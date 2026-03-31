import { useMemo, useState } from 'react'
import { LifeGoalTask } from '../../../types'

type TimeframeOption = {
  value: number
  label: string
}

type EventPoint = {
  date: string
  dayIndex: number
  completedCount: number
  progressPercent: number
  countForDay: number
  tasksForDay: string[]
}

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { value: 7, label: '7d' },
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 60, label: '60d' },
  { value: 90, label: '3m' },
  { value: 180, label: '6m' },
  { value: 365, label: '1y' },
]

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function shiftIsoDate(date: string, deltaDays: number) {
  const shiftedDate = new Date(`${date}T00:00:00Z`)
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + deltaDays)
  return shiftedDate.toISOString().slice(0, 10)
}

function formatAxisDateLabel(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function isValidIsoDate(value: string | null | undefined) {
  return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
}

function getTickIndices(totalDays: number) {
  if (totalDays <= 7) return Array.from({ length: totalDays }, (_, index) => index)
  if (totalDays <= 14) return [0, 2, 5, 8, 11, totalDays - 1]
  if (totalDays <= 30) return [0, 7, 14, 21, totalDays - 1]
  if (totalDays <= 60) return [0, 14, 28, 42, totalDays - 1]
  if (totalDays <= 92) return [0, 30, 60, totalDays - 1]
  if (totalDays <= 184) return [0, 30, 60, 91, 121, 152, totalDays - 1]
  return [0, 59, 120, 181, 243, 304, totalDays - 1]
}

function buildEventPoints(tasks: LifeGoalTask[], startDate: string, totalDays: number) {
  const endDate = shiftIsoDate(startDate, totalDays - 1)
  const completedTasks = [...tasks]
    .filter((task) => task.completed && task.completedAt)
    .sort((left, right) => (left.completedAt ?? '').localeCompare(right.completedAt ?? ''))

  let completedCount = 0
  const dailySeen = new Map<string, number>()
  const grouped = new Map<string, EventPoint>()

  completedTasks.forEach((task) => {
    const date = task.completedAt!.slice(0, 10)
    completedCount += 1
    if (date < startDate || date > endDate) {
      return
    }

    const countForDay = (dailySeen.get(date) ?? 0) + 1
    dailySeen.set(date, countForDay)
    const dayIndex = Math.max(0, Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000))
    const existing = grouped.get(date)

    if (existing) {
      existing.completedCount = completedCount
      existing.progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0
      existing.countForDay = countForDay
      existing.tasksForDay.push(task.text)
      return
    }

    grouped.set(date, {
      date,
      dayIndex,
      completedCount,
      progressPercent: tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0,
      countForDay,
      tasksForDay: [task.text],
    })
  })

  return Array.from(grouped.values()).sort((left, right) => left.date.localeCompare(right.date))
}

function buildRoundedStepPath(
  eventPoints: EventPoint[],
  xForDayIndex: (dayIndex: number) => number,
  yForPercent: (percent: number) => number,
  startX: number,
  endX: number,
) {
  const startY = yForPercent(0)
  const pathSegments = [`M ${startX.toFixed(2)} ${startY.toFixed(2)}`]
  let currentX = startX
  let currentY = startY

  eventPoints.forEach((point) => {
    const targetX = xForDayIndex(point.dayIndex)
    const targetY = yForPercent(point.progressPercent)
    const dx = targetX - currentX
    const dy = targetY - currentY

    if (dx <= 0 || Math.abs(dy) < 0.01) {
      pathSegments.push(`L ${targetX.toFixed(2)} ${targetY.toFixed(2)}`)
      currentX = targetX
      currentY = targetY
      return
    }

    const cornerRadius = Math.min(1.1, dx / 2, Math.abs(dy) / 2)

    if (cornerRadius <= 0.01) {
      pathSegments.push(`L ${targetX.toFixed(2)} ${currentY.toFixed(2)}`)
      pathSegments.push(`L ${targetX.toFixed(2)} ${targetY.toFixed(2)}`)
      currentX = targetX
      currentY = targetY
      return
    }

    const directionY = dy > 0 ? 1 : -1

    pathSegments.push(`L ${(targetX - cornerRadius).toFixed(2)} ${currentY.toFixed(2)}`)
    pathSegments.push(
      `Q ${targetX.toFixed(2)} ${currentY.toFixed(2)} ${targetX.toFixed(2)} ${(currentY + directionY * cornerRadius).toFixed(2)}`,
    )
    pathSegments.push(`L ${targetX.toFixed(2)} ${(targetY - directionY * cornerRadius).toFixed(2)}`)
    pathSegments.push(
      `Q ${targetX.toFixed(2)} ${targetY.toFixed(2)} ${(targetX + cornerRadius).toFixed(2)} ${targetY.toFixed(2)}`,
    )

    currentX = targetX + cornerRadius
    currentY = targetY
  })

  pathSegments.push(`L ${endX.toFixed(2)} ${currentY.toFixed(2)}`)
  return pathSegments.join(' ')
}

