export function StatPill({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/70">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
