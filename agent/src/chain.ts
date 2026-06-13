import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { config } from "./config";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(config.RPC_URL),
});

export const agentAccount = privateKeyToAccount(config.AGENT_PK as `0x${string}`);
export const facilitatorAccount = privateKeyToAccount(config.FACILITATOR_PK as `0x${string}`);

/** Wallet that owns the agent NFT, is its agentWallet, and withdraws earnings. */
export const agentWallet = createWalletClient({
  account: agentAccount,
  chain: arbitrumSepolia,
  transport: http(config.RPC_URL),
});

/** Wallet that relays x402 settlement txs and pays their gas. */
export const facilitatorWallet = createWalletClient({
  account: facilitatorAccount,
  chain: arbitrumSepolia,
  transport: http(config.RPC_URL),
});
