import type { RiskAssessment, AuditEntry } from "~lib/types"
import { parseTransaction } from "~lib/parser"
import { assessRisk } from "~lib/riskEngine"
import { addAuditEntry, recordContractInteraction, addKnownAddress } from "~lib/storage"
import { getAuditLog, clearAuditLog, getTrustedSites, getAssessmentCache, setAssessmentCache } from "~lib/storage"
import { simulateTransaction } from "~lib/apis/tenderly"

console.log("[WD-BG] Service Worker 已啟動")

let currentPopupId: number | null = null

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[WD-BG] 收到訊息:", message.type)
  if (message.type === "ANALYZE_TRANSACTION") {
    handleAnalyzeTransaction(message.payload, sender, sendResponse)
    return true
  }
  if (message.type === "GET_AUDIT_LOG") {
    getAuditLog().then((log) => sendResponse({ auditLog: log }))
    return true
  }
  if (message.type === "CLEAR_AUDIT_LOG") {
    clearAuditLog().then(() => sendResponse({ success: true }))
    return true
  }
  if (message.type === "USER_DECISION") {
    handleUserDecision(message.payload)
    sendResponse({ success: true })
    return false
  }
  return false
})

async function handleAnalyzeTransaction(
  payload: {
    id: string
    method: string
    params: unknown[]
    chainId: string
    hostname: string
    timestamp: number
  },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: Record<string, unknown>) => void
) {
  try {
    // 檢查白名單：信任的網站直接放行
    const trustedSites = await getTrustedSites()
    if (trustedSites.includes(payload.hostname)) {
      sendResponse({ action: "ALLOW" })
      return
    }

    const txParams = (payload.params[0] as Record<string, unknown>) ?? {}

    // 檢查快取：同一筆交易不用重複分析
    const cacheKey = `${payload.hostname}:${txParams.to ?? ""}:${(txParams.data as string ?? "").slice(0, 10)}`
    const cached = await getAssessmentCache(cacheKey)
    if (cached) {
      if (cached.severity === "NONE" || cached.severity === "LOW") {
        sendResponse({ action: "ALLOW" })
        return
      }
    }

    const { parsed, approveDetails, swapDetails, transferDetails } = await parseTransaction(
      payload.method,
      txParams,
      payload.chainId,
    )

    const simulation = await simulateTransaction({
      from: parsed.from,
      to: parsed.to,
      data: parsed.data,
      value: parsed.value,
      gas: parsed.gas,
      chainId: payload.chainId,
    })

    const assessment = await assessRisk(
      parsed,
      approveDetails,
      swapDetails,
      transferDetails,
      payload.hostname,
      payload.chainId,
      simulation,
    )

    // 快取分析結果（5 分鐘）
    await setAssessmentCache(cacheKey, assessment)

    if (parsed.to && parsed.to !== "0x0000000000000000000000000000000000000000") {
      await recordContractInteraction(payload.hostname, parsed.to)
    }
    if (parsed.to && transferDetails?.recipient) {
      await addKnownAddress(parsed.to)
      await addKnownAddress(transferDetails.recipient)
    }

    if (assessment.severity === "NONE" || assessment.severity === "LOW") {
      await logDecision(payload, parsed, "ALLOW", assessment.riskScore)
      sendResponse({ action: "ALLOW" })
      return
    }

    // 兩階段流程：先回 PENDING，讓攔截器等待用戶決定
    const tabId = sender.tab?.id
    if (tabId == null) {
      sendResponse({ action: "ALLOW" })
      return
    }

    // 儲存請求資料，供後續 FINALIZE 使用
    await chrome.storage.local.set({
      [`pending_req_${payload.id}`]: {
        tabId,
        assessment,
        requestId: payload.id,
        hostname: payload.hostname,
        method: payload.method,
        timestamp: payload.timestamp,
        chainId: payload.chainId,
        parsed,
        txParams,
      },
    })

    // Phase 1: 告知攔截器等待
    sendResponse({ action: "PENDING", requestId: payload.id })

    // 開啟警示彈窗
    const popupUrl = chrome.runtime.getURL(`popup.html?reqId=${encodeURIComponent(payload.id)}`)

    await chrome.storage.local.set({
      [`pending_assessment_${payload.id}`]: {
        assessment,
        requestId: payload.id,
        hostname: payload.hostname,
        method: payload.method,
        timestamp: payload.timestamp,
        chainId: payload.chainId,
      },
    })

    chrome.windows.create(
      {
        url: popupUrl,
        type: "popup",
        width: 420,
        height: 680,
        focused: true,
      },
      (window) => {
        if (window?.id != null) currentPopupId = window.id
      },
    )
  } catch (error) {
    console.error("Web3 Defense analysis error:", error)
    sendResponse({ action: "ALLOW" })
  }
}

