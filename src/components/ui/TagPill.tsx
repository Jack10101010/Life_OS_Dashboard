import { Tag } from '../../types'

export function TagPill({
  tag,
  active = false,
  emphasis = 'default',
  muted = false,
  oneOff = false,
}: {
  tag: Tag
  active?: boolean
  emphasis?: 'default' | 'selected'
  muted?: boolean
  oneOff?: boolean
}) {
  const selected = emphasis === 'selected'
  const negative = tag.polarity === 'negative'
  const neutral = tag.polarity === 'neutral'
  const activeClass = negative
    ? selected
      ? 'border-[rgb(var(--theme-negative-rgb)/0.42)] bg-[rgb(var(--theme-negative-rgb)/0.18)] theme-text-primary'
      : 'border-[rgb(var(--theme-negative-rgb)/0.28)] bg-[rgb(var(--theme-negative-rgb)/0.11)] theme-text-secondary'
    : neutral
      ? selected
        ? 'border-[rgb(var(--theme-info-rgb)/0.46)] bg-[rgb(var(--theme-info-rgb)/0.18)] theme-text-primary'
        : 'border-[rgb(var(--theme-info-rgb)/0.3)] bg-[rgb(var(--theme-info-rgb)/0.1)] theme-text-secondary'
      : selected
        ? 'border-[rgb(var(--theme-accent-rgb)/0.62)] bg-[rgb(var(--theme-accent-rgb)/0.28)] theme-text-primary'
        : 'border-[rgb(var(--theme-accent-rgb)/0.42)] bg-[rgb(var(--theme-accent-rgb)/0.18)] theme-text-secondary'
  const inactiveClass =
    'theme-border-subtle theme-surface-soft theme-text-muted hover:theme-border-strong hover:theme-text-primary'

  return (
    <span
      className={`${
        active ? 'tag-pill-select scale-100 opacity-100' : 'scale-[0.985] opacity-[0.94]'
      } rounded-full border px-2.5 py-1 text-xs font-medium transition-[transform,opacity,background-color,border-color,color,box-shadow,filter] duration-150 ease-out will-change-transform ${
        active ? activeClass : inactiveClass
      }`}
      style={{ opacity: muted ? 0.72 : 1, borderStyle: oneOff ? 'dashed' : 'solid' }}
    >
      {tag.name}
    </span>
  )
}
