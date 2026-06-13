# 🚀 Agent Bazaar — 上线清单（你要填/要做的事，全在这）

> 代码已全部写完 + 三层都过了 code review。**剩下的都是需要"你动手"的步骤**，按顺序往下做。
> 每个要填的值都标了 **谁填 / 从哪来**。私钥只进本地 `.env`，永远不要贴进对话或提交到 git。

---

## 📋 总表：需要你提供的值

| 值 | 谁填 | 从哪来 |
|---|---|---|
| dev 钱包**公开地址** (`0x…`) | 你 | 你的 MetaMask |
| dev 钱包**私钥** | 你（只填进本地 `.env` / 部署命令） | 你的 MetaMask（导出私钥） |
| **OpenAI API key**（可选） | 你 | platform.openai.com（见文末） |
| 3 个**合约地址** | 部署后**自动生成** | `contracts/deployments/arbitrum-sepolia.json` |
| **部署区块号** | 你（抄一下） | 部署命令的输出 / Arbiscan 交易页 |

---

## ☑️ 第 1 步：领测试币

### 1A · 领 ETH（付 gas 用）

你正在用的 **QuickNode** 页面（[faucet.quicknode.com/arbitrum/sepolia](https://faucet.quicknode.com/arbitrum/sepolia)）：
- [ ] 在 `0x...` 框里**粘贴你的钱包地址**
- [ ] 右边确认是 **Arbitrum / Sepolia**（默认已对）
- [ ] 点 **Continue** → 选额度（~0.05 ETH 够了）→ 领取

> ⚠️ 如果它要求"主网有少量 ETH"或"发推文"——换备选：
> - Alchemy: https://www.alchemy.com/faucets/arbitrum-sepolia
> - Chainlink: https://faucets.chain.link/arbitrum-sepolia
> - 实在不行：领 L1 Sepolia ETH（sepoliafaucet.com）→ 用 bridge.arbitrum.io 跨到 Arb Sepolia
> **只需要 ~0.02 ETH** 就够部署 + demo。

### 1B · 领 USDC（给 agent 付费用）

- [ ] 打开 **[faucet.circle.com](https://faucet.circle.com)**
- [ ] 网络选 **Arbitrum Sepolia**
- [ ] 粘贴**同一个钱包地址** → Claim（一次 10 USDC，够了）

---

## ☑️ 第 2 步：把地址发我

- [ ] 把你的钱包**公开地址**（`0x…`）发到对话里
- → 我用 `cast` 链上确认 ETH + USDC 都到账了，再给你放行部署

---

## ☑️ 第 3 步：部署合约到 Arbitrum Sepolia

在你自己的终端里跑（把 `0x你的私钥` 换成真私钥；私钥不进对话）：

```bash
cd contracts
DEPLOYER_PK=0x你的私钥 forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast
```

- [ ] 跑完后，记下输出里的 3 个地址（也会写进 `contracts/deployments/arbitrum-sepolia.json`）
- [ ] **抄下部署区块号**（输出里的 block，或在 [sepolia.arbiscan.io](https://sepolia.arbiscan.io) 查那笔交易）
- → 跟我说"部署好了"，我会把下面两个 `.env` 帮你填好

---

## ☑️ 第 4 步：填 `agent/.env`

先复制模板：`cd agent && cp .env.example .env`，然后填：

| 字段 | 填什么 | 来源 |
|---|---|---|
| `RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | 默认，别动 |
| `CHAIN_ID` | `421614` | 默认 |
| `AGENT_PK` | `0x你的私钥` | **你填**（dev 钱包私钥） |
| `FACILITATOR_PK` | 留空 | 默认用 AGENT_PK |
| `OPENAI_API_KEY` | 你的 key 或留空 | **你填**（可选，留空走 fallback） |
| `OPENAI_MODEL` | `gpt-4o-mini` | 默认 |
| `IDENTITY_REGISTRY` | `0x…` | **部署后填**（deployments JSON） |
| `REPUTATION_REGISTRY` | `0x…` | **部署后填** |
| `PAYMENT_ESCROW` | `0x…` | **部署后填** |
| `USDC` | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | 默认 |
| `PUBLIC_URL` | `http://localhost:8787` | 默认（本地）；公网部署再改 |
| `PRICE_USDC` | `0.10` | 默认 |
| `AGENT_ID` | 留空 | 首次启动会自动注册并打印 id；之后填进来可跳过重注册 |
| `PORT` | `8787` | 默认 |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | 默认（前端地址）；公网部署再加 |

> 标"部署后填"的 3 个地址 = 我可以在你部署完后帮你写进去。

---

## ☑️ 第 5 步：填 `web/.env`

先复制模板：`cd web && cp .env.example .env`，然后填：

| 字段 | 填什么 | 来源 |
|---|---|---|
| `VITE_RPC_URL` | `https://sepolia-rollup.arbitrum.io/rpc` | 默认 |
| `VITE_IDENTITY_REGISTRY` | `0x…` | **部署后填** |
| `VITE_REPUTATION_REGISTRY` | `0x…` | **部署后填** |
| `VITE_PAYMENT_ESCROW` | `0x…` | **部署后填** |
| `VITE_USDC` | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | 默认 |
| `VITE_AGENT_BASE_URL` | `http://localhost:8787` | 默认（本地 agent） |
| `VITE_DEPLOY_BLOCK` | 部署区块号 | **你填**（第 3 步抄的那个数字） |

---

## ☑️ 第 6 步：启动跑通

```bash
# 终端 1：启动 agent（会自动在链上注册自己）
cd agent && npm run dev

# 终端 2：启动前端
cd web && npm run dev          # 打开 http://localhost:5173
```

- [ ] 浏览器连钱包（确认在 Arbitrum Sepolia 网络）
- [ ] 点一个 agent → 贴合约 → "Audit · pay $0.10 USDC" → 钱包弹**签名**（不是交易，免 gas）
- [ ] 看到审计结果 + 链上 payment 链接 → 给它打分（链上 giveFeedback）→ 信誉刷新
- → 跑通后跟我说，我帮你录 demo 脚本要点 + 补 README 里的合约地址

---

## ☑️ 第 7 步：提交

- [ ] push 到 GitHub（你的账号 `stetang98`）：我可以帮你建仓 + push（你确认即可）
- [ ] 在 HackQuest 提交：仓库链接 + 在线 demo 链接 + README + （可选）demo 视频

---

## 附：拿 OpenAI API Key（可选，3 分钟）

> 没有也行，审计 agent 会自动退化到确定性静态分析器，demo 照常跑。

1. 打开 **platform.openai.com**（开发者平台，跟 ChatGPT 订阅是两回事）
2. Settings → **Billing** → 充值 **$5**（用 `gpt-4o-mini`，每次审计几分钱）
3. **platform.openai.com/api-keys** → Create new secret key → **立刻复制** `sk-…`
4. 填进 `agent/.env` 的 `OPENAI_API_KEY=`（别贴进对话）

---

**当前进度**：你在 👉 **第 1 步（领币）**。领完币、把地址发我，我们就进第 2~3 步。
