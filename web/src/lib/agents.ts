import { publicClient } from "./client";
import { addresses } from "./addresses";
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

/** Read all registered agents from chain, hydrate their registration JSON + reputation summary. */
export async function fetchAgents(): Promise<Agent[]> {
  const total = await publicClient.readContract({
    address: addresses.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "totalAgents",
  });

  const agents: Agent[] = [];
  for (let id = 1n; id <= total; id++) {
    const [owner, wallet, uri] = await Promise.all([
      publicClient.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "ownerOf",
        args: [id],
      }),
      publicClient.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "getAgentWallet",
        args: [id],
      }),
      publicClient.readContract({
        address: addresses.identityRegistry,
        abi: identityRegistryAbi,
        functionName: "tokenURI",
        args: [id],
      }),
    ]);

    const registration = await fetchRegistration(uri);
    const [count, summaryValue, summaryDecimals] = await publicClient.readContract({
      address: addresses.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getSummary",
      args: [id, [], "", ""],
    });

    const ratingValue =
      Number(count) > 0 ? Number(summaryValue) / 10 ** Number(summaryDecimals) : 0;
    const webEndpoint = registration?.services?.find((s) => s.name === "web")?.endpoint;

    agents.push({
      agentId: id,
      owner,
      agentWallet: wallet,
      uri,
      registration,
      ratingCount: Number(count),
      ratingValue,
      webEndpoint,
    });
  }
  return agents;
}
