export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="muted small">—</span>;
  const cls = value.toLowerCase();
  return <span className={`badge badge-${cls}`}>{value.replaceAll("_", " ")}</span>;
}
