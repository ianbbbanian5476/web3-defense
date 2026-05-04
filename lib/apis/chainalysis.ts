import type { SanctionsResult } from "../types"
import { Storage } from "@plasmohq/storage"
import { API_KEYS } from "../types"

const storage = new Storage({ area: "local" })
const CHAINALYSIS_BASE = "https://public.chainalysis.com/api/v1"

export async function checkSanctions(address: string): Promise<SanctionsResult | null> {
  const apiKey = await storage.get<string>(API_KEYS.CHAINALYSIS_KEY)
  if (!apiKey) return null
  if (!address || address === "0x0000000000000000000000000000000000000000") return null

  try {
    const resp = await fetch(`${CHAINALYSIS_BASE}/address/${address}`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(5000),
    })

    if (!resp.ok) return null

    const data = (await resp.json()) as {
      identifications?: Array<{
        category?: string
        name?: string
        description?: string
        url?: string
      }>
    }

    const matches = (data.identifications ?? [])
      .filter((id) => id.category === "sanctions")
      .map((id) => ({
        category: id.category ?? "sanctions",
        name: id.name ?? "Sanctioned Entity",
        description: id.description ?? "",
        url: id.url ?? "",
      }))

    return {
      isSanctioned: matches.length > 0,
      matches,
    }
  } catch {
    return null
  }
}