async function logDecision(
  payload: { id: string; method: string; hostname: string; chainId: string; timestamp: number },
  parsed: { intent: string; to: string; functionName: string },
  decision: "ALLOW" | "BLOCK" | "USER_OVERRIDE",
  riskScore: number,
) {
  await addAuditEntry({
    id: payload.id,
    timestamp: payload.timestamp,
    hostname: payload.hostname,
    chainId: payload.chainId,
    method: payload.method,
    intent: parsed.intent as AuditEntry["intent"],
    decision,
    riskScore,
    to: parsed.to,
    contractName: parsed.functionName,
  })
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (currentPopupId === windowId) {
    currentPopupId = null
  }
  // 清理過期的 pending 請求
  const all = await chrome.storage.local.get(null)
  for (const key of Object.keys(all)) {
    if (key.startsWith("pending_req_")) {
      const data = all[key]
      if (Date.now() - (data?.timestamp ?? 0) > 120000) {
        await chrome.storage.local.remove(key)
        // 清理對應的 assessment
        const reqId = key.replace("pending_req_", "")
        await chrome.storage.local.remove(`pending_assessment_${reqId}`)
      }
    }
  }
})

async function handleUserDecision(payload: {
  requestId: string
  decision: "ALLOW" | "BLOCK" | "USER_OVERRIDE"
  assessment: RiskAssessment
  hostname: string
  method: string
  chainId: string
  timestamp: number
}) {
  const { requestId, decision, assessment, hostname, method, chainId, timestamp } = payload

  await logDecision(
    { id: requestId, method, hostname, chainId, timestamp },
    assessment.parsed,
    decision,
    assessment.riskScore,
  )
  updateBadge()

  // Phase 2: 傳送最終決定給攔截器
  const stored = await chrome.storage.local.get(`pending_req_${requestId}`)
  const pending = stored[`pending_req_${requestId}`]
  const tabId: number | undefined = pending?.tabId

  if (tabId != null) {
    const finalAction = (decision === "USER_OVERRIDE" || decision === "ALLOW") ? "ALLOW" : "BLOCK"
    chrome.tabs.sendMessage(tabId, {
      type: "FINALIZE",
      requestId,
      action: finalAction,
    }).catch(() => {
      // tab may have been closed
    })
  }

  await chrome.storage.local.remove(`pending_assessment_${requestId}`)
  await chrome.storage.local.remove(`pending_req_${requestId}`)

  if (currentPopupId != null) {
    try {
      const windows = await chrome.windows.getAll()
      for (const w of windows) {
        if (w.type === "popup" && w.id != null) chrome.windows.remove(w.id)
      }
    } catch {
      // ignore
    }
  }
}

chrome.alarms.create("heartbeat", { periodInMinutes: 1 })
chrome.alarms.create("reset-badge", { periodInMinutes: 1440 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "heartbeat") {
    chrome.storage.local.set({ "last-heartbeat": Date.now() })
  }
  if (alarm.name === "reset-badge") {
    updateBadge()
  }
})

async function updateBadge() {
  const log = await getAuditLog()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayBlocked = log.filter(
    (e) => e.timestamp >= todayStart.getTime() && (e.decision === "BLOCK" || e.decision === "USER_OVERRIDE")
  ).length

  if (todayBlocked > 0) {
    chrome.action.setBadgeText({ text: String(todayBlocked) })
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" })
  } else {
    chrome.action.setBadgeText({ text: "" })
  }
}

chrome.runtime.onConnect.addListener(() => {
  // Port kept open by caller
})
