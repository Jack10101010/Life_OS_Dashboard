import { ColorMode, DayEntry, Habit, HeatmapLayout, Tag, TrackerFilters, TrackerViewMode, WeekEntry } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FiltersPanel } from '../../components/tracker/FiltersPanel'
import { DayHeatmap } from '../../components/tracker/DayHeatmap'
import { WeekHeatmap } from '../../components/tracker/WeekHeatmap'
import { WeekSummaryStrip } from '../../components/tracker/WeekSummaryStrip'

export function TrackerPage({
  viewMode,
  onViewModeChange,
  colorMode,
  onColorModeChange,
  layout,
  onLayoutChange,
  year,
  years,
  filters,
  showFilters,
  onToggleFilters,
  onFiltersChange,
  weeks,
  days,
  habits,
  tags,
  selectedWeek,
  selectedWeekDays,
  selectedDay,
  moodCollapsed,
  onToggleMoodCollapsed,
  onCreateTracker,
  onSelectWeek,
  onSelectDay,
}: {
  viewMode: TrackerViewMode
  onViewModeChange: (mode: TrackerViewMode) => void
  colorMode: ColorMode
  onColorModeChange: (mode: ColorMode) => void
  layout: HeatmapLayout
  onLayoutChange: (layout: HeatmapLayout) => void
  year: number
  years: number[]
  filters: TrackerFilters
  showFilters: boolean
  onToggleFilters: () => void
  onFiltersChange: (filters: TrackerFilters) => void
  weeks: WeekEntry[]
  days: DayEntry[]
  habits: Habit[]
  tags: Tag[]
  selectedWeek: WeekEntry | null
  selectedWeekDays: DayEntry[]
  selectedDay: DayEntry | null
  moodCollapsed: boolean
  onToggleMoodCollapsed: () => void
  onCreateTracker: () => void
  onSelectWeek: (week: WeekEntry) => void
  onSelectDay: (day: DayEntry) => void
}) {
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            label="View"
            value={viewMode}
            items={[
              ['year', 'Year'],
              ['weeks', 'Weeks'],
              ['days', 'Days'],
            ]}
            onChange={(value) => onViewModeChange(value as TrackerViewMode)}
          />
          <ToggleGroup
            label="Metric"
            value={colorMode}
            items={[
              ['overall', 'Overall'],
              ['habits', 'Habits'],
              ['mood', 'Mood'],
              ['alcohol', 'Alcohol'],
            ]}
            onChange={(value) => onColorModeChange(value as ColorMode)}
          />
          <ToggleGroup
            label="Layout"
            value={layout}
            items={[
              ['github', 'GitHub'],
              ['calendar', 'Calendar'],
            ]}
            onChange={(value) => onLayoutChange(value as HeatmapLayout)}
          />

          <select
            value={year}
            onChange={(event) => onFiltersChange({ ...filters, year: Number(event.target.value) })}
            className="rounded-2xl border border-[#2F2F2F] bg-[#171717] px-4 py-2 text-sm text-white outline-none"
          >
            {years.map((item) => (
              <option key={item} value={item} className="bg-panel">
                {item}
              </option>
            ))}
          </select>
          <Button onClick={onToggleFilters}>Filter</Button>
          <Button variant="primary" onClick={() => selectedDay && onSelectDay(selectedDay)}>
            Quick add day entry
          </Button>
          <Button onClick={() => selectedWeek && onSelectWeek(selectedWeek)}>Quick add week reflection</Button>
          <Button onClick={onCreateTracker}>Create habit</Button>
        </div>
      </Card>

      {showFilters ? <FiltersPanel filters={filters} tags={tags} onChange={onFiltersChange} /> : null}

      <Card className="space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">
              Mood tracker
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              Mood Tracker & Daily Journal
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-mist">
              {days.length} days tracked • {habits.filter((habit) => habit.active).length} active habits
            </p>
            <Button onClick={onToggleMoodCollapsed}>{moodCollapsed ? 'Expand' : 'Collapse'}</Button>
          </div>
        </div>

        {!moodCollapsed ? (viewMode === 'days' ? (
          <DayHeatmap
            days={days}
            mode={colorMode}
            layout={layout}
            year={year}
            selectedDayId={selectedDay?.id}
            onSelectDay={onSelectDay}
          />
        ) : viewMode === 'year' ? (
          <DayHeatmap
            days={days}
            mode={colorMode}
            layout={layout}
            year={year}
            selectedDayId={selectedDay?.id}
            onSelectDay={onSelectDay}
          />
        ) : (
          <WeekHeatmap weeks={weeks} mode={colorMode} selectedWeekId={selectedWeek?.id} onSelectWeek={onSelectWeek} />
        )) : null}

        {!moodCollapsed && selectedWeek && selectedWeekDays.length > 0 ? (
          <WeekSummaryStrip week={selectedWeek} days={selectedWeekDays} tags={tags} />
        ) : null}

        <div className="flex flex-wrap items-center gap-6 text-sm text-[#A0A0A0]">
          <p>Tracked days: <span className="font-semibold text-white">{days.filter((day) => day.isLogged).length}</span></p>
          <p>Active habits: <span className="font-semibold text-white">{habits.filter((habit) => habit.active).length}</span></p>
          <p>Selected year: <span className="font-semibold text-white">{year}</span></p>
        </div>
      </Card>
    </div>
  )
}

function ToggleGroup({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: string[][]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#2C2C2C] bg-[#181818] p-1">
      <span className="px-3 text-xs uppercase tracking-[0.2em] text-[#8F8F8F]">{label}</span>
      {items.map(([itemValue, labelText]) => (
        <button
          key={itemValue}
          onClick={() => onChange(itemValue)}
          className={`rounded-2xl px-3 py-2 text-sm transition ${
            value === itemValue ? 'bg-[#343434] text-white' : 'text-[#A3A3A3] hover:text-white'
          }`}
        >
          {labelText}
        </button>
      ))}
    </div>
  )
}
