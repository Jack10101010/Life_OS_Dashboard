import { useMemo } from 'react'
import {
  ColorMode,
  DayEntry,
  Habit,
  HabitTrackerCalendarRange,
  Tag,
  TrackerFilters,
  TrackerViewMode,
  WeekEntry,
} from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { FiltersPanel } from '../../components/tracker/FiltersPanel'
import { DayHeatmap } from '../../components/tracker/DayHeatmap'
import { DayHeatmapCell } from '../../components/tracker/DayHeatmapCell'
import {
  HeatmapActionButton,
  HeatmapBadge,
  HeatmapIconButton,
  HeatmapMenuButton,
  HeatmapPeriodControl,
  HeatmapSegmentedControl,
} from '../../components/tracker/HeatmapControls'
import { HeatmapTooltip } from '../../components/tracker/HeatmapTooltip'
import { HeatmapWeekRow } from '../../components/tracker/HeatmapWeekRow'
import { WeekSummaryStrip } from '../../components/tracker/WeekSummaryStrip'
import { useHeatmapHover } from '../../components/tracker/useHeatmapHover'
import { usePopoverGroup } from '../../components/tracker/usePopoverGroup'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MOOD_MONTH_TILE_CLASS = 'h-[36px] w-[36px] rounded-[12px]'
const MOOD_WEEK_TILE_CLASS = 'h-[40px] w-[40px] rounded-[12px]'
const MOOD_MONTH_TILE_SIZE = 36
const MOOD_WEEK_TILE_SIZE = 40
const MOOD_TILE_GAP = 8

