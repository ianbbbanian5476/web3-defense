import { useEffect, useState } from "react"
import type { RiskAssessment, AuditEntry } from "~lib/types"
import { getAuditLog, hasCompletedOnboarding, completeOnboarding } from "~lib/storage"
import "~style.css"

const severityLabel: Record<string, string> = {
  NONE: "安全",
  LOW: "低風險",
  MEDIUM: "中風險",
  HIGH: "高風險",
  CRITICAL: "極度危險",
}

const severityColor: Record<string, string> = {
  NONE: "bg-risk-none",
  LOW: "bg-risk-low",
  MEDIUM: "bg-risk-medium",
  HIGH: "bg-risk-high",
  CRITICAL: "bg-risk-critical",
}

const severityTextColor: Record<string, string> = {
  NONE: "text-green-400",
  LOW: "text-yellow-400",
  MEDIUM: "text-orange-400",
  HIGH: "text-red-400",
  CRITICAL: "text-purple-400",
}

const severityEmoji: Record<string, string> = {
  NONE: "🟢",
  LOW: "🟡",
  MEDIUM: "🟠",
  HIGH: "🔴",
  CRITICAL: "⛔",
}

function RiskBadge({ severity, score }: { severity: string; score: number }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${severityColor[severity]} bg-opacity-20 border`}>
      <span className="text-lg">{severityEmoji[severity]}</span>
      <span className={`font-bold text-sm ${severityTextColor[severity]}`}>
        {severityLabel[severity]} · {score} 分
      </span>
    </div>
  )
}

function SimulationPreview({ assessment }: { assessment: RiskAssessment }) {
  const { simulation } = assessment
  if (!simulation || simulation.assetChanges.length === 0) return null

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-blue-400">交易模擬結果</h3>
        {simulation.success ? (
          <span className="text-xs text-green-400">模擬成功</span>
        ) : (
          <span className="text-xs text-red-400">模擬失敗</span>
        )}
      </div>

      {simulation.assetChanges.map((ac, i) => (
        <div key={i} className={`flex items-center justify-between text-sm p-2 rounded ${ac.direction === "out" ? "bg-red-900/20" : "bg-green-900/20"}`}>
          <div className="flex items-center gap-2">
            <span className={ac.direction === "out" ? "text-red-400" : "text-green-400"}>
              {ac.direction === "out" ? "→" : "←"}
            </span>
            <span className="text-gray-200">
              {ac.amount} <span className="text-gray-400">{ac.tokenSymbol}</span>
            </span>
          </div>
          <span className={`font-mono text-xs ${ac.direction === "out" ? "text-red-400" : "text-green-400"}`}>
            {ac.direction === "out" ? "-" : "+"}${ac.dollarValue}
          </span>
        </div>
      ))}

      <div className="border-t border-gray-800 pt-2 flex justify-between text-sm">
        <span className="text-gray-400">預估資產變化</span>
        <span className={`font-bold ${simulation.netUsdChange.startsWith("-") ? "text-red-400" : "text-green-400"}`}>
          ${simulation.netUsdChange}
        </span>
      </div>

      {simulation.errorMessage && (
        <div className="bg-red-900/30 border border-red-800/50 rounded p-2 text-xs text-red-300">
          這筆交易很可能會失敗：{simulation.errorMessage}
        </div>
      )}
    </div>
  )
}

function ContractSecurityView({ contractSecurity }: { contractSecurity: NonNullable<RiskAssessment["contractSecurity"]> }) {
  const items = [
    { label: "程式碼是否公開", value: contractSecurity.isOpenSource, detail: contractSecurity.isOpenSource ? "是（可被外界檢驗）" : "否（無法確認安全性）", good: contractSecurity.isOpenSource },
    { label: "是否可被修改", value: contractSecurity.isProxy, detail: contractSecurity.isProxy ? "是（規則隨時可能改變）" : "否", good: !contractSecurity.isProxy },
    { label: "資金陷阱", value: contractSecurity.isHoneypot, detail: contractSecurity.isHoneypot ? "是（買了可能賣不掉）" : "否", good: !contractSecurity.isHoneypot },
    { label: "發行者可否收回", value: contractSecurity.canTakeBackOwnership, detail: contractSecurity.canTakeBackOwnership ? "是（你的幣可能被收回）" : "否", good: !contractSecurity.canTakeBackOwnership },
    { label: "是否可凍結轉帳", value: contractSecurity.transferPausable, detail: contractSecurity.transferPausable ? "是（你的資產可能被鎖住）" : "否", good: !contractSecurity.transferPausable },
    { label: "買入手續費", value: `${contractSecurity.buyTax}%`, detail: parseFloat(contractSecurity.buyTax) > 10 ? "過高（買入即虧）" : "", good: parseFloat(contractSecurity.buyTax) <= 10 },
    { label: "賣出手續費", value: `${contractSecurity.sellTax}%`, detail: parseFloat(contractSecurity.sellTax) > 10 ? "過高（賣出即虧）" : "", good: parseFloat(contractSecurity.sellTax) <= 10 },
    { label: "交易所上架數", value: String(contractSecurity.dexCount), detail: contractSecurity.dexCount < 2 ? "太少（流動性不足）" : "正常", good: contractSecurity.dexCount >= 2 },
    { label: "是否被列黑名單", value: contractSecurity.isBlacklisted ? "是" : "否", detail: contractSecurity.isBlacklisted ? "已被安全機構列入黑名單" : "", good: !contractSecurity.isBlacklisted },
  ]

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-2">
      <h3 className="text-xs font-semibold text-purple-400">合約安全報告</h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs">
            <span className={item.good ? "text-green-400 mt-0.5" : "text-red-400 mt-0.5"}>
              {item.good ? "✓" : "✗"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300">{item.label}</span>
                <span className={item.good ? "text-green-400" : "text-red-400"}>{item.value}</span>
              </div>
              {item.detail && (
                <div className={item.good ? "text-gray-500" : "text-red-300/70"}>{item.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SanctionsWarning({ sanctions }: { sanctions: NonNullable<RiskAssessment["sanctions"]> }) {
  if (!sanctions.isSanctioned) return null

  return (
    <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4">
      <div className="text-purple-400 font-bold text-sm mb-2">⚠️ 制裁名單地址</div>
      <div className="text-xs text-purple-300">
        此地址被列入國際制裁名單，與其交易可能違法。
      </div>
    </div>
  )
}

function AssetFlowPreview({ assessment }: { assessment: RiskAssessment }) {
  const { parsed, approveDetails, swapDetails, transferDetails } = assessment

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-400">交易內容</h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500">交易類型</div>
        <div className="text-gray-200 font-mono">
          {parsed.intent === "APPROVE" ? "授權" :
           parsed.intent === "TRANSFER" ? "轉帳" :
           parsed.intent === "SWAP" ? "兌換" :
           parsed.intent === "MINT" ? "鑄造" :
           parsed.intent === "SIGN" ? "簽署" : "未知操作"}
        </div>

        <div className="text-gray-500">你的錢包</div>
        <div className="text-gray-200 font-mono text-xs">{parsed.from.slice(0, 10)}...{parsed.from.slice(-4)}</div>

        <div className="text-gray-500">目標合約</div>
        <div className="text-gray-200 font-mono text-xs">{parsed.to.slice(0, 10)}...{parsed.to.slice(-4)}</div>

        {parsed.value !== "0x0" && parsed.value !== "0" && (
          <>
            <div className="text-gray-500">金額</div>
            <div className="text-yellow-300 font-mono text-xs">{(Number(BigInt(parsed.value)) / 1e18).toFixed(4)} ETH</div>
          </>
        )}
      </div>

      {approveDetails && (
        <div className="bg-red-900/30 border border-red-800/50 rounded p-3 mt-2">
          <div className="text-red-400 font-semibold text-sm mb-1">
            授權詳情
            {approveDetails.tokenSymbol && <span className="text-red-300 ml-1">({approveDetails.tokenSymbol})</span>}
            {approveDetails.usdValue && <span className="text-red-300 ml-1">約 $ {approveDetails.usdValue}</span>}
          </div>
          <div className="text-xs text-red-300 space-y-1">
            <div>授權對象：<span className="font-mono">{approveDetails.spender.slice(0, 12)}...{approveDetails.spender.slice(-4)}</span></div>
            <div>
              授權額度：{" "}
              <span className={`font-mono ${approveDetails.isInfinite ? "font-bold text-base" : ""}`}>
                {approveDetails.isInfinite ? "⚠️ 無上限（你的資產可能被全部搬走）" : approveDetails.amount}
              </span>
            </div>
          </div>
        </div>
      )}

      {transferDetails && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded p-3 mt-2">
          <div className="text-blue-400 font-semibold text-sm mb-1">
            轉帳詳情
            {transferDetails.tokenSymbol && <span className="text-blue-300 ml-1">({transferDetails.tokenSymbol})</span>}
            {transferDetails.usdValue && <span className="text-blue-300 ml-1">約 $ {transferDetails.usdValue}</span>}
          </div>
          <div className="text-xs text-blue-300 space-y-1">
            <div>收款方：<span className="font-mono">{transferDetails.recipient.slice(0, 12)}...{transferDetails.recipient.slice(-4)}</span></div>
            <div>數量：<span className="font-mono">{transferDetails.amount}</span></div>
            {transferDetails.isZeroValue && (
              <div className="text-yellow-400 font-bold mt-1 p-1.5 rounded bg-yellow-900/30">
                注意！這是零元轉帳——常見的詐騙手法，目的是在你的交易紀錄中留下一個「長得很像」的地址，讓你下次複製地址時轉錯錢。
              </div>
            )}
          </div>
        </div>
      )}

      {swapDetails && (
        <div className="bg-purple-900/30 border border-purple-800/50 rounded p-3 mt-2">
          <div className="text-purple-400 font-semibold text-sm mb-1">
            兌換詳情
            {swapDetails.tokenInSymbol && swapDetails.tokenOutSymbol && (
              <span className="text-purple-300">（{swapDetails.tokenInSymbol} → {swapDetails.tokenOutSymbol}）</span>
            )}
          </div>
          <div className="text-xs text-purple-300 space-y-1">
            <div>最少可獲得：<span className="font-mono">{swapDetails.amountOutMin}</span></div>
            <div>交易期限：<span className="font-mono">{new Date(swapDetails.deadline * 1000).toLocaleString()}</span></div>
            {swapDetails.amountInUsd && <div>價值約：<span className="text-purple-400">$ {swapDetails.amountInUsd}</span></div>}
            {swapDetails.isHighSlippage && (
              <div className="text-red-400 font-bold mt-1 p-1.5 rounded bg-red-900/30">
                注意！價格保護為零——你可能換到極少的幣，甚至什麼都拿不到。
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function translateRisk(name: string): string {
  const map: Record<string, string> = {
    "Infinite Approval": "無上限授權",
    "Zero-Value Transfer": "零元轉帳詐騙",
    "Address Poisoning Detected": "假地址詐騙",
    "Suspicious Contract Address": "可疑合約地址",
    "High Slippage Risk": "價格損失風險",
    "Cross-Domain Contract": "跨網站合約",
    "First-Time Contract": "首次接觸的合約",
    "Dangerous Function Call": "高風險操作",
    "Unverified Permit/Approval": "未驗證網站的授權",
    "High-Value Transaction": "大額交易",
    "Honeypot Detected (GoPlus)": "資金陷阱（買了賣不掉）",
    "Unverified Contract (GoPlus)": "未公開程式碼的合約",
    "Proxy Contract (GoPlus)": "可被修改的合約",
    "Hidden Ownership Risk (GoPlus)": "發行者可收回你的資產",
    "Sell Restriction (GoPlus)": "無法賣出",
    "Transfer Pausable (GoPlus)": "轉帳可被凍結",
    "High Token Tax (GoPlus)": "手續費過高",
    "Blacklisted Token (GoPlus)": "已被列入黑名單",
    "Sanctioned Address (Chainalysis)": "制裁名單地址",
    "Simulation Failed (Tenderly)": "交易模擬失敗",
    "Total Asset Drain (Tenderly)": "資產會被全部搬走",
    "Suspicious Value Discrepancy (Tenderly)": "兌換比例異常",
  }
  return map[name] ?? name
}

function translateSeverity(severity: string): string {
  const map: Record<string, string> = {
    NONE: "安全",
    LOW: "低",
    MEDIUM: "中",
    HIGH: "高",
    CRITICAL: "極危險",
  }
  return map[severity] ?? severity
}

function RiskFactors({ factors }: { factors: RiskAssessment["factors"] }) {
  if (factors.length === 0) {
    return (
      <div className="text-green-400 text-sm text-center py-4">
        沒有發現風險，這筆交易看起來是安全的。
      </div>
    )
  }

  const sourceLabel: Record<string, string> = {
    HEURISTIC: "本機偵測",
    GOPLUS: "GoPlus 安全資料",
    TENDERLY: "Tenderly 模擬",
    CHAINALYSIS: "Chainalysis 制裁",
  }

  return (
    <div className="space-y-2">
      {factors.map((factor, i) => (
        <div key={i} className={`rounded-lg p-3 border ${
          factor.severity === "CRITICAL" ? "border-purple-700/50 bg-purple-900/20" :
          factor.severity === "HIGH" ? "border-red-700/50 bg-red-900/20" :
          factor.severity === "MEDIUM" ? "border-orange-700/50 bg-orange-900/20" :
          "border-yellow-700/50 bg-yellow-900/20"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${severityTextColor[factor.severity]}`}>
                {translateSeverity(factor.severity)}風險
              </span>
              <span className="text-xs text-gray-500">{factor.category}</span>
            </div>
            <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              {sourceLabel[factor.source] ?? factor.source}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-200">{translateRisk(factor.name)}</div>
          <div className="text-xs text-gray-400 mt-1">{factor.description}</div>
        </div>
      ))}
    </div>
  )
}

function OverviewTab({ entries }: { entries: AuditEntry[] }) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEntries = entries.filter((e) => e.timestamp >= todayStart.getTime())
  const todayChecked = todayEntries.length
  const todayBlocked = todayEntries.filter((e) => e.decision === "BLOCK").length
  const recentBlocked = entries.filter((e) => e.decision === "BLOCK" || e.decision === "USER_OVERRIDE").slice(0, 3)

  const intentLabel: Record<string, string> = {
    APPROVE: "授權", TRANSFER: "轉帳", SWAP: "兌換", MINT: "鑄造",
    SIGN: "簽署", SIGN_TYPED_DATA: "簽署", PERSONAL_SIGN: "簽署",
    SEND_TRANSACTION: "交易", WALLET_SEND_CALLS: "批量", UNKNOWN: "未知",
  }

  return (
    <div className="space-y-4">
      {/* 防護狀態 */}
      <div className="flex items-center gap-2 bg-green-900/20 border border-green-800/30 rounded-lg px-4 py-3">
        <span className="text-lg">🟢</span>
        <div>
          <div className="text-sm font-semibold text-green-400">防護運作中</div>
          <div className="text-xs text-gray-500">Web3 Defense 正在保護你的交易安全</div>
        </div>
      </div>

      {/* 今日統計 */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">今日統計</h3>
        <div className="flex gap-4">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-gray-200">{todayChecked}</div>
            <div className="text-xs text-gray-500">已檢查</div>
          </div>
          <div className="w-px bg-gray-800" />
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-red-400">{todayBlocked}</div>
            <div className="text-xs text-gray-500">已攔截</div>
          </div>
          <div className="w-px bg-gray-800" />
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-gray-200">{entries.length}</div>
            <div className="text-xs text-gray-500">總紀錄</div>
          </div>
        </div>
      </div>

      {/* 防護項目 */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 mb-1">防護項目</h3>
        <div className="flex justify-between text-xs"><span className="text-gray-500">本機風險偵測</span><span className="text-green-400">✓ 啟用</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">GoPlus 合約安全</span><span className="text-green-400">✓ 啟用</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Tenderly 交易模擬</span><span className="text-green-400">✓ 啟用</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Chainalysis 制裁</span><span className="text-yellow-400">⏳ 等待金鑰</span></div>
        <div className="flex justify-between text-xs"><span className="text-gray-500">Permit2 釣魚防護</span><span className="text-green-400">✓ 啟用</span></div>
      </div>

      {/* 最近攔截 */}
      {recentBlocked.length > 0 && (
        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 mb-1">最近攔截</h3>
          {recentBlocked.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-red-400 shrink-0">⚠</span>
                <span className="text-gray-400 truncate">{e.hostname}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-600">{timeAgo(e.timestamp)}</span>
                <span className="text-red-400">{e.riskScore}分</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 快速操作 */}
      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        className="w-full bg-gray-900 hover:bg-gray-800 rounded-lg p-3 text-xs text-gray-400 hover:text-gray-200 transition-colors flex items-center justify-between"
      >
        <span>管理信任網站與設定</span>
        <span>→</span>
      </button>
    </div>
  )
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return "剛剛"
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function AuditLogView({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        尚無交易紀錄。被攔截或放行的交易會顯示在這裡。
      </div>
    )
  }

  const decisionLabel: Record<string, string> = {
    BLOCK: "已攔截",
    ALLOW: "已放行",
    USER_OVERRIDE: "自行承擔",
  }

  const intentLabel: Record<string, string> = {
    APPROVE: "授權",
    TRANSFER: "轉帳",
    SWAP: "兌換",
    MINT: "鑄造",
    SIGN: "簽署",
    SIGN_TYPED_DATA: "簽署資料",
    PERSONAL_SIGN: "個人簽署",
    SEND_TRANSACTION: "發送交易",
    WALLET_SEND_CALLS: "批量交易",
    UNKNOWN: "未知操作",
  }

  return (
    <div className="space-y-2">
      {entries.slice(0, 20).map((entry) => (
        <div key={entry.id} className="bg-gray-900 rounded p-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              entry.decision === "BLOCK" ? "bg-red-900/50 text-red-400" :
              entry.decision === "USER_OVERRIDE" ? "bg-yellow-900/50 text-yellow-400" :
              "bg-green-900/50 text-green-400"
            }`}>
              {decisionLabel[entry.decision] ?? entry.decision}
            </span>
          </div>
          <div className="text-gray-300 font-mono">
            <span className="text-gray-500">{entry.hostname}</span> · {intentLabel[entry.intent] ?? entry.intent}
          </div>
          <div className="text-gray-500 font-mono mt-0.5">
            目標：{entry.to.slice(0, 10)}...{entry.to.slice(-4)}
            <span className="ml-2">風險：{entry.riskScore} 分</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PopupIndex() {
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [activeTab, setActiveTab] = useState<"overview" | "warning" | "audit">("overview")
  const [loading, setLoading] = useState(true)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [hostname, setHostname] = useState<string>("")
  const [chainId, setChainId] = useState<string>("")
  const [method, setMethod] = useState<string>("")
  const [timestamp, setTimestamp] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    loadAssessmentData()
  }, [])

  async function loadAssessmentData() {
    try {
      const params = new URLSearchParams(window.location.search)
      const reqId = params.get("reqId")
      setRequestId(reqId)

      if (reqId) {
        const stored = await chrome.storage.local.get(`pending_assessment_${reqId}`)
        const data = stored[`pending_assessment_${reqId}`]
        if (data) {
          setAssessment(data.assessment)
          setHostname(data.hostname || "")
          setChainId(data.chainId || "")
          setMethod(data.method || "")
          setTimestamp(data.timestamp || 0)
          setActiveTab("warning")
        }
      }

      const log = await getAuditLog()
      setAuditLog(log)

      if (!reqId) {
        const onboarded = await hasCompletedOnboarding()
        if (!onboarded) setShowOnboarding(true)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleDecision(decision: "USER_OVERRIDE" | "BLOCK") {
    if (!assessment || !requestId) return

    await chrome.runtime.sendMessage({
      type: "USER_DECISION",
      payload: {
        requestId,
        decision,
        assessment,
        hostname,
        method,
        chainId,
        timestamp,
      },
    })
    window.close()
  }

  if (loading) {
    return (
      <div className="w-[400px] h-[600px] bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">正在分析交易安全性...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-[400px] h-[600px] bg-gray-950 flex items-center justify-center p-8">
        <div className="text-red-400 text-sm text-center">載入失敗：{error}</div>
      </div>
    )
  }

  return (
    <div className="w-[400px] min-h-[600px] bg-gray-950 text-gray-100 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h1 className="font-bold text-sm">Web3 Defense</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
              title="設定"
            >
              ⚙️
            </button>
            <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`text-xs px-2 py-1 rounded ${activeTab === "overview" ? "bg-gray-700 text-white" : "text-gray-500"}`}
            >
              總覽
            </button>
            <button
              onClick={() => setActiveTab("warning")}
              className={`text-xs px-2 py-1 rounded ${activeTab === "warning" ? "bg-gray-700 text-white" : "text-gray-500"}`}
            >
              交易警示
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`text-xs px-2 py-1 rounded ${activeTab === "audit" ? "bg-gray-700 text-white" : "text-gray-500"}`}
            >
              交易紀錄
            </button>
          </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" && <OverviewTab entries={auditLog} />}

        {activeTab === "warning" && (
          assessment ? (
            <>
              <div className="flex justify-center">
                <RiskBadge severity={assessment.severity} score={assessment.riskScore} />
              </div>

              {hostname && (
                <div className="text-center text-xs text-gray-500">
                  {hostname} · {new Date(timestamp).toLocaleTimeString()}
                </div>
              )}

              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-300 text-center">
                {assessment.severity === "CRITICAL" && "⚠️ 這筆交易極度危險，建議你立刻拒絕！"}
                {assessment.severity === "HIGH" && "⚠️ 這筆交易有高度風險，請仔細檢查！"}
                {assessment.severity === "MEDIUM" && "⚠️ 這筆交易有些風險，請確認後再決定。"}
                {assessment.severity === "LOW" && "這筆交易風險較低，但仍請留意。"}
                {assessment.severity === "NONE" && "這筆交易看起來安全。"}
              </div>

              {assessment.sanctions && <SanctionsWarning sanctions={assessment.sanctions} />}
              {assessment.simulation && <SimulationPreview assessment={assessment} />}
              <AssetFlowPreview assessment={assessment} />
              {assessment.contractSecurity && <ContractSecurityView contractSecurity={assessment.contractSecurity} />}

              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  發現 {assessment.factors.length} 個風險項目
                </h3>
                <RiskFactors factors={assessment.factors} />
              </div>

              <div className="flex gap-3 pt-2 pb-4">
                <button
                  onClick={() => handleDecision("BLOCK")}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  拒絕交易
                </button>
                <button
                  onClick={() => handleDecision("USER_OVERRIDE")}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-lg text-sm transition-colors"
                >
                  我了解風險，繼續
                </button>
              </div>
            </>
          ) : showOnboarding ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 space-y-4">
              <span className="text-3xl">🛡️</span>
              <h2 className="text-sm font-bold text-gray-200">歡迎使用 Web3 Defense</h2>
              <div className="text-xs text-gray-400 text-center space-y-2 leading-relaxed">
                <p>我會在你進行交易時自動檢查安全，<br />幫你攔截可能詐騙的操作。</p>
                <div className="bg-gray-900 rounded-lg p-3 space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>偵測「無上限授權」——避免你的錢被全部搬走</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>偵測「假地址詐騙」——防止複製到騙子的地址</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>偵測「資金陷阱」——避免買到賣不掉的幣</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>模擬交易結果——事先看到資金流向</span>
                  </div>
                </div>
                <p className="text-gray-500 mt-2">
                  你可以在「設定」中管理信任的網站，<br />點右上角擴充套件圖示 → 設定。
                </p>
              </div>
              <button
                onClick={async () => {
                  await completeOnboarding()
                  setShowOnboarding(false)
                }}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors"
              >
                知道了，開始使用
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 text-sm text-center">
                <div className="text-3xl mb-2">🟢</div>
                目前沒有需要警示的交易。
              </div>
            </div>
          )
        )}

        {activeTab === "audit" && <AuditLogView entries={auditLog} />}
      </div>

      <div className="bg-gray-900 border-t border-gray-800 px-4 py-2">
        <div className="text-[10px] text-gray-600 text-center">
          Web3 Defense · 保護你的數位資產安全
        </div>
      </div>
    </div>
  )
}
