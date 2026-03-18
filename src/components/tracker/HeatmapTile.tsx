import { ReactNode } from 'react'

export function HeatmapTile({
  backgroundColor,
  active = false,
  currentWeek = false,
  hoverOutline = false,
  disabled = false,
  dimmed = false,
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
  roundedClassName?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={`heat-cell relative border ${roundedClassName} ${
        active
          ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.22)]'
          : currentWeek
            ? 'border-[#78A7FF] shadow-[0_0_0_1px_rgba(120,167,255,0.18)]'
            : 'border-white/[0.04]'
      } ${hoverOutline && !active ? 'group-hover:border-[#78A7FF] group-hover:shadow-[0_0_0_1px_rgba(120,167,255,0.34)]' : ''} ${
        dimmed && !disabled ? 'opacity-55' : ''
      } ${className}`}
      style={{
        backgroundColor,
        borderColor: disabled ? 'rgba(255,255,255,0.03)' : undefined,
      }}
    >
      {children}
    </div>
  )
}
