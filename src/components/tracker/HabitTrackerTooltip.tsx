import { BadHabitDefinition } from '../../types'

const CALLOUT_WIDTH = 220
const GAP = 8

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function HabitTrackerTooltip({
  date,
  title,
  status,
  preview,
  streak,
  occurredBadHabits = [],
  anchorRect,
  containerRect,
}: {
  date: string
  title: string
  status: string
  preview?: string
  streak?: number
  occurredBadHabits?: BadHabitDefinition[]
  anchorRect: { top: number; left: number; right: number; width: number; height: number }
  containerRect: { top: number; left: number; width: number; height: number }
}) {
  const preferRight = anchorRect.right + GAP + CALLOUT_WIDTH <= containerRect.width - 12
  const left = preferRight ? anchorRect.right + GAP : Math.max(anchorRect.left - GAP - CALLOUT_WIDTH, 12)
  const centeredTop = anchorRect.top + anchorRect.height / 2 - 34
  const top = Math.min(Math.max(centeredTop, 10), containerRect.height - 84)
  const arrowSide = preferRight ? 'left' : 'right'
  const arrowTop = Math.min(Math.max(anchorRect.top + anchorRect.height / 2 - top - 6, 14), 54)

  return (
    <div
      className="theme-tooltip pointer-events-none absolute z-[140] w-[220px] rounded-2xl border px-3.5 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
      style={{ left, top }}
    >
      <span
        className="theme-tooltip absolute h-3 w-3 rotate-45 border"
        style={{
          top: arrowTop,
          [arrowSide]: -6,
          borderLeftWidth: arrowSide === 'left' ? 1 : 0,
          borderTopWidth: arrowSide === 'left' ? 1 : 0,
          borderRightWidth: arrowSide === 'right' ? 1 : 0,
          borderBottomWidth: arrowSide === 'right' ? 1 : 0,
          borderStyle: 'solid',
        }}
      />
      <p className="text-[12px] font-semibold theme-text-primary">{title}</p>
      <p className="mt-1 text-[10px] theme-text-faint">{formatDate(date)}</p>
      <p className="mt-1.5 text-[13px] font-semibold theme-text-primary">{status}</p>
      {streak && streak > 0 ? <p className="mt-1 text-[11px] theme-text-secondary">Streak: {streak} day{streak === 1 ? '' : 's'}</p> : null}
      {occurredBadHabits.length > 0 ? (
        <p className="mt-1 text-[11px] theme-text-secondary">Bad habits: {occurredBadHabits.map((habit) => habit.name).join(', ')}</p>
      ) : null}
      {preview ? <p className="mt-1 text-[11px] leading-4 theme-text-muted">{preview}</p> : null}
    </div>
  )
}
