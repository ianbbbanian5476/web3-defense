import type {
  RiskFactor,
  ApproveDetails,
  SwapDetails,
  TransferDetails,
  ParsedTransaction,
  ContractSecurity,
  SanctionsResult,
} from "./types"
import { MAX_UINT256, VERIFIED_DEX_DOMAINS, DANGEROUS_SELECTORS, PERMIT_SELECTORS, RISK_THRESHOLDS } from "./constants"
import { getContractHistory, getKnownAddresses } from "./storage"
import { fetchContractSecurity } from "./apis/goplus"
import { checkSanctions } from "./apis/chainalysis"

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

function addressSimilarity(addr1: string, addr2: string): number {
  const a = addr1.toLowerCase()
  const b = addr2.toLowerCase()
  const d = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  return ((maxLen - d) / maxLen) * 100
}

function prefixSuffixSimilarity(addr1: string, addr2: string): { prefixMatch: boolean; suffixMatch: boolean } {
  const a = addr1.toLowerCase()
  const b = addr2.toLowerCase()
  return {
    prefixMatch: a.slice(2, 6) === b.slice(2, 6),
    suffixMatch: a.slice(-4) === b.slice(-4),
  }
}

// ─── 本機啟發式偵測 ───

async function checkInfiniteApproval(approve: ApproveDetails): Promise<RiskFactor | null> {
  if (!approve || !approve.isInfinite) return null
  return {
    name: "Infinite Approval",
    severity: "CRITICAL",
    description: `你正在授權「${approve.spender.slice(0, 12)}...」無限制動用你的資產。對方隨時可以把你的錢全部拿走，不需要再經過你的同意。`,
    category: "APPROVAL",
    source: "HEURISTIC",
  }
}

async function checkZeroValueTransfer(transfer: TransferDetails): Promise<RiskFactor | null> {
  if (!transfer?.isZeroValue) return null
  return {
    name: "Zero-Value Transfer",
    severity: "MEDIUM",
    description: `你收到一筆零元轉帳，發送地址是「${transfer.recipient.slice(0, 12)}...」。這通常是詐騙集團的手法——他們在你錢包的交易紀錄中留下一個長得很像你常用地址的假地址，等你下次不察複製貼上時，錢就會轉到騙子手上。`,
    category: "ADDRESS",
    source: "HEURISTIC",
  }
}

async function checkAddressPoisoning(
  transfer: TransferDetails | null,
  parsed: ParsedTransaction
): Promise<RiskFactor | null> {
  if (!transfer || transfer.isZeroValue) {
    if (transfer?.isZeroValue) {
      const known = await getKnownAddresses()
      for (const knownAddr of known) {
        const similarity = addressSimilarity(transfer.recipient, knownAddr)
        const { prefixMatch, suffixMatch } = prefixSuffixSimilarity(transfer.recipient, knownAddr)
        if (similarity >= RISK_THRESHOLDS.ADDRESS_SIMILARITY_MIN || (prefixMatch && suffixMatch)) {
          return {
            name: "Address Poisoning Detected",
            severity: "HIGH",
            description: `目標地址「${transfer.recipient.slice(0, 8)}...${transfer.recipient.slice(-4)}」和你常用的地址「${knownAddr.slice(0, 8)}...${knownAddr.slice(-4)}」相似度高達 ${similarity.toFixed(0)}%。這極可能是詐騙手法——騙子故意使用外觀相似的地址來混淆你。`,
            category: "ADDRESS",
            source: "HEURISTIC",
          }
        }
      }
    }
  }

  const toAddr = parsed.to.toLowerCase()
  if (toAddr === "0x0000000000000000000000000000000000000000") return null

  const known = await getKnownAddresses()
  for (const knownAddr of known) {
    const similarity = addressSimilarity(toAddr, knownAddr)
    const { prefixMatch, suffixMatch } = prefixSuffixSimilarity(toAddr, knownAddr)
    if ((similarity >= RISK_THRESHOLDS.ADDRESS_SIMILARITY_MIN || (prefixMatch && suffixMatch)) && toAddr !== knownAddr) {
      return {
        name: "Suspicious Contract Address",
        severity: "MEDIUM",
        description: `這個合約地址「${toAddr.slice(0, 8)}...${toAddr.slice(-4)}」和你之前用過的「${knownAddr.slice(0, 8)}...${knownAddr.slice(-4)}」長得很像，但其實是不同的合約。請仔細確認地址。`,
        category: "ADDRESS",
        source: "HEURISTIC",
      }
    }
  }

  return null
}

async function checkHighSlippage(swap: SwapDetails): Promise<RiskFactor | null> {
  if (!swap?.isHighSlippage) return null
  return {
    name: "High Slippage Risk",
    severity: "HIGH",
    description: "這筆兌換沒有設定最低保障數量（或保障極低）。這代表你可能付出很多，卻換到極少甚至什麼都拿不到。正派的交易所通常會幫你設定合理的保護。",
    category: "TRANSACTION",
    source: "HEURISTIC",
  }
}

