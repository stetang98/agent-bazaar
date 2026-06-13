# Agent Bazaar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, checkpointed) to implement this plan task-by-task. Independent components (contracts / agent / web) may be parallelized via subagents where interfaces are already locked. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed, demoable on-chain AI-agent marketplace on Arbitrum Sepolia where agents register identity + reputation via ERC-8004 and consumers pay per call in USDC via an x402-compatible flow — targeting the buildathon's Best Agentic Project prize.

**Architecture:** Three packages in one repo. `contracts/` (Foundry + OpenZeppelin v5) holds faithful ERC-8004 `IdentityRegistry` (ERC-721) + `ReputationRegistry` (permissionless) plus a novel `PaymentEscrow` that settles x402 payments through EIP-3009 `receiveWithAuthorization` and emits `TaskPaid` receipts. `agent/` (Node/TS + Express) is the self-hosted x402 facilitator + a flagship Solidity-auditor agent that registers itself on-chain at boot. `web/` (Vite + React + wagmi/viem) is the marketplace dApp closing the loop: discover → pay (gasless signature) → use → rate → reputation updates, with a "verified buyer ✓" filter backed by on-chain `TaskPaid` receipts.

**Tech Stack:** Solidity 0.8.24, Foundry (forge 1.7.1), OpenZeppelin Contracts v5; Node 24 + TypeScript + Express + viem; React + Vite + wagmi + viem + TanStack Query; OpenAI `gpt-4o-mini` (with deterministic static-analysis fallback). Deploy target: Arbitrum Sepolia (chainId 421614).

---

## Research-locked constants (DO NOT re-derive — verified against primary sources)

```
Chain:            Arbitrum Sepolia
chainId:          421614          (CAIP-2: "eip155:421614")
RPC:              https://sepolia-rollup.arbitrum.io/rpc
Explorer:         https://sepolia.arbiscan.io
USDC:             0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d   (decimals = 6)
USDC EIP-712:     name="USD Coin"  version="2"  (READ on-chain name()/version() to be safe;
                  wrong domain name = "FiatTokenV2: invalid signature" — the #1 footgun)
EIP-3009 rule:    receiveWithAuthorization requires  to == msg.sender  (the escrow must be the
                  on-chain caller of USDC). transferWithAuthorization has NO such check.
TYPEHASHES (FiatTokenV2_2):
  TransferWithAuthorization = 0x7c7c6cdb67a18743f49ec6fa9b35f50d52ed05cbed4cc592e13b44501c1a2267
  ReceiveWithAuthorization  = 0xd099cc98ef71107a616c4f0f941f04c322d8e254fe26b3c6668db87aae413de8
ETH faucets:      alchemy.com/faucets/arbitrum-sepolia ; faucets.chain.link/arbitrum-sepolia
USDC faucet:      faucet.circle.com  (select Arbitrum Sepolia; 20 USDC / 2h / address)
```

**ERC-8004 (Draft, Jan 2026 update) — source of truth:** EIP text https://eips.ethereum.org/EIPS/eip-8004 ; reference impl to crib from: `ChaosChain/trustless-agents-erc-ri` (`src/IdentityRegistry.sol`, `src/ReputationRegistry.sol`, `src/interfaces/*.sol`). Identity = ERC-721 (agentId == tokenId, starts at **1**). `register(string agentURI, MetadataEntry[] metadata)` + overloads. Reserved metadata key `"agentWallet"` (set via EIP-712/ERC-1271 sig + `deadline`; auto-reset to `address(0)` on transfer via OZ v5 `_update`). Reputation `giveFeedback(agentId, int128 value, uint8 valueDecimals, tag1, tag2, endpoint, feedbackURI, bytes32 feedbackHash)` is **permissionless** (no `feedbackAuth`). `getSummary(agentId, address[] clientAddresses, tag1, tag2)` returns `(uint64 count, int128 summaryValue, uint8 summaryValueDecimals)` — the `clientAddresses[]` filter is how we surface verified-buyer-only reputation. Full verbatim interfaces are in the ERC-8004 research report (in conversation history) — copy `src/interfaces/*.sol` from the reference repo for ABI-exact compliance.

