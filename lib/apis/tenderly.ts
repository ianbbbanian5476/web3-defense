import type { SimulationResult, SimulationAssetChange } from "../types"
import { EMBEDDED_KEYS } from "../constants"

const NETWORK_ID_MAP: Record<string, string> = {
  "0x1": "1", "1": "1",
  "0x38": "56", "56": "56",
  "0x89": "137", "137": "137",
  "0xa4b1": "42161", "42161": "42161",
  "0xa": "10", "10": "10",
  "0x2105": "8453", "8453": "8453",
}

export async function simulateTransaction(params: {
  from: string
  to: string
  data: string
  value: string
  gas: string
  chainId: string
}): Promise<SimulationResult | null> {
  const user = EMBEDDED_KEYS.TENDERLY_USER
  const project = EMBEDDED_KEYS.TENDERLY_PROJECT
  const accessKey = EMBEDDED_KEYS.TENDERLY_ACCESS_KEY

  const networkId = NETWORK_ID_MAP[params.chainId] ?? "1"

  try {
    const url = `https://api.tenderly.co/api/v1/account/${user}/project/${project}/simulate`
    const body = {
      network_id: networkId,
      from: params.from,
      to: params.to || undefined,
      input: params.data || "0x",
      gas: Number(params.gas) || 8000000,
      gas_price: "0",
      value: params.value || "0",
      save_if_fails: true,
      simulation_type: "full",
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": accessKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })

    if (!resp.ok) return null

    const result = (await resp.json()) as {
      simulation?: { status: boolean; gas_used: number }
      transaction?: {
        transaction_info?: {
          asset_changes?: Array<{
            asset_type: string
            from: string
            to: string
            amount: string
            dollar_value: string
            token_info?: { symbol: string }
          }>
          call_trace?: { error?: string }
        }
      }
    }

    const sim = result.simulation
    const txInfo = result.transaction?.transaction_info

    const assetChanges: SimulationAssetChange[] =
      txInfo?.asset_changes?.map((ac) => ({
        from: ac.from,
        to: ac.to,
        tokenAddress: "",
        tokenSymbol: ac.token_info?.symbol ?? ac.asset_type,
        amount: ac.amount,
        dollarValue: ac.dollar_value,
        direction: ac.dollar_value.startsWith("-") ? "out" : "in",
      })) ?? []

    const netUsdChange = assetChanges
      .reduce((sum, ac) => sum + (parseFloat(ac.dollarValue) || 0), 0)
      .toFixed(2)

    return {
      success: sim?.status ?? false,
      gasUsed: String(sim?.gas_used ?? 0),
      assetChanges,
      netUsdChange,
      errorMessage: txInfo?.call_trace?.error ?? null,
    }
  } catch {
    return null
  }
}
