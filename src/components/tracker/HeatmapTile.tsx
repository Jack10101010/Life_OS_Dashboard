import { ReactNode } from 'react'

export function HeatmapTile({
  backgroundColor,
  active = false,
  currentWeek = false,
  hoverOutline = false,
  disabled = false,
  dimmed = false,
  borderColorOverride,
  roundedClassName = 'rounded-[4px]',
  className = '',
  children,
}: {
  backgroundColor: string
  active?: boolean
  currentWeek?: boolean
  hoverOutline?: boolean
  disabled?: boolean
  dimmed?: boolean
  borderColorOverride?: string
  roundedClassName?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`heat-cell relative border ${roundedClassName} ${
        active
          ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.22)]'
          : currentWeek
            ? 'shadow-[0_0_0_1px_rgba(120,167,255,0.18)]'
            : ''
      } ${hoverOutline && !active ? 'group-hover:shadow-[0_0_0_1px_rgba(120,167,255,0.34)]' : ''} ${
        dimmed && !disabled ? 'opacity-55' : ''
      } ${className}`}
      style={{
        backgroundColor,
        borderColor: borderColorOverride ?? (active ? 'rgb(var(--theme-text-primary-rgb))' : currentWeek ? 'rgb(var(--theme-info-rgb))' : disabled ? 'rgb(var(--theme-heatmap-inactive-rgb))' : 'rgb(var(--theme-border-subtle-rgb) / 0.5)'),
      }}
    >
      {children}
    </div>
  )
}
