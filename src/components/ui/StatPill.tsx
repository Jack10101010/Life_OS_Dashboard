export function StatPill({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`theme-surface-soft rounded-2xl border px-3 py-2 ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] theme-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold theme-text-primary">{value}</p>
    </div>
  )
}
