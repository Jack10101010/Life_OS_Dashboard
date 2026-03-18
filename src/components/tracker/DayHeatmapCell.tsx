import { getDayColor } from '../../lib/color'
import { ColorMode, DayEntry } from '../../types'

export function DayHeatmapCell({
  day,
  mode,
  active = false,
  sizeClassName = 'aspect-square min-h-[12px] w-full min-w-[12px]',
}: {
  day: DayEntry | null
  mode: ColorMode
  active?: boolean
  sizeClassName?: string
}) {
  if (!day) {
    return <div className={`${sizeClassName} rounded-[3px] border border-white/5 bg-white/[0.02] opacity-35`} />
  }

  return (
    <div className="relative">
      <div
        className={`heat-cell relative ${sizeClassName} rounded-[4px] border ${
        active ? 'border-white shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_14px_rgba(255,255,255,0.08)]' : 'border-white/[0.04]'
        }`}
        style={{ backgroundColor: getDayColor(day, mode) }}
      >
        {day.bigWin ? <span className="absolute -right-px -top-px h-[4px] w-[4px] rounded-full bg-sand" /> : null}
      </div>
    </div>
  )
}
