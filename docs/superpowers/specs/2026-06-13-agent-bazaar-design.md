# Agent Bazaar — Design Spec

| | |
|---|---|
| **Project** | Agent Bazaar |
| **Event** | Arbitrum Open House London — Online Buildathon |
| **Target prize** | Best Agentic Project (15,000 USDC) |
| **Submission deadline** | 2026-06-14 23:59 BST |
| **Chain** | Arbitrum Sepolia (testnet) |
| **Date** | 2026-06-13 |

## 1. Narrative / PMF

Autonomous AI agents are proliferating, but they cannot **discover each other, pay each other, or build reputation** — without humans or KYC. **Agent Bazaar** is an open agent marketplace + payment rail on Arbitrum: agents register on-chain identity & reputation via **ERC-8004**, and consumers (humans or other agents) pay per call in USDC via **x402**.

This exercises the two primitives the buildathon ran workshops on (ERC-8004 agent registration, x402 agent payments) as a working product solving a real, current problem — the agent economy's identity + payments + trust layer.

## 2. Goals / Non-goals

**Goals**
- Faithful ERC-8004 Identity + Reputation registries on Arbitrum Sepolia.
- Working x402 pay-per-call flow in USDC (EIP-3009, gasless for the payer).
- ≥1 real, useful LLM-backed agent (Solidity auditor) registered + monetized.
- A polished dApp closing the loop: **discover → pay → use → rate → reputation updates**.
- High smart-contract quality: tests, NatSpec, access control, reentrancy safety, OpenZeppelin.

**Non-goals (YAGNI for 1.5 days)**
- Mainnet deployment (testnet only).
- Token / governance.
- Full A2A protocol beyond the AgentCard surface we need.
- Off-chain indexer infra (read directly via viem + events).

## 3. Architecture & data flow

```
[Browser dApp] ──1 browse──▶ reads IdentityRegistry + ReputationRegistry + each agent's AgentCard
     │
     │──2 call agent (HTTP /audit)──▶ [Agent backend]
     │◀─ 402 Payment Required {price, USDC, payTo, network} ─┘
     │──3 wallet signs EIP-3009 (gasless USDC authorization)
     │──4 retry w/ X-PAYMENT header──▶ [Agent backend] ─verify─▶ [x402 facilitator] ─settle─▶ USDC into PaymentEscrow (emit TaskPaid)
     │                                       └─ runs LLM audit
     │◀─5 200 + audit result + on-chain receipt ──┘
     │──6 submit rating──▶ ReputationRegistry (permissionless per ERC-8004 — feedbackAuth was removed)
     │◀─7 reputation refreshes live; dApp shows "verified buyer ✓" via TaskPaid receipts + the spec's clientAddresses filter
```

Each agent at boot: registers on `IdentityRegistry` and serves an A2A AgentCard at `/.well-known/agent-card.json`.

**Components**
- `contracts/` — Solidity (Foundry + OpenZeppelin)
- `agent/` — Node/TS x402-paywalled agent backend(s) + minimal facilitator fallback
- `web/` — Vite + React + wagmi/viem dApp

## 4. Smart contracts (judged first — highest priority)

- **`IdentityRegistry.sol`** (ERC-8004, **ERC-721** — agentId = tokenId): `register(agentURI, metadata[])`; `agentURI` → off-chain registration JSON (sets `x402Support: true` + lists the A2A AgentCard service); reserved `agentWallet` key set via EIP-712/ERC-1271 sig and auto-reset on transfer; `Registered` event.
- **`ReputationRegistry.sol`** (ERC-8004): `giveFeedback` is **permissionless** (the spec removed `feedbackAuth` in the Jan 2026 update — we stay faithful, no on-chain gating); signed fixed-point score (`int128 value` + `uint8 valueDecimals`); `getSummary`/`readAllFeedback` accept a `clientAddresses[]` filter. **Anti-sybil lives off the standard:** the dApp filters reputation to "verified buyers" using `PaymentEscrow` TaskPaid receipts — exactly the reviewer-filtering the spec intends.
- **`PaymentEscrow.sol`**: the x402 `payTo` target. `settle(...)` pulls USDC via **`receiveWithAuthorization` (EIP-3009)** with the escrow as `to` (msg.sender), records `TaskPaid(payer, agentId, amount, taskId)`, emits event, and pull-pays the agent. Showcases real Solidity: EIP-3009 integration, reentrancy safety, access control.
- *(stretch)* **`ValidationRegistry.sol`** (ERC-8004 third registry).
- **Conformance:** interfaces verified against EIP-8004 (Draft, Jan 2026 update) + the ChaosChain `trustless-agents-erc-ri` reference impl. Build on **OpenZeppelin v5** (`_update` hook for the agentWallet transfer-reset). Validation Registry is experimental per spec → P2/optional.
- **Security:** OZ `Ownable` / `ReentrancyGuard` / `SafeERC20`; checks-effects-interactions; custom errors; full NatSpec.
- **Tests:** Foundry unit + fuzz (registration, reputation gating, EIP-3009 settle path, access control, reentrancy); target high coverage.

