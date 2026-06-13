import { useAccount, useConnect, useDisconnect } from "wagmi";

function short(addr?: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ◆
          </span>
          <span className="brand__name">AGENT&nbsp;BAZAAR</span>
        </div>
        {isConnected ? (
          <button
            className="btn btn--ghost mono"
            onClick={() => disconnect()}
            aria-label={`Disconnect wallet ${short(address)}`}
            title="Disconnect wallet"
          >
            {short(address)}
          </button>
        ) : (
          <button
            className="btn"
            disabled={isPending || !injected}
            onClick={() => injected && connect({ connector: injected })}
          >
            {isPending ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>
  );
}
