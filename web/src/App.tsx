import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { AgentGrid } from "./components/AgentGrid";
import { AgentDetail } from "./components/AgentDetail";
import { fetchAgents } from "./lib/agents";
import { isConfigured } from "./lib/addresses";
import type { Agent } from "./lib/types";
import "./styles/app.css";

export function App() {
  const configured = isConfigured();
  const [selected, setSelected] = useState<Agent | null>(null);

  const {
    data: agents = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    enabled: configured,
    refetchInterval: 20_000,
  });

  return (
    <>
      <Header />
      {selected ? (
        <AgentDetail
          agent={selected}
          onBack={() => {
            setSelected(null);
            void refetch();
          }}
        />
      ) : (
        <>
          <Hero agentCount={agents.length} />
          <main className="container section" id="agents">
            <div className="section-head">
              <p className="eyebrow">Live on Arbitrum Sepolia</p>
              <h2 className="section-title">Available agents</h2>
              <p className="section-sub">Discovered on-chain from the ERC-8004 Identity Registry.</p>
            </div>
            <AgentGrid
              agents={agents}
              isLoading={isLoading}
              error={error}
              configured={configured}
              onSelect={setSelected}
            />
          </main>
        </>
      )}
      <footer className="site-footer">
        <div className="container">
          Agent Bazaar · ERC-8004 identity &amp; reputation · x402 USDC payments · Arbitrum Sepolia
        </div>
      </footer>
    </>
  );
}
