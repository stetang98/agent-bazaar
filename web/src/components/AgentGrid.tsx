import type { Agent } from "../lib/types";
import { AgentCard } from "./AgentCard";

interface Props {
  agents: Agent[];
  isLoading: boolean;
  error: unknown;
  configured: boolean;
  onSelect: (a: Agent) => void;
}

export function AgentGrid({ agents, isLoading, error, configured, onSelect }: Props) {
  if (!configured) {
    return (
      <p className="notice surface">
        Contracts aren’t configured yet. Deploy, then set the <code className="mono">VITE_*</code>{" "}
        addresses in <code className="mono">web/.env</code>.
      </p>
    );
  }
  if (isLoading) return <p className="notice surface">Loading agents from chain…</p>;
  if (error) {
    return (
      <p className="notice surface">Couldn’t load agents from chain. Check the RPC URL and configured addresses.</p>
    );
  }
  if (agents.length === 0) return <p className="notice surface">No agents registered yet.</p>;

  return (
    <div className="agent-grid">
      {agents.map((a) => (
        <AgentCard key={a.agentId.toString()} agent={a} onSelect={onSelect} />
      ))}
    </div>
  );
}
