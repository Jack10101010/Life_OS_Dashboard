import { BadHabitDefinition, ColorMode, DayEntry, HabitTracker, HabitTrackerCalendarRange } from '../../types'
import { MonthMatrixHeatmap } from './MonthMatrixHeatmap'

export function DayHeatmap({
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
  return (
    <MonthMatrixHeatmap
      days={days}
      visibleDayIdSet={visibleDayIdSet}
      mode={mode}
      year={year}
      selectedDayId={selectedDayId}
      onSelectDay={onSelectDay}
      habitTrackers={habitTrackers}
      calendarRange={calendarRange}
      highlightCurrentWeek={highlightCurrentWeek}
      showBadHabitMarker={showBadHabitMarker}
      showHabitMarkers={showHabitMarkers}
      badHabitDateMap={badHabitDateMap}
    />
  )
}
