import type { Agent } from "../lib/types";
import { ReputationBadge } from "./ReputationBadge";

export function AgentCard({ agent, onSelect }: { agent: Agent; onSelect: (a: Agent) => void }) {
  const name = agent.registration?.name ?? `Agent #${agent.agentId.toString()}`;
  const desc = agent.registration?.description ?? "Registered ERC-8004 agent.";
  return (
    <article className="agent surface">
      <div className="agent__top">
        <h3 className="agent__name">{name}</h3>
        {agent.registration?.x402Support && <span className="badge">x402</span>}
      </div>
      <p className="agent__desc">{desc}</p>
      <div className="agent__meta">
        <ReputationBadge value={agent.ratingValue} count={agent.ratingCount} />
        <span className="agent__id mono">#{agent.agentId.toString()}</span>
      </div>
      <button className="btn agent__cta" onClick={() => onSelect(agent)}>
        Hire agent →
      </button>
    </article>
  );
}