export function TrackerPage({
  viewMode,
  onViewModeChange,
  colorMode,
  onColorModeChange,
  year,
  years,
  filters,
  showFilters,
  onToggleFilters,
  onFiltersChange,
  weeks,
  days,
  allDays,
  habits,
  tags,
  selectedWeek,
  selectedWeekDays,
  selectedDay,
  moodHeatmapFocusDate,
  onMoodHeatmapFocusDateChange,
  moodHeatmapCalendarRange,
  onMoodHeatmapCalendarRangeChange,
  moodHighlightCurrentWeek,
  onMoodHighlightCurrentWeekChange,
  onLogToday,
  onSelectWeek,
  onPreviewWeek,
  onSelectDay,
}: {
  viewMode: TrackerViewMode
  onViewModeChange: (mode: TrackerViewMode) => void
  colorMode: ColorMode
  onColorModeChange: (mode: ColorMode) => void
  year: number
  years: number[]
  filters: TrackerFilters
  showFilters: boolean
  onToggleFilters: () => void
  onFiltersChange: (filters: TrackerFilters) => void
  weeks: WeekEntry[]
  days: DayEntry[]
  allDays: DayEntry[]
  habits: Habit[]
  tags: Tag[]
  selectedWeek: WeekEntry | null
  selectedWeekDays: DayEntry[]
  selectedDay: DayEntry | null
  moodHeatmapFocusDate: string
  onMoodHeatmapFocusDateChange: (date: string) => void
  moodHeatmapCalendarRange: HabitTrackerCalendarRange
  onMoodHeatmapCalendarRangeChange: (range: HabitTrackerCalendarRange) => void
  moodHighlightCurrentWeek: boolean
  onMoodHighlightCurrentWeekChange: (value: boolean) => void
  onLogToday: () => void
  onSelectWeek: (week: WeekEntry) => void
  onPreviewWeek: (week: WeekEntry) => void
  onSelectDay: (day: DayEntry) => void
}) {
  const { containerRef: controlsRef, isOpen, toggleMenu, closeMenu } = usePopoverGroup<'view' | 'settings'>()
  const moodSummary = getRecentMoodSummary(days)
  const currentWeekSummary = useMemo(() => getCurrentWeekSummary(weeks, days), [weeks, days])
  const moodPeriodLabel = getMoodPeriodLabel(viewMode, moodHeatmapFocusDate, year)
  const visibleDayIdSet = useMemo(() => new Set(days.map((day) => day.id)), [days])
  const moodMonthDays = useMemo(() => getMoodMonthViewDays(allDays, moodHeatmapFocusDate), [allDays, moodHeatmapFocusDate])
  const moodWeekDays = useMemo(() => getMoodWeekViewDays(allDays, moodHeatmapFocusDate), [allDays, moodHeatmapFocusDate])
  const selectedWeekIndex = selectedWeek ? weeks.findIndex((week) => week.id === selectedWeek.id) : -1
  const previousWeek = selectedWeekIndex > 0 ? weeks[selectedWeekIndex - 1] : null
  const nextWeekCandidate = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex + 1] ?? null : null
  const todayIso = new Date().toISOString().slice(0, 10)
  const nextWeek = nextWeekCandidate && nextWeekCandidate.startDate <= todayIso ? nextWeekCandidate : null
  const weeklyTrendData = useMemo(() => getWeeklyTrendData(weeks, days), [weeks, days])

  return (
    <div className="space-y-5">
      {showFilters ? <FiltersPanel filters={filters} tags={tags} onChange={onFiltersChange} /> : null}

      <Card className="space-y-4 border-white/[0.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-semibold text-white">Mood Tracker & Daily Journal</h3>
          </div>

          <div ref={controlsRef} className="flex flex-wrap items-center gap-2">
            <HeatmapSegmentedControl
              items={[
                ['year', 'Year'],
                ['days', 'Month'],
                ['weeks', 'Week'],
              ] as Array<[TrackerViewMode, string]>}
              value={viewMode}
              onChange={onViewModeChange}
            />

            {viewMode === 'year' ? (
              <HeatmapBadge>{year}</HeatmapBadge>
            ) : (
              <HeatmapPeriodControl
                label={moodPeriodLabel}
                onPrev={() => onMoodHeatmapFocusDateChange(shiftMoodFocusDate(viewMode, moodHeatmapFocusDate, 'prev'))}
                onNext={() => onMoodHeatmapFocusDateChange(shiftMoodFocusDate(viewMode, moodHeatmapFocusDate, 'next'))}
              />
            )}

            {viewMode === 'year' ? (
              <div className="relative">
                <HeatmapMenuButton label="View" onClick={() => toggleMenu('view')} />
                {isOpen('view') ? (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[210px] rounded-2xl border border-[#2F2F2F] bg-[#171717] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                    {([
                      ['full-year', 'Full tile view'],
                      ['first-entry', 'From first entry'],
                      ['current-date', 'From today'],
                    ] as Array<[HabitTrackerCalendarRange, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          onMoodHeatmapCalendarRangeChange(value)
                          closeMenu()
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${
                          moodHeatmapCalendarRange === value
                            ? 'bg-[#2B2B2B] text-white'
                            : 'text-[#B0B0B0] hover:bg-[#202020] hover:text-white'
                        }`}
                      >
                        <span>{label}</span>
                        {moodHeatmapCalendarRange === value ? (
                          <span className="text-[11px] text-[#E6E6E6]">Selected</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
              <HeatmapIconButton onClick={() => toggleMenu('settings')} ariaLabel="Mood heatmap settings" compact={false}>
                ⚙
              </HeatmapIconButton>
              {isOpen('settings') ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[236px] rounded-2xl border border-[#2F2F2F] bg-[#171717] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#8F8F8F]">Metric</p>
                      <div className="flex flex-wrap gap-1">
                        {([
                          ['overall', 'Overall'],
                          ['habits', 'Habits'],
                          ['mood', 'Mood'],
                          ['alcohol', 'Alcohol'],
                        ] as Array<[ColorMode, string]>).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => onColorModeChange(value)}
                            className={`rounded-xl px-3 py-2 text-[13px] transition ${
                              colorMode === value ? 'bg-[#343434] text-white' : 'bg-[#1D1D1D] text-[#A3A3A3] hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#8F8F8F]">Year</p>
                      <div className="flex gap-1">
                        {years.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => onFiltersChange({ ...filters, year: item })}
                            className={`rounded-xl px-3 py-2 text-[13px] transition ${
                              year === item ? 'bg-[#343434] text-white' : 'bg-[#1D1D1D] text-[#A3A3A3] hover:text-white'
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-white/[0.06] pt-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-mist/80 transition hover:text-white">
                        <input
                          type="checkbox"
                          checked={moodHighlightCurrentWeek}
                          onChange={() => onMoodHighlightCurrentWeekChange(!moodHighlightCurrentWeek)}
                          className="h-3.5 w-3.5 rounded border border-white/10 bg-transparent accent-[#78A7FF]"
                        />
                        <span>Highlight current week</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <HeatmapActionButton label="Log" compact={false} onClick={onLogToday} />
          </div>
        </div>

        {currentWeekSummary ? (
          <CurrentWeekStrip
            rangeLabel={currentWeekSummary.rangeLabel}
            good={currentWeekSummary.good}
            average={currentWeekSummary.average}
            low={currentWeekSummary.low}
            days={currentWeekSummary.days}
            onOpenWeek={() => onSelectWeek(currentWeekSummary.week)}
          />
        ) : null}

        {viewMode === 'year' ? (
          <DayHeatmap
            days={allDays}
            visibleDayIds={days.map((day) => day.id)}
            mode={colorMode}
            year={year}
            selectedDayId={selectedDay?.id}
            onSelectDay={onSelectDay}
            calendarRange={moodHeatmapCalendarRange}
            highlightCurrentWeek={moodHighlightCurrentWeek}
            showAlcoholMarker
          />
        ) : viewMode === 'days' ? (
          <MoodMonthView
            days={moodMonthDays}
            visibleDayIdSet={visibleDayIdSet}
            mode={colorMode}
            selectedDayId={selectedDay?.id}
            highlightCurrentWeek={moodHighlightCurrentWeek}
            onSelectDay={onSelectDay}
          />
        ) : (
          <MoodWeekView
            days={moodWeekDays}
            visibleDayIdSet={visibleDayIdSet}
            mode={colorMode}
            selectedDayId={selectedDay?.id}
            highlightCurrentWeek={moodHighlightCurrentWeek}
            onSelectDay={onSelectDay}
          />
        )}

        {(viewMode === 'days' || viewMode === 'year') ? <MoodSummaryStrip summary={moodSummary} /> : null}

        {selectedWeek && selectedWeekDays.length > 0 ? (
          <WeekSummaryStrip
            week={selectedWeek}
            days={selectedWeekDays}
            tags={tags}
            canGoPrev={Boolean(previousWeek)}
            canGoNext={Boolean(nextWeek)}
            onPrevWeek={() => previousWeek && onPreviewWeek(previousWeek)}
            onNextWeek={() => nextWeek && onPreviewWeek(nextWeek)}
            onOpenWeek={() => onSelectWeek(selectedWeek)}
            trendData={weeklyTrendData}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-6 text-sm text-[#A0A0A0]">
          <p>
            Tracked days: <span className="font-semibold text-white">{days.filter((day) => day.isLogged).length}</span>
          </p>
          <p>
            Active habits: <span className="font-semibold text-white">{habits.filter((habit) => habit.active).length}</span>
          </p>
          <p>
            Selected year: <span className="font-semibold text-white">{year}</span>
          </p>
        </div>
      </Card>
    </div>
  )
}

function MoodMonthView({
  days,
  visibleDayIdSet,
  mode,
  selectedDayId,
  highlightCurrentWeek,
  onSelectDay,
}: {
  days: Array<{ day: DayEntry | null; dayNumber: number; inCurrentMonth: boolean; isoDate: string }>
  visibleDayIdSet: Set<string>
  mode: ColorMode
  selectedDayId?: string
  highlightCurrentWeek: boolean
  onSelectDay: (day: DayEntry) => void
}) {
  const { containerRef, hovered, bindHover } = useHeatmapHover<DayEntry>()
  const weekRows = chunkIntoWeeks(days)

  return (
    <div ref={containerRef} className="relative overflow-visible rounded-[28px] border border-[#2A2A2A] bg-[#161616] px-4 py-4">
      <div className="mx-auto w-fit">
      <HeatmapWeekRow
        labels={WEEKDAY_LABELS}
        columns={7}
        gapClassName="gap-2"
        labelClassName="text-[10px] uppercase tracking-[0.16em] text-[#969696]"
      >
          {weekRows.map((row, rowIndex) => {
            const currentWeekIndices = row
              .map((cell, index) => (isDateInCurrentIsoWeek(cell.isoDate) ? index : null))
              .filter((value): value is number => value !== null)

            return (
              <div
                key={`row-${rowIndex}`}
                className="relative col-span-7 grid grid-cols-7 gap-2 rounded-[16px] p-1.5"
              >
                {highlightCurrentWeek && currentWeekIndices.length > 0 ? (
                  <div
                    className="pointer-events-none absolute top-1.5 z-0 rounded-[14px] border border-[#78A7FF] shadow-[0_0_0_1px_rgba(120,167,255,0.16)]"
                    style={getCompactWeekOutlineStyle(currentWeekIndices[0], currentWeekIndices[currentWeekIndices.length - 1], MOOD_MONTH_TILE_SIZE)}
                  />
                ) : null}
                {row.map((cell, index) => (
                  <div key={`${cell.day?.id ?? 'empty'}-${rowIndex}-${index}`} className="relative z-10">
                    {cell.day && visibleDayIdSet.has(cell.day.id) ? (
                      <button
                        type="button"
                        onClick={() => onSelectDay(cell.day!)}
                        className={`group relative z-10 block overflow-hidden text-left transition duration-150 hover:scale-[1.06] hover:brightness-110 ${MOOD_MONTH_TILE_CLASS}`}
                        {...bindHover(cell.day)}
                      >
                        <DayHeatmapCell
                          day={cell.day}
                          mode={mode}
                          active={selectedDayId === cell.day.id}
                          hoverOutline
                          showAlcoholMarker
                          temporalEmptyShade
                          sizeClassName={MOOD_MONTH_TILE_CLASS}
                        />
                      </button>
                    ) : (
                      <DayHeatmapCell
                        day={null}
                        mode={mode}
                        hoverOutline
                        temporalEmptyShade
                        emptyDate={cell.isoDate}
                        sizeClassName={MOOD_MONTH_TILE_CLASS}
                      />
                    )}
                    <p
                      className={`pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium ${
                        cell.inCurrentMonth ? 'text-[#D0D0D0]' : 'text-[#636363]'
                      }`}
                    >
                      {cell.dayNumber}
                    </p>
                  </div>
                ))}
              </div>
            )
          })}
      </HeatmapWeekRow>
      </div>
      {hovered ? <HeatmapTooltip day={hovered.day} anchorRect={hovered.rect} containerRect={hovered.container} /> : null}
    </div>
  )
}

function MoodWeekView({
  days,
  visibleDayIdSet,
  mode,
  selectedDayId,
  highlightCurrentWeek,
  onSelectDay,
}: {
  days: Array<{ day: DayEntry | null; dayNumber: number; isoDate: string }>
  visibleDayIdSet: Set<string>
  mode: ColorMode
  selectedDayId?: string
  highlightCurrentWeek: boolean
  onSelectDay: (day: DayEntry) => void
}) {
  const { containerRef, hovered, bindHover } = useHeatmapHover<DayEntry>()

  return (
    <div ref={containerRef} className="relative overflow-visible rounded-[28px] border border-[#2A2A2A] bg-[#161616] px-4 py-4">
      <div className="mx-auto w-fit">
      <HeatmapWeekRow
        labels={WEEKDAY_LABELS}
        columns={7}
        gapClassName="gap-2"
        labelClassName="text-[10px] uppercase tracking-[0.16em] text-[#969696]"
      >
          <div className="relative col-span-7 grid grid-cols-7 gap-2 rounded-[16px] p-1.5">
          {highlightCurrentWeek ? (
            <div
              className="pointer-events-none absolute top-1.5 z-0 rounded-[14px] border border-[#78A7FF] shadow-[0_0_0_1px_rgba(120,167,255,0.16)]"
              style={getCompactWeekOutlineStyle(0, 6, MOOD_WEEK_TILE_SIZE)}
            />
          ) : null}
          {days.map((cell, index) => (
            <div key={`${cell.day?.id ?? 'empty'}-${index}`} className="relative z-10">
              {cell.day && visibleDayIdSet.has(cell.day.id) ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(cell.day!)}
                  className={`group relative z-10 block overflow-hidden text-left transition duration-150 hover:scale-[1.06] hover:brightness-110 ${MOOD_WEEK_TILE_CLASS}`}
                  {...bindHover(cell.day)}
                >
                  <DayHeatmapCell
                    day={cell.day}
                    mode={mode}
                    active={selectedDayId === cell.day.id}
                    hoverOutline
                    showAlcoholMarker
                    temporalEmptyShade
                    sizeClassName={MOOD_WEEK_TILE_CLASS}
                  />
                </button>
              ) : (
                <DayHeatmapCell
                  day={null}
                  mode={mode}
                  hoverOutline
                  temporalEmptyShade
                  emptyDate={cell.isoDate}
                  sizeClassName={MOOD_WEEK_TILE_CLASS}
                />
              )}
              <p className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium text-[#D0D0D0]">
                {cell.dayNumber}
              </p>
            </div>
          ))}
          </div>
      </HeatmapWeekRow>
      </div>
      {hovered ? <HeatmapTooltip day={hovered.day} anchorRect={hovered.rect} containerRect={hovered.container} /> : null}
    </div>
  )
}

function CurrentWeekStrip({
  rangeLabel,
  good,
  average,
  low,
  days,
  onOpenWeek,
}: {
  rangeLabel: string
  good: number
  average: number
  low: number
  days: Array<{ label: string; state: 'past' | 'today' | 'future' }>
  onOpenWeek: () => void
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.04] bg-white/[0.02] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-[0.2em] text-mist/55">Current Week</span>
          <span className="text-[#6E6E6E]">·</span>
          <span className="text-[#78A7FF]">{rangeLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-mist">
            <span>
              <span className="mr-1.5 text-[#17C964]">●</span>
              {good} good
            </span>
            <span>
              <span className="mr-1.5 text-[#C27A2C]">●</span>
              {average} average
            </span>
            <span>
              <span className="mr-1.5 text-[#A44A43]">●</span>
              {low} low
            </span>
          </div>
          <Button onClick={onOpenWeek}>Open Week</Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {days.map((day, index) => (
          <div key={`${day.label}-${index}`} className="flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#727272]">{day.label}</span>
            <div
              className={`h-[10px] w-[22px] rounded-full border transition-colors ${
                day.state === 'past'
                  ? 'border-[#4B4B4B] bg-[#4B4B4B]'
                  : day.state === 'today'
                    ? 'border-[#78A7FF] bg-[#1B1F29]'
                    : 'border-white/[0.06] bg-[#1D1D1D]'
              }`}
              style={
                day.state === 'today'
                  ? { boxShadow: 'inset 0 0 0 1px rgba(120,167,255,0.38)' }
                  : undefined
              }
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function chunkIntoWeeks<T>(items: T[]) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += 7) {
    chunks.push(items.slice(index, index + 7))
  }
  return chunks
}

function MoodSummaryStrip({
  summary,
}: {
  summary: { good: number; average: number; low: number; trend: string; windowDays: number }
}) {
  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist/75">
      <span className="text-xs uppercase tracking-[0.2em] text-mist/45">Last {summary.windowDays} days</span>
      <span className="text-[#6E6E6E]">·</span>
      <span>
        <span className="mr-1.5 text-[#17C964]">●</span>
        {summary.good} good
      </span>
      <span>
        <span className="mr-1.5 text-[#C27A2C]">●</span>
        {summary.average} average
      </span>
      <span>
        <span className="mr-1.5 text-[#A44A43]">●</span>
        {summary.low} low
      </span>
      <span className="text-[#6E6E6E]">·</span>
      <span>
        Trend: <span className="text-white">{summary.trend}</span>
      </span>
      </div>
    </div>
  )
}

function getRecentMoodSummary(days: DayEntry[]) {
  const windowDays = 30
  const recentLoggedDays = [...days]
    .filter((day) => day.isLogged)
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-windowDays)
    .map((day) => ({
      day,
      score: getDailyMoodSignal(day),
    }))
    .filter((item) => item.score != null) as Array<{ day: DayEntry; score: number }>

  const good = recentLoggedDays.filter((item) => item.score >= 7).length
  const average = recentLoggedDays.filter((item) => item.score >= 4 && item.score < 7).length
  const low = recentLoggedDays.filter((item) => item.score < 4).length

  const midpoint = Math.max(1, Math.floor(recentLoggedDays.length / 2))
  const firstHalf = recentLoggedDays.slice(0, midpoint)
  const secondHalf = recentLoggedDays.slice(midpoint)
  const firstAverage = averageScores(firstHalf)
  const secondAverage = averageScores(secondHalf.length > 0 ? secondHalf : firstHalf)
  const delta = secondAverage - firstAverage

  let trend = 'steady'
  if (recentLoggedDays.length < 4) {
    trend = 'early days'
  } else if (Math.abs(delta) < 0.35) {
    trend = 'steady'
  } else if (delta >= 0.75) {
    trend = 'improving'
  } else if (delta <= -0.75) {
    trend = 'declining'
  } else {
    trend = 'mixed'
  }

  return { good, average, low, trend, windowDays }
}

function getCurrentWeekSummary(weeks: WeekEntry[], days: DayEntry[]) {
  const today = new Date().toISOString().slice(0, 10)
  const todayEntry = days.find((day) => day.date === today)
  const currentWeek = todayEntry ? weeks.find((week) => week.id === todayEntry.linkedWeek) ?? null : null

  if (!currentWeek) return null

  const currentWeekDays = days.filter((day) => day.linkedWeek === currentWeek.id && day.isLogged)
  const classified = currentWeekDays
    .map((day) => getDailyMoodSignal(day))
    .filter((score): score is number => score != null)

  return {
    week: currentWeek,
    rangeLabel: formatWeekRange(currentWeek.startDate, currentWeek.endDate),
    good: classified.filter((score) => score >= 7).length,
    average: classified.filter((score) => score >= 4 && score < 7).length,
    low: classified.filter((score) => score < 4).length,
    days: buildCurrentWeekProgressDays(currentWeek.startDate, today),
  }
}

function formatWeekRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const startMonth = start.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const endMonth = end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  const startDay = start.getUTCDate()
  const endDay = end.getUTCDate()

  return startMonth === endMonth ? `${startMonth} ${startDay}-${endDay}` : `${startMonth} ${startDay}-${endMonth} ${endDay}`
}

function buildCurrentWeekProgressDays(startDate: string, today: string) {
  const start = new Date(`${startDate}T00:00:00Z`)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const iso = date.toISOString().slice(0, 10)
    const label = date.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 1)

    let state: 'past' | 'today' | 'future' = 'future'
    if (iso < today) state = 'past'
    if (iso === today) state = 'today'

    return { label, state }
  })
}

function getDailyMoodSignal(day: DayEntry) {
  const checkInValues = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)
  if (checkInValues.length > 0) {
    return checkInValues.reduce((sum, value) => sum + value, 0) / checkInValues.length
  }

  if (!day.isLogged) return null
  return ((day.morningMood + day.eveningMood) / 2) * 2
}

function averageScores(items: Array<{ score: number }>) {
  if (items.length === 0) return 0
  return items.reduce((sum, item) => sum + item.score, 0) / items.length
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startOfIsoWeek(date: Date) {
  const copy = new Date(date)
  const day = (copy.getUTCDay() + 6) % 7
  copy.setUTCDate(copy.getUTCDate() - day)
  return copy
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + amount)
  return copy
}

function addMonths(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setUTCMonth(copy.getUTCMonth() + amount)
  return copy
}

function getMoodPeriodLabel(viewMode: TrackerViewMode, focusDate: string, year: number) {
  if (viewMode === 'year') return `${year}`

  const focus = new Date(`${focusDate}T00:00:00Z`)
  if (viewMode === 'days') {
    return focus.toLocaleDateString('en-IE', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  const weekStart = startOfIsoWeek(focus)
  const weekNumber = Math.ceil((((weekStart.getTime() - Date.UTC(weekStart.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)
  return `Week ${weekNumber} · ${weekStart.getUTCFullYear()}`
}

function shiftMoodFocusDate(viewMode: TrackerViewMode, focusDate: string, direction: 'prev' | 'next') {
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const amount = direction === 'next' ? 1 : -1

  if (viewMode === 'days') return toIsoDate(addMonths(focus, amount))
  if (viewMode === 'weeks') return toIsoDate(addDays(focus, amount * 7))
  return focusDate
}

function getMoodMonthViewDays(days: DayEntry[], focusDate: string) {
  const dayMap = new Map(days.map((day) => [day.date, day]))
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const monthStart = new Date(Date.UTC(focus.getUTCFullYear(), focus.getUTCMonth(), 1))
  const gridStart = startOfIsoWeek(monthStart)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const iso = toIsoDate(date)
    return {
      day: dayMap.get(iso) ?? null,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === focus.getUTCMonth(),
      isoDate: iso,
    }
  })
}

function getMoodWeekViewDays(days: DayEntry[], focusDate: string) {
  const dayMap = new Map(days.map((day) => [day.date, day]))
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const weekStart = startOfIsoWeek(focus)

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    const iso = toIsoDate(date)
    return {
      day: dayMap.get(iso) ?? null,
      dayNumber: date.getUTCDate(),
      isoDate: iso,
    }
  })
}

function getWeeklyTrendData(weeks: WeekEntry[], days: DayEntry[]) {
  return weeks
    .filter((week) => week.loggedDaysCount > 0)
    .slice(-8)
    .map((week) => {
      const linkedDays = days.filter((day) => week.linkedDays.includes(day.id) && day.isLogged)
      const lowDays = linkedDays.filter((day) => {
        const signal = getMoodSignal(day)
        return signal !== null && signal < 4
      }).length

      return {
        label: formatTrendWeekLabel(week),
        mood: Number(week.moodAverage.toFixed(1)),
        lowDays,
        drank: linkedDays.some((day) => day.drank),
        poorSleep: linkedDays.some((day) => day.tags.includes('poor-sleep')),
      }
    })
}

function formatTrendWeekLabel(week: WeekEntry) {
  const start = new Date(`${week.startDate}T00:00:00Z`)
  return start.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function getMoodSignal(day: DayEntry) {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter(
    (value): value is number => typeof value === 'number',
  )
  if (values.length > 0) {
    return averageOf(values)
  }

  if (day.morningMood || day.eveningMood) {
    return ((day.morningMood + day.eveningMood) / 2) * 2
  }

  return null
}

function averageOf(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function isDateInCurrentIsoWeek(isoDate: string) {
  const now = new Date()
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const currentWeekStart = startOfIsoWeek(todayUtc)
  const currentWeekEnd = addDays(currentWeekStart, 6)
  const date = new Date(`${isoDate}T00:00:00Z`)
  return date >= currentWeekStart && date <= currentWeekEnd
}

function getCompactWeekOutlineStyle(startIndex: number, endIndex: number, tileSize: number) {
  const left = startIndex * (tileSize + MOOD_TILE_GAP) + 6
  const width = (endIndex - startIndex + 1) * tileSize + (endIndex - startIndex) * MOOD_TILE_GAP
  return {
    left: `${left}px`,
    width: `${width}px`,
    height: `${tileSize}px`,
  }
}
