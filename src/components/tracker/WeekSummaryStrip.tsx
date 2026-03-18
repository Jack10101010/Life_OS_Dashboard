import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DAY_NAMES, formatShortDate } from '../../lib/date'
import { DayEntry, Tag, WeekEntry } from '../../types'
import { TagPill } from '../ui/TagPill'

export function WeekSummaryStrip({
  week,
  days,
  tags,
  canGoPrev,
  canGoNext,
  onPrevWeek,
  onNextWeek,
  onOpenWeek,
  trendData,
}: {
  week: WeekEntry
  days: DayEntry[]
  tags: Tag[]
  canGoPrev: boolean
  canGoNext: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
  onOpenWeek: () => void
  trendData: Array<{ label: string; mood: number; lowDays: number; drank: boolean; poorSleep: boolean }>
}) {
  const loggedDays = days.filter((day) => day.isLogged)
  const moodInsight = getMoodInsight(loggedDays, week.moodAverage)
  const behaviorInsight = getBehaviorInsight(week.habitCompletionPercent, loggedDays)
  const weeklyHighlight = getWeeklyHighlight(week, loggedDays, tags)

  return (
    <div className="space-y-4 rounded-3xl border border-white/5 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevWeek}
            disabled={!canGoPrev}
            className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            ← Prev
          </button>
          <p className="text-sm font-medium text-white">{formatWeekLabel(week)}</p>
          <button
            type="button"
            onClick={onNextWeek}
            disabled={!canGoNext}
            className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Weekly insight</p>
        <div className="mt-3 flex gap-1.5">
          {days.map((day, index) => (
            <div key={day.id} className="flex-1 rounded-2xl border border-white/5 bg-panelSoft/70 p-2">
              <p className="text-[11px] text-mist/70">{DAY_NAMES[index]}</p>
              <p className="mt-1 text-sm font-semibold text-white">{day.score}</p>
              <p className="text-[11px] text-mist">{formatShortDate(day.date)}</p>
            </div>
          ))}
        </div>
      </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Mood insight</p>
          <p className="mt-3 text-3xl font-semibold text-white">{week.moodAverage.toFixed(1)}</p>
          <p className="mt-2 text-sm text-mist">
            {moodInsight.good} good · {moodInsight.average} average · {moodInsight.low} low
          </p>
          <p className="mt-2 text-sm text-white">{moodInsight.summary}</p>
          {moodInsight.pattern ? <p className="mt-1 text-xs text-mist/75">{moodInsight.pattern}</p> : null}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Behavior insight</p>
          <p className="mt-3 text-3xl font-semibold text-white">{week.habitCompletionPercent}%</p>
          <div className="mt-3 h-2 rounded-full bg-white/5">
            <div className="h-full rounded-full bg-glow" style={{ width: `${week.habitCompletionPercent}%` }} />
          </div>
          <p className="mt-2 text-sm text-white">{behaviorInsight.summary}</p>
          {behaviorInsight.detail ? <p className="mt-1 text-xs text-mist/75">{behaviorInsight.detail}</p> : null}
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tags + big win</p>
          {weeklyHighlight.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {weeklyHighlight.tags.map((tagId) => {
                const tag = tags.find((item) => item.id === tagId)
                return tag ? <TagPill key={tag.id} tag={tag} /> : null
              })}
            </div>
          ) : null}
          <p className="mt-3 text-sm text-white">{weeklyHighlight.message}</p>
          <button
            type="button"
            onClick={onOpenWeek}
            className="mt-3 text-sm font-medium text-mist transition hover:text-white"
          >
            Open Week
          </button>
        </div>
      </div>

      <details className="group rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3" open>
        <summary className="cursor-pointer list-none text-sm font-medium text-white/90">
          Show trends
        </summary>
        <div className="mt-3 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8C8C8C', fontSize: 11 }}
              />
              <YAxis
                domain={[0, 10]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6F6F6F', fontSize: 10 }}
                width={26}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                contentStyle={{
                  background: '#171717',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  color: '#F5F5F5',
                }}
              />
              <Line
                type="monotone"
                dataKey="mood"
                stroke="#78A7FF"
                strokeWidth={2}
                dot={{ r: 3, fill: '#78A7FF', stroke: '#171717', strokeWidth: 2 }}
                activeDot={{ r: 4, fill: '#78A7FF', stroke: '#171717', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </details>
    </div>
  )
}

function getMoodInsight(days: DayEntry[], moodAverage: number) {
  const scoredDays = days.map((day) => getMoodSignal(day)).filter((value): value is number => value !== null)
  const good = scoredDays.filter((value) => value >= 7).length
  const average = scoredDays.filter((value) => value >= 4 && value < 7).length
  const low = scoredDays.filter((value) => value < 4).length

  let summary = 'Mixed week'
  if (scoredDays.length === 0) {
    summary = 'No mood data logged'
  } else if (moodAverage >= 7) {
    summary = 'Strong week'
  } else if (moodAverage < 4) {
    summary = 'Low week overall'
  } else if (good > 0 && low > 0) {
    summary = 'Mixed week'
  }

  const firstHalf = scoredDays.slice(0, Math.ceil(scoredDays.length / 2))
  const secondHalf = scoredDays.slice(Math.ceil(scoredDays.length / 2))
  const firstAverage = averageOf(firstHalf)
  const secondAverage = averageOf(secondHalf)

  let pattern = ''
  if (scoredDays.length >= 4) {
    if (secondAverage - firstAverage >= 0.6) pattern = 'Improved mid-week'
    else if (firstAverage - secondAverage >= 0.6) pattern = 'Stronger start than finish'
  }

  return { good, average, low, summary, pattern }
}

function getBehaviorInsight(habitCompletionPercent: number, days: DayEntry[]) {
  const completedDays = days.filter((day) => day.habitsCompleted > 0).length

  let summary = 'Building consistency'
  if (days.length === 0) {
    summary = 'Nothing logged yet'
  } else if (habitCompletionPercent >= 75) {
    summary = 'Strong consistency'
  } else if (habitCompletionPercent >= 45) {
    summary = 'Some consistency this week'
  } else {
    summary = 'No consistency this week'
  }

  const detail = days.length > 0 ? `${completedDays} of ${days.length} days had habit progress.` : ''

  return { summary, detail }
}

function getWeeklyHighlight(week: WeekEntry, days: DayEntry[], tags: Tag[]) {
  const bigWin = week.bigWin?.trim()
  if (bigWin) {
    return {
      tags: week.tags.slice(0, 3),
      message: bigWin,
    }
  }

  const visibleTags = week.tags
    .filter((tagId) => tags.some((tag) => tag.id === tagId))
    .slice(0, 3)

  if (visibleTags.length > 0) {
    return {
      tags: visibleTags,
      message: 'Tags captured the week, but no win was logged.',
    }
  }

  const anyJournal = days.some((day) => day.journal?.trim())
  return {
    tags: [],
    message: anyJournal ? 'No wins logged → Add one' : 'No wins logged → Add one',
  }
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

function formatWeekLabel(week: WeekEntry) {
  const start = new Date(`${week.startDate}T00:00:00Z`)
  const end = new Date(`${week.endDate}T00:00:00Z`)
  const startLabel = start.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const endLabel = end.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${startLabel}–${endLabel}`
}
