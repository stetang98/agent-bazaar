import { publicClient } from "./client";
import { requireAddresses, DEPLOY_BLOCK } from "./addresses";
import { paymentEscrowAbi, reputationRegistryAbi } from "./abis";

/** Addresses with an on-chain TaskPaid receipt for this agent — i.e. verified buyers. */
export async function fetchVerifiedBuyers(agentId: bigint): Promise<`0x${string}`[]> {
  const a = requireAddresses();
  const logs = await publicClient.getContractEvents({
    address: a.paymentEscrow,
    abi: paymentEscrowAbi,
    eventName: "TaskPaid",
    args: { agentId },
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });
  const set = new Set<`0x${string}`>();
  for (const log of logs) {
    const payer = log.args.payer;
    if (payer) set.add(payer);
  }
  return [...set];
}

export interface ReputationSummary {
  count: number;
  value: number; // human scale
}

/** getSummary, optionally filtered to a client set (e.g. verified buyers only). */
export async function fetchSummary(
  agentId: bigint,
  clients: `0x${string}`[] = [],
): Promise<ReputationSummary> {
  const a = requireAddresses();
  const [count, summaryValue, summaryDecimals] = await publicClient.readContract({
    address: a.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, clients, "", ""],
  });
  return {
    count: Number(count),
    value: Number(count) > 0 ? Number(summaryValue) / 10 ** Number(summaryDecimals) : 0,
  };
}
