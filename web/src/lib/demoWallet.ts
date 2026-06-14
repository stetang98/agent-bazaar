// Hands-free DEMO wallet — used ONLY for recording the product walkthrough.
//
// It activates exclusively when an automation harness sets `window.__DEMO_PK__`
// BEFORE the app loads (our local Playwright recorder injects it at runtime).
// In every normal session — including the production Vercel build — the flag is
// absent and this module is a no-op, so the real `injected()` MetaMask flow is
// used. The private key never lives in source, env, or the shipped bundle.
//
// When active it installs a minimal EIP-1193 provider as `window.ethereum`,
// backed by a local viem account, so the existing wagmi `injected()` connector
// works with no extension and no popups: typed-data + transactions are signed
// locally and broadcast straight to the RPC. Everything that lands on-chain is
// real (real EIP-3009 settlement, real `giveFeedback`) — only the signer UI is
// replaced.
import { createPublicClient, createWalletClient, http, hexToBigInt, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";

const CHAIN_ID_HEX = "0x66eee"; // 421614, Arbitrum Sepolia
const DEFAULT_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

declare global {
  interface Window {
    __DEMO_PK__?: string;
    __DEMO_RPC__?: string;
    // `ethereum` is already declared as `any` by wallet typings; we assign to it below.
  }
}

interface TxParam {
  to?: Hex;
  data?: Hex;
  value?: Hex;
  gas?: Hex;
  maxFeePerGas?: Hex;
  maxPriorityFeePerGas?: Hex;
  nonce?: Hex;
}

interface TypedData {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}

/** Install the demo provider when (and only when) a harness has armed it. Safe no-op otherwise. */
export function installDemoWallet(): void {
  const pk = typeof window !== "undefined" ? window.__DEMO_PK__ : undefined;
  if (!pk) return;

  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const transport = http(window.__DEMO_RPC__ || DEFAULT_RPC);
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport });
  const pub = createPublicClient({ chain: arbitrumSepolia, transport });
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  async function request({ method, params }: { method: string; params?: readonly unknown[] }): Promise<unknown> {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [account.address];
      case "eth_chainId":
        return CHAIN_ID_HEX;
      case "net_version":
        return "421614";
      case "wallet_switchEthereumChain":
      case "wallet_addEthereumChain":
        return null;
      case "wallet_getPermissions":
      case "wallet_requestPermissions":
        return [
          {
            parentCapability: "eth_accounts",
            caveats: [{ type: "restrictReturnedAccounts", value: [account.address] }],
          },
        ];
      case "personal_sign": {
        const data = params?.[0];
        if (typeof data !== "string") throw new Error("personal_sign: missing message");
        return account.signMessage({ message: { raw: data as Hex } });
      }
      case "eth_signTypedData_v4": {
        const raw = params?.[1];
        const src = (typeof raw === "string" ? JSON.parse(raw) : raw) as TypedData;
        // Build fresh objects — never mutate the caller's input (viem re-adds
        // EIP712Domain internally, so it must be absent from the types we pass).
        const types = { ...src.types };
        delete types.EIP712Domain;
        const domain = { ...src.domain };
        if (typeof domain.chainId === "string") domain.chainId = Number(domain.chainId);
        const typed = { domain, types, primaryType: src.primaryType, message: src.message };
        return account.signTypedData(typed as Parameters<typeof account.signTypedData>[0]);
      }
      case "eth_sendTransaction": {
        const tx = (params?.[0] ?? {}) as TxParam;
        return wallet.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: tx.value ? hexToBigInt(tx.value) : undefined,
          gas: tx.gas ? hexToBigInt(tx.gas) : undefined,
          maxFeePerGas: tx.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? hexToBigInt(tx.maxPriorityFeePerGas) : undefined,
          nonce: tx.nonce ? Number(hexToBigInt(tx.nonce)) : undefined,
        } as Parameters<typeof wallet.sendTransaction>[0]);
      }
      default:
        // Reads (eth_call, eth_estimateGas, nonce, fees, receipts…) go to the RPC.
        // Unknown wallet_* methods are tolerated so the connector never hard-fails.
        if (method.startsWith("wallet_")) return null;
        return pub.request({ method: method as never, params: params as never });
    }
  }

  const provider = {
    isMetaMask: true,
    request,
    on(event: string, handler: (...args: unknown[]) => void) {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
      return provider;
    },
    removeListener(event: string, handler: (...args: unknown[]) => void) {
      listeners.set(event, (listeners.get(event) ?? []).filter((h) => h !== handler));
      return provider;
    },
  };

  window.ethereum = provider;
}
