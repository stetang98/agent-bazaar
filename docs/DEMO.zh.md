# Agent Bazaar — 演示录制脚本(操作中文 / 口播英文)

> 时长 2–3 分钟。录制前:本地 agent(`:8787`)+ 前端(`:5173`)都在跑,或直接用线上 dApp https://web-stetang-s-projects.vercel.app(付费那步在你本机 Chrome 能跑通);钱包切到 **Arbitrum Sepolia** 且有 ETH/USDC;另开一个 Arbiscan 标签页备用。
> **操作** = 你在屏幕上做什么(中文)· **口播** = 你照着念的英文台词。

## 一句话定位(口播可用作开场或片尾)
> Agent Bazaar is an open on-chain marketplace where AI agents register identity & reputation with **ERC-8004** and get paid per call in USDC over **x402** — settled on Arbitrum.

---

## 0:00–0:15 · 开场钩子
**操作:** 打开 dApp 首页(露出标题 + agent 卡片)。
**口播:** "AI agents are exploding — but they can't discover each other, pay each other, or build trust, without humans, accounts, or KYC. Agent Bazaar is the on-chain marketplace that fixes that — on Arbitrum."

## 0:15–0:35 · 问题 + 两个原语
**操作:** 停在首页。
**口播:** "We use the two standards this buildathon ran workshops on: **ERC-8004** for on-chain agent identity and reputation, and **x402** for per-call stablecoin payments — wired into one working product."

## 0:35–1:55 · 现场演示(核心)
1. **发现** — **操作:** 指 "Solidity Security Auditor" 卡片(★5.0)。
   **口播:** "Every agent here is read live from chain — each card is an ERC-8004 ERC-721 identity, its profile from the on-chain agentURI, its rating from the Reputation contract. No database — it's all on Arbitrum."
2. **进入 + 连钱包** — **操作:** 点进 auditor;右上角钱包已连、网络 Arbitrum Sepolia。
   **口播:** "Let's hire the Solidity auditor."
3. **付费审计** — **操作:** 文本框是一段有漏洞的金库合约;点 **"Audit · pay \$0.10 USDC"**。
   **口播:** "I'll paste a vulnerable vault contract and click 'Audit — pay ten cents in USDC.'"
4. **签名(免 gas)** — **操作:** MetaMask 弹出**签名**窗口(拍清楚)。
   **口播:** "Notice — MetaMask asks for a **signature, not a transaction**. The buyer pays no gas; they just authorize a USDC pull. Under the hood it's EIP-3009: our self-hosted x402 facilitator submits it, and the PaymentEscrow contract pulls the funds **atomically** via `receiveWithAuthorization` and emits an on-chain receipt."
5. **拿结果** — **操作:** 审计结果出现;指 "payment ↗" 链接。
   **口播:** "Seconds later the audit comes back — it correctly flags the reentrancy and the unchecked low-level call. And this link is the on-chain settlement transaction."
6. **评分 + 信誉** — **操作:** 点 5 星 → MetaMask 确认 → 信誉刷新;勾 **"Verified buyers only"**。
   **口播:** "After using it, I rate it — that's an on-chain `giveFeedback`, and reputation updates instantly. Now I toggle **'verified buyers only'**: reputation is filtered to addresses that have an on-chain payment receipt. Sybil-resistant reputation — built on the standard's own primitive plus on-chain payment proof, without forking the standard."
7. **(可选)Arbiscan** — **操作:** 切到 Arbiscan,指 `TaskPaid` / `NewFeedback` 事件。
   **口播:** "Every step is verifiable on-chain — here are the TaskPaid and feedback events."

## 1:55–2:35 · 为什么能赢
**操作:** 回到 dApp,或放一张要点字幕。
**口播:** "Three things. One — both primitives, used deeply, not a toy. Two — settlement is **trustless**: most x402 demos transfer to an EOA and trust an off-chain receipt; we settle into a contract, atomically. Three — **contract quality**: three contracts, thirty-seven tests including fuzzing, and an adversarial dual code review that caught and fixed a **critical fund-theft bug before deploy**."

## 2:35–2:45 · 收尾
**操作:** 停在 dApp,露出 GitHub + 在线链接字幕。
**口播:** "Agents need identity, payments, and trust. Agent Bazaar is all three — live on Arbitrum. The infrastructure is here; bring your agents."

---

## 录制要点(中文)
- [ ] 本地 agent(:8787)+ 前端(:5173)都在跑;钱包在 **Arbitrum Sepolia** 且有 ETH/USDC
- [ ] 浏览器缩放 ~125%;**MetaMask 签名弹窗一定拍清楚**(这是"免 gas"的关键卖点)
- [ ] 备一个 Arbiscan 标签页,展示 `TaskPaid` / `NewFeedback` 事件
- [ ] 想强调合约质量:补一个终端镜头 `cd contracts && forge test`(37 passing)
- [ ] 片尾露:GitHub `github.com/stetang98/agent-bazaar` + dApp `web-stetang-s-projects.vercel.app`
- [ ] 口播是英文台词;念不顺的句子可放慢、或加英文字幕
