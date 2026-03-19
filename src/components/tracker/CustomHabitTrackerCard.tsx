import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { HabitTracker, HabitTrackerAchievement, HabitTrackerCalendarRange, HabitTrackerPeriodView, HeatmapLayout } from '../../types'
import {
  getAchievementDetailLabel,
  getLiveTrackerStreak,
  getTrackerGoalLabel,
  getTrackerGoalProgress,
  getTrackerStreakEndingOn,
  normalizeHabitTracker,
} from '../../lib/habitTrackerGoals'
import { getConsecutiveDateStreak } from '../../lib/streaks'
import { Card } from '../ui/Card'
import {
  HeatmapActionButton,
  HeatmapBadge,
  HeatmapIconButton,
  HeatmapMenuButton,
  HeatmapPeriodControl,
} from './HeatmapControls'
import { HeatmapTile } from './HeatmapTile'
import { HabitTrackerTooltip } from './HabitTrackerTooltip'
import { HeatmapWeekRow } from './HeatmapWeekRow'
import { GITHUB_DAY_LABELS, getContributionColumns, getContributionMonthSpans, getMonthMatrix } from './heatmapUtils'
import { useHeatmapHover } from './useHeatmapHover'
import { usePopoverGroup } from './usePopoverGroup'

type TrackerCell = { date: string; completed: boolean; note: string }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isWeekendIso(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

function isTodayIso(date: string) {
  return date === new Date().toISOString().slice(0, 10)
}

function getCurrentMonthIndex(year: number) {
  const today = new Date()
  return today.getUTCFullYear() === year ? today.getUTCMonth() : null
}

function getCurrentDayNumber(year: number) {
  const today = new Date()
  return today.getUTCFullYear() === year ? today.getUTCDate() : null
}

function getTrackerColor(color: string, intensity: number) {
  const hex = color.replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)

  const base = { r: 38, g: 38, b: 38 }
  const normalizedIntensity = Math.max(intensity, 0)
  const mix = Math.min(normalizedIntensity, 100) / 100

  const mixChannel = (from: number, to: number, amount: number) => Math.round(from + (to - from) * amount)

  if (normalizedIntensity <= 100) {
    return `rgb(${mixChannel(base.r, r, mix)}, ${mixChannel(base.g, g, mix)}, ${mixChannel(base.b, b, mix)})`
  }

  const boost = normalizedIntensity / 100
  const brighten = (channel: number) => Math.min(Math.round(channel * boost), 255)
  return `rgb(${brighten(r)}, ${brighten(g)}, ${brighten(b)})`
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

function formatAchievementDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getAchievementDurationLabel(achievement: HabitTrackerAchievement) {
  return achievement.durationDays === 1 ? '1 day' : `${achievement.durationDays} days`
}

function getTrackerCells(tracker: HabitTracker, year: number): TrackerCell[] {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))
  const cells: TrackerCell[] = []
  const cursor = new Date(start)

  while (cursor < end) {
    const iso = toIsoDate(cursor)
    const entry = tracker.entries[iso]
    cells.push({
      date: iso,
      completed: entry?.completed ?? false,
      note: entry?.note ?? '',
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return cells
}

function getMonthViewCells(tracker: HabitTracker, focusDate: string) {
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const monthStart = new Date(Date.UTC(focus.getUTCFullYear(), focus.getUTCMonth(), 1))
  const gridStart = startOfIsoWeek(monthStart)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index)
    const iso = toIsoDate(date)
    const entry = tracker.entries[iso]
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: date.getUTCMonth() === focus.getUTCMonth(),
      completed: entry?.completed ?? false,
      note: entry?.note ?? '',
    }
  })
}

function getWeekViewCells(tracker: HabitTracker, focusDate: string) {
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const weekStart = startOfIsoWeek(focus)

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index)
    const iso = toIsoDate(date)
    const entry = tracker.entries[iso]
    return {
      date: iso,
      dayNumber: date.getUTCDate(),
      completed: entry?.completed ?? false,
      note: entry?.note ?? '',
    }
  })
}

