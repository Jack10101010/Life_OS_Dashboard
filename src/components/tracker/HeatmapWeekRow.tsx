import { ReactNode } from 'react'

export function HeatmapWeekRow({
  labels,
  columns,
  className = '',
  children,
  gapClassName = 'gap-3',
  labelClassName = 'text-[11px] uppercase tracking-[0.16em] text-[#A0A0A0]',
}: {
  labels: string[]
  columns: number
  className?: string
  children: ReactNode
  gapClassName?: string
  labelClassName?: string
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div
        className={`grid px-1 ${gapClassName}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {labels.map((label) => (
          <div key={label} className={`text-center ${labelClassName}`}>
            {label.slice(0, 1)}
          </div>
        ))}
      </div>
      <div
        className={`grid ${gapClassName}`}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </div>
  )
}
