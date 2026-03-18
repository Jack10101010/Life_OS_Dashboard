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
    <div className="flex items-center gap-1 rounded-2xl border border-[#2C2C2C] bg-[#181818] p-1">
      {items.map(([itemValue, label]) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
            value === itemValue ? 'bg-[#343434] text-white' : 'text-[#A3A3A3] hover:text-white'
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
      className={`flex items-center border border-[#2F2F2F] bg-[#171717] text-sm text-[#D1D1D1] ${
        compact ? 'gap-0.5 rounded-[14px] px-1 py-1' : 'gap-2 rounded-2xl px-2 py-2'
      }`}
    >
      <button
        type="button"
        onClick={onPrev}
        className={`${compact ? 'rounded-lg px-1.5 py-1 text-xs' : 'rounded-xl px-2 py-1'} text-[#9A9A9A] transition hover:bg-[#222] hover:text-white`}
        aria-label="Previous period"
      >
        ‹
      </button>
      <span className={`${compact ? 'min-w-[92px] text-[12px]' : 'min-w-[120px]'} text-center font-medium text-[#78A7FF]`}>
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className={`${compact ? 'rounded-lg px-1.5 py-1 text-xs' : 'rounded-xl px-2 py-1'} text-[#9A9A9A] transition hover:bg-[#222] hover:text-white`}
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
    <div
      className={`${compact ? 'rounded-[16px] px-3 py-2 text-[13px]' : 'rounded-2xl px-4 py-2 text-sm'} border border-[#2F2F2F] bg-[#171717] text-white`}
    >
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
      className="rounded-[16px] border border-[#2F2F2F] bg-[#171717] px-3 py-2 text-[13px] text-white outline-none transition hover:bg-[#202020]"
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
      className={`${compact ? 'h-9 w-9 rounded-[14px] text-[18px]' : 'h-11 w-11 rounded-[14px] text-[18px]'} border border-[#2F2F2F] bg-[#171717] text-[#B0B0B0] transition hover:bg-[#222] hover:text-white`}
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
      className={`group relative overflow-hidden border border-[rgba(255,255,255,0.08)] bg-[#181818] text-white shadow-[0_0_0_1px_var(--panel-hue-line),0_0_18px_var(--panel-hue-glow)] transition hover:bg-[#202020] ${
        compact ? 'h-10 w-10 rounded-[14px]' : 'h-14 rounded-2xl px-5'
      }`}
      aria-label={label}
    >
      {compact ? (
        <span className="flex h-full w-full items-center justify-center text-xl font-semibold leading-none">+</span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-2xl font-semibold leading-none">+</span>
          <span className="translate-y-[1px] text-sm font-semibold tracking-[0.02em] text-[#EAEAEA] transition group-hover:text-white">
            {label}
          </span>
        </span>
      )}
    </motion.button>
  )
}
