import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  run_at: "document_start",
  all_frames: true,
}

// 用外部檔案載入攔截器（避免 CSP 封鎖 inline script）
const script = document.createElement("script")
script.src = chrome.runtime.getURL("wd-interceptor.js")
script.id = "web3-defense-interceptor"
const target = document.head || document.documentElement
if (target) {
  target.appendChild(script)
  console.log("[WD] 攔截器已注入 MAIN world")
  script.remove()
} else {
  console.error("[WD] 無法注入攔截器：找不到 document.head")
}

const DISPATCH_REQUEST = "WEB3_DEFENSE_DISPATCH_REQUEST"
const DISPATCH_RESPONSE = "WEB3_DEFENSE_DISPATCH_RESPONSE"

interface InterceptedRequest {
  id: string
  method: string
  params: unknown[]
  chainId: string
  hostname: string
  timestamp: number
}

const pendingRequests = new Map<string, string>()

function sendResponse(requestId: string, decision: { action: string; assessment?: unknown; requestId?: string }) {
  document.dispatchEvent(
    new CustomEvent(DISPATCH_RESPONSE, { detail: { requestId, decision } })
  )
}

document.addEventListener(DISPATCH_REQUEST, async (event: Event) => {
  console.log("[WD-BRIDGE] 收到 DISPATCH_REQUEST")
  const request = (event as CustomEvent<InterceptedRequest>).detail
  if (!request?.id) return

  try {
    console.log("[WD-BRIDGE] 發送 ANALYZE_TRANSACTION 到 background")
    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_TRANSACTION",
      payload: request,
    })
    console.log("[WD-BRIDGE] 收到 background 回應:", response?.action)

    if (response?.action === "PENDING") {
      pendingRequests.set(request.id, "waiting")
      sendResponse(request.id, { action: "PENDING", requestId: request.id })
    } else {
      sendResponse(request.id, {
        action: response?.action ?? "ALLOW",
        assessment: response?.assessment,
      })
    }
  } catch (e) {
    console.error("[WD-BRIDGE] sendMessage 失敗:", e)
    sendResponse(request.id, { action: "ALLOW" })
  }
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "FINALIZE" && pendingRequests.has(message.requestId)) {
    pendingRequests.delete(message.requestId)
    sendResponse(message.requestId, { action: message.action })
  }
})
