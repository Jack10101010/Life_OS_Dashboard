import { DayEntry } from '../../types'

const CALLOUT_WIDTH = 236
const GAP = 8

function formatReferenceDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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
  const preview = (day.journal || day.bigWin || day.moodNote || '').trim()
  const truncatedPreview = preview.length > 90 ? `${preview.slice(0, 87)}...` : preview
  const checkInValues = [
    ['Mood', day.mood],
    ['Energy', day.energy],
    ['Clarity', day.clarity],
    ['Motivation', day.motivation],
  ].filter(([, value]) => value != null) as Array<[string, number]>
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
      className="pointer-events-none absolute z-[140] w-[236px] overflow-hidden rounded-2xl border border-[#3A3A3A] bg-[#1B1B1B] px-3.5 py-3 text-left text-white shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
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
      <div className="relative">
        <p className="text-[10px] text-[#B9B9B9]">{formatReferenceDate(day.date)}</p>
        <p className="mt-1.5 text-[13px] font-semibold text-white">{statusLine}</p>
      </div>
      {day.isLogged ? (
        <div className="relative mt-2 flex flex-wrap gap-1.5">
          {checkInValues.map(([label, value]) => (
            <span
              key={label}
              className="rounded-full border border-white/6 bg-white/[0.04] px-2 py-1 text-[11px] text-[#C9C9C9]"
            >
              {label} {value}
            </span>
          ))}
          <span className="rounded-full border border-white/6 bg-white/[0.04] px-2 py-1 text-[11px] text-[#C9C9C9]">
            Alcohol consumed: {day.drank ? 'Yes' : 'No'}
          </span>
        </div>
      ) : null}
      {day.isLogged && truncatedPreview ? (
        <p className="relative mt-1 text-[11px] leading-4 text-[#AEAEAE]">{truncatedPreview}</p>
      ) : null}
    </div>
  )
}
