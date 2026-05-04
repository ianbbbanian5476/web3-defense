import type { ContractSecurity } from "../types"

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1"

const CHAIN_ID_MAP: Record<string, string> = {
  "0x1": "1",
  "1": "1",
  "0x38": "56",
  "56": "56",
  "0x89": "137",
  "137": "137",
  "0xa4b1": "42161",
  "42161": "42161",
  "0xa": "10",
  "10": "10",
  "0x2105": "8453",
  "8453": "8453",
  "0xa86a": "43114",
  "43114": "43114",
}

export async function fetchContractSecurity(
  contractAddress: string,
  chainId: string
): Promise<ContractSecurity | null> {
  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    return null
  }

  const numericChainId = CHAIN_ID_MAP[chainId] ?? "1"

  try {
    const url = `${GOPLUS_BASE}/token_security/${numericChainId}?contract_addresses=${contractAddress.toLowerCase()}`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })

    if (!resp.ok) return null

    const data = (await resp.json()) as {
      code: number
      result: Record<string, Record<string, unknown>>
    }

    if (data.code !== 1) return null

    const addrData = data.result[contractAddress.toLowerCase()]
    if (!addrData) return null

    return {
      isOpenSource: addrData.is_open_source === "1",
      isProxy: addrData.is_proxy === "1",
      isHoneypot: addrData.is_honeypot === "1",
      canTakeBackOwnership: addrData.can_take_back_ownership === "1",
      hiddenOwner: addrData.hidden_owner === "1",
      transferPausable: addrData.transfer_pausable === "1",
      cannotBuy: addrData.cannot_buy === "1",
      cannotSellAll: addrData.cannot_sell_all === "1",
      slippageModifiable: addrData.slippage_modifiable === "1",
      isBlacklisted: addrData.is_blacklisted === "1",
      buyTax: String(addrData.buy_tax ?? "0"),
      sellTax: String(addrData.sell_tax ?? "0"),
      dexCount: Array.isArray(addrData.dex) ? (addrData.dex as unknown[]).length : 0,
    }
  } catch {
    return null
  }
}
