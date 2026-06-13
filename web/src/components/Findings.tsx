import type { Finding, Severity } from "../lib/types";

const ORDER: Severity[] = ["high", "medium", "low", "info"];

export function Findings({
  findings,
  summary,
}: {
  findings: Finding[];
  summary: Record<Severity, number>;
}) {
  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  return (
    <div className="findings">
      <div className="findings__summary">
        {ORDER.filter((s) => summary[s] > 0).map((s) => (
          <span key={s} className={`sev-pill sev-pill--${s}`}>
            {summary[s]} {s}
          </span>
        ))}
      </div>
      <ul className="findings__list">
        {sorted.map((f, i) => (
          <li key={i} className={`finding finding--${f.severity}`}>
            <div className="finding__head">
              <span className={`sev-dot sev-dot--${f.severity}`} aria-hidden />
              <span className="finding__title">{f.title}</span>
              {f.line > 0 && <span className="finding__line mono">L{f.line}</span>}
            </div>
            <p className="finding__detail">{f.detail}</p>
            <p className="finding__fix">
              <span className="mono">fix</span> {f.suggestion}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
