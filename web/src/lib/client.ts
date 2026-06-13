import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(import.meta.env.VITE_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc"),
});
