import { getDayColor } from '../../lib/color'
import { ColorMode, DayEntry } from '../../types'
import { HeatmapTile } from './HeatmapTile'

export function DayHeatmapCell({
  day,
  mode,
  active = false,
  currentWeek = false,
  hoverOutline = false,
  sizeClassName = 'aspect-square min-h-[12px] w-full min-w-[12px]',
}: {
  day: DayEntry | null
  mode: ColorMode
  active?: boolean
  currentWeek?: boolean
  hoverOutline?: boolean
  sizeClassName?: string
}) {
  if (!day) {
    return (
      <HeatmapTile
        backgroundColor="rgba(255,255,255,0.02)"
        currentWeek={currentWeek}
        hoverOutline={hoverOutline}
        className={`${sizeClassName} opacity-35`}
        roundedClassName="rounded-[3px]"
      />
    )
  }

  return (
    <div className="relative">
      <HeatmapTile
        backgroundColor={getDayColor(day, mode)}
        active={active}
        currentWeek={currentWeek}
        hoverOutline={hoverOutline}
        className={sizeClassName}
      >
        {day.bigWin ? <span className="absolute -right-px -top-px h-[4px] w-[4px] rounded-full bg-sand" /> : null}
      </HeatmapTile>
    </div>
  )
}