export function GoalProgressTimelineChart({
  tasks,
  goalStartDate,
  goalCreatedAt,
}: {
  tasks: LifeGoalTask[]
  goalStartDate: string
  goalCreatedAt: string
}) {
  const [timeframeDays, setTimeframeDays] = useState(30)
  const [hoveredPointDate, setHoveredPointDate] = useState<string | null>(null)
  const todayIsoDate = getTodayIsoDate()
  const timeframeStartDate = shiftIsoDate(todayIsoDate, -(timeframeDays - 1))
  const goalAnchorDate = isValidIsoDate(goalStartDate)
    ? goalStartDate
    : goalCreatedAt.slice(0, 10)
  const startDate = goalAnchorDate > timeframeStartDate ? goalAnchorDate : timeframeStartDate
  const effectiveTimeframeDays =
    Math.max(
      1,
      Math.round((new Date(`${todayIsoDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86400000) + 1,
    )

  const svgWidth = 100
  const totalTasks = Math.max(tasks.length, 1)
  const axisTextFill = 'rgb(var(--theme-text-muted-rgb) / 0.62)'
  const axisFontSize = 1
  const dynamicHeight = Math.min(60, Math.max(39, 17 + totalTasks * 0.7))
  const svgHeight = dynamicHeight
  const margin = { top: 8, right: 6, bottom: 12, left: 9 }
  const plotWidth = svgWidth - margin.left - margin.right
  const plotHeight = svgHeight - margin.top - margin.bottom

  const xForDayIndex = (dayIndex: number) => margin.left + (dayIndex / Math.max(1, effectiveTimeframeDays - 1)) * plotWidth
  const yForPercent = (percent: number) => margin.top + plotHeight - (Math.max(0, Math.min(100, percent)) / 100) * plotHeight

  const eventPoints = useMemo(() => buildEventPoints(tasks, startDate, effectiveTimeframeDays), [tasks, startDate, effectiveTimeframeDays])
  const tickIndices = getTickIndices(effectiveTimeframeDays)
  const hoveredPoint = hoveredPointDate ? eventPoints.find((point) => point.date === hoveredPointDate) ?? null : null

  const linePath = buildRoundedStepPath(
    eventPoints,
    xForDayIndex,
    yForPercent,
    xForDayIndex(0),
    margin.left + plotWidth,
  )
  const tooltipLeft = hoveredPoint ? `${(xForDayIndex(hoveredPoint.dayIndex) / svgWidth) * 100}%` : '0%'
  const tooltipTop = hoveredPoint ? `${(yForPercent(hoveredPoint.progressPercent) / svgHeight) * 100}%` : '0%'

  return (
    <section className="rounded-[28px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/62">Goal progress</p>
          <p className="mt-1 text-sm text-mist">Task completions over time.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimeframeDays(option.value)}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] tracking-[0.08em] transition ${
                timeframeDays === option.value
                  ? 'border-[rgb(var(--theme-accent-rgb)/0.14)] bg-[rgb(var(--theme-accent-rgb)/0.05)] text-[rgb(var(--theme-accent-rgb)/0.74)]'
                  : 'border-white/[0.04] bg-transparent text-mist/42 hover:border-white/[0.06] hover:text-mist/56'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3" style={{ minHeight: `${Math.max(110, dynamicHeight * 3)}px` }}>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
          {Array.from({ length: 11 }, (_, index) => index * 10)
            .filter((value) => value % 20 === 0)
            .map((value) => {
              const y = yForPercent(value)
              return (
                <g key={`y-grid-${value}`}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + plotWidth}
                    y2={y}
                    stroke="rgb(var(--theme-border-subtle-rgb) / 0.084)"
                    strokeWidth="0.19"
                  />
                  <text
                    x={margin.left - 1.8}
                    y={Math.max(margin.top + 1, Math.min(svgHeight - margin.bottom, y + 0.8))}
                    textAnchor="end"
                    fill={axisTextFill}
                    fontSize={axisFontSize}
                  >
                    {value}%
                  </text>
                </g>
              )
            })}

          {tickIndices.map((index) => {
            const x = xForDayIndex(index)
            return (
              <line
                key={`x-guide-${index}`}
                x1={x}
                y1={margin.top}
                x2={x}
                y2={margin.top + plotHeight}
                stroke="rgb(var(--theme-border-subtle-rgb) / 0.056)"
                strokeWidth="0.28"
              />
            )
          })}

          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + plotHeight}
            stroke="rgb(var(--theme-border-subtle-rgb) / 0.2)"
            strokeWidth="0.6"
          />
          <line
            x1={margin.left}
            y1={margin.top + plotHeight}
            x2={margin.left + plotWidth}
            y2={margin.top + plotHeight}
            stroke="rgb(var(--theme-border-subtle-rgb) / 0.2)"
            strokeWidth="0.6"
          />

          <path
            d={linePath}
            fill="none"
            stroke="rgb(var(--theme-accent-rgb) / 0.8)"
            strokeWidth="0.34"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {eventPoints.map((point, index) => {
            const x = xForDayIndex(point.dayIndex)
            const y = yForPercent(point.progressPercent)
            const isFinal = index === eventPoints.length - 1
            return (
              <g key={`event-${point.date}-${point.completedCount}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={isFinal ? 0.575 : 0.41}
                  fill="rgb(var(--theme-accent-rgb) / 0.92)"
                  stroke="rgb(var(--theme-surface-rgb) / 0.96)"
                  strokeWidth="0.12"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isFinal ? 1.7 : 1.45}
                  fill="transparent"
                  onMouseEnter={() => setHoveredPointDate(point.date)}
                  onMouseLeave={() => setHoveredPointDate((current) => (current === point.date ? null : current))}
                />
                {point.countForDay > 1 ? (
                  <text
                    x={x + 0.75}
                    y={y - 0.45}
                    textAnchor="start"
                    fill={axisTextFill}
                    fontSize={axisFontSize}
                  >
                    +{point.countForDay - 1}
                  </text>
                ) : null}
              </g>
            )
          })}

          <circle
            cx={margin.left + plotWidth}
            cy={margin.top}
            r="0.95"
            fill="rgb(var(--theme-accent-rgb) / 0.22)"
            stroke="rgb(var(--theme-accent-rgb) / 0.34)"
            strokeWidth="0.24"
          />

          {tickIndices.map((index, labelIndex) => {
            const x = xForDayIndex(index)
            const isFirst = labelIndex === 0
            const isLast = labelIndex === tickIndices.length - 1
            return (
              <g key={`x-label-${index}`}>
                <line
                  x1={x}
                  y1={margin.top + plotHeight}
                  x2={x}
                  y2={margin.top + plotHeight + 1.1}
                  stroke="rgb(var(--theme-border-subtle-rgb) / 0.18)"
                  strokeWidth="0.4"
                />
                <text
                  x={x}
                  y={margin.top + plotHeight + 3.5}
                  textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                  fill={axisTextFill}
                  fontSize={axisFontSize}
                >
                  {isLast ? 'Today' : formatAxisDateLabel(shiftIsoDate(startDate, index))}
                </text>
              </g>
            )
          })}
        </svg>

        {hoveredPoint ? (
          <div
            className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-2xl border border-white/[0.08] bg-[rgb(var(--theme-surface-rgb)/0.94)] px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            style={{
              left: tooltipLeft,
              top: tooltipTop,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-mist/48">{formatAxisDateLabel(hoveredPoint.date)}</p>
            <p className="mt-1 text-[11px] text-mist/58">
              {hoveredPoint.countForDay} completed {hoveredPoint.countForDay === 1 ? 'task' : 'tasks'}
            </p>
            <div className="mt-2 space-y-1.5">
              {hoveredPoint.tasksForDay.map((taskText, taskIndex) => (
                <div key={`${hoveredPoint.date}-task-${taskIndex}`} className="flex items-start gap-2 text-[12px] text-mist/86">
                  <span className="mt-[5px] h-1 w-1 flex-none rounded-full bg-[rgb(var(--theme-accent-rgb)/0.85)]" />
                  <span className="leading-[1.35]">{taskText}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
