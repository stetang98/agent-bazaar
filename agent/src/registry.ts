import { decodeEventLog } from "viem";
import { config } from "./config";
import { publicClient, agentWallet, agentAccount } from "./chain";
import { identityRegistryAbi } from "./abis";

export interface AgentIdentity {
  agentId: bigint;
  agentWallet: `0x${string}`;
}

/** Ensure the agent is registered on the IdentityRegistry; returns its agentId + wallet. */
export async function ensureRegistered(): Promise<AgentIdentity> {
  const wallet = agentAccount.address;

  if (config.AGENT_ID) {
    return { agentId: BigInt(config.AGENT_ID), agentWallet: wallet };
  }

  const agentURI = `${config.PUBLIC_URL}/.well-known/agent-registration.json`;
  const hash = await agentWallet.writeContract({
    address: config.IDENTITY_REGISTRY as `0x${string}`,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentURI],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const registry = config.IDENTITY_REGISTRY.toLowerCase();
  let agentId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== registry) continue; // only decode our registry's logs
    try {
      const decoded = decodeEventLog({ abi: identityRegistryAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "Registered") {
        agentId = decoded.args.agentId;
        break;
      }
    } catch {
      // not a Registered event — ignore
    }
  }
  if (agentId === undefined) {
    // No racy totalAgents() guess: a missing event is a real error.
    throw new Error(
      `Registered event not found in tx ${hash}. Set AGENT_ID in .env to skip auto-registration.`,
    );
  }

  console.log(`[registry] registered agent #${agentId} (tx ${hash}). Set AGENT_ID=${agentId} to skip next boot.`);
  return { agentId, agentWallet: wallet };
}
