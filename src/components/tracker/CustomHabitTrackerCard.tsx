import { motion } from 'framer-motion'
import { useState } from 'react'
import { HabitTracker, HabitTrackerCalendarRange, HabitTrackerPeriodView, HeatmapLayout } from '../../types'
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
import { GITHUB_DAY_LABELS, MONTH_LABELS, getContributionColumns, getContributionMonthSpans, getMonthMatrix } from './heatmapUtils'
import { useHeatmapHover } from './useHeatmapHover'

type TrackerCell = { date: string; completed: boolean; note: string }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isWeekendIso(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
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
  hovered,
  dimmed,
  disabled = false,
  onClick,
  hoverProps,
  className = '',
}: {
  cell: TrackerCell
  color: string
  colorIntensity: number
  active?: boolean
  hovered?: boolean
  dimmed?: boolean
  disabled?: boolean
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
        disabled={disabled}
        dimmed={dimmed}
        className="h-full w-full"
      />
    </motion.button>
  )
}

export function CustomHabitTrackerCard({
  tracker,
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
  onShiftPeriod,
  onCalendarRangeChange,
}: {
  tracker: HabitTracker
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
  onShiftPeriod: (nextFocusDate: string) => void
  onCalendarRangeChange: (next: HabitTrackerCalendarRange) => void
}) {
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const compactMode = periodView !== 'year'
  const yearCells = getTrackerCells(tracker, year)
  const monthCells = getMonthViewCells(tracker, focusDate)
  const weekCells = getWeekViewCells(tracker, focusDate)
  const completedYearCells = yearCells.filter((cell) => cell.completed)
  const streak = getConsecutiveDateStreak(new Set(completedYearCells.map((cell) => cell.date)), year)
  const totalTracked = completedYearCells.length
  const completionRate = Math.round((totalTracked / Math.max(yearCells.length, 1)) * 100)
  const periodLabel = getPeriodLabel(periodView, focusDate, year)
  const calendarStartMonth = getCalendarRangeStartMonth(tracker, year, calendarRange)
  const calendarStartDay = getCalendarRangeStartDay(tracker, year, calendarRange)

  const { containerRef, hovered, bindHover } = useHeatmapHover<TrackerCell>()
  const hoveredDate = hovered?.day.date
  const trackerColor = getTrackerColor(tracker.color, tracker.colorIntensity ?? 100)
  const hideWeekends = tracker.weekendVisibility === 'hide'
  const disableWeekends = tracker.weekendVisibility === 'disable'
  const weekdayLabels = hideWeekends ? WEEKDAY_LABELS.slice(0, 5) : WEEKDAY_LABELS

  const renderYearView = () => {
    if (layout === 'calendar') {
      const visibleRows = getMonthMatrix(yearCells, year).slice(calendarStartMonth).map((row, rowIndex) => {
        const realCells = row.cells.filter((cell): cell is TrackerCell => cell !== null)

        if (rowIndex !== 0 || calendarRange === 'full-year') {
          return {
            ...row,
            cells: realCells.map((cell) =>
              tracker.weekendVisibility === 'hide' && isWeekendIso(cell.date)
                ? ({ type: 'hidden' as const, key: cell.date })
                : ({ type: 'cell' as const, cell }),
            ),
          }
        }

        return {
          ...row,
          cells: realCells.map((cell, index) =>
            index < Math.max(calendarStartDay - 1, 0)
              ? ({ type: 'hidden' as const, key: `${row.label}-${index}` })
              : tracker.weekendVisibility === 'hide' && isWeekendIso(cell.date)
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
                  {index + 1}
                </div>
              ))}
            </div>
            <div className="space-y-[3px]">
              {visibleRows.map((row) => (
                <div key={row.label} className="flex items-center gap-[3px]">
                  <div className="flex h-[17px] w-[46px] items-center pr-2 text-[11px] uppercase tracking-[0.16em] text-[#8C8C8C]">
                    {row.label}
                  </div>
                  {row.cells.map((item) =>
                    item.type === 'cell' ? (
                      <TrackerCellButton
                      key={item.cell.date}
                      cell={item.cell}
                        color={tracker.color}
                      colorIntensity={tracker.colorIntensity ?? 100}
                      active={selectedDate === item.cell.date}
                        hovered={hoveredDate === item.cell.date}
                        disabled={isWeekendIso(item.cell.date) && tracker.weekendVisibility === 'disable'}
                        onClick={() => onSelectDate(item.cell.date)}
                        hoverProps={isWeekendIso(item.cell.date) && tracker.weekendVisibility !== 'show' ? {} : bindHover(item.cell)}
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
              className="truncate text-[10px] uppercase tracking-[0.16em] text-[#8C8C8C]"
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
                      color={tracker.color}
                      colorIntensity={tracker.colorIntensity ?? 100}
                      active={selectedDate === cell.date}
                      hovered={hoveredDate === cell.date}
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
    <HeatmapWeekRow labels={weekdayLabels} columns={tracker.weekendVisibility === 'hide' ? 5 : 7}>
        {monthCells
          .filter((cell) => !hideWeekends || !isWeekendIso(cell.date))
          .map((cell) => (
          <div key={cell.date} className="relative">
            <TrackerCellButton
              cell={cell}
              color={tracker.color}
              colorIntensity={tracker.colorIntensity ?? 100}
              active={selectedDate === cell.date}
              hovered={hoveredDate === cell.date}
              dimmed={!cell.inCurrentMonth}
              disabled={isWeekendIso(cell.date) && disableWeekends}
              onClick={() => onSelectDate(cell.date)}
              hoverProps={isWeekendIso(cell.date) && tracker.weekendVisibility !== 'show' ? {} : bindHover(cell)}
              className="aspect-square w-full overflow-hidden rounded-[18px]"
            />
            <p
              className={`pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium ${
                cell.inCurrentMonth ? 'text-[#D0D0D0]' : 'text-[#636363]'
              }`}
            >
              {cell.dayNumber}
            </p>
          </div>
        ))}
    </HeatmapWeekRow>
  )

  const renderWeekView = () => (
    <HeatmapWeekRow labels={weekdayLabels} columns={tracker.weekendVisibility === 'hide' ? 5 : 7}>
        {weekCells
          .filter((cell) => !hideWeekends || !isWeekendIso(cell.date))
          .map((cell) => (
          <div key={cell.date} className="relative">
            <TrackerCellButton
              cell={cell}
              color={tracker.color}
              colorIntensity={tracker.colorIntensity ?? 100}
              active={selectedDate === cell.date}
              hovered={hoveredDate === cell.date}
              disabled={isWeekendIso(cell.date) && disableWeekends}
              onClick={() => onSelectDate(cell.date)}
              hoverProps={isWeekendIso(cell.date) && tracker.weekendVisibility !== 'show' ? {} : bindHover(cell)}
              className="aspect-square w-full overflow-hidden rounded-[18px]"
            />
            <p className="pointer-events-none absolute inset-x-0 top-1/2 z-20 -translate-y-1/2 text-center text-[12px] font-medium text-[#D0D0D0]">
              {cell.dayNumber}
            </p>
          </div>
        ))}
    </HeatmapWeekRow>
  )

  return (
    <Card className={`${compactMode ? 'space-y-4 p-4' : 'space-y-5'} ${collapsed && compactMode ? 'pb-4' : ''}`}>
      <div className={`flex gap-3 ${compactMode ? 'items-start justify-between' : 'items-start justify-between'}`}>
        <div>
          <h3 className={`${compactMode ? 'text-[18px] leading-tight' : 'text-2xl'} font-semibold text-white`}>{tracker.title}</h3>
          {!compactMode && !collapsed ? (
            <p
              className="mt-2 max-w-2xl text-sm text-[#9B9B9B]"
              style={
                tracker.clampDescription
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
                  : undefined
              }
            >
              {tracker.description || 'No description yet.'}
            </p>
          ) : null}
        </div>
        <div className={`flex items-center ${compactMode ? 'gap-1' : 'gap-2'}`}>
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
              <HeatmapMenuButton label="View" onClick={() => setViewMenuOpen((value) => !value)} />
              {viewMenuOpen ? (
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
                        setViewMenuOpen(false)
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
            <span className={`inline-block transition-transform ${collapsed ? 'rotate-180' : ''}`}>⌃</span>
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
              status={tracker.entries[hovered.day.date]?.completed ? 'Completed' : 'No entry yet'}
              preview={tracker.entries[hovered.day.date]?.note || undefined}
              anchorRect={hovered.rect}
              containerRect={hovered.container}
            />
          ) : null}
        </div>
      ) : null}

      <div className={`flex items-end justify-between gap-4 ${compactMode ? 'text-[13px]' : 'text-sm'} text-[#A0A0A0]`}>
        <div className={`flex flex-wrap items-center ${compactMode ? 'gap-4' : 'gap-6'}`}>
          <p>
            Streak: <span className="font-semibold text-white">{streak}</span>
          </p>
          <p>
            Total done ({year}): <span className="font-semibold text-white">{totalTracked}</span>
          </p>
          <p>
            Completion rate ({year}): <span className="font-semibold text-white">{completionRate}%</span>
          </p>
        </div>
        {compactMode ? (
          <HeatmapActionButton label="Log" compact onClick={() => onSelectDate(new Date().toISOString().slice(0, 10))} />
        ) : (
          <p className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: trackerColor }} /> {tracker.title}
          </p>
        )}
      </div>
    </Card>
  )
}
