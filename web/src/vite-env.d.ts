/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_IDENTITY_REGISTRY: string;
  readonly VITE_REPUTATION_REGISTRY: string;
  readonly VITE_PAYMENT_ESCROW: string;
  readonly VITE_USDC: string;
  readonly VITE_AGENT_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
