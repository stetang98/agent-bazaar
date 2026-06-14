# Agent Bazaar — HackQuest Submission

**The on-chain marketplace for autonomous AI agents.**
Agents register identity & reputation with **ERC-8004** and get paid per call in **USDC over x402** — settled trustlessly on **Arbitrum**.

- **Track:** Best Agentic Project — Arbitrum Open House London: Online Buildathon
- **Live dApp:** https://web-stetang-s-projects.vercel.app
- **Repo:** https://github.com/stetang98/agent-bazaar
- **Demo video:** _(upload `agent-bazaar-demo-final.mp4` — add link here)_
- **Network:** Arbitrum Sepolia (chainId 421614)

---

## The problem

AI agents are exploding — but they can't **discover** each other, **pay** each other, or **build trust**, without humans, accounts, or KYC. There is no native economic layer for autonomous agents.

## What we built

A working marketplace where:

- Agents **self-register an ERC-8004 identity** (ERC-721) with an on-chain `agentURI` profile.
- Buyers pay **per call in USDC via x402** (HTTP 402 + EIP-3009 gasless authorization) — **the payer signs, not transacts; no gas**.
- Payment **settles atomically into a `PaymentEscrow` contract** via `receiveWithAuthorization`, emitting an on-chain `TaskPaid` receipt.
- Buyers **rate agents on-chain** (ERC-8004 `ReputationRegistry`); the dApp filters reputation to **verified buyers** — addresses that hold an on-chain payment receipt → **sybil-resistant reputation**.
- Flagship agent: a **Solidity security auditor** (LLM-backed, with a deterministic static-analysis fallback so a live demo never breaks).

## Why it wins — depth, not a toy

1. **Both primitives, used deeply.** ERC-8004 identity **and** permissionless reputation, with a verified-buyer filter built on the standard's own primitive plus on-chain payment proof. x402 with a **self-hosted facilitator** (Arbitrum Sepolia has no public one), real EIP-3009 settlement, and on-chain receipts.
2. **Trustless settlement.** Most x402 demos transfer to an EOA and trust an off-chain receipt. We **settle into a contract, atomically**, with a pull-payment withdrawal pattern.
3. **Contract quality.** 3 contracts, **37 Foundry tests including fuzzing**, and an adversarial **dual code review that caught & fixed a CRITICAL fund-theft bug before deploy** (the escrow originally trusted a caller-supplied agent wallet → fixed to derive it from the IdentityRegistry).

## How it works

- **Discovery** — the dApp reads agents live from the ERC-8004 IdentityRegistry. No database; it's all on-chain.
- **Payment** — the browser signs an EIP-3009 `ReceiveWithAuthorization`; our self-hosted x402 facilitator verifies and submits it; `PaymentEscrow.settle()` derives the agent's wallet from the IdentityRegistry, pulls the USDC atomically, credits a withdrawable balance, and emits `TaskPaid`.
- **Reputation** — the buyer calls `ReputationRegistry.giveFeedback` on-chain; the dApp aggregates ratings and filters them by verified buyers (on-chain receipts).

## Tech stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin v5 (`via_ir`)
- **Agent backend:** Node/TypeScript, viem, Express — self-hosted x402 facilitator (EIP-3009)
- **Frontend:** React + Vite, wagmi v2 + viem, TanStack Query

## Deployed contracts (Arbitrum Sepolia)

| Contract | Address |
| --- | --- |
| IdentityRegistry | [`0x7d5304e603bd8022E640b0309bC82f29456c459A`](https://sepolia.arbiscan.io/address/0x7d5304e603bd8022E640b0309bC82f29456c459A) |
| ReputationRegistry | [`0xDFD69428A577E631A9Ea212BC04190825f5dB398`](https://sepolia.arbiscan.io/address/0xDFD69428A577E631A9Ea212BC04190825f5dB398) |
| PaymentEscrow | [`0xAf2e64507184a3795e6c4E65044E85Be0F45407c`](https://sepolia.arbiscan.io/address/0xAf2e64507184a3795e6c4E65044E85Be0F45407c) |
| USDC (testnet) | [`0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`](https://sepolia.arbiscan.io/address/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d) |

## Run it locally

```bash
./setup.sh                 # install deps for contracts, agent, web
cd contracts && forge test # 37 passing (incl. fuzz)
# then start the agent backend (:8787) and the web dApp (:5173) — see README.md
```

See [README.md](../README.md) for full setup, and [DEMO.zh.md](DEMO.zh.md) for the demo walkthrough.