function getPeriodLabel(periodView: HabitTrackerPeriodView, focusDate: string, year: number) {
  if (periodView === 'year') return `${year}`

  const focus = new Date(`${focusDate}T00:00:00Z`)
  if (periodView === 'month') {
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

function shiftFocusDate(periodView: HabitTrackerPeriodView, focusDate: string, direction: 'prev' | 'next') {
  const focus = new Date(`${focusDate}T00:00:00Z`)
  const amount = direction === 'next' ? 1 : -1

  if (periodView === 'month') return toIsoDate(addMonths(focus, amount))
  if (periodView === 'week') return toIsoDate(addDays(focus, amount * 7))
  return focusDate
}

function getCalendarRangeStartMonth(
  tracker: HabitTracker,
  year: number,
  calendarRange: HabitTrackerCalendarRange,
) {
  if (calendarRange === 'full-year') return 0

  if (calendarRange === 'first-entry') {
    const firstEntry = Object.values(tracker.entries)
      .filter((entry) => entry.completed && entry.date.startsWith(`${year}-`))
      .sort((a, b) => a.date.localeCompare(b.date))[0]

    if (!firstEntry) return 0
    return new Date(`${firstEntry.date}T00:00:00Z`).getUTCMonth()
  }

  const today = new Date()
  if (today.getUTCFullYear() !== year) return 0
  return today.getUTCMonth()
}

function getCalendarRangeStartDay(
  tracker: HabitTracker,
  year: number,
  calendarRange: HabitTrackerCalendarRange,
) {
  if (calendarRange === 'full-year') return 1

  if (calendarRange === 'first-entry') {
    const firstEntry = Object.values(tracker.entries)
      .filter((entry) => entry.completed && entry.date.startsWith(`${year}-`))
      .sort((a, b) => a.date.localeCompare(b.date))[0]

    if (!firstEntry) return 1
    return new Date(`${firstEntry.date}T00:00:00Z`).getUTCDate()
  }

  const today = new Date()
  if (today.getUTCFullYear() !== year) return 1
  return today.getUTCDate()
}

function TrackerCellButton({
  cell,
  color,
  colorIntensity,
  active,
  today = false,
  hovered,
  dimmed,
  disabled = false,
  achievement = false,
  alcoholConsumed = false,
  onClick,
  hoverProps,
  className = '',
}: {
  cell: TrackerCell
  color: string
  colorIntensity: number
  active?: boolean
  today?: boolean
  hovered?: boolean
  dimmed?: boolean
  disabled?: boolean
  achievement?: boolean
  alcoholConsumed?: boolean
  onClick: () => void
  hoverProps: Record<string, unknown>
  className?: string
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.06, filter: 'brightness(1.08)' }}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative z-10 block text-left ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      {...hoverProps}
    >
      <HeatmapTile
        backgroundColor={hovered ? '#595959' : disabled ? '#0E0E0E' : cell.completed ? getTrackerColor(color, colorIntensity) : '#262626'}
        active={active}
        currentWeek={today}
        disabled={disabled}
        dimmed={dimmed}
        className="h-full w-full"
      />
      {alcoholConsumed ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1B1B1B] bg-[#FF4D4F] shadow-[0_0_0_1px_rgba(255,77,79,0.16)]" />
      ) : null}
      {achievement ? (
        <span className="pointer-events-none absolute right-0.5 top-0.5 z-20 inline-flex h-3 w-3 items-center justify-center rounded-full bg-[#2A2316] text-[8px] leading-none text-[#F3C56B] shadow-[0_0_0_1px_rgba(243,197,107,0.18)]">
          ★
        </span>
      ) : null}
    </motion.button>
  )
}

