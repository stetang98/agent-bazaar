export const CHAIN_ID = 421614; // Arbitrum Sepolia

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const raw: Record<keyof Addresses, string | undefined> = {
  identityRegistry: import.meta.env.VITE_IDENTITY_REGISTRY,
  reputationRegistry: import.meta.env.VITE_REPUTATION_REGISTRY,
  paymentEscrow: import.meta.env.VITE_PAYMENT_ESCROW,
  usdc: import.meta.env.VITE_USDC,
};

export const AGENT_BASE_URL: string | undefined = import.meta.env.VITE_AGENT_BASE_URL;

/** Block the contracts were deployed at — bounds reputation log scans (avoids scanning from 0). */
export const DEPLOY_BLOCK: bigint = (() => {
  const b = import.meta.env.VITE_DEPLOY_BLOCK;
  try {
    return b ? BigInt(b) : 0n;
  } catch {
    return 0n;
  }
})();

export interface Addresses {
  identityRegistry: `0x${string}`;
  reputationRegistry: `0x${string}`;
  paymentEscrow: `0x${string}`;
  usdc: `0x${string}`;
}

/** True once the deployed registry address is configured (post-deploy). */
export function isConfigured(): boolean {
  return ADDR_RE.test(raw.identityRegistry ?? "");
}

/** Validated contract addresses, or throws if any are missing/invalid. Call only behind isConfigured(). */
export function requireAddresses(): Addresses {
  for (const key of Object.keys(raw) as (keyof Addresses)[]) {
    const v = raw[key];
    if (!v || !ADDR_RE.test(v)) {
      throw new Error("Contracts not configured — set the VITE_* addresses in web/.env after deploying.");
    }
  }
  return raw as Addresses;
}
