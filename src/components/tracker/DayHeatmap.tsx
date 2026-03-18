import { ColorMode, DayEntry, HabitTrackerCalendarRange } from '../../types'
import { MonthMatrixHeatmap } from './MonthMatrixHeatmap'

export function DayHeatmap({
  days,
  mode,
  year,
  selectedDayId,
  onSelectDay,
  calendarRange = 'full-year',
  highlightCurrentWeek = true,
}: {
  days: DayEntry[]
  mode: ColorMode
  year: number
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
  calendarRange?: HabitTrackerCalendarRange
  highlightCurrentWeek?: boolean
}) {
  return (
    <MonthMatrixHeatmap
      days={days}
      mode={mode}
      year={year}
      selectedDayId={selectedDayId}
      onSelectDay={onSelectDay}
      calendarRange={calendarRange}
      highlightCurrentWeek={highlightCurrentWeek}
    />
  )
}
