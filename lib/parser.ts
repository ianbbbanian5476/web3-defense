import type { IntentType, ParsedTransaction, ApproveDetails, SwapDetails, TransferDetails } from "./types"
import { FUNCTION_SELECTORS, MAX_UINT256, RISK_THRESHOLDS } from "./constants"
import { getTokenMeta } from "./apis/rpc"

const FOURBYTE_API = "https://www.4byte.directory/api/v1/signatures/"

interface FourByteResult {
  results: Array<{ text_signature: string; hex_signature: string }>
}

export interface ParseResult {
  parsed: ParsedTransaction
  approveDetails: ApproveDetails | null
  swapDetails: SwapDetails | null
  transferDetails: TransferDetails | null
}

function extractSelector(data: string): string {
  if (!data || data === "0x") return ""
  return data.slice(0, 10)
}

function hexSlice(data: string, offset: number, length: number): string {
  return "0x" + data.slice(2 + offset * 2, 2 + (offset + length) * 2)
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x") return 0n
  try {
    return BigInt(hex)
  } catch {
    return 0n
  }
}

function padAddress(hex: string): string {
  if (!hex) return "0x0000000000000000000000000000000000000000"
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex
  return "0x" + stripped.padStart(64, "0")
}

function extractAddressFromHex(slot: string): string {
  if (!slot || slot.length < 26) return "0x0000000000000000000000000000000000000000"
  return "0x" + slot.slice(slot.length - 40)
}

function parseApproveDetails(data: string, from: string): ApproveDetails | null {
  const spenderHex = hexSlice(data, 4, 32)
  const amountHex = hexSlice(data, 36, 32)
  const spender = extractAddressFromHex(spenderHex)
  const amount = hexToBigInt(amountHex)

  return {
    spender,
    amount: amount.toString(),
    isInfinite: amount === MAX_UINT256 || amount === 0n,
    tokenAddress: data ? "" : from,
    tokenSymbol: "",
    usdValue: "",
  }
}

function parseTransferDetails(data: string): TransferDetails | null {
  const recipientHex = hexSlice(data, 4, 32)
  const amountHex = hexSlice(data, 36, 32)
  const recipient = extractAddressFromHex(recipientHex)
  const amount = hexToBigInt(amountHex)

  return {
    recipient,
    amount: amount.toString(),
    isZeroValue: amount === 0n,
    tokenSymbol: "",
    usdValue: "",
  }
}

function parseSwapDetails(data: string, selector: string): SwapDetails | null {
  try {
    // swapExactETHForTokens: amountOutMin at offset 4, deadline at offset 100
    // swapExactTokensForTokens: amountIn at offset 4, amountOutMin at offset 36, deadline at offset 132
    if (selector === "0x7ff36ab5" || selector === "0xfb3bdb41") {
      // swapExactETHForTokens / swapETHForExactTokens: (uint256 amt, address[] path, address to, uint256 deadline)
      const amountOutMinHex = hexSlice(data, 4, 32)
      const deadlineHex = hexSlice(data, 100, 32)
      const deadline = Number(hexToBigInt(deadlineHex))
      const amountOutMin = hexToBigInt(amountOutMinHex)
      return {
        tokenIn: "", tokenOut: "", tokenInSymbol: "", tokenOutSymbol: "",
        amountIn: "0", amountOutMin: amountOutMin.toString(),
        amountInUsd: "", amountOutUsd: "",
        deadline,
        isHighSlippage: amountOutMin === 0n,
      }
    }

    // Generic swap (token->token): (uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline)
    const amountInHex = hexSlice(data, 4, 32)
    const amountOutMinHex = hexSlice(data, 36, 32)
    const deadlineHex = hexSlice(data, 132, 32)
    const deadline = Number(hexToBigInt(deadlineHex))
    const amountOutMin = hexToBigInt(amountOutMinHex)

    const isHighSlippage =
      amountOutMin === 0n ||
      (amountOutMin > 0n && amountOutMin < hexToBigInt(amountInHex) / 10n)

    return {
      tokenIn: "",
      tokenOut: "",
      tokenInSymbol: "",
      tokenOutSymbol: "",
      amountIn: amountInHex,
      amountOutMin: amountOutMin.toString(),
      amountInUsd: "",
      amountOutUsd: "",
      deadline,
      isHighSlippage,
    }
  } catch {
    return null
  }
}

