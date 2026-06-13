import { publicClient } from "./client";
import { requireAddresses, type Addresses } from "./addresses";
import { identityRegistryAbi, reputationRegistryAbi } from "./abis";
import type { Agent, RegistrationJson } from "./types";

async function fetchRegistration(uri: string): Promise<RegistrationJson | undefined> {
  try {
    const res = await fetch(uri);
    if (!res.ok) return undefined;
    return (await res.json()) as RegistrationJson;
  } catch {
    return undefined;
  }
}

async function fetchAgent(a: Addresses, id: bigint): Promise<Agent> {
  const [owner, wallet, uri] = await Promise.all([
    publicClient.readContract({
      address: a.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "ownerOf",
      args: [id],
    }),
    publicClient.readContract({
      address: a.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "getAgentWallet",
      args: [id],
    }),
    publicClient.readContract({
      address: a.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "tokenURI",
      args: [id],
    }),
  ]);

  const registration = await fetchRegistration(uri);
  const [count, summaryValue, summaryDecimals] = await publicClient.readContract({
    address: a.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [id, [], "", ""],
  });

  return {
    agentId: id,
    owner,
    agentWallet: wallet,
    uri,
    registration,
    ratingCount: Number(count),
    ratingValue: Number(count) > 0 ? Number(summaryValue) / 10 ** Number(summaryDecimals) : 0,
    webEndpoint: registration?.services?.find((s) => s.name === "web")?.endpoint,
  };
}

/** Read all registered agents from chain (in parallel), hydrating registration JSON + reputation. */
export async function fetchAgents(): Promise<Agent[]> {
  const a = requireAddresses();
  const total = await publicClient.readContract({
    address: a.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "totalAgents",
  });
  const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
  return Promise.all(ids.map((id) => fetchAgent(a, id)));
}