async function checkDomainContractMatch(
  parsed: ParsedTransaction,
  hostname: string
): Promise<RiskFactor | null> {
  if (!parsed.to || parsed.to === "0x0000000000000000000000000000000000000000") return null
  if (hostname === "" || hostname === "localhost") return null

  const history = await getContractHistory()
  const domainKey = Object.keys(history).find((k) => k.endsWith(`:${parsed.to.toLowerCase()}`))

  if (domainKey && !domainKey.startsWith(`${hostname}:`)) {
    const otherDomain = domainKey.split(":")[0]
    return {
      name: "Cross-Domain Contract",
      severity: "MEDIUM",
      description: `這個合約（${parsed.to.slice(0, 10)}...）你之前是在「${otherDomain}」使用的，但現在「${hostname}」也在叫你授權同一個合約。這有可能是釣魚網站正在冒充正牌網站。`,
      category: "CONTRACT",
      source: "HEURISTIC",
    }
  }

  if (!domainKey && hostname) {
    return {
      name: "First-Time Contract",
      severity: "LOW",
      description: `這是你第一次在「${hostname}」和這個合約互動。建議你先確認這個網站是否真的是正版，以及這個合約是否真的是你要操作的對象。`,
      category: "CONTRACT",
      source: "HEURISTIC",
    }
  }

  return null
}

async function checkDangerousSelector(data: string): Promise<RiskFactor | null> {
  if (!data || data === "0x") return null
  const selector = data.slice(0, 10)
  const description = DANGEROUS_SELECTORS[selector]
  if (!description) return null
  return {
    name: "Dangerous Function Call",
    severity: "HIGH",
    description,
    category: "CONTRACT",
    source: "HEURISTIC",
  }
}

async function checkPermitPhishing(
  intent: ParsedTransaction["intent"],
  hostname: string
): Promise<RiskFactor | null> {
  if ((intent === "APPROVE" || intent === "SIGN_TYPED_DATA" || intent === "SIGN" || intent === "PERSONAL_SIGN") && hostname) {
    const isVerified = VERIFIED_DEX_DOMAINS.some((d) => hostname.includes(d))
    if (!isVerified) {
      return {
        name: intent === "SIGN_TYPED_DATA" ? "Blind Signing Risk" : "Unverified Permit/Approval",
        severity: "HIGH",
        description: intent === "SIGN_TYPED_DATA"
          ? `你正在「${hostname}」簽署一筆資料。你無法從簽署內容判斷這筆操作會動用到哪些資產。許多詐騙利用這種「盲簽」手法——在你看不懂的資料上簽名，就能動用你的錢。`
          : `你正在「${hostname}」這個網站進行授權。這個網站不在已知安全交易所的名單中。如果這不是你信任的網站，請立即停止——詐騙網站常會用假的授權來偷走你的資產。`,
        category: "SIGNATURE",
        source: "HEURISTIC",
      }
    }
  }
  return null
}

async function checkLargeValue(value: string): Promise<RiskFactor | null> {
  try {
    const val = BigInt(value)
    const eth = Number(val) / 1e18
    if (val > BigInt("10000000000000000000")) {
      return {
        name: "High-Value Transaction",
        severity: "CRITICAL",
        description: `這筆交易金額高達 ${eth.toFixed(2)} ETH（約 ${(eth * 1800).toFixed(0)} 美金），屬於超大額交易。請再三確認收款地址是否正確！`,
        category: "TRANSACTION",
        source: "HEURISTIC",
      }
    }
    if (val > BigInt("1000000000000000000")) {
      return {
        name: "High-Value Transaction",
        severity: "HIGH",
        description: `這筆交易金額為 ${eth.toFixed(2)} ETH（約 ${(eth * 1800).toFixed(0)} 美金），請確認收款地址是否正確。`,
        category: "TRANSACTION",
        source: "HEURISTIC",
      }
    }
  } catch {
    // ignore
  }
  return null
}

// ─── API 輔助偵測 ───

