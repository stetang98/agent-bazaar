import { config } from "./config";

const NAME = "Solidity Security Auditor";
const DESCRIPTION =
  "AI agent that audits Solidity for security pitfalls. Pay per audit in USDC via x402.";

/** ERC-8004 registration JSON pointed to by the on-chain agentURI. */
export function registrationJson(agentId: number | string) {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: NAME,
    description: DESCRIPTION,
    image: `${config.PUBLIC_URL}/agent.png`,
    services: [
      { name: "web", endpoint: `${config.PUBLIC_URL}/` },
      {
        name: "A2A",
        endpoint: `${config.PUBLIC_URL}/.well-known/agent-card.json`,
        version: "0.3.0",
      },
    ],
    x402Support: true,
    active: true,
    registrations: [
      {
        agentId: Number(agentId),
        agentRegistry: `eip155:${config.CHAIN_ID}:${config.IDENTITY_REGISTRY}`,
      },
    ],
    supportedTrust: ["reputation"],
  };
}

/** A2A AgentCard served at /.well-known/agent-card.json. */
export function agentCard(agentId: number | string) {
  return {
    protocolVersion: "0.3.0",
    name: NAME,
    description:
      "Pay-per-audit AI agent. Submit Solidity source, receive a structured security review.",
    url: `${config.PUBLIC_URL}/agents/auditor/audit`,
    version: "0.1.0",
    capabilities: { streaming: false },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "audit-solidity",
        name: "Audit Solidity",
        description:
          "Security audit of a Solidity contract: findings with severity, line, issue, and suggested fix.",
        tags: ["solidity", "security", "audit", "x402"],
      },
    ],
    // x402 payment metadata (non-standard extension for discovery).
    x402: {
      price: `$${config.PRICE_USDC}`,
      asset: config.USDC,
      network: `eip155:${config.CHAIN_ID}`,
      payTo: config.PAYMENT_ESCROW,
    },
    registrations: [
      {
        agentId: Number(agentId),
        agentRegistry: `eip155:${config.CHAIN_ID}:${config.IDENTITY_REGISTRY}`,
      },
    ],
  };
}
