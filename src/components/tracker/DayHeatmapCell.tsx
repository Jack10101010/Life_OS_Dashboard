import { getDayColor } from '../../lib/color'
import { ColorMode, DayEntry } from '../../types'
import { HeatmapTile } from './HeatmapTile'

type MoodHabitMarker = {
  id: string
  name: string
  color: string
}

function getMoodEmptyTileColor(date: string) {
  const todayIso = new Date().toISOString().slice(0, 10)
  if (date >= todayIso) return '#3B3B3B'
  return '#242424'
}

function getMoodEmptyTileBorderColor(date: string) {
  const todayIso = new Date().toISOString().slice(0, 10)
  if (date >= todayIso) return 'rgba(255,255,255,0.08)'
  return 'rgba(255,255,255,0.04)'
}

export function DayHeatmapCell({
  day,
  mode,
  active = false,
  currentWeek = false,
  hoverOutline = false,
  showBadHabitMarker = false,
  habitMarkers = [],
  temporalEmptyShade = false,
  emptyDate = null,
  sizeClassName = 'aspect-square min-h-[12px] w-full min-w-[12px]',
}: {
  day: DayEntry | null
  mode: ColorMode
  active?: boolean
  currentWeek?: boolean
  hoverOutline?: boolean
  showBadHabitMarker?: boolean
  habitMarkers?: MoodHabitMarker[]
  temporalEmptyShade?: boolean
  emptyDate?: string | null
  sizeClassName?: string
}) {
  if (!day) {
    return (
      <HeatmapTile
        backgroundColor={temporalEmptyShade && emptyDate ? getMoodEmptyTileColor(emptyDate) : 'rgba(255,255,255,0.02)'}
        borderColorOverride={temporalEmptyShade && emptyDate ? getMoodEmptyTileBorderColor(emptyDate) : undefined}
        currentWeek={currentWeek}
        hoverOutline={hoverOutline}
        className={temporalEmptyShade && emptyDate ? sizeClassName : `${sizeClassName} opacity-35`}
        roundedClassName="rounded-[3px]"
      />
    )
  }

  const visibleHabitMarkers = habitMarkers.slice(0, 3)
  const hiddenHabitCount = Math.max(habitMarkers.length - visibleHabitMarkers.length, 0)

  return (
    <div className="relative">
      <HeatmapTile
        backgroundColor={temporalEmptyShade && !day.isLogged ? getMoodEmptyTileColor(day.date) : getDayColor(day, mode)}
        borderColorOverride={temporalEmptyShade && !day.isLogged ? getMoodEmptyTileBorderColor(day.date) : undefined}
        active={active}
        currentWeek={currentWeek}
        hoverOutline={hoverOutline}
        className={sizeClassName}
      >
        {day.bigWin ? <span className="absolute -right-px -top-px h-[4px] w-[4px] rounded-full bg-sand" /> : null}
        {showBadHabitMarker ? (
          <span className="absolute left-1/2 top-1/2 z-20 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1B1B1B] bg-[#FF4D4F] shadow-[0_0_0_1px_rgba(255,77,79,0.16)]" />
        ) : null}
        {visibleHabitMarkers.length > 0 ? (
          <span className="pointer-events-none absolute inset-x-[3px] bottom-[2px] z-20 flex items-center justify-center gap-[2px]">
            {visibleHabitMarkers.map((marker) => (
              <span
                key={marker.id}
                className="h-[4px] w-[4px] rounded-full border border-black/25"
                style={{ backgroundColor: marker.color }}
              />
            ))}
            {hiddenHabitCount > 0 ? (
              <span className="text-[7px] font-medium leading-none text-white/72">+{hiddenHabitCount}</span>
            ) : null}
          </span>
        ) : null}
      </HeatmapTile>
    </div>
  )
}
