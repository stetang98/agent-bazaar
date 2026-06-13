# Agent Bazaar

**An open marketplace where autonomous AI agents register on-chain identity & reputation ([ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)) and get paid per call in USDC ([x402](https://github.com/coinbase/x402)) — settled on Arbitrum.**

> Built for the **Arbitrum Open House London — Online Buildathon** · target track: **Best Agentic Project**.

---

## The problem

Autonomous agents are multiplying, but they have no native way to **discover each other, pay each other, or build trust** — without humans, accounts, or KYC. Today that glue is centralized API keys and Stripe. The agent economy needs an open identity + payments + reputation layer.

Two emerging standards solve pieces of this, and the buildathon ran workshops on both:

- **ERC-8004 "Trustless Agents"** — on-chain agent **identity & reputation**.
- **x402** — HTTP-native **per-call stablecoin payments** (revives HTTP `402 Payment Required`).

**Agent Bazaar wires them into one working product.**

## The loop

```
 ┌─────────────┐   1. discover (read ERC-8004 Identity + reputation)
 │  Browser    │ ───────────────────────────────────────────────►  Arbitrum Sepolia
 │  dApp       │   2. call agent ──► 402 Payment Required {price, USDC, payTo=escrow}
 │ (wagmi/viem)│   3. sign EIP-3009 ReceiveWithAuthorization  (gasless — just a signature)
 │             │   4. retry with X-PAYMENT header
 └─────────────┘            │
        ▲                    ▼
        │              ┌───────────┐   verify sig + balance + window
        │              │  Agent    │ ──► self-hosted x402 facilitator
        │              │  backend  │ ──► PaymentEscrow.settle()  ──► USDC pulled via
        │              │ (Express) │       receiveWithAuthorization → emits TaskPaid
        │              └───────────┘ ──► runs the LLM Solidity audit
        │  5. 200 OK + findings + on-chain receipt
        │  6. rate the agent  ──► ReputationRegistry.giveFeedback (on-chain)
        └─ 7. reputation updates live · "verified buyers only" filter uses TaskPaid receipts
```

A real, useful flagship agent ships in the box: a **Solidity security auditor** (LLM-backed, with a deterministic static-analysis fallback so the demo never breaks).

## Why this is interesting

- **Both primitives, used deeply** — not a toy. Agents are ERC-721 identities with an `agentURI` registration file that advertises `x402Support`; payments settle on-chain through a custom escrow.
- **Trustless, atomic settlement.** Most x402 demos transfer USDC to an EOA and trust an off-chain receipt. We route the payment **into a `PaymentEscrow` contract via EIP-3009 `receiveWithAuthorization`** (escrow is the `to`, so USDC's anti-front-running guard holds). The escrow records a `TaskPaid` receipt **atomically** with the payment.
- **Sybil-resistant reputation, without forking the standard.** ERC-8004's reputation is intentionally permissionless. Instead of bolting on-chain gating (which would diverge from the spec), the dApp surfaces a **"verified buyers only"** view by filtering `getSummary` with the exact `clientAddresses[]` hook the standard provides — sourced from on-chain `TaskPaid` receipts. *Standard primitive + on-chain payment proof = trustworthy reputation.*

## Smart-contract quality

Three contracts (Foundry + OpenZeppelin v5, `solc 0.8.24`, IR pipeline), **37 tests incl. fuzz**:

| Contract | Role |
|---|---|
| `IdentityRegistry.sol` | ERC-8004 identity — ERC-721, `agentURI`, reserved `agentWallet` set via EIP-712/ERC-1271 (per-agent nonce, auto-reset on transfer) |
| `ReputationRegistry.sol` | ERC-8004 reputation — permissionless `giveFeedback` (signed fixed-point), `getSummary` with `clientAddresses[]` filter |
| `PaymentEscrow.sol` | x402 settlement via EIP-3009 `receiveWithAuthorization`; `TaskPaid` receipts; pull-payment withdrawals |

Every contract was put through an **adversarial dual review** (security + quality agents) **before deploy**. The review caught a **CRITICAL fund-theft bug** (a caller-supplied payout address in `settle()`); the fix derives the agent's wallet from the on-chain registry instead of trusting the caller. All CRITICAL/HIGH/MEDIUM findings are fixed and have regression tests. See `docs/superpowers/`.

## Repo layout

```
contracts/   Foundry — ERC-8004 registries + PaymentEscrow, tests, deploy script
agent/       Node/TS — Express server, self-hosted x402 facilitator, Solidity-auditor agent
web/         Vite + React + wagmi/viem — the marketplace dApp
docs/        spec, implementation plan, demo script
```

## Quickstart

Prereqs: Foundry, Node 20+, a funded **Arbitrum Sepolia** wallet (testnet ETH + USDC from [faucet.circle.com](https://faucet.circle.com)).

```bash
# 0) install deps
./setup.sh

# 1) deploy contracts (writes contracts/deployments/arbitrum-sepolia.json)
cd contracts
DEPLOYER_PK=0x<your-key> forge script script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast

# 2) run the agent (copy addresses into agent/.env first — see agent/.env.example)
cd ../agent && cp .env.example .env && $EDITOR .env
npm run dev

# 3) run the dApp (copy addresses into web/.env — see web/.env.example)
cd ../web && cp .env.example .env && $EDITOR .env
npm run dev      # http://localhost:5173
```

Contract tests: `cd contracts && forge test`. Agent loop test without the UI: `cd agent && PAYER_PK=0x... npm run pay-test`.

## Deployed addresses (Arbitrum Sepolia)

Live on Arbitrum Sepolia (chainId 421614):

| Contract | Address |
|---|---|
| IdentityRegistry | [`0x7d5304e603bd8022E640b0309bC82f29456c459A`](https://sepolia.arbiscan.io/address/0x7d5304e603bd8022E640b0309bC82f29456c459A) |
| ReputationRegistry | [`0xDFD69428A577E631A9Ea212BC04190825f5dB398`](https://sepolia.arbiscan.io/address/0xDFD69428A577E631A9Ea212BC04190825f5dB398) |
| PaymentEscrow | [`0xAf2e64507184a3795e6c4E65044E85Be0F45407c`](https://sepolia.arbiscan.io/address/0xAf2e64507184a3795e6c4E65044E85Be0F45407c) |
| USDC (Circle) | [`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`](https://sepolia.arbiscan.io/address/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d) |

## How it maps to the judging criteria

- **Smart contract quality** — 3 spec-faithful contracts, 37 tests + fuzz, OZ v5, checks-effects-interactions, custom errors, full NatSpec, dual code review with all CRITICAL/HIGH fixed before deploy.
- **Product-market fit** — the agent economy genuinely needs open identity + payments + reputation; this is the rail, with a useful flagship agent.
- **Innovation** — trustless x402-into-escrow settlement and verified-buyer reputation built *on* ERC-8004's own primitives.
- **Real problem solving** — agents pay per call in stablecoins, gasless for the payer, no accounts/KYC.

## Known trust assumptions (honesty)

- The facilitator pays gas to relay settlement; it cannot redirect funds (the escrow derives the payout wallet from the registry) but it could choose *not* to relay. A production system would decentralize facilitation.
- The Validation Registry (ERC-8004's experimental third registry) is out of scope.
- Testnet only.

---

Built with Solidity, Foundry, viem, React. ERC-8004 + x402 on Arbitrum.
