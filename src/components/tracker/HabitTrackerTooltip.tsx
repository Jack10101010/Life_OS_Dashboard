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
  anchorRect,
  containerRect,
}: {
  date: string
  title: string
  status: string
  preview?: string
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
      className="pointer-events-none absolute z-[140] w-[220px] rounded-2xl border border-[#3A3A3A] bg-[#1B1B1B] px-3.5 py-3 text-left text-white shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
      style={{ left, top }}
    >
      <span
        className="absolute h-3 w-3 rotate-45 border-[#3A3A3A] bg-[#1B1B1B]"
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
      <p className="text-[12px] font-semibold text-white">{title}</p>
      <p className="mt-1 text-[10px] text-[#B9B9B9]">{formatDate(date)}</p>
      <p className="mt-1.5 text-[13px] font-semibold text-white">{status}</p>
      {preview ? <p className="mt-1 text-[11px] leading-4 text-[#AEAEAE]">{preview}</p> : null}
    </div>
  )
}
