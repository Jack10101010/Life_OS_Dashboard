import { motion } from 'framer-motion'
import { Fragment } from 'react'
import { BadHabitDefinition, ColorMode, DayEntry, HabitTracker, HabitTrackerCalendarRange } from '../../types'
import { DayHeatmapCell } from './DayHeatmapCell'
import { HeatmapTooltip } from './HeatmapTooltip'
import { getMonthMatrix } from './heatmapUtils'
import { useHeatmapHover } from './useHeatmapHover'

export function MonthMatrixHeatmap({
  days,
  visibleDayIdSet,
  mode,
  year,
  selectedDayId,
  onSelectDay,
  habitTrackers = [],
  calendarRange = 'full-year',
  highlightCurrentWeek = true,
  showBadHabitMarker = false,
  showHabitMarkers = false,
  badHabitDateMap = new Map<string, BadHabitDefinition[]>(),
}: {
  days: DayEntry[]
  visibleDayIdSet?: Set<string>
  mode: ColorMode
  year: number
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
  habitTrackers?: HabitTracker[]
  calendarRange?: HabitTrackerCalendarRange
  highlightCurrentWeek?: boolean
  showBadHabitMarker?: boolean
  showHabitMarkers?: boolean
  badHabitDateMap?: Map<string, BadHabitDefinition[]>
}) {
  const rows = getMonthMatrix(days, year)
  const { containerRef, hovered, bindHover } = useHeatmapHover<DayEntry>()
  const { startMonth, startDay } = getCalendarRangeStart(days, year, calendarRange)
  const currentMonthIndex = getCurrentMonthIndex(year)
  const currentDayNumber = getCurrentDayNumber(year)
  const visibleRows = rows.slice(startMonth).map((row, rowIndex) => {
    const hiddenBeforeStart = rowIndex === 0 && calendarRange !== 'full-year' ? Math.max(startDay - 1, 0) : 0
    return {
      ...row,
      monthIndex: startMonth + rowIndex,
      hiddenBeforeStart,
    }
  })
  const currentWeekRanges = visibleRows.map((row) =>
    getCurrentWeekRangeForRow(year, row.monthIndex, row.cells, row.hiddenBeforeStart),
  )

  return (
    <div ref={containerRef} className="relative overflow-visible rounded-[28px] border border-white/5 bg-white/[0.02] px-4 py-4">
      <div className="overflow-x-auto">
        <div className="grid min-w-[860px] w-full grid-cols-[56px_1fr] gap-x-[3px] gap-y-[3px]">
          <div />
          <div className="grid grid-cols-[repeat(31,minmax(14px,1fr))] gap-x-[3px]">
            {Array.from({ length: 31 }, (_, index) => (
              <div
                key={index + 1}
                className={`flex h-[14px] items-center justify-center text-[10px] uppercase tracking-[0.12em] ${
                  currentDayNumber === index + 1 ? 'text-[#78A7FF]' : 'text-mist/55'
                }`}
              >
                {index + 1}
              </div>
            ))}
          </div>

          {visibleRows.map((row, rowIndex) => (
            <Fragment key={row.label}>
              <div
                className={`flex h-[14px] items-center pr-2 text-[11px] uppercase tracking-[0.16em] ${
                  row.monthIndex === currentMonthIndex ? 'text-[#78A7FF]' : 'text-mist/60'
                }`}
              >
                {row.label}
              </div>
              <div className="relative grid grid-cols-[repeat(31,minmax(14px,1fr))] gap-[3px]">
                {highlightCurrentWeek && currentWeekRanges[rowIndex] ? (
                  <div
                    className="pointer-events-none absolute z-0 rounded-[8px] border border-[#78A7FF] shadow-[0_0_0_1px_rgba(120,167,255,0.16)]"
                    style={{
                      gridColumn: `${currentWeekRanges[rowIndex]!.start + 1} / ${currentWeekRanges[rowIndex]!.end + 2}`,
                      insetBlockStart: '-2px',
                      insetInlineStart: '-2px',
                      width: 'calc(100% + 4px)',
                      height: 'calc(100% + 4px)',
                    }}
                  />
                ) : null}
                {row.cells.map((day, index) => {
                  const cellDate = day?.date ?? getIsoDateForCell(year, row.monthIndex, index + 1)
                  const hiddenBeforeStart = index < row.hiddenBeforeStart

                  return (
                  <div
                    key={day?.id ?? `${row.label}-${index}`}
                    className={`relative z-10 ${hiddenBeforeStart ? 'pointer-events-none opacity-0' : ''}`}
                    style={{ gridColumn: `${index + 1}` }}
                  >
                    {day && (!visibleDayIdSet || visibleDayIdSet.has(day.id)) ? (
                      <motion.button
                        whileHover={{ scale: 1.08, filter: 'brightness(1.08)' }}
                        onClick={() => onSelectDay(day)}
                        type="button"
                        className="group relative block h-full w-full cursor-pointer text-left transition"
                        {...bindHover(day)}
                      >
                        <DayHeatmapCell
                          day={day}
                          mode={mode}
                          active={selectedDayId === day.id}
                          hoverOutline
                          showBadHabitMarker={showBadHabitMarker && (badHabitDateMap.get(day.date)?.length ?? 0) > 0}
                          badHabitMarkerColor={getBadHabitMarkerColor(badHabitDateMap.get(day.date) ?? [])}
                          habitMarkers={showHabitMarkers ? getOrderedCompletedHabits(day.date, habitTrackers) : []}
                          temporalEmptyShade
                          sizeClassName="aspect-square min-h-[14px] w-full min-w-[14px]"
                        />
                      </motion.button>
                    ) : (
                      <DayHeatmapCell
                        day={null}
                        mode={mode}
                        hoverOutline
                        temporalEmptyShade
                        emptyDate={cellDate}
                        sizeClassName="aspect-square min-h-[14px] w-full min-w-[14px]"
                      />
                    )}
                  </div>
                  )
                })}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
      {hovered ? (
        <HeatmapTooltip
          day={hovered.day}
          anchorRect={hovered.rect}
          containerRect={hovered.container}
          completedHabits={getOrderedCompletedHabits(hovered.day.date, habitTrackers)}
          occurredBadHabits={badHabitDateMap.get(hovered.day.date) ?? []}
        />
      ) : null}
    </div>
  )
}

function getOrderedCompletedHabits(date: string, habitTrackers: HabitTracker[]) {
  if (!habitTrackers.length) return []

  return habitTrackers
    .filter((tracker) => tracker.entries[date]?.completed)
    .map((tracker) => ({
      id: tracker.id,
      name: tracker.title,
      color: tracker.color,
    }))
}

function getBadHabitMarkerColor(occurredBadHabits: BadHabitDefinition[]) {
  if (occurredBadHabits.some((habit) => habit.id === 'alcohol')) return '#FF4D4F'
  return occurredBadHabits.find((habit) => !habit.isArchived)?.color ?? '#FF4D4F'
}

function getCurrentWeekRangeForRow(
  year: number,
  monthIndex: number,
  cells: Array<DayEntry | null>,
  hiddenBeforeStart = 0,
) {
  const indices = cells
    .map((day, index) => {
      if (index < hiddenBeforeStart) return null
      const cellDate = day?.date ?? getIsoDateForCell(year, monthIndex, index + 1)
      return cellDate && isDateInCurrentIsoWeek(cellDate) ? index : null
    })
    .filter((value): value is number => value !== null)

  if (indices.length === 0) return null
  return { start: indices[0], end: indices[indices.length - 1] }
}

function getIsoDateForCell(year: number, monthIndex: number, dayNumber: number) {
  const date = new Date(Date.UTC(year, monthIndex, dayNumber))
  if (date.getUTCMonth() !== monthIndex) return null
  return date.toISOString().slice(0, 10)
}

function isDateInCurrentIsoWeek(isoDate: string) {
  const currentWeekStart = startOfCurrentIsoWeek()
  const currentWeekEnd = new Date(currentWeekStart)
  currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + 6)
  const date = new Date(`${isoDate}T00:00:00Z`)
  return date >= currentWeekStart && date <= currentWeekEnd
}

function startOfCurrentIsoWeek() {
  const today = new Date()
  const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const day = (current.getUTCDay() + 6) % 7
  current.setUTCDate(current.getUTCDate() - day)
  return current
}

function getCalendarRangeStart(days: DayEntry[], year: number, calendarRange: HabitTrackerCalendarRange) {
  if (calendarRange === 'full-year') {
    return { startMonth: 0, startDay: 1 }
  }

  if (calendarRange === 'first-entry') {
    const firstEntry = [...days]
      .filter((day) => day.isLogged && day.date.startsWith(`${year}-`))
      .sort((left, right) => left.date.localeCompare(right.date))[0]

    if (!firstEntry) return { startMonth: 0, startDay: 1 }
    const date = new Date(`${firstEntry.date}T00:00:00Z`)
    return { startMonth: date.getUTCMonth(), startDay: date.getUTCDate() }
  }

  const today = new Date()
  if (today.getUTCFullYear() !== year) return { startMonth: 0, startDay: 1 }
  return { startMonth: today.getUTCMonth(), startDay: today.getUTCDate() }
}

function getCurrentMonthIndex(year: number) {
  const today = new Date()
  return today.getUTCFullYear() === year ? today.getUTCMonth() : null
}

function getCurrentDayNumber(year: number) {
  const today = new Date()
  return today.getUTCFullYear() === year ? today.getUTCDate() : null
}
