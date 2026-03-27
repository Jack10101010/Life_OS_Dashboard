import { motion } from 'framer-motion'
import { ReactNode } from 'react'

export function HeatmapSegmentedControl<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<[T, string]>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="theme-surface-elevated flex items-center gap-1 rounded-2xl border p-1">
      {items.map(([itemValue, label]) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
            value === itemValue ? 'bg-[rgb(var(--theme-surface-soft-rgb))] text-[rgb(var(--theme-text-primary-rgb))]' : 'text-mist hover:text-sky'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function HeatmapPeriodControl({
  label,
  onPrev,
  onNext,
  compact = false,
}: {
  label: string
  onPrev: () => void
  onNext: () => void
  compact?: boolean
}) {
  return (
    <div
      className={`theme-surface-elevated flex items-center border text-sm text-[rgb(var(--theme-text-secondary-rgb))] ${
        compact ? 'gap-0.5 rounded-[14px] px-1 py-1' : 'gap-2 rounded-2xl px-2 py-2'
      }`}
    >
      <button
        type="button"
        onClick={onPrev}
        className={`${compact ? 'rounded-lg px-1.5 py-1 text-xs' : 'rounded-xl px-2 py-1'} text-mist transition hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-sky`}
        aria-label="Previous period"
      >
        ‹
      </button>
      <span className={`${compact ? 'min-w-[92px] text-[12px]' : 'min-w-[120px]'} text-center font-medium text-[rgb(var(--theme-info-rgb))]`}>
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className={`${compact ? 'rounded-lg px-1.5 py-1 text-xs' : 'rounded-xl px-2 py-1'} text-mist transition hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-sky`}
        aria-label="Next period"
      >
        ›
      </button>
    </div>
  )
}

export function HeatmapBadge({
  children,
  compact = false,
}: {
  children: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`${compact ? 'rounded-[16px] px-3 py-2 text-[13px]' : 'rounded-2xl px-4 py-2 text-sm'} theme-surface-elevated theme-text-primary border`}>
      {children}
    </div>
  )
}

export function HeatmapMenuButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="theme-surface-elevated theme-text-primary rounded-[16px] border px-3 py-2 text-[13px] outline-none transition hover:bg-[rgb(var(--theme-surface-soft-rgb))]"
    >
      {label}
    </button>
  )
}

export function HeatmapIconButton({
  children,
  onClick,
  ariaLabel,
  compact = true,
}: {
  children: ReactNode
  onClick: () => void
  ariaLabel: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${compact ? 'h-9 w-9 rounded-[14px] text-[18px]' : 'h-11 w-11 rounded-[14px] text-[18px]'} theme-surface-elevated border text-mist transition hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-sky`}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

export function HeatmapActionButton({
  label,
  compact,
  onClick,
}: {
  label: string
  compact: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      className={`group theme-surface-elevated theme-text-primary relative overflow-hidden border shadow-[0_0_0_1px_var(--panel-hue-line),0_0_18px_var(--panel-hue-glow)] transition hover:bg-[rgb(var(--theme-surface-soft-rgb))] ${
        compact ? 'h-10 w-10 rounded-[14px]' : 'h-14 rounded-2xl px-5'
      }`}
      aria-label={label}
    >
      {compact ? (
        <span className="flex h-full w-full items-center justify-center text-xl font-semibold leading-none">+</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-2xl font-semibold leading-none">+</span>
          <span className="translate-y-[1px] text-sm font-semibold tracking-[0.02em] text-[rgb(var(--theme-text-secondary-rgb))] transition group-hover:text-[rgb(var(--theme-text-primary-rgb))]">
            {label}
          </span>
        </span>
      )}
    </motion.button>
  )
}