async function lookupFourByte(selector: string): Promise<string | null> {
  try {
    const resp = await fetch(`${FOURBYTE_API}?hex_signature=${selector}`)
    if (!resp.ok) return null
    const data = (await resp.json()) as FourByteResult
    if (data.results && data.results.length > 0) {
      return data.results[0].text_signature
    }
    return null
  } catch {
    return null
  }
}

function classifyMethod(method: string): IntentType {
  switch (method) {
    case "eth_sign":
      return "SIGN"
    case "personal_sign":
      return "PERSONAL_SIGN"
    case "eth_signTypedData":
    case "eth_signTypedData_v1":
    case "eth_signTypedData_v3":
    case "eth_signTypedData_v4":
      return "SIGN_TYPED_DATA"
    case "eth_sendTransaction":
      return "SEND_TRANSACTION"
    case "wallet_sendCalls":
      return "WALLET_SEND_CALLS"
    default:
      return "UNKNOWN"
  }
}

export async function parseTransaction(
  method: string,
  params: Record<string, unknown>,
  chainId: string
): Promise<ParseResult> {
  const baseIntent = classifyMethod(method)
  const from = (params.from as string) ?? "0x0000000000000000000000000000000000000000"
  const to = (params.to as string) ?? "0x0000000000000000000000000000000000000000"
  const data = (params.data as string) ?? "0x"
  const value = (params.value as string) ?? "0x0"
  const gas = (params.gas as string) ?? "0x0"

  let intent: IntentType = baseIntent
  let functionName = ""
  let approveDetails: ApproveDetails | null = null
  let swapDetails: SwapDetails | null = null
  let transferDetails: TransferDetails | null = null

  if (data && data !== "0x" && data.length >= 10) {
    const selector = extractSelector(data)
    const known = FUNCTION_SELECTORS[selector]

    if (known) {
      intent = known.intent
      functionName = known.name
    } else {
      functionName = (await lookupFourByte(selector)) ?? "unknown"
      if (functionName.toLowerCase().includes("approve")) {
        intent = "APPROVE"
      } else if (functionName.toLowerCase().includes("transfer")) {
        intent = "TRANSFER"
      } else if (functionName.toLowerCase().includes("swap")) {
        intent = "SWAP"
      } else if (functionName.toLowerCase().includes("mint")) {
        intent = "MINT"
      }
    }

    switch (intent) {
      case "APPROVE":
        approveDetails = parseApproveDetails(data, from)
        break
      case "TRANSFER":
        transferDetails = parseTransferDetails(data)
        break
      case "SWAP":
        swapDetails = parseSwapDetails(data, selector)
        break
    }
  }

  const parsed: ParsedTransaction = {
    intent,
    functionName,
    from,
    to,
    value,
    data,
    gas,
    decodedArgs: { from, to, value, data, gas },
  }

  // 鏈上查詢代幣名稱（非同步，不阻塞主流程）
  enrichTokenNames(chainId, parsed.to, approveDetails, swapDetails, transferDetails)

  return { parsed, approveDetails, swapDetails, transferDetails }
}

// 在背景查詢代幣名稱，填充到 details 中
async function enrichTokenNames(
  chainId: string,
  contractAddress: string,
  approveDetails: ApproveDetails | null,
  swapDetails: SwapDetails | null,
  transferDetails: TransferDetails | null,
) {
  const meta = await getTokenMeta(chainId, contractAddress)
  if (!meta) return

  if (approveDetails && !approveDetails.tokenSymbol) {
    approveDetails.tokenSymbol = meta.symbol
    approveDetails.tokenAddress = contractAddress
  }
  if (transferDetails && !transferDetails.tokenSymbol) {
    transferDetails.tokenSymbol = meta.symbol
  }
  if (swapDetails) {
    if (!swapDetails.tokenOutSymbol) swapDetails.tokenOutSymbol = meta.symbol
  }
}
