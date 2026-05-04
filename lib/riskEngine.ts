import type {
  RiskFactor,
  RiskAssessment,
  ParsedTransaction,
  ApproveDetails,
  SwapDetails,
  TransferDetails,
  ContractSecurity,
  SanctionsResult,
  SimulationResult,
} from "./types"
import { runHeuristics } from "./heuristics"
import { RISK_THRESHOLDS } from "./constants"

const SEVERITY_WEIGHTS: Record<RiskFactor["severity"], number> = {
  NONE: 0,
  LOW: 5,
  MEDIUM: 15,
  HIGH: 40,
  CRITICAL: 75,
}

const CATEGORY_BOOST: Record<RiskFactor["category"], number> = {
  APPROVAL: 1.5,
  ADDRESS: 1.2,
  SIGNATURE: 1.3,
  CONTRACT: 1.1,
  TRANSACTION: 1.0,
}

const SOURCE_BOOST: Record<RiskFactor["source"], number> = {
  HEURISTIC: 1.0,
  GOPLUS: 1.15,
  TENDERLY: 1.2,
  CHAINALYSIS: 1.3,
}

function computeScore(factors: RiskFactor[]): number {
  if (factors.length === 0) return 0
  let score = 0
  for (const factor of factors) {
    score += SEVERITY_WEIGHTS[factor.severity] * (CATEGORY_BOOST[factor.category] ?? 1.0) * (SOURCE_BOOST[factor.source] ?? 1.0)
  }
  return Math.min(100, Math.round(score))
}

function computeOverallSeverity(score: number): RiskAssessment["severity"] {
  if (score >= RISK_THRESHOLDS.CRITICAL_RISK_SCORE) return "CRITICAL"
  if (score >= RISK_THRESHOLDS.HIGH_RISK_SCORE) return "HIGH"
  if (score >= 40) return "MEDIUM"
  if (score >= 15) return "LOW"
  return "NONE"
}

export async function assessRisk(
  parsed: ParsedTransaction,
  approveDetails: ApproveDetails | null,
  swapDetails: SwapDetails | null,
  transferDetails: TransferDetails | null,
  hostname: string,
  chainId: string,
  simulation: SimulationResult | null,
): Promise<RiskAssessment> {
  const { factors, contractSecurity, sanctions } = await runHeuristics(
    parsed,
    approveDetails,
    swapDetails,
    transferDetails,
    hostname,
    chainId,
  )

  // Add simulation-based risk factors if simulation ran
  if (simulation) {
    if (!simulation.success && simulation.errorMessage) {
      factors.push({
        name: "Simulation Failed (Tenderly)",
        severity: "HIGH",
        description: `Transaction simulation failed: ${simulation.errorMessage}. This transaction will likely revert.`,
        category: "TRANSACTION",
        source: "TENDERLY",
      })
    }

    const totalOutflow = simulation.assetChanges
      .filter((ac) => ac.direction === "out")
      .reduce((sum, ac) => sum + (parseFloat(ac.dollarValue) || 0), 0)

    const totalInflow = simulation.assetChanges
      .filter((ac) => ac.direction === "in")
      .reduce((sum, ac) => sum + (parseFloat(ac.dollarValue) || 0), 0)

    if (totalOutflow > 0 && totalInflow === 0) {
      factors.push({
        name: "Total Asset Drain (Tenderly)",
        severity: "CRITICAL",
        description: `Simulation shows $${totalOutflow.toFixed(2)} flowing out with $0 in return. This transaction will drain your assets.`,
        category: "TRANSACTION",
        source: "TENDERLY",
      })
    }

    if (totalOutflow > 1000 && totalInflow < totalOutflow * 0.5) {
      factors.push({
        name: "Suspicious Value Discrepancy (Tenderly)",
        severity: "HIGH",
        description: `Simulation shows $${totalOutflow.toFixed(2)} out vs $${totalInflow.toFixed(2)} in. You are losing significant value.`,
        category: "TRANSACTION",
        source: "TENDERLY",
      })
    }
  }

  const riskScore = computeScore(factors)
  const severity = computeOverallSeverity(riskScore)

  return {
    riskScore,
    severity,
    factors,
    parsed,
    approveDetails,
    swapDetails,
    transferDetails,
    simulation,
    contractSecurity,
    sanctions,
  }
}
