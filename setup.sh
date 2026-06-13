#!/usr/bin/env bash
# Agent Bazaar — one-shot setup. Reinstalls vendored libs (gitignored), builds + tests
# contracts, and installs the agent + web dependencies.
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ Installing contract libraries…"
if [ ! -d contracts/lib/forge-std ]; then
  forge install foundry-rs/forge-std --root contracts
fi
if [ ! -d contracts/lib/openzeppelin-contracts ]; then
  git clone --depth 1 --branch v5.1.0 \
    https://github.com/OpenZeppelin/openzeppelin-contracts contracts/lib/openzeppelin-contracts
  rm -rf contracts/lib/openzeppelin-contracts/.git
fi

echo "▶ Building + testing contracts…"
forge build --root contracts
forge test --root contracts

echo "▶ Installing agent backend deps…"
npm install --prefix agent

echo "▶ Installing web dApp deps…"
npm install --prefix web

cat <<'NEXT'

✓ Setup complete.

Next steps:
  1. Deploy:   cd contracts && DEPLOYER_PK=0x... forge script script/Deploy.s.sol \
                 --rpc-url arbitrum_sepolia --broadcast
  2. Agent:    cd agent && cp .env.example .env  (fill addresses + AGENT_PK) && npm run dev
  3. dApp:     cd web   && cp .env.example .env  (fill VITE_* addresses) && npm run dev
NEXT
