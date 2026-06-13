export const CHAIN_ID = 421614; // Arbitrum Sepolia

export const addresses = {
  identityRegistry: import.meta.env.VITE_IDENTITY_REGISTRY as `0x${string}`,
  reputationRegistry: import.meta.env.VITE_REPUTATION_REGISTRY as `0x${string}`,
  paymentEscrow: import.meta.env.VITE_PAYMENT_ESCROW as `0x${string}`,
  usdc: import.meta.env.VITE_USDC as `0x${string}`,
} as const;

export const AGENT_BASE_URL = import.meta.env.VITE_AGENT_BASE_URL;

/** True once the deployed registry address is configured (post-deploy). */
export const isConfigured = (): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(addresses.identityRegistry ?? "");
