// --- Transaction request intercepted from window.ethereum ---
export interface InterceptedRequest {
  id: string
  method: string
  params: unknown[]
  chainId: string
  hostname: string
  timestamp: number
}

// --- Parsed transaction intent ---
export type IntentType =
  | "APPROVE"
  | "TRANSFER"
  | "SWAP"
  | "MINT"
  | "SIGN"
  | "SIGN_TYPED_DATA"
  | "PERSONAL_SIGN"
  | "SEND_TRANSACTION"
  | "WALLET_SEND_CALLS"
  | "UNKNOWN"

export interface ParsedTransaction {
  intent: IntentType
  functionName: string
  from: string
  to: string
  value: string
  data: string
  gas: string
  decodedArgs: Record<string, unknown>
}

export interface ApproveDetails {
  spender: string
  amount: string
  isInfinite: boolean
  tokenAddress: string
  tokenSymbol: string
  usdValue: string
}

export interface SwapDetails {
  tokenIn: string
  tokenOut: string
  tokenInSymbol: string
  tokenOutSymbol: string
  amountIn: string
  amountOutMin: string
  amountInUsd: string
  amountOutUsd: string
  deadline: number
  isHighSlippage: boolean
}

export interface TransferDetails {
  recipient: string
  amount: string
  isZeroValue: boolean
  tokenSymbol: string
  usdValue: string
}

export interface ContractSecurity {
  isOpenSource: boolean
  isProxy: boolean
  isHoneypot: boolean
  canTakeBackOwnership: boolean
  hiddenOwner: boolean
  transferPausable: boolean
  cannotBuy: boolean
  cannotSellAll: boolean
  slippageModifiable: boolean
  isBlacklisted: boolean
  buyTax: string
  sellTax: string
  dexCount: number
}

export interface SimulationAssetChange {
  from: string
  to: string
  tokenAddress: string
  tokenSymbol: string
  amount: string
  dollarValue: string
  direction: "in" | "out"
}

export interface SimulationResult {
  success: boolean
  gasUsed: string
  assetChanges: SimulationAssetChange[]
  netUsdChange: string
  errorMessage: string | null
}

export interface SanctionsResult {
  isSanctioned: boolean
  matches: Array<{
    category: string
    name: string
    description: string
    url: string
  }>
}

export interface RiskFactor {
  name: string
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  description: string
  category: "APPROVAL" | "ADDRESS" | "SIGNATURE" | "CONTRACT" | "TRANSACTION"
  source: "HEURISTIC" | "GOPLUS" | "TENDERLY" | "CHAINALYSIS"
}

export interface RiskAssessment {
  riskScore: number
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  factors: RiskFactor[]
  parsed: ParsedTransaction
  approveDetails: ApproveDetails | null
  swapDetails: SwapDetails | null
  transferDetails: TransferDetails | null
  simulation: SimulationResult | null
  contractSecurity: ContractSecurity | null
  sanctions: SanctionsResult | null
}

export type InterceptorDecision =
  | { action: "ALLOW" }
  | { action: "BLOCK"; assessment: RiskAssessment }
  | { action: "TIMEOUT" }

export interface AuditEntry {
  id: string
  timestamp: number
  hostname: string
  chainId: string
  method: string
  intent: IntentType
  decision: "ALLOW" | "BLOCK" | "USER_OVERRIDE"
  riskScore: number
  to: string
  contractName: string
}

export const INTERNAL_EVENT = "WEB3_DEFENSE_INTERNAL"
export const DISPATCH_REQUEST = "WEB3_DEFENSE_DISPATCH_REQUEST"
export const DISPATCH_RESPONSE = "WEB3_DEFENSE_DISPATCH_RESPONSE"

export const WS_MESSAGE = {
  ANALYZE_TRANSACTION: "ANALYZE_TRANSACTION",
  GET_AUDIT_LOG: "GET_AUDIT_LOG",
  CLEAR_AUDIT_LOG: "CLEAR_AUDIT_LOG",
  GET_STATS: "GET_STATS",
  USER_DECISION: "USER_DECISION",
} as const

export const API_KEYS = {
  TENDERLY_USER: "api_key_tenderly_user",
  TENDERLY_PROJECT: "api_key_tenderly_project",
  TENDERLY_ACCESS_KEY: "api_key_tenderly_access",
  CHAINALYSIS_KEY: "api_key_chainalysis",
} as const
