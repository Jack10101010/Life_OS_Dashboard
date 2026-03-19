import { ColorMode, DayEntry, HabitTrackerCalendarRange } from '../../types'
import { MonthMatrixHeatmap } from './MonthMatrixHeatmap'

export function DayHeatmap({
  days,
  visibleDayIds,
  mode,
  year,
  selectedDayId,
  onSelectDay,
  calendarRange = 'full-year',
  highlightCurrentWeek = true,
  showAlcoholMarker = false,
}: {
  days: DayEntry[]
  visibleDayIds?: string[]
  mode: ColorMode
  year: number
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
  calendarRange?: HabitTrackerCalendarRange
  highlightCurrentWeek?: boolean
  showAlcoholMarker?: boolean
}) {
  return (
    <MonthMatrixHeatmap
      days={days}
      visibleDayIds={visibleDayIds}
      mode={mode}
      year={year}
      selectedDayId={selectedDayId}
      onSelectDay={onSelectDay}
      calendarRange={calendarRange}
      highlightCurrentWeek={highlightCurrentWeek}
      showAlcoholMarker={showAlcoholMarker}
    />
  )
}
