import { DayEntry } from '../../types'

const CALLOUT_WIDTH = 260
const GAP = 10

function formatReferenceDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`)
  const day = `${value.getUTCDate()}`.padStart(2, '0')
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0')
  const year = value.getUTCFullYear()
  return `${day}.${month}.${year}`
}

export function HeatmapTooltip({
  day,
  anchorRect,
  containerRect,
}: {
  day: DayEntry
  anchorRect: { top: number; left: number; right: number; width: number; height: number }
  containerRect: { top: number; left: number; width: number; height: number }
}) {
  const preview = (day.notes || day.bigWin || day.moodNote || '').trim()
  const truncatedPreview = preview.length > 90 ? `${preview.slice(0, 87)}...` : preview
  const statusLine = day.isLogged ? (day.bigWin || day.moodNote || 'Entry saved') : 'No entry yet'

  const preferRight = anchorRect.right + GAP + CALLOUT_WIDTH <= containerRect.width - 12
  const left = preferRight
    ? anchorRect.right + GAP
    : Math.max(anchorRect.left - GAP - CALLOUT_WIDTH, 12)
  const centeredTop = anchorRect.top + anchorRect.height / 2 - 44
  const top = Math.min(Math.max(centeredTop, 10), containerRect.height - 98)
  const arrowSide = preferRight ? 'left' : 'right'
  const arrowTop = Math.min(Math.max(anchorRect.top + anchorRect.height / 2 - top - 7, 18), 70)

  return (
    <div
      className="pointer-events-none absolute z-[140] w-[260px] rounded-2xl border border-[#2D2D2D] bg-[#121212] px-4 py-3.5 text-left text-white shadow-[0_18px_40px_rgba(0,0,0,0.4)]"
      style={{ left, top }}
    >
      <span
        className="absolute h-3.5 w-3.5 rotate-45 border-[#2D2D2D] bg-[#121212]"
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
      <p className="text-[13px] font-semibold tracking-[-0.01em] text-white">{formatReferenceDate(day.date)}</p>
      <p className="mt-2 text-[14px] font-semibold tracking-[-0.02em] text-white">{statusLine}</p>
      {day.isLogged && truncatedPreview ? (
        <p className="mt-1.5 text-[12px] leading-5 text-[#A0A0A0]">{truncatedPreview}</p>
      ) : null}
    </div>
  )
}
