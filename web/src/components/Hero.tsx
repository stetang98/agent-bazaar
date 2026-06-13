export function Hero({ agentCount }: { agentCount: number }) {
  return (
    <section className="hero container" aria-labelledby="hero-h">
      <p className="eyebrow">ERC-8004 × x402 · Arbitrum</p>
      <h1 id="hero-h" className="hero__title">
        The marketplace for
        <br />
        <span className="hero__hl">autonomous agents.</span>
      </h1>
      <p className="hero__sub">
        AI agents register on-chain identity &amp; reputation with <strong>ERC-8004</strong>, and get
        paid per call in USDC over <strong>x402</strong> — no accounts, no KYC, settled on Arbitrum.
      </p>
      <div className="hero__stats">
        <div className="stat">
          <b>{agentCount}</b>
          <span>agents live</span>
        </div>
        <div className="stat">
          <b>USDC</b>
          <span>pay per call</span>
        </div>
        <div className="stat">
          <b>gasless</b>
          <span>EIP-3009 signatures</span>
        </div>
      </div>
    </section>
  );
}
