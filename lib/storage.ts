import { Storage } from "@plasmohq/storage"
import type { AuditEntry, RiskAssessment } from "./types"
import { AUDIT_LOG_MAX_ENTRIES, ASSESSMENT_CACHE_TTL } from "./constants"

const storage = new Storage({ area: "local" })

const KEYS = {
  AUDIT_LOG: "audit_log",
  CONTRACT_HISTORY: "contract_history",
  KNOWN_ADDRESSES: "known_addresses",
  TRUSTED_SITES: "trusted_sites",
  ASSESSMENT_CACHE: "assessment_cache",
  ONBOARDED: "onboarded",
} as const

// ─── 稽核紀錄 ───
export async function getAuditLog(): Promise<AuditEntry[]> {
  const raw = await storage.get<AuditEntry[]>(KEYS.AUDIT_LOG)
  return raw ?? []
}

export async function addAuditEntry(entry: AuditEntry): Promise<void> {
  const log = await getAuditLog()
  log.unshift(entry)
  if (log.length > AUDIT_LOG_MAX_ENTRIES) log.length = AUDIT_LOG_MAX_ENTRIES
  await storage.set(KEYS.AUDIT_LOG, log)
}

export async function clearAuditLog(): Promise<void> {
  await storage.set(KEYS.AUDIT_LOG, [])
}

// ─── 域名-合約對應 ───
type ContractHistory = Record<string, { firstSeen: number; lastSeen: number }>

export async function getContractHistory(): Promise<ContractHistory> {
  const raw = await storage.get<ContractHistory>(KEYS.CONTRACT_HISTORY)
  return raw ?? {}
}

export async function recordContractInteraction(domain: string, contractAddress: string): Promise<void> {
  const history = await getContractHistory()
  const key = `${domain}:${contractAddress.toLowerCase()}`
  const now = Date.now()
  history[key] = { firstSeen: history[key]?.firstSeen ?? now, lastSeen: now }
  await storage.set(KEYS.CONTRACT_HISTORY, history)
}

// ─── 已知地址 ───
export async function getKnownAddresses(): Promise<string[]> {
  const raw = await storage.get<string[]>(KEYS.KNOWN_ADDRESSES)
  return raw ?? []
}

export async function addKnownAddress(address: string): Promise<void> {
  const addrs = await getKnownAddresses()
  const normalized = address.toLowerCase()
  if (!addrs.includes(normalized)) {
    addrs.push(normalized)
    if (addrs.length > 200) addrs.shift()
    await storage.set(KEYS.KNOWN_ADDRESSES, addrs)
  }
}

// ─── 信任網站（白名單）───
export async function getTrustedSites(): Promise<string[]> {
  const raw = await storage.get<string[]>(KEYS.TRUSTED_SITES)
  return raw ?? []
}

export async function addTrustedSite(domain: string): Promise<void> {
  const sites = await getTrustedSites()
  if (!sites.includes(domain)) {
    sites.push(domain)
    await storage.set(KEYS.TRUSTED_SITES, sites)
  }
}

export async function removeTrustedSite(domain: string): Promise<void> {
  const sites = await getTrustedSites()
  await storage.set(KEYS.TRUSTED_SITES, sites.filter((s) => s !== domain))
}

// ─── 分析結果快取 ───
interface CachedAssessment {
  assessment: RiskAssessment
  timestamp: number
}

export async function getAssessmentCache(key: string): Promise<RiskAssessment | null> {
  const raw = await storage.get<Record<string, CachedAssessment>>(KEYS.ASSESSMENT_CACHE)
  if (!raw) return null
  const cached = raw[key]
  if (!cached) return null
  if (Date.now() - cached.timestamp > ASSESSMENT_CACHE_TTL) {
    delete raw[key]
    await storage.set(KEYS.ASSESSMENT_CACHE, raw)
    return null
  }
  return cached.assessment
}

export async function setAssessmentCache(key: string, assessment: RiskAssessment): Promise<void> {
  const raw = (await storage.get<Record<string, CachedAssessment>>(KEYS.ASSESSMENT_CACHE)) ?? {}
  raw[key] = { assessment, timestamp: Date.now() }
  const keys = Object.keys(raw)
  if (keys.length > 100) {
    keys.sort((a, b) => (raw[a].timestamp - raw[b].timestamp))
    for (const oldKey of keys.slice(0, keys.length - 100)) delete raw[oldKey]
  }
  await storage.set(KEYS.ASSESSMENT_CACHE, raw)
}

// ─── 首次使用導覽 ───
export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await storage.get<boolean>(KEYS.ONBOARDED)) ?? false
}

export async function completeOnboarding(): Promise<void> {
  await storage.set(KEYS.ONBOARDED, true)
}