export function CustomHabitTrackerCard({
  tracker,
  alcoholConsumedDates,
  year,
  layout,
  periodView,
  focusDate,
  calendarRange,
  selectedDate,
  collapsed,
  onToggleCollapse,
  onSelectDate,
  onOpenSettings,
  onOpenGoalSetup,
  onShiftPeriod,
  onCalendarRangeChange,
}: {
  tracker: HabitTracker
  alcoholConsumedDates: string[]
  year: number
  layout: HeatmapLayout
  periodView: HabitTrackerPeriodView
  focusDate: string
  calendarRange: HabitTrackerCalendarRange
  selectedDate?: string
  collapsed: boolean
  onToggleCollapse: () => void
  onSelectDate: (date: string) => void
  onOpenSettings: () => void
  onOpenGoalSetup: () => void
  onShiftPeriod: (nextFocusDate: string) => void
  onCalendarRangeChange: (next: HabitTrackerCalendarRange) => void
}) {
  const trackerData = normalizeHabitTracker(tracker)
  const alcoholConsumedDateSet = new Set(alcoholConsumedDates)
  const { containerRef: controlsRef, isOpen, toggleMenu, closeMenu } = usePopoverGroup<'view'>()
  const {
    containerRef: achievementShelfRef,
    isOpen: isAchievementOpen,
    toggleMenu: toggleAchievement,
    closeMenu: closeAchievement,
  } = usePopoverGroup<'details'>()
  const compactMode = periodView !== 'year'
  const yearCells = getTrackerCells(trackerData, year)
  const monthCells = getMonthViewCells(trackerData, focusDate)
  const weekCells = getWeekViewCells(trackerData, focusDate)
  const completedYearCells = yearCells.filter((cell) => cell.completed)
  const streak = getConsecutiveDateStreak(new Set(completedYearCells.map((cell) => cell.date)), year)
  const liveStreak = getLiveTrackerStreak(trackerData, year)
  const totalTracked = completedYearCells.length
  const completionRate = Math.round((totalTracked / Math.max(yearCells.length, 1)) * 100)
  const goalProgress = getTrackerGoalProgress(trackerData, year)
  const periodLabel = getPeriodLabel(periodView, focusDate, year)
  const calendarStartMonth = getCalendarRangeStartMonth(tracker, year, calendarRange)
  const calendarStartDay = getCalendarRangeStartDay(tracker, year, calendarRange)
  const currentMonthIndex = getCurrentMonthIndex(year)
  const currentDayNumber = getCurrentDayNumber(year)
  const currentMonthLabel =
    currentMonthIndex != null
      ? new Date(Date.UTC(year, currentMonthIndex, 1)).toLocaleDateString('en-IE', { month: 'short', timeZone: 'UTC' }).toUpperCase()
      : null
  const achievementDates = new Set(trackerData.achievements.map((achievement) => achievement.date))

  const { containerRef, hovered, bindHover } = useHeatmapHover<TrackerCell>()
  const hoveredDate = hovered?.day.date
  const trackerColor = getTrackerColor(tracker.color, tracker.colorIntensity ?? 100)
  const hideWeekends = tracker.weekendVisibility === 'hide'
  const disableWeekends = tracker.weekendVisibility === 'disable'
  const weekdayLabels = hideWeekends ? WEEKDAY_LABELS.slice(0, 5) : WEEKDAY_LABELS
  const [showCelebration, setShowCelebration] = useState(false)
  const [selectedAchievement, setSelectedAchievement] = useState<HabitTrackerAchievement | null>(null)
  const previousCompletedRef = useRef(Boolean(goalProgress?.completed))
  const visibleAchievements = trackerData.achievements.slice(-10).reverse()

  useEffect(() => {
    const nextCompleted = Boolean(goalProgress?.completed)
    if (!previousCompletedRef.current && nextCompleted) {
      previousCompletedRef.current = nextCompleted
      setShowCelebration(true)
      const timeout = window.setTimeout(() => setShowCelebration(false), 2800)
      return () => window.clearTimeout(timeout)
    }
    previousCompletedRef.current = nextCompleted
    return undefined
  }, [goalProgress?.completed])

  const openAchievementDetails = (achievement: HabitTrackerAchievement) => {
    if (isAchievementOpen('details') && selectedAchievement?.id === achievement.id) {
      setSelectedAchievement(null)
      closeAchievement()
      return
    }

    setSelectedAchievement(achievement)
    if (!isAchievementOpen('details')) {
      toggleAchievement('details')
    }
  }

  const renderYearView = () => {
    if (layout === 'calendar') {
      const visibleRows = getMonthMatrix(yearCells, year).slice(calendarStartMonth).map((row, rowIndex) => {
        const realCells = row.cells.filter((cell): cell is TrackerCell => cell !== null)

        if (rowIndex !== 0 || calendarRange === 'full-year') {
              return {
            ...row,
            monthIndex: calendarStartMonth + rowIndex,
            cells: realCells.map((cell) =>
              trackerData.weekendVisibility === 'hide' && isWeekendIso(cell.date)
                ? ({ type: 'hidden' as const, key: cell.date })
                : ({ type: 'cell' as const, cell }),
            ),
          }
        }

        return {
          ...row,
            monthIndex: calendarStartMonth + rowIndex,
            cells: realCells.map((cell, index) =>
              index < Math.max(calendarStartDay - 1, 0)
                ? ({ type: 'hidden' as const, key: `${row.label}-${index}` })
              : trackerData.weekendVisibility === 'hide' && isWeekendIso(cell.date)
                ? ({ type: 'hidden' as const, key: cell.date })
              : ({ type: 'cell' as const, cell }),
          ),
        }
      })

      return (
        <div className="overflow-x-auto">
          <div className="min-w-[1040px]">
            <div className="mb-[3px] flex items-center gap-[3px]">
              <div className="w-[46px]" />
              {Array.from({ length: 31 }, (_, index) => (
              <div key={index + 1} className="flex h-[17px] w-[30px] items-center justify-center text-[10px] text-[#6F6F6F]">
                  <span className={currentDayNumber === index + 1 ? 'text-[#78A7FF]' : undefined}>{index + 1}</span>
                </div>
              ))}
            </div>
            <div className="space-y-[3px]">
              {visibleRows.map((row) => (
                <div key={row.label} className="flex items-center gap-[3px]">
                  <div className={`flex h-[17px] w-[46px] items-center pr-2 text-[11px] uppercase tracking-[0.16em] ${row.monthIndex === currentMonthIndex ? 'text-[#78A7FF]' : 'text-[#8C8C8C]'}`}>
                    {row.label}
                  </div>
                  {row.cells.map((item) =>
                    item.type === 'cell' ? (
                      <TrackerCellButton
                      key={item.cell.date}
                      cell={item.cell}
                        color={trackerData.color}
                      colorIntensity={trackerData.colorIntensity ?? 100}
                      active={selectedDate === item.cell.date}
                      today={isTodayIso(item.cell.date)}
                      hovered={hoveredDate === item.cell.date}
                      achievement={achievementDates.has(item.cell.date)}
                      alcoholConsumed={trackerData.showAlcoholMarkers && alcoholConsumedDateSet.has(item.cell.date)}
                      disabled={isWeekendIso(item.cell.date) && trackerData.weekendVisibility === 'disable'}
                      onClick={() => onSelectDate(item.cell.date)}
                      hoverProps={isWeekendIso(item.cell.date) && trackerData.weekendVisibility !== 'show' ? {} : bindHover(item.cell)}
                        className="h-[17px] w-[30px]"
                      />
                    ) : (
                      <div key={item.key} className="h-[17px] w-[30px]" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    const contributionColumns = getContributionColumns(yearCells)
    return (
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-2">
        <div />
        <div
          className="grid items-end gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${Math.max(contributionColumns.columns.length, 1)}, minmax(14px, 1fr))` }}
        >
          {getContributionMonthSpans(yearCells).map((label) => (
            <div
              key={`${label.label}-${label.column}`}
              className={`truncate text-[10px] uppercase tracking-[0.16em] ${currentMonthLabel && label.label === currentMonthLabel ? 'text-[#78A7FF]' : 'text-[#8C8C8C]'}`}
              style={{ gridColumn: `${label.column + 1} / span ${label.span}` }}
            >
              {label.label}
            </div>
          ))}
        </div>
        <div className="grid gap-[3px] pt-px">
          {(!hideWeekends ? GITHUB_DAY_LABELS : GITHUB_DAY_LABELS.slice(0, 5)).map((label, index) => (
            <div key={`${label}-${index}`} className="flex h-[12px] items-center text-[10px] uppercase tracking-[0.12em] text-[#6F6F6F]">
              {label}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid min-w-[980px] w-full gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${Math.max(contributionColumns.columns.length, 1)}, minmax(14px, 1fr))` }}
          >
            {contributionColumns.columns.map((column, columnIndex) => (
              <div key={columnIndex} className="grid gap-[3px]">
                {column
                  .map((cell, rowIndex) => ({ cell, rowIndex }))
                  .filter(({ rowIndex }) => !hideWeekends || rowIndex < 5)
                  .map(({ cell, rowIndex }, visibleRowIndex) =>
                  cell ? (
                    <TrackerCellButton
                      key={cell.date}
                      cell={cell}
                      color={trackerData.color}
                      colorIntensity={trackerData.colorIntensity ?? 100}
                      active={selectedDate === cell.date}
                      today={isTodayIso(cell.date)}
                      hovered={hoveredDate === cell.date}
                      achievement={achievementDates.has(cell.date)}
                      alcoholConsumed={trackerData.showAlcoholMarkers && alcoholConsumedDateSet.has(cell.date)}
                      disabled={rowIndex >= 5 && disableWeekends}
                      onClick={() => onSelectDate(cell.date)}
                      hoverProps={rowIndex >= 5 && disableWeekends ? {} : bindHover(cell)}
                      className="aspect-square w-full"
                    />
                  ) : (
                    <div key={`empty-${columnIndex}-${visibleRowIndex}`} className="aspect-square w-full rounded-[4px] border border-white/[0.04] bg-[#242424]" />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

const renderMonthView = () => (
    <HeatmapWeekRow labels={weekdayLabels} columns={trackerData.weekendVisibility === 'hide' ? 5 : 7}>
        {monthCells
          .filter((cell) => !hideWeekends || !isWeekendIso(cell.date))
          .map((cell) => (
          <div key={cell.date} className="relative">
            <TrackerCellButton
              cell={cell}
              color={trackerData.color}
              colorIntensity={trackerData.colorIntensity ?? 100}
              active={selectedDate === cell.date}
              today={isTodayIso(cell.date)}
              hovered={hoveredDate === cell.date}
              achievement={achievementDates.has(cell.date)}
              alcoholConsumed={trackerData.showAlcoholMarkers && alcoholConsumedDateSet.has(cell.date)}
              dimmed={!cell.inCurrentMonth}
              disabled={isWeekendIso(cell.date) && disableWeekends}
              onClick={() => onSelectDate(cell.date)}
              hoverProps={isWeekendIso(cell.date) && tracker.weekendVisibility !== 'show' ? {} : bindHover(cell)}
              className="aspect-square w-full overflow-hidden rounded-[18px]"
            />
            <p
              className={`pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium ${
                isTodayIso(cell.date) ? 'text-[#78A7FF]' : cell.inCurrentMonth ? 'text-[#D0D0D0]' : 'text-[#636363]'
              }`}
            >
              {cell.dayNumber}
            </p>
          </div>
        ))}
    </HeatmapWeekRow>
  )

  const renderWeekView = () => (
    <HeatmapWeekRow labels={weekdayLabels} columns={trackerData.weekendVisibility === 'hide' ? 5 : 7}>
        {weekCells
          .filter((cell) => !hideWeekends || !isWeekendIso(cell.date))
          .map((cell) => (
          <div key={cell.date} className="relative">
            <TrackerCellButton
              cell={cell}
              color={trackerData.color}
              colorIntensity={trackerData.colorIntensity ?? 100}
              active={selectedDate === cell.date}
              today={isTodayIso(cell.date)}
              hovered={hoveredDate === cell.date}
              achievement={achievementDates.has(cell.date)}
              alcoholConsumed={trackerData.showAlcoholMarkers && alcoholConsumedDateSet.has(cell.date)}
              disabled={isWeekendIso(cell.date) && disableWeekends}
              onClick={() => onSelectDate(cell.date)}
              hoverProps={isWeekendIso(cell.date) && tracker.weekendVisibility !== 'show' ? {} : bindHover(cell)}
              className="aspect-square w-full overflow-hidden rounded-[18px]"
            />
            <p className={`pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium ${isTodayIso(cell.date) ? 'text-[#78A7FF]' : 'text-[#D0D0D0]'}`}>
              {cell.dayNumber}
            </p>
          </div>
        ))}
    </HeatmapWeekRow>
  )

  return (
    <Card className={`${compactMode ? 'space-y-4 p-4' : 'space-y-5'} ${collapsed && compactMode ? 'pb-4' : ''}`}>
      <div className={`relative flex gap-3 ${compactMode ? 'items-start justify-between' : 'items-start justify-between'}`}>
        <AnimatePresence>
          {showCelebration && trackerData.goal ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] bg-black/45"
                onClick={() => setShowCelebration(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed left-1/2 top-1/2 z-[130] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2"
              >
                <div className="rounded-[28px] border border-[#332B18] bg-[#17130E] px-6 py-6 text-center shadow-[0_22px_60px_rgba(0,0,0,0.45)]">
                  <p className="text-[24px] font-semibold text-[#F3E4B4]">🎉 Goal Completed!</p>
                  <p className="mt-3 text-sm leading-6 text-[#D7C59A]">
                    You completed your{' '}
                    {trackerData.goal.type === 'times-per-week'
                      ? `${goalProgress?.target}x weekly`
                      : trackerData.goal.type === 'minutes-target'
                        ? `${goalProgress?.target}-minute`
                        : trackerData.goal.type === 'target-value'
                          ? `${goalProgress?.target}-point`
                          : `${goalProgress?.target}-day`}{' '}
                    {tracker.title} goal. Keep it up.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCelebration(false)}
                    className="mt-5 rounded-full border border-[#4C4023] bg-[#221B12] px-4 py-2 text-sm font-semibold text-[#F1E2B5] transition hover:bg-[#2A2116]"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
              <div className="pointer-events-none fixed left-1/2 top-1/2 z-[125] -translate-x-1/2 -translate-y-1/2">
                {Array.from({ length: 22 }, (_, index) => (
                  <motion.span
                    key={index}
                    className="absolute block rounded-full"
                    style={{
                      width: index % 3 === 0 ? 8 : 6,
                      height: index % 3 === 0 ? 8 : 6,
                      backgroundColor: ['#F3C56B', '#F0E1B3', '#CBE87A', '#7CC9FF'][index % 4],
                    }}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.7 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: Math.cos((index / 22) * Math.PI * 2) * (70 + (index % 4) * 18),
                      y: Math.sin((index / 22) * Math.PI * 2) * (70 + (index % 5) * 14),
                      scale: [0.7, 1, 0.85],
                      rotate: [0, index % 2 === 0 ? 140 : -140],
                    }}
                    transition={{ duration: 2.25, ease: 'easeOut', delay: index * 0.018 }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </AnimatePresence>
        <div className={`min-w-0 ${compactMode ? 'flex-1' : 'flex-[0_1_360px]'}`}>
          <div className="flex items-center gap-2">
            <h3 className={`${compactMode ? 'text-[18px] leading-tight' : 'text-2xl'} font-semibold text-white`}>{tracker.title}</h3>
            {!trackerData.goal ? (
              <div className="group relative shrink-0">
                <button
                  type="button"
                  onClick={onOpenGoalSetup}
                  aria-label={`Create goal for ${tracker.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2F2F2F] bg-[#151515] text-lg text-[#BEBEBE] transition hover:border-[#3A3A3A] hover:bg-[#1D1D1D] hover:text-white"
                >
                  +
                </button>
                <div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 -translate-x-1/2 whitespace-nowrap rounded-xl border border-[#2C2C2C] bg-[#191919] px-2.5 py-1 text-[11px] font-medium text-[#E2E2E2] opacity-0 shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition duration-150 group-hover:opacity-100">
                  Create goal
                </div>
              </div>
            ) : null}
          </div>
          {!collapsed && tracker.description ? (
            <p
              className={`mt-1 max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap text-[#8E8E8E] ${compactMode ? 'text-[12px]' : 'text-[13px]'}`}
            >
              {tracker.description}
            </p>
          ) : null}
        </div>
        {trackerData.goal ? (
          <button
            type="button"
            onClick={onOpenGoalSetup}
            className={`min-w-0 rounded-2xl border border-[#242424] bg-[#141414] transition hover:border-[#333333] hover:bg-[#181818] ${
              compactMode ? 'w-[210px] px-3 py-2' : 'ml-2 mr-auto w-[290px] px-4 py-3'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[11px] uppercase tracking-[0.14em] text-[#8E8E8E]">{getTrackerGoalLabel(trackerData.goal)}</p>
              <p className="shrink-0 text-[13px] font-semibold text-white">{goalProgress?.progressText ?? '0 / 0'}</p>
            </div>
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: Math.max(goalProgress?.target ?? 0, 1) }, (_, index) => {
                const isFilled = index < (goalProgress?.current ?? 0)
                const isMissed = Boolean(goalProgress?.missed) && index === 0 && !isFilled
                return (
                  <div
                    key={index}
                    className={`h-2 flex-1 rounded-full ${isMissed ? 'bg-[#8D3D37]' : !isFilled ? 'bg-[#262626]' : ''}`}
                    style={isFilled ? { backgroundColor: trackerColor } : undefined}
                  />
                )
              })}
            </div>
          </button>
        ) : (
          <div className="hidden w-6 lg:block" />
        )}
        <div ref={controlsRef} className={`shrink-0 flex items-center ${compactMode ? 'gap-1' : 'gap-2'}`}>
          {periodView !== 'year' ? (
            <HeatmapPeriodControl
              label={periodLabel}
              onPrev={() => onShiftPeriod(shiftFocusDate(periodView, focusDate, 'prev'))}
              onNext={() => onShiftPeriod(shiftFocusDate(periodView, focusDate, 'next'))}
              compact={compactMode}
            />
          ) : (
            <HeatmapBadge compact={compactMode}>{periodLabel}</HeatmapBadge>
          )}
          {periodView === 'year' && layout === 'calendar' ? (
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
                        onCalendarRangeChange(value)
                        closeMenu()
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${
                        calendarRange === value ? 'bg-[#2B2B2B] text-white' : 'text-[#B0B0B0] hover:bg-[#202020] hover:text-white'
                      }`}
                    >
                      <span>{label}</span>
                      {calendarRange === value ? <span className="text-[11px] text-[#E6E6E6]">Selected</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <HeatmapIconButton onClick={onToggleCollapse} ariaLabel={collapsed ? 'Expand tracker' : 'Collapse tracker'} compact={compactMode}>
            <span className={`inline-block text-[15px] text-[#8E8E8E] transition-transform ${collapsed ? 'rotate-180' : ''}`}>⌃</span>
          </HeatmapIconButton>
          <HeatmapIconButton onClick={onOpenSettings} ariaLabel="Tracker settings" compact={compactMode}>
            ⚙
          </HeatmapIconButton>
          {!compactMode ? <HeatmapActionButton label="Log" compact={false} onClick={() => onSelectDate(new Date().toISOString().slice(0, 10))} /> : null}
        </div>
      </div>

      {!collapsed ? (
        <div
          ref={containerRef}
          className={`relative overflow-visible rounded-[28px] border border-[#2A2A2A] bg-[#161616] ${
            compactMode ? 'px-4 py-4' : 'px-5 py-5'
          }`}
        >
          {periodView === 'year' ? renderYearView() : periodView === 'month' ? renderMonthView() : renderWeekView()}

          {hovered ? (
            <HabitTrackerTooltip
              title={tracker.title}
              date={hovered.day.date}
              status={
                trackerData.entries[hovered.day.date]?.completed
                  ? 'Completed'
                  : hovered.day.date < new Date().toISOString().slice(0, 10)
                    ? 'Missed'
                    : 'No entry yet'
              }
              preview={trackerData.entries[hovered.day.date]?.note || undefined}
              streak={trackerData.goal?.type === 'streak' ? getTrackerStreakEndingOn(trackerData, hovered.day.date) : undefined}
              alcoholConsumed={trackerData.showAlcoholMarkers && alcoholConsumedDateSet.has(hovered.day.date)}
              anchorRect={hovered.rect}
              containerRect={hovered.container}
            />
          ) : null}
        </div>
      ) : null}

      <div className={`flex items-end justify-between gap-4 ${compactMode ? 'text-[13px]' : 'text-sm'} text-[#A0A0A0]`}>
        <div className={`flex flex-wrap items-center ${compactMode ? 'gap-4' : 'gap-6'}`}>
          <p>
            Streak: <span className="font-semibold text-white">{liveStreak || streak}</span>
          </p>
          <p>
            Total done ({year}): <span className="font-semibold text-white">{totalTracked}</span>
          </p>
          <p>
            Completion rate ({year}): <span className="font-semibold text-white">{completionRate}%</span>
          </p>
        </div>
        {compactMode ? (
          <div className="flex items-center gap-3">
            {visibleAchievements.length ? (
              <div ref={achievementShelfRef} className="relative flex items-center gap-1">
                {visibleAchievements.map((achievement) => (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => openAchievementDetails(achievement)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#3B3420] bg-[#1B1812] text-[12px] text-[#F3C56B] transition hover:border-[#514824] hover:bg-[#201C14]"
                    aria-label={`View achievement earned ${formatAchievementDate(achievement.completedDate)}`}
                  >
                    🏆
                  </button>
                ))}
                {isAchievementOpen('details') && selectedAchievement ? (
                  <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 w-[240px] rounded-2xl border border-[#2F2F2F] bg-[#171717] p-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8E8E8E]">Goal completed</p>
                    <p className="mt-2 text-sm font-semibold text-white">{getAchievementDetailLabel(selectedAchievement)}</p>
                    <div className="mt-3 space-y-1.5 text-[12px] text-[#BEBEBE]">
                      <p>Started: <span className="text-white">{formatAchievementDate(selectedAchievement.startedDate)}</span></p>
                      <p>Completed: <span className="text-white">{formatAchievementDate(selectedAchievement.completedDate)}</span></p>
                      <p>Duration: <span className="text-white">{getAchievementDurationLabel(selectedAchievement)}</span></p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <HeatmapActionButton label="Log" compact onClick={() => onSelectDate(new Date().toISOString().slice(0, 10))} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {visibleAchievements.length ? (
              <div ref={achievementShelfRef} className="relative flex items-center gap-1">
                {visibleAchievements.map((achievement) => (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => openAchievementDetails(achievement)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#3B3420] bg-[#1B1812] text-[13px] text-[#F3C56B] transition hover:border-[#514824] hover:bg-[#201C14]"
                    aria-label={`View achievement earned ${formatAchievementDate(achievement.completedDate)}`}
                  >
                    🏆
                  </button>
                ))}
                {isAchievementOpen('details') && selectedAchievement ? (
                  <div className="absolute bottom-[calc(100%+10px)] right-0 z-30 w-[250px] rounded-2xl border border-[#2F2F2F] bg-[#171717] p-3.5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#8E8E8E]">Goal completed</p>
                    <p className="mt-2 text-sm font-semibold text-white">{getAchievementDetailLabel(selectedAchievement)}</p>
                    <div className="mt-3 space-y-1.5 text-[12px] text-[#BEBEBE]">
                      <p>Started: <span className="text-white">{formatAchievementDate(selectedAchievement.startedDate)}</span></p>
                      <p>Completed: <span className="text-white">{formatAchievementDate(selectedAchievement.completedDate)}</span></p>
                      <p>Duration: <span className="text-white">{getAchievementDurationLabel(selectedAchievement)}</span></p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: trackerColor }} />
              {tracker.title}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
