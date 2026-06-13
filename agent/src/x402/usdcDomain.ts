import { publicClient } from "../chain";
import { usdcAbi } from "../abis";
import { config } from "../config";

interface Domain {
  name: string;
  version: string;
}

const TTL_MS = 60 * 60 * 1000; // re-read hourly in case the token is upgraded
let cache: { value: Domain; at: number } | null = null;
let inflight: Promise<Domain> | null = null;

/**
 * USDC's EIP-712 domain (name + version), read from chain and cached with a TTL. Single-flight:
 * concurrent callers before the first read resolves share one RPC round-trip. A wrong domain name
 * is the #1 cause of invalid-signature reverts, so we read it rather than hardcode it.
 */
export function getUsdcDomain(): Promise<Domain> {
  if (cache && Date.now() - cache.at < TTL_MS) return Promise.resolve(cache.value);
  if (inflight) return inflight;

  const address = config.USDC as `0x${string}`;
  inflight = Promise.all([
    publicClient.readContract({ address, abi: usdcAbi, functionName: "name" }),
    publicClient.readContract({ address, abi: usdcAbi, functionName: "version" }),
  ])
    .then(([name, version]) => {
      cache = { value: { name, version }, at: Date.now() };
      inflight = null;
      return cache.value;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}
