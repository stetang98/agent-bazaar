import { publicClient } from "../chain";
import { usdcAbi } from "../abis";
import { config } from "../config";

let cached: { name: string; version: string } | null = null;

/**
 * Reads and caches USDC's EIP-712 domain (name + version) from chain. Required to verify
 * ReceiveWithAuthorization signatures — a wrong domain name is the #1 cause of invalid-signature
 * reverts, so we always read the live values rather than hardcoding "USD Coin"/"2".
 */
export async function getUsdcDomain(): Promise<{ name: string; version: string }> {
  if (cached) return cached;
  const address = config.USDC as `0x${string}`;
  const [name, version] = await Promise.all([
    publicClient.readContract({ address, abi: usdcAbi, functionName: "name" }),
    publicClient.readContract({ address, abi: usdcAbi, functionName: "version" }),
  ]);
  cached = { name, version };
  return cached;
}
