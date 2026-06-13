export function ReputationBadge({ value, count }: { value: number; count: number }) {
  if (count === 0) {
    return <span className="rep rep--none mono">no ratings yet</span>;
  }
  const full = Math.min(5, Math.max(0, Math.round(value)));
  const stars = "★".repeat(full).padEnd(5, "☆");
  return (
    <span className="rep mono" title={`${value.toFixed(2)} from ${count} rating(s)`}>
      <span className="rep__stars" aria-hidden>
        {stars}
      </span>
      <span className="rep__num">{value.toFixed(1)}</span>
      <span className="rep__count">({count})</span>
    </span>
  );
}
