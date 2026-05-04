<p align="center">
  <img src="assets/icon128.png" width="80" alt="Web3 Defense">
</p>

<h1 align="center">Web3 Defense</h1>

<p align="center">
  <strong>瀏覽器擴充套件 · Web3 交易安全防護</strong><br>
  <em>在每一筆區塊鏈交易送出前，自動檢查安全風險，防止詐騙。</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Chrome%20%7C%20Brave%20%7C%20Edge-blue" alt="Platform">
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License">
</p>

---

## 🛡️ 為什麼需要這個擴充套件？

在 Web3 的世界裡，**每一筆交易都是不可逆的**。一旦把錢轉出去，就再也拿不回來。詐騙集團利用這一點，設計了各種手法來騙取你的資產：

- 誘導你**無限制授權**給假合約，隨時可以把你的錢搬光
- 在你的交易紀錄中留下**長得很像的假地址**，讓你複製貼上時轉錯錢
- 建立**資金陷阱代幣**，讓你買了之後完全賣不掉
- 偽裝成知名交易所，用**釣魚網站**騙你簽名

**Web3 Defense** 在你按下「確認」之前，自動分析每一筆交易，告訴你這筆交易**到底安不安全**。

---

## ✨ 功能介紹

### 🔍 交易安全分析

在交易發送到區塊鏈之前，自動攔截並分析：

| 防護項目 | 說明 |
|---|---|
| **無上限授權攔截** | 偵測合約要求「無限額度」動用權，強制警告 |
| **假地址詐騙偵測** | 比對目標地址與你常用地址的相似度，防止複製到假地址 |
| **資金陷阱偵測** | 透過 GoPlus API 檢查代幣是否為蜜罐（買了賣不掉） |
| **合約安全檢查** | 檢查合約是否開源、是否可被修改、是否在黑名單 |
| **交易模擬預覽** | 透過 Tenderly 模擬交易結果，事先看到資金流向 |
| **盲簽風險警告** | 當你在非知名網站上簽署看不懂的資料時發出警告 |
| **大額交易提醒** | 超過 1 ETH 或等值金額時特別提醒 |
| **跨網站合約偵測** | 發現同一個合約在不同網站被呼叫時發出警告 |
| **零元轉帳詐騙** | 偵測交易記錄汙染攻擊 |
| **高滑點保護** | 偵測沒有價格保護的兌換交易 |

### 📊 信任網站白名單

把你常用的安全網站（如 Uniswap、OpenSea）加入信任清單，這些網站會自動跳過檢查。

### 📝 本地交易紀錄

所有攔截和檢查結果都保存在你的電腦上，**不會上傳到任何伺服器**。

### 🌐 完全本地運作

除了查詢公開的合約安全資料外，所有分析都在你的瀏覽器內完成。你的交易資料、錢包地址**永遠不會離開你的電腦**。

---

## 🚀 快速開始

### 環境需求

- Node.js 18+
- 瀏覽器：Chrome / Brave / Edge（需支援 Manifest V3）

### 安裝與建置

```bash
# 1. 下載專案
git clone https://github.com/ianbbbanian5476/web3-defense.git
cd web3-defense

# 2. 安裝依賴
npm install

# 3. 建置擴充套件
npx plasmo build
```

### 載入瀏覽器

1. 打開瀏覽器 → 網址列輸入 `chrome://extensions/`
2. 右上角開啟 **「開發人員模式」**
3. 點左上角 **「載入未封裝項目」**
4. 選擇 `build/chrome-mv3-prod/` 資料夾

載入完成後，工具列會出現紫色盾牌圖示 🛡️。

---

## 🧪 測試

建置完成後，可以用內建的測試頁面來驗證各項功能：

```bash
# 啟動本地伺服器
python3 -m http.server 8765
```

瀏覽器開啟 `http://localhost:8765/test.html`，點擊按鈕模擬各種詐騙情境。

---

## 🏗️ 專案架構

```
web3-defense/
├── contents/
│   └── isolatedBridge.ts      # 內容腳本：注入攔截器 + 橋接背景
├── lib/
│   ├── apis/
│   │   ├── goplus.ts          # GoPlus 合約安全 API
│   │   ├── tenderly.ts        # Tenderly 交易模擬 API
│   │   ├── chainalysis.ts     # Chainalysis 制裁檢查 API
│   │   └── rpc.ts             # 鏈上 RPC 查詢（代幣名稱等）
│   ├── types.ts               # 共享型別定義
│   ├── constants.ts           # 函數選擇器、已知代幣、風險閾值
│   ├── parser.ts              # ABI 解碼 + 交易意圖分類
│   ├── heuristics.ts          # 風險啟發式偵測（16+ 項檢查）
│   ├── riskEngine.ts          # 風險評分聚合引擎
│   └── storage.ts             # chrome.storage 包裝層
├── background.ts              # Service Worker 入口
├── popup.tsx                  # 警示彈窗 UI
├── options.tsx                # 設定頁面（信任網站管理）
├── wd-interceptor.js          # MAIN world 攔截器腳本
├── assets/                    # 圖示資源
└── package.json
```

### 四層架構

```
dApp 交易請求
    │
    ▼
┌─ 攔截層 ──────────────────────────────┐
│  包裝 window.ethereum.request         │
│  攔截 8 種錢包方法                     │
└────────────┬──────────────────────────┘
             │
             ▼
┌─ 解析與模擬引擎 ──────────────────────┐
│  ABI 解碼 + 4bytes 查詢              │
│  Tenderly 交易模擬                    │
└────────────┬──────────────────────────┘
             │
             ▼
┌─ 風控大腦 ────────────────────────────┐
│  16+ 項啟發式偵測                     │
│  GoPlus 合約安全評分                 │
│  Chainalysis 制裁檢查                │
└────────────┬──────────────────────────┘
             │
             ▼
┌─ 決策警示 UI ─────────────────────────┐
│  風險分數 0-100，五級分類              │
│  資產流向視覺化                        │
│  用戶決定放行或拒絕                    │
└──────────────────────────────────────┘
```

---

## ⚠️ 注意事項

- 本專案為**學術研究用途**，不構成任何投資或安全建議
- 所有分析結果僅供參考，請務必自行確認交易內容
- 擴充套件無法防範所有詐騙手法，請保持警覺

---

## 📄 授權

MIT License

---

<p align="center">
  <em>為保護 Web3 新手而設計與開發。</em>
</p>
