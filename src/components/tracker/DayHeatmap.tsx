import { ColorMode, DayEntry, HeatmapLayout } from '../../types'
import { GithubDayHeatmap } from './GithubDayHeatmap'
import { MonthMatrixHeatmap } from './MonthMatrixHeatmap'

export function DayHeatmap({
  days,
  mode,
  layout,
  year,
  selectedDayId,
  onSelectDay,
}: {
  days: DayEntry[]
  mode: ColorMode
  layout: HeatmapLayout
  year: number
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
}) {
  return layout === 'calendar' ? (
    <MonthMatrixHeatmap days={days} mode={mode} year={year} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
  ) : (
    <GithubDayHeatmap days={days} mode={mode} selectedDayId={selectedDayId} onSelectDay={onSelectDay} />
  )
}
