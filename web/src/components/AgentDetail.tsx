import { useState } from "react";
import { useAccount, useWalletClient, useWriteContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import type { Agent, AuditResult } from "../lib/types";
import { payAndAudit } from "../lib/x402Pay";
import { fetchVerifiedBuyers, fetchSummary, type ReputationSummary } from "../lib/reputation";
import { reputationRegistryAbi } from "../lib/abis";
import { addresses, CHAIN_ID } from "../lib/addresses";
import { Findings } from "./Findings";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const SAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Vault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 bal = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0;
    }
}`;

export function AgentDetail({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [source, setSource] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [paymentTx, setPaymentTx] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  const repQuery = useQuery({
    queryKey: ["rep", agent.agentId.toString()],
    queryFn: async () => {
      const buyers = await fetchVerifiedBuyers(agent.agentId);
      const [all, verified] = await Promise.all([
        fetchSummary(agent.agentId, []),
        buyers.length
          ? fetchSummary(agent.agentId, buyers)
          : Promise.resolve<ReputationSummary>({ count: 0, value: 0 }),
      ]);
      return { all, verified, buyers };
    },
  });

  async function handleAudit() {
    setErr(null);
    setAudit(null);
    setPaymentTx(undefined);
    if (!walletClient || !address) {
      setErr("Connect your wallet first.");
      return;
    }
    setBusy(true);
    try {
      const res = await payAndAudit({
        walletClient,
        account: address,
        chainId: CHAIN_ID,
        source,
        webEndpoint: agent.webEndpoint,
      });
      setAudit(res.audit);
      setPaymentTx(res.paymentTx);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRate(stars: number) {
    if (!address) {
      setErr("Connect your wallet first.");
      return;
    }
    setRatingBusy(true);
    setErr(null);
    try {
      await writeContractAsync({
        address: addresses.reputationRegistry,
        abi: reputationRegistryAbi,
        functionName: "giveFeedback",
        args: [agent.agentId, BigInt(stars), 0, "audit", "", agent.webEndpoint ?? "", "", ZERO_HASH],
      });
      setRatingDone(true);
      setTimeout(() => void repQuery.refetch(), 3000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRatingBusy(false);
    }
  }

  const rep = repQuery.data;
  const shown = verifiedOnly ? rep?.verified : rep?.all;
  const name = agent.registration?.name ?? `Agent #${agent.agentId.toString()}`;
  const isVerifiedBuyer =
    !!address && !!rep?.buyers.some((b) => b.toLowerCase() === address.toLowerCase());

  return (
    <main className="container section detail">
      <button className="btn btn--ghost back" onClick={onBack}>
        ← all agents
      </button>

      <div className="detail__grid">
        <section className="detail__main surface">
          <p className="eyebrow">
            Agent #{agent.agentId.toString()}
            {agent.registration?.x402Support ? " · x402" : ""}
          </p>
          <h2 className="detail__name">{name}</h2>
          <p className="detail__desc">{agent.registration?.description}</p>

          <label className="field-label" htmlFor="src">
            Solidity to audit
          </label>
          <textarea
            id="src"
            className="code-input"
            rows={14}
            value={source}
            spellCheck={false}
            onChange={(e) => setSource(e.target.value)}
          />

          <div className="detail__actions">
            <button className="btn" onClick={handleAudit} disabled={busy || !isConnected}>
              {busy
                ? "Awaiting signature & settlement…"
                : isConnected
                  ? "Audit · pay $0.10 USDC"
                  : "Connect wallet to audit"}
            </button>
            <span className="hint mono">gasless signature → settled on-chain via x402</span>
          </div>

          {err && <p className="error">{err}</p>}

          {audit && (
            <div className="result">
              <div className="result__bar">
                <span className="badge">
                  engine: {audit.engine}
                  {audit.model ? ` (${audit.model})` : ""}
                </span>
                {paymentTx && (
                  <a
                    className="badge"
                    href={`https://sepolia.arbiscan.io/tx/${paymentTx}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    payment ↗
                  </a>
                )}
              </div>
              <Findings findings={audit.findings} summary={audit.summary} />
              {isConnected && <RateRow onRate={handleRate} busy={ratingBusy} done={ratingDone} />}
            </div>
          )}
        </section>

        <aside className="detail__side surface">
          <h3 className="side__title">Reputation</h3>
          <div className="side__score">
            <b>{shown && shown.count > 0 ? shown.value.toFixed(1) : "—"}</b>
            <span>{rep ? `${shown?.count ?? 0} rating(s)` : "loading…"}</span>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
            <span>Verified buyers only</span>
          </label>
          <p className="side__note mono">
            {rep
              ? `${rep.buyers.length} verified buyer(s) — ERC-8004 reputation filtered by on-chain x402 receipts`
              : ""}
          </p>
          {isVerifiedBuyer && <span className="badge badge--verified">✓ you’re a verified buyer</span>}
        </aside>
      </div>
    </main>
  );
}

function RateRow({
  onRate,
  busy,
  done,
}: {
  onRate: (stars: number) => void;
  busy: boolean;
  done: boolean;
}) {
  const [hover, setHover] = useState(0);
  if (done) return <p className="rated mono">★ Thanks — your rating is recorded on-chain.</p>;
  return (
    <div className="rate">
      <span className="rate__label">Rate this audit:</span>
      <div className="rate__stars" role="group" aria-label="rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star ${n <= hover ? "star--on" : ""}`}
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onRate(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      {busy && <span className="hint mono">confirming on-chain…</span>}
    </div>
  );
}
