import type { IntentType } from "./types"

// ─── 內嵌 API 金鑰（學術研究用途，所有用戶共用）───
export const EMBEDDED_KEYS = {
  TENDERLY_USER: "ycair_",
  TENDERLY_PROJECT: "project",
  TENDERLY_ACCESS_KEY: "3vy0u7GG7K6odiPkTSGjSCzT9gTg4tuu",
} as const

// ─── 已知函數選擇器 ───
export const FUNCTION_SELECTORS: Record<string, { name: string; intent: IntentType }> = {
  "0xa9059cbb": { name: "transfer(address,uint256)", intent: "TRANSFER" },
  "0x095ea7b3": { name: "approve(address,uint256)", intent: "APPROVE" },
  "0x23b872dd": { name: "transferFrom(address,address,uint256)", intent: "TRANSFER" },
  "0x39509351": { name: "increaseAllowance(address,uint256)", intent: "APPROVE" },
  "0xa457c2d7": { name: "decreaseAllowance(address,uint256)", intent: "APPROVE" },
  "0x40c10f19": { name: "mint(address,uint256)", intent: "MINT" },
  "0x42842e0e": { name: "safeTransferFrom(address,address,uint256)", intent: "TRANSFER" },
  "0xb88d4fde": { name: "safeTransferFrom(address,address,uint256,bytes)", intent: "TRANSFER" },
  "0x7ff36ab5": { name: "swapExactETHForTokens(...)", intent: "SWAP" },
  "0x38ed1739": { name: "swapExactTokensForTokens(...)", intent: "SWAP" },
  "0x18cbafe5": { name: "swapExactTokensForETH(...)", intent: "SWAP" },
  "0x8803dbee": { name: "swapTokensForExactTokens(...)", intent: "SWAP" },
  "0xfb3bdb41": { name: "swapETHForExactTokens(...)", intent: "SWAP" },
  "0x4a25d94a": { name: "swapTokensForExactETH(...)", intent: "SWAP" },
  "0x414bf389": { name: "exactInputSingle(...)", intent: "SWAP" },
  "0xdb3e2198": { name: "exactOutputSingle(...)", intent: "SWAP" },
  "0x5c11d795": { name: "swapExactTokensForTokensSupportingFeeOnTransferTokens(...)", intent: "SWAP" },
  "0xe8e33700": { name: "addLiquidity(...)", intent: "UNKNOWN" },
  "0xbaa2abde": { name: "removeLiquidity(...)", intent: "UNKNOWN" },

  // Permit / Permit2（鏈下簽名即可動用資產，不需要 approve 交易）
  "0xd505accf": { name: "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", intent: "APPROVE" },
  "0x2b67b4d7": { name: "permit (Permit2 - 鏈下簽名)", intent: "APPROVE" },

  "0xd0e30db0": { name: "deposit()", intent: "TRANSFER" },
  "0x2e1a7d4d": { name: "withdraw(uint256)", intent: "TRANSFER" },
  "0xab834bab": { name: "fulfillOrder(...)", intent: "UNKNOWN" },
  "0xfb16a595": { name: "cancelOrder(...)", intent: "UNKNOWN" },
}

export const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

// ─── 危險操作 ───
export const DANGEROUS_SELECTORS: Record<string, string> = {
  "0x9b3c14e7": "setApprovalForAll（授權對方控制你所有的 NFT）",
  "0xa22cb465": "setApprovalForAll（授權對方控制你所有的 NFT）",
}

// ─── Permit / Permit2 選擇器 ───
export const PERMIT_SELECTORS = new Set([
  "0xd505accf",
  "0x2b67b4d7",
])

// ─── 知名交易所域名 ───
export const VERIFIED_DEX_DOMAINS = [
  "uniswap.org", "app.uniswap.org",
  "sushi.com", "app.sushi.com",
  "curve.fi",
  "1inch.io", "app.1inch.io",
  "pancakeswap.finance",
  "balancer.fi",
  "matcha.xyz",
  "paraswap.io",
  "opensea.io", "pro.opensea.io",
  "blur.io",
  "looksrare.org",
  "x2y2.io",
]

// ─── 常見代幣 ───
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": { symbol: "ETH", decimals: 18 },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18 },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { symbol: "USDT", decimals: 6 },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
  "0x6b175474e89094c44da98b954eedeac495271d0f": { symbol: "DAI", decimals: 18 },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { symbol: "WBTC", decimals: 8 },
  "0x514910771af9ca656af840dff83e8264ecf986ca": { symbol: "LINK", decimals: 18 },
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": { symbol: "AAVE", decimals: 18 },
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": { symbol: "UNI", decimals: 18 },
}

// ─── 風險閾值 ───
export const RISK_THRESHOLDS = {
  HIGH_SLIPPAGE_PERCENT: 30,
  ADDRESS_SIMILARITY_MIN: 80,
  HIGH_RISK_SCORE: 60,
  CRITICAL_RISK_SCORE: 80,
}

// ─── 限制 ───
export const AUDIT_LOG_MAX_ENTRIES = 500
export const ASSESSMENT_CACHE_TTL = 5 * 60 * 1000 // 5 分鐘
export const INTERCEPTOR_TIMEOUT = 15000 // 改為 15 秒