async function checkContractReputation(
  contractAddress: string,
  chainId: string
): Promise<{ factors: RiskFactor[]; data: ContractSecurity | null }> {
  const security = await fetchContractSecurity(contractAddress, chainId)
  if (!security) return { factors: [], data: null }

  const factors: RiskFactor[] = []

  if (security.isHoneypot) {
    factors.push({
      name: "Honeypot Detected (GoPlus)",
      severity: "CRITICAL",
      description: "這個幣種被標記為「資金陷阱」——你買了之後可能完全賣不掉。這是常見的詐騙手法，請不要購買。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  if (!security.isOpenSource) {
    factors.push({
      name: "Unverified Contract (GoPlus)",
      severity: "MEDIUM",
      description: "這個合約的程式碼沒有公開，外界無法檢驗它是否安全。它可能藏有後門，讓發行者隨時偷走你的資產。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  if (security.isProxy) {
    factors.push({
      name: "Proxy Contract (GoPlus)",
      severity: "MEDIUM",
      description: "這是一個「代理合約」，代表它的規則可以被發行者隨時修改。今天安全的合約，明天可能就變成會偷錢的合約。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  if (security.canTakeBackOwnership || security.hiddenOwner) {
    factors.push({
      name: "Hidden Ownership Risk (GoPlus)",
      severity: "HIGH",
      description: "這個合約的發行者有特殊權限，可以在未來把你的資產收回或銷毀。這是「捲款跑路」的常見前兆。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  if (security.cannotSellAll) {
    factors.push({
      name: "Sell Restriction (GoPlus)",
      severity: "HIGH",
      description: "這個幣種限制你賣出的數量，代表你可能買了之後無法完全賣掉。你的錢會被卡在裡面。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  if (security.transferPausable) {
    factors.push({
      name: "Transfer Pausable (GoPlus)",
      severity: "MEDIUM",
      description: "發行者可以隨時凍結你的轉帳功能。你的資產可能被鎖住，無法動用。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  const buyTax = parseFloat(security.buyTax)
  const sellTax = parseFloat(security.sellTax)
  if (buyTax > 10 || sellTax > 10) {
    factors.push({
      name: "High Token Tax (GoPlus)",
      severity: "HIGH",
      description: `這個幣種的手續費高達買入 ${buyTax}%、賣出 ${sellTax}%。也就是說你每買 100 元就會虧 ${buyTax} 元，每賣 100 元又會再虧 ${sellTax} 元。`,
      category: "TRANSACTION",
      source: "GOPLUS",
    })
  }

  if (security.isBlacklisted) {
    factors.push({
      name: "Blacklisted Token (GoPlus)",
      severity: "HIGH",
      description: "這個幣種已被安全機構列入黑名單，代表它曾被多次檢舉有詐騙行為。請不要購買。",
      category: "CONTRACT",
      source: "GOPLUS",
    })
  }

  return { factors, data: security }
}

async function checkAddressSanctions(
  fromAddress: string,
  toAddress: string
): Promise<{ factors: RiskFactor[]; data: SanctionsResult | null }> {
  const results: RiskFactor[] = []
  let sanctions: SanctionsResult | null = null

  for (const addr of [fromAddress, toAddress]) {
    const result = await checkSanctions(addr)
    if (!result) continue
    if (!sanctions && result.isSanctioned) sanctions = result

    if (result.isSanctioned) {
      results.push({
        name: "Sanctioned Address (Chainalysis)",
        severity: "CRITICAL",
        description: `地址「${addr.slice(0, 12)}...」已被列入國際制裁名單。與此地址交易可能觸犯法律，請立即停止。`,
        category: "ADDRESS",
        source: "CHAINALYSIS",
      })
      break
    }
  }

  return { factors: results, data: sanctions }
}

async function checkPermit2(data: string, hostname: string): Promise<RiskFactor | null> {
  if (!data || data === "0x") return null
  const selector = data.slice(0, 10)
  if (!PERMIT_SELECTORS.has(selector)) return null

  const isVerified = VERIFIED_DEX_DOMAINS.some((d) => hostname.includes(d))
  if (isVerified) return null

  return {
    name: "Permit2 Phishing",
    severity: "CRITICAL",
    description: `你正在「${hostname}」簽署一筆 Permit/Permit2 授權。這是一種不需要支付手續費的鏈下簽名，簽下去後對方就可以動用你的資產！這種手法是 2025-2026 最常見的詐騙方式——騙子用假的網站誘使你簽名，然後在幣價上漲時把你的錢全部轉走。`,
    category: "APPROVAL",
    source: "HEURISTIC",
  }
}

// ─── 主入口 ───

export interface HeuristicResult {
  factors: RiskFactor[]
  contractSecurity: ContractSecurity | null
  sanctions: SanctionsResult | null
}

export async function runHeuristics(
  parsed: ParsedTransaction,
  approveDetails: ApproveDetails | null,
  swapDetails: SwapDetails | null,
  transferDetails: TransferDetails | null,
  hostname: string,
  chainId: string
): Promise<HeuristicResult> {
  const [localFactors, apiResults] = await Promise.all([
    Promise.all([
      approveDetails ? checkInfiniteApproval(approveDetails) : null,
      transferDetails ? checkZeroValueTransfer(transferDetails) : null,
      checkAddressPoisoning(transferDetails, parsed),
      swapDetails ? checkHighSlippage(swapDetails) : null,
      checkDomainContractMatch(parsed, hostname),
      checkDangerousSelector(parsed.data),
      checkPermitPhishing(parsed.intent, hostname),
      checkLargeValue(parsed.value),
      checkPermit2(parsed.data, hostname),
    ]),
    Promise.all([
      checkContractReputation(parsed.to, chainId),
      checkAddressSanctions(parsed.from, parsed.to),
    ]),
  ])

  const localChecked = localFactors.filter((f): f is RiskFactor => f !== null)
  const [contractResult, sanctionResult] = apiResults

  return {
    factors: [...localChecked, ...contractResult.factors, ...sanctionResult.factors],
    contractSecurity: contractResult.data,
    sanctions: sanctionResult.data,
  }
}
