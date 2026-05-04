import { KNOWN_TOKENS } from "../constants"

const RPC_URLS: Record<string, string> = {
  "1": "https://eth.llamarpc.com",
  "0x1": "https://eth.llamarpc.com",
  "56": "https://bsc-dataseed.binance.org",
  "0x38": "https://bsc-dataseed.binance.org",
  "137": "https://polygon-rpc.com",
  "0x89": "https://polygon-rpc.com",
  "42161": "https://arb1.arbitrum.io/rpc",
  "0xa4b1": "https://arb1.arbitrum.io/rpc",
  "10": "https://mainnet.optimism.io",
  "0xa": "https://mainnet.optimism.io",
  "8453": "https://mainnet.base.org",
  "0x2105": "https://mainnet.base.org",
}

const ERC20_ABI = {
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  name: "0x06fdde03",
}

interface TokenMeta {
  symbol: string
  decimals: number
}

const tokenCache = new Map<string, TokenMeta>()

function getRpcUrl(chainId: string): string {
  return RPC_URLS[chainId] ?? RPC_URLS["0x1"]
}

function encodeCall(to: string, data: string): string {
  return data + "000000000000000000000000" + to.slice(2)
}

async function callRPC(chainId: string, to: string, data: string, blockTag = "latest"): Promise<string | null> {
  const rpcUrl = getRpcUrl(chainId)
  try {
    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, blockTag],
      }),
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as { result?: string; error?: unknown }
    return json.result ?? null
  } catch {
    return null
  }
}

export async function getTokenMeta(chainId: string, tokenAddress: string): Promise<TokenMeta | null> {
  if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") return null

  const addr = tokenAddress.toLowerCase()
  const cacheKey = `${chainId}:${addr}`

  // 1. 先查本地快取
  const cached = tokenCache.get(cacheKey)
  if (cached) return cached

  // 2. 再查已知代幣表
  const known = KNOWN_TOKENS[addr]
  if (known) {
    tokenCache.set(cacheKey, known)
    return known
  }

  // 3. 鏈上查詢
  try {
    const [symbolHex, decimalsHex] = await Promise.all([
      callRPC(chainId, tokenAddress, ERC20_ABI.symbol),
      callRPC(chainId, tokenAddress, ERC20_ABI.decimals),
    ])

    let symbol = ""
    if (symbolHex && symbolHex !== "0x") {
      try {
        const stripped = symbolHex.slice(2)
        const bytes = new Uint8Array(stripped.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
        symbol = new TextDecoder().decode(bytes).replace(/\0/g, "").trim()
      } catch {
        symbol = ""
      }
    }

    let decimals = 18
    if (decimalsHex && decimalsHex !== "0x") {
      decimals = parseInt(decimalsHex, 16)
      if (isNaN(decimals)) decimals = 18
    }

    if (symbol) {
      const meta: TokenMeta = { symbol, decimals }
      tokenCache.set(cacheKey, meta)
      return meta
    }
  } catch {
    // ignore
  }

  return null
}

export function formatTokenAmount(amount: string, decimals: number, symbol?: string): string {
  try {
    const val = BigInt(amount)
    const divisor = BigInt(10) ** BigInt(decimals)
    const whole = val / divisor
    const remainder = val % divisor
    const fracStr = remainder.toString().padStart(decimals, "0").slice(0, 4)
    const formatted = `${whole}.${fracStr}`
    return symbol ? `${formatted} ${symbol}` : formatted
  } catch {
    return amount
  }
}
