import { useEffect, useState } from "react"
import { getTrustedSites, addTrustedSite, removeTrustedSite } from "~lib/storage"
import "~style.css"

export default function OptionsIndex() {
  const [trustedSites, setTrustedSites] = useState<string[]>([])
  const [newSite, setNewSite] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    loadSites()
  }, [])

  async function loadSites() {
    setTrustedSites(await getTrustedSites())
  }

  async function handleAdd() {
    const domain = newSite.trim().toLowerCase()
    if (!domain) return
    if (trustedSites.includes(domain)) {
      setMessage("此網站已在信任清單中")
      return
    }
    await addTrustedSite(domain)
    await loadSites()
    setNewSite("")
    setMessage(`已加入「${domain}」`)
    setTimeout(() => setMessage(""), 2000)
  }

  async function handleRemove(domain: string) {
    await removeTrustedSite(domain)
    await loadSites()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <h1 className="text-lg font-bold">Web3 Defense 設定</h1>
            <p className="text-xs text-gray-500">管理你的信任網站清單</p>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">信任的網站（自動放行）</h2>
          <p className="text-xs text-gray-600">
            加入信任清單的網站會跳過安全檢查，交易直接放行。請只加入你完全信任的網站。
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="輸入網站域名，例如 uniswap.org"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-600"
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded transition-colors"
            >
              加入
            </button>
          </div>

          {message && (
            <div className="text-xs text-green-400 bg-green-900/30 rounded px-3 py-2">{message}</div>
          )}

          {trustedSites.length === 0 ? (
            <div className="text-xs text-gray-600 text-center py-4">
              尚未加入任何信任網站
            </div>
          ) : (
            <div className="space-y-1">
              {trustedSites.map((site) => (
                <div key={site} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs">✓</span>
                    <span className="text-sm text-gray-300">{site}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(site)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-400">安全防護狀態</h2>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">本機風險偵測</span>
              <span className="text-green-400">已啟用</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">GoPlus 合約安全分析</span>
              <span className="text-green-400">已啟用</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tenderly 交易模擬</span>
              <span className="text-green-400">已啟用</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Chainalysis 制裁檢查</span>
              <span className="text-yellow-400">等待 API 金鑰</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