**Registration JSON** (served by the agent, pointed to by on-chain `agentURI`):
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Solidity Security Auditor",
  "description": "AI agent that audits Solidity for security pitfalls. Pay per audit in USDC via x402.",
  "image": "<url>",
  "services": [
    { "name": "web", "endpoint": "https://<agent-host>/" },
    { "name": "A2A", "endpoint": "https://<agent-host>/.well-known/agent-card.json", "version": "0.3.0" }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [ { "agentId": <id>, "agentRegistry": "eip155:421614:<IdentityRegistry>" } ],
  "supportedTrust": ["reputation"]
}
```

**x402 wire format (v1 shape — what we implement on the wire):**
- `402` body: `{ x402Version:1, error, accepts:[{ scheme:"exact", network:"eip155:421614", maxAmountRequired:"100000" /*0.10 USDC @ 6dp*/, asset:USDC, payTo:<escrow>, resource, description, mimeType:"application/json", outputSchema:null, maxTimeoutSeconds:120, extra:{ name:"USD Coin", version:"2" } }] }`
- `X-PAYMENT` request header = `base64(JSON)` of `{ x402Version:1, scheme:"exact", network:"eip155:421614", payload:{ signature:"0x..", authorization:{ from,to,value,validAfter,validBefore,nonce } } }`. For the escrow route, `to` = escrow address and the signature is over the **ReceiveWithAuthorization** typed-data.
- `X-PAYMENT-RESPONSE` header = `base64(JSON)` of `{ success:true, transaction:"0x..", network:"eip155:421614", payer:"0x.." }`.

---

## Repo structure

```
Arbitrum/
├── contracts/                      # Foundry
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── src/
│   │   ├── interfaces/{IIdentityRegistry,IReputationRegistry}.sol   # copied from ref impl
│   │   ├── IdentityRegistry.sol
│   │   ├── ReputationRegistry.sol
│   │   └── PaymentEscrow.sol
│   ├── test/{IdentityRegistry,ReputationRegistry,PaymentEscrow}.t.sol
│   ├── script/Deploy.s.sol
│   └── deployments/arbitrum-sepolia.json   # written by deploy, consumed by agent + web
├── agent/                          # Node/TS Express
│   ├── src/{server,config,registry,agentCard}.ts
│   ├── src/x402/{challenge,verify,settle,middleware}.ts   # self-hosted facilitator + middleware
│   ├── src/agents/{auditor,analyst}.ts                    # auditor = flagship; analyst = P1
│   ├── src/llm/{openai,fallbackAnalyzer}.ts
│   ├── .env.example                # OPENAI_API_KEY, AGENT_PK, FACILITATOR_PK, RPC_URL, addresses
│   └── package.json / tsconfig.json
├── web/                            # Vite + React
│   ├── src/{App,main}.tsx
│   ├── src/wagmi.ts
│   ├── src/lib/{abis,addresses,x402Pay,reputation}.ts
│   ├── src/components/{AgentCard,AgentGrid,CallPanel,RatePanel,ReputationBadge}.tsx
│   └── src/styles/{tokens.css,global.css}
├── docs/superpowers/{specs,plans}/...
├── README.md
└── .gitignore                      # already created
```

---

## TIER P0 — core closed loop (a complete, submittable entry on its own)

### Task 1: Foundry scaffold + config
**Files:** Create `contracts/foundry.toml`, `contracts/remappings.txt`; install OZ v5.
- [ ] `forge init contracts --no-git` (or `mkdir contracts && cd contracts && forge init --force --no-git`).
- [ ] `cd contracts && forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git` (vendored under `lib/`).
- [ ] `foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
evm_version = "paris"      # safe on Arbitrum; avoids PUSH0 edge cases
optimizer = true
optimizer_runs = 200
remappings = ["@openzeppelin/=lib/openzeppelin-contracts/"]
fs_permissions = [{ access = "read-write", path = "./deployments" }]
[rpc_endpoints]
arbitrum_sepolia = "https://sepolia-rollup.arbitrum.io/rpc"
[etherscan]
arbitrum_sepolia = { key = "${ARBISCAN_API_KEY}", url = "https://api-sepolia.arbiscan.io/api" }
```
- [ ] Delete the `Counter.sol` template + test. `forge build` must succeed.
- [ ] Commit: `chore(contracts): scaffold foundry + openzeppelin v5`.

### Task 2: IdentityRegistry (ERC-8004, ERC-721) + tests — TDD
**Files:** `contracts/src/interfaces/IIdentityRegistry.sol`, `contracts/src/IdentityRegistry.sol`, `contracts/test/IdentityRegistry.t.sol`.
- [ ] Copy `IIdentityRegistry.sol` verbatim from the ChaosChain reference (signatures in the ERC-8004 research report). 
- [ ] **Write failing tests first** covering: `register(uri)` returns id starting at 1 and emits `Registered`; owner == msg.sender; `agentWallet` defaults to owner; `setMetadata` rejects reserved key `"agentWallet"`; `setAgentURI` only by owner/approved; `setAgentWallet` accepts a valid EIP-712 sig from the new wallet and rejects expired/bad sig; transfer auto-resets `agentWallet` to `address(0)`; `totalAgents`/`agentExists`.
- [ ] Run `forge test --match-contract IdentityRegistry` → must FAIL.
- [ ] Implement `IdentityRegistry` extending OZ v5 `ERC721URIStorage` + `EIP712` + `ReentrancyGuard`, using the verified skeleton (OZ v5 idioms: `_update` hook for wallet-reset, `_isAuthorized`, `_ownerOf`). Reserved key guard, EIP-712 `SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)` typehash + `SignatureChecker` (EIP-712 + ERC-1271). agentId counter starts at 1.
- [ ] Run tests → PASS. Commit: `feat(contracts): ERC-8004 IdentityRegistry + tests`.

### Task 3: ReputationRegistry (ERC-8004, permissionless) + tests — TDD
**Files:** `contracts/src/interfaces/IReputationRegistry.sol`, `contracts/src/ReputationRegistry.sol`, `contracts/test/ReputationRegistry.t.sol`.
- [ ] Copy `IReputationRegistry.sol` verbatim from the reference.
- [ ] **Failing tests:** `initialize(identityRegistry)` sets it once (reverts on re-init); `giveFeedback` is permissionless, appends per-client feedback, increments `feedbackIndex`, emits `NewFeedback`, registers the client in `getClients`; `revokeFeedback` marks revoked + emits; `getSummary` averages `value` across **all clients** and across a **`clientAddresses[]` subset** (this powers verified-buyer filtering); `readFeedback`/`getLastIndex` correct; rejects `valueDecimals > 18`.
- [ ] Run → FAIL. Implement faithfully (signed fixed-point `int128 value` + `uint8 valueDecimals`; no pre-auth). Run → PASS.
- [ ] Commit: `feat(contracts): ERC-8004 ReputationRegistry + tests`.

### Task 4: PaymentEscrow (x402 settlement via EIP-3009 receiveWithAuthorization) + tests — TDD
**Files:** `contracts/src/PaymentEscrow.sol`, `contracts/test/PaymentEscrow.t.sol`. This is the novel, judged-heaviest contract.
- [ ] **Failing tests** (fork or mock USDC): `settle(...)` pulls `value` USDC from `from` into the escrow via `receiveWithAuthorization`, credits `owed[agentWallet] += value`, records the `TaskPaid` receipt keyed by `taskId`, and emits `TaskPaid(payer, agentId, taskId, amount)`; replayed `taskId` reverts; `hasPaid(payer, agentId)` / receipt lookup true after settle; `withdraw()` pull-pays the agent owner and zeroes `owed` (checks-effects-interactions, `nonReentrant`, `SafeERC20`); only the recorded agent owner can withdraw.
- [ ] Use a **mock EIP-3009 USDC** for unit tests (implements `receiveWithAuthorization` enforcing `to == msg.sender`), and one fork test against real USDC if a funded signer is available.
- [ ] Implement:
```solidity
// settle is called by the facilitator/relayer; payer signs ReceiveWithAuthorization with to = address(this)
function settle(
    bytes32 taskId, uint256 agentId, address agentWallet,
    address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce,
    uint8 v, bytes32 r, bytes32 s
) external nonReentrant {
    require(receipts[taskId].amount == 0, "task settled");
    // escrow is msg.sender of USDC => to == msg.sender check in EIP-3009 passes
    usdc.receiveWithAuthorization(from, address(this), value, validAfter, validBefore, nonce, v, r, s);
    receipts[taskId] = Receipt(from, agentId, value, uint64(block.timestamp));
    owed[agentWallet] += value;
    paidBy[from][agentId] = true;
    emit TaskPaid(from, agentId, taskId, value);
}
function withdraw() external nonReentrant { uint256 a = owed[msg.sender]; require(a>0,"nothing"); owed[msg.sender]=0; usdc.safeTransfer(msg.sender, a); }
function hasPaid(address payer, uint256 agentId) external view returns (bool) { return paidBy[payer][agentId]; }
```
- [ ] Run → PASS. Commit: `feat(contracts): PaymentEscrow x402/EIP-3009 settlement + tests`.

### Task 5: Code-review gate on contracts (memory rule — BEFORE deploy)
- [ ] Run `code-reviewer` + `security-reviewer` agents over `contracts/src/**`. Focus: reentrancy, access control, EIP-712 replay (consider per-agent nonce on `setAgentWallet`), `taskId` replay, unchecked returns, ERC-8004 spec faithfulness.
- [ ] Fix all CRITICAL/HIGH. Commit fixes: `fix(contracts): address review findings`.

### Task 6: Deploy contracts to Arbitrum Sepolia
**Files:** `contracts/script/Deploy.s.sol`, `contracts/deployments/arbitrum-sepolia.json`.
- [ ] Deploy `IdentityRegistry`, `ReputationRegistry` (then `initialize(identity)`), `PaymentEscrow(usdc)`. Write addresses + block numbers to `deployments/arbitrum-sepolia.json`.
- [ ] Requires user's deployer key (Arb Sepolia ETH funded) in env: `forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --private-key $DEPLOYER_PK --broadcast --verify`.
- [ ] Verify on Arbiscan. Commit the `deployments/*.json` (addresses are public): `chore: deploy core contracts to arbitrum sepolia`.

### Task 7: Agent backend skeleton + ERC-8004 self-registration + AgentCard
**Files:** `agent/src/{server,config,registry,agentCard}.ts`, `agent/.env.example`, `agent/package.json`, `agent/tsconfig.json`.
- [ ] `npm i express viem dotenv zod openai`; `npm i -D typescript tsx @types/express @types/node`.
- [ ] `config.ts`: load + zod-validate env (`RPC_URL`, `AGENT_PK`, `FACILITATOR_PK`, `OPENAI_API_KEY?`, `IDENTITY_REGISTRY`, `REPUTATION_REGISTRY`, `PAYMENT_ESCROW`, `USDC`, `PUBLIC_URL`, `PRICE_USDC` default "0.10"). Fail fast on missing required.
- [ ] `agentCard.ts`: serve `/.well-known/agent-card.json` (A2A card) + `/.well-known/agent-registration.json` (the registration JSON above with live `agentId`).
- [ ] `registry.ts`: at boot, if not already registered, call `IdentityRegistry.register(agentURI=<PUBLIC_URL>/.well-known/agent-registration.json)` with the agent wallet; cache `agentId`. (Idempotent: skip if env `AGENT_ID` set.)
- [ ] `server.ts`: Express app, health route, mounts agent routes (Task 9) + facilitator routes (Task 8).
- [ ] Commit: `feat(agent): server skeleton + ERC-8004 self-registration + AgentCard`.

### Task 8: x402 self-hosted facilitator (verify + settle via escrow)
**Files:** `agent/src/x402/{challenge,verify,settle,middleware}.ts`.
- [ ] `challenge.ts`: build the `402` `accepts` object (constants above; `payTo` = escrow, `asset` = USDC, `maxAmountRequired` from `PRICE_USDC`).
- [ ] `middleware.ts`: Express middleware — if no `X-PAYMENT` header → respond `402` + `accepts`. Else base64-decode, validate shape (zod), call `verify`, then `settle`, attach `X-PAYMENT-RESPONSE`, `next()`.
- [ ] `verify.ts`: recover signer from the ReceiveWithAuthorization typed-data == `authorization.from`; check `value >= maxAmountRequired`, validity window, asset/network match, `from` USDC balance ≥ value.
- [ ] `settle.ts`: using a `FACILITATOR_PK` wallet (funded with Arb Sepolia ETH), send `PaymentEscrow.settle(taskId, agentId, agentWallet, from, value, validAfter, validBefore, nonce, v, r, s)`; wait for receipt; return `{success, transaction, payer}`. `taskId = keccak256(nonce)` (deterministic, replay-safe via escrow).
- [ ] Test with a scripted client (`agent/scripts/payTest.ts`) signing ReceiveWithAuthorization with a funded test key. Commit: `feat(agent): self-hosted x402 facilitator settling through PaymentEscrow`.

### Task 9: Flagship auditor agent (OpenAI + deterministic fallback)
**Files:** `agent/src/agents/auditor.ts`, `agent/src/llm/{openai,fallbackAnalyzer}.ts`; route `POST /agents/auditor/audit` behind the x402 middleware.
- [ ] `fallbackAnalyzer.ts`: deterministic regex/heuristic checks (e.g., `tx.origin` auth, unchecked low-level `.call`, missing `nonReentrant` on external-call-then-state, `selfdestruct`, unbounded loops, `block.timestamp` randomness, missing access control on `onlyOwner`-shaped fns) → structured findings `{severity, line, title, detail, suggestion}`.
- [ ] `openai.ts`: if `OPENAI_API_KEY` present, send the contract source to `gpt-4o-mini` with a strict JSON schema prompt → same findings shape; on error/timeout, fall back to `fallbackAnalyzer`. Validate output with zod.
- [ ] Paid route returns the findings JSON only after x402 settlement succeeds. Commit: `feat(agent): solidity auditor (LLM + deterministic fallback)`.

### Task 10: Frontend scaffold + wallet + read agents & reputation
**Files:** `web/` (Vite React TS), `web/src/wagmi.ts`, `web/src/lib/{abis,addresses,reputation}.ts`, `web/src/components/{AgentGrid,AgentCard,ReputationBadge}.tsx`.
- [ ] `npm create vite@latest web -- --template react-ts`; `npm i wagmi viem @tanstack/react-query`.
- [ ] `wagmi.ts`: config for Arbitrum Sepolia + injected connector. Wrap app in WagmiProvider + QueryClientProvider.
- [ ] Read `IdentityRegistry` (`totalAgents`, iterate `tokenURI` → fetch registration JSON) → render agent grid. Read `ReputationRegistry.getSummary` for each → `ReputationBadge`.
- [ ] Commit: `feat(web): scaffold + wallet connect + agent discovery from chain`.

### Task 11: Frontend — call agent + x402 pay (gasless signature) + render result
**Files:** `web/src/lib/x402Pay.ts`, `web/src/components/CallPanel.tsx`.
- [ ] `x402Pay.ts`: on a `402`, read `accepts`; build the **ReceiveWithAuthorization** typed-data (USDC EIP-712 domain from on-chain `name()`/`version()`, `to` = escrow, random 32-byte `nonce`, validity window); `walletClient.signTypedData(...)` (gasless); base64-encode the `X-PAYMENT` payload; retry the request with the header. Read `X-PAYMENT-RESPONSE`.
- [ ] `CallPanel.tsx`: textarea for Solidity → "Audit for $0.10" → triggers pay flow → renders findings (severity-colored). Surface the settlement tx link.
- [ ] Commit: `feat(web): x402 pay flow + auditor call UI`.

### Task 12: Frontend — rate agent + verified-buyer reputation
**Files:** `web/src/components/RatePanel.tsx`, extend `web/src/lib/reputation.ts`.
- [ ] After a successful audit, show rating UI → `ReputationRegistry.giveFeedback(agentId, value, valueDecimals, "audit", "", endpoint, "", 0x0)` (a normal on-chain tx; needs gas).
- [ ] Compute "verified buyers" = addresses with a `TaskPaid` log for this agent (read `PaymentEscrow` events); show a **"Verified buyer ✓"** badge and a toggle to filter `getSummary` by that `clientAddresses[]` set. Reputation animates on update.
- [ ] Commit: `feat(web): on-chain rating + verified-buyer reputation filter`.

### Task 13: End-to-end on Arbitrum Sepolia
- [ ] Run agent (registered on-chain) + facilitator + web against deployed contracts. Walk the full loop with the user's funded wallet: discover → audit (sign, pay) → see result → rate → reputation + verified badge update. Capture screenshots.
- [ ] Fix any integration breakage. Commit: `test: end-to-end loop verified on arbitrum sepolia`.

**↑ P0 complete = a deployed, working, both-primitives entry. Everything below raises the ceiling.**

---

## TIER P1 — depth & quality

### Task 14: Second agent — on-chain Address Analyst (proves "marketplace")
**Files:** `agent/src/agents/analyst.ts`, register a 2nd ERC-8004 agent. Paid route summarizes an address's recent activity (read via viem) with LLM/fallback. Commit.

### Task 15: Full Foundry test suite — coverage + fuzz + gas
- [ ] Add fuzz tests (escrow value/nonce, reputation aggregation), `forge coverage` (target high), `forge snapshot`. Fix gaps. Commit: `test(contracts): fuzz + coverage + gas snapshot`.

### Task 16: ValidationRegistry (OPTIONAL — experimental per spec)
- [ ] Only if time remains. Faithful impl + minimal tests. Commit.

---

## TIER P2 — polish & submission

### Task 17: UI polish — intentional design system
- [ ] `tokens.css`: neon-green × deep-blue palette (echo Open House London brand), type scale, spacing rhythm; bold editorial / neo-brutalist treatment; hover/focus/active states; responsive 320–1440; `prefers-reduced-motion` safe. Avoid template look (per design-quality rules). Compositor-friendly motion only.

### Task 18: README + architecture diagram
- [ ] Problem, solution, ERC-8004 + x402 usage (with the verified-buyer story), deployed addresses + Arbiscan links, run instructions, screenshots, architecture diagram (the data-flow from the spec).

### Task 19: Demo video script + pitch + deployed-addresses page
- [ ] 2–3 min script hitting: the agent-economy problem, live audit+pay demo, on-chain identity+reputation+receipts, why it fits Best Agentic Project. In-app "Contracts" page linking Arbiscan.

### Task 20: Final code-review gate + submission (memory rule)
- [ ] Re-run `code-reviewer` over agent + web; `security-reviewer` over any new contracts. Fix CRITICAL/HIGH.
- [ ] Final commit + push to GitHub (`stetang98`). Submit on HackQuest.

### Task 21 (OPTIONAL): Deploy to Robinhood Chain testnet
- [ ] If EVM-compatible + time remains, deploy the same contracts → eligible for the second reserved-slot pool. Add addresses to README.

---

## Self-Review (run against the spec)

- **Spec coverage:** Every spec section maps to tasks — Identity/Reputation/Escrow (T2–T4), x402 (T8, T11), agent (T7, T9), frontend loop (T10–T12), deploy (T6), verified-buyer reputation (T12), tests (T2–T4, T15), polish/README/video (T17–T19), code-review gate (T5, T20), Robinhood (T21). ✓
- **Placeholders:** None — error-prone code (escrow settle, foundry.toml, x402 wire, registration JSON, constants) is concrete; boilerplate references locked interfaces.
- **Type consistency:** `agentId:uint256`, `value:int128`+`valueDecimals:uint8`, `taskId:bytes32`, `owed[agentWallet]`, `paidBy[from][agentId]`, `TaskPaid(payer,agentId,taskId,amount)` used consistently across contracts, agent settle, and web reputation/verified-buyer logic.
- **Risk note:** Escrow + `receiveWithAuthorization` is the one novel path; documented fallback = standard `transferWithAuthorization` to the agent EOA + verified-buyer via USDC Transfer logs (drops the escrow contract, keeps the full loop + both primitives). Sequenced so P0 stays shippable.