## 5. Agent backend

- **Flagship: Solidity Security Auditor agent.** `POST` contract source → `402` → pay $0.10 USDC → LLM (`gpt-4o-mini`) returns structured findings (severity, line, issue, suggested fix). **Deterministic static-analysis fallback** when no `OPENAI_API_KEY` (pattern checks: `tx.origin`, unchecked low-level call, reentrancy shape, missing access control, etc.) so demos never break.
- **Second agent (P1, proves "marketplace"):** On-chain Address Analyst — given an address, summarizes its activity.
- Each agent: registers on `IdentityRegistry` at boot; serves `/.well-known/agent-card.json`; x402 middleware (`x402-express`) on the paid route.
- **x402 facilitator:** use a hosted testnet facilitator if it supports Arb Sepolia; otherwise a **minimal self-hosted verify+settle** (calls `PaymentEscrow.settle`).

## 6. Frontend (the polish — anti-template)

- **Marketplace:** grid of registered agents (read `IdentityRegistry` + AgentCards), live reputation (`ReputationRegistry`).
- **Agent page:** input → connect wallet → x402 pay (sign EIP-3009 in-browser) → render result → on-chain rate → reputation animates.
- **Design direction:** neon-green × deep-blue, bold editorial / neo-brutalist (echo the Open House London brand); intentional, non-template; responsive (320–1440); reduced-motion safe.

## 7. Priority tiers / build order

- **P0 — must ship (a complete entry on its own):** Identity + Reputation contracts deployed to Arb Sepolia; auditor agent registered + x402-paid + producing real output; dApp closes discover→pay→use→rate→reputation loop. Hits both primitives.
- **P1 — depth:** `PaymentEscrow` EIP-3009 + reputation gating; 2nd agent; full Foundry test suite; `ValidationRegistry`.
- **P2 — polish:** UI polish, README, architecture diagram, demo video, deployed-addresses page; optional Robinhood Chain deploy (second reserved-slot pool).

"Don't cut anything" = aim for all of it; tiers guarantee we never end up with a half-built thing that won't run.

## 8. Definition of done (mapped to judging criteria)

- **Qualification:** deployed on Arbitrum Sepolia with public addresses.
- **Smart contract quality:** clean, tested, OZ-based; reviewed by `code-reviewer` + `security-reviewer` (memory rule [[code-review-before-done]]).
- **Product:** live dApp URL + live agent URL; full loop works.
- **Comms:** README (problem, architecture, ERC-8004 + x402 usage, run steps, addresses) + 2–3 min demo video script + pitch.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| ERC-8004 interface drift | Verify against the EIP before coding |
| x402 facilitator lacks Arb Sepolia | Self-host minimal facilitator |
| USDC EIP-3009 support on testnet | Circle faucet USDC (faucet.circle.com); confirm `receiveWithAuthorization`; fallback to approve + `transferFrom` escrow |
| No OpenAI key / billing issue | Deterministic analyzer fallback |
| Time | Strict P0→P1→P2; P0 alone is submittable |

## 10. Deliverables

Repo (`contracts/` `agent/` `web/` `docs/`), deployed addresses, live URLs, README, architecture diagram, demo video, pitch.
