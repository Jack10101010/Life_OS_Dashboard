import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getWeekLabel } from '../../lib/date'
import { DayEntry, Tag, WeekEntry } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Card } from '../ui/Card'
import { TagPill } from '../ui/TagPill'

function getWeeklyReviewSummary(week: WeekEntry, days: DayEntry[]) {
  const loggedDays = days.filter((day) => day.isLogged).length
  const strongHabits = week.habitCompletionPercent >= 70
  const stableMood = week.loggedDaysCount > 0 && week.moodAverage >= 3

  if (strongHabits && stableMood) {
    return `A steadier week overall, with ${loggedDays} logged days and habits holding up better than usual.`
  }

  if (week.habitCompletionPercent >= 55) {
    return `There was enough structure this week to build from, even if the signal still felt mixed.`
  }

  if (loggedDays >= 4) {
    return `The week stayed visible, but execution softened. This is a good point to tighten the next few days.`
  }

  return `The week needs a cleaner reset. Keep the next one smaller, simpler, and easier to sustain.`
}

function getWeeklyTakeaway(week: WeekEntry, days: DayEntry[]) {
  const completedDays = days.filter((day) => day.isLogged && day.habitsCompleted > 0).length

  if (week.habitCompletionPercent >= 70 && !week.drankThisWeek) {
    return 'You kept the week relatively clean and supported it with real follow-through. Protect that baseline next week.'
  }

  if (completedDays >= 4) {
    return 'You were still in the week, even when it felt uneven. The main opportunity now is to convert visibility into cleaner execution.'
  }

  return 'The week drifted more than it moved. The best adjustment is not more ambition, but fewer moving parts and one cleaner daily standard.'
}

function getNextWeekAdjustments(week: WeekEntry, days: DayEntry[]) {
  const suggestions: string[] = []

  if (week.habitCompletionPercent < 60) {
    suggestions.push('Reduce friction around one core habit and make that the first daily win.')
  } else {
    suggestions.push('Protect the habits that are already working before adding anything new.')
  }

  if (week.drankThisWeek) {
    suggestions.push('Plan one cleaner evening boundary now so the week does not slip in the same place.')
  } else {
    suggestions.push('Keep the same clean-day standard and make it easier to repeat.')
  }

  const loggedDays = days.filter((day) => day.isLogged).length
  if (loggedDays < 5) {
    suggestions.push('Log the week more consistently so you can read the pattern earlier, not after it slips.')
  } else {
    suggestions.push('Use the first signs of drift as a cue to simplify, not to disappear from the week.')
  }

  return suggestions.slice(0, 3)
}

function getWeeklyBarColor(score: number) {
  if (score >= 70) return 'rgb(var(--theme-accent-rgb))'
  if (score > 30) return 'rgb(var(--theme-warning-rgb))'
  return 'rgb(var(--theme-negative-rgb))'
}

function getWeeklyBarValue(day: DayEntry) {
  if (!day.isLogged) return null
  return Math.max(0, Math.min(100, Math.round((day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100)))
}

export function WeekDrawer({
  week,
  days,
  tags,
  showBadHabitTracking,
  open,
  onClose,
  onOpenDay,
}: {
  week: WeekEntry | null
  days: DayEntry[]
  tags: Tag[]
  showBadHabitTracking: boolean
  open: boolean
  onClose: () => void
  onOpenDay: (day: DayEntry) => void
}) {
  if (!week) return null

  const chartData = [...days]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((day) => {
      const value = getWeeklyBarValue(day)
      return {
        name: new Date(day.date).toLocaleDateString('en-IE', { weekday: 'short' }),
        dayName: new Date(day.date).toLocaleDateString('en-IE', { weekday: 'long' }),
        value,
        score: day.score,
        habits: day.isLogged ? `${day.habitsCompleted}/${day.habitsTotal}` : '0/0',
        mood: day.isLogged ? `${day.morningMood}/${day.eveningMood}` : '-',
        fill: typeof value === 'number' ? getWeeklyBarColor(value) : '#2A2A2A',
        hasData: day.isLogged,
      }
    })
  const hasWeeklyPatternData = chartData.some((entry) => entry.hasData)

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="lg"
      subtitle={`Week ${week.weekNumber} • ${getWeekLabel(week.startDate, week.endDate)}`}
      title="Weekly Review"
      description={getWeeklyReviewSummary(week, days)}
      headerActions={
        <div className="theme-muted-pill rounded-full border px-3 py-1.5 text-sm">
          Score {week.weeklyScore}
        </div>
      }
    >
      <div className="space-y-5">
        <Card className="p-4">
          <div>
            <p className="theme-section-title">Week at a glance</p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Status label="Mood avg" value={week.loggedDaysCount > 0 ? week.moodAverage.toFixed(1) : '-'} />
              <Status label="Habit completion" value={`${week.habitCompletionPercent}%`} />
              {showBadHabitTracking ? <Status label="Alcohol" value={week.drankThisWeek ? 'Logged' : 'Clean'} /> : null}
              <Status label="Big win" value={week.bigWin ? 'Captured' : 'Not logged'} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div>
            <p className="theme-section-title">Weekly takeaway</p>
            <p className="theme-body-secondary mt-3 max-w-[760px]">{getWeeklyTakeaway(week, days)}</p>
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="theme-section-title">Daily breakdown</p>
              <p className="theme-body-secondary mt-1">A lighter read on how the week actually unfolded day by day.</p>
            </div>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {days.map((day) => (
              <button
                key={day.id}
                onClick={() => onOpenDay(day)}
                className="grid w-full gap-3 py-3 text-left transition hover:bg-white/[0.02]"
              >
                <div className={`grid items-center gap-3 ${showBadHabitTracking ? 'grid-cols-[1.15fr_0.7fr_0.8fr_0.9fr_0.7fr]' : 'grid-cols-[1.2fr_0.8fr_0.9fr_1fr]'}`}>
                  <div>
                    <p className="theme-body-primary">
                      {new Date(day.date).toLocaleDateString('en-IE', { weekday: 'long' })}
                    </p>
                    <p className="theme-metadata">{new Date(day.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <RowMetric label="Score" value={`${day.score}`} />
                  <RowMetric label="Mood" value={`${day.morningMood}/${day.eveningMood}`} />
                  <RowMetric label="Habits" value={`${day.habitsCompleted}/${day.habitsTotal}`} />
                  {showBadHabitTracking ? <RowMetric label="Alcohol" value={day.drank ? 'Logged' : 'Clean'} /> : null}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
            <p className="theme-section-title">Weekly notes</p>
            <div className="theme-body-secondary space-y-3">
            <p><span className="font-semibold theme-text-primary">Reflection:</span> {week.reflection || 'No weekly reflection yet.'}</p>
            <p><span className="font-semibold theme-text-primary">What went well:</span> {week.whatWentWell || 'No notes yet.'}</p>
            <p><span className="font-semibold theme-text-primary">What slipped:</span> {week.whatSlipped || 'No notes yet.'}</p>
            <p><span className="font-semibold theme-text-primary">Big win:</span> {week.bigWin || 'No big win logged.'}</p>
            </div>
          </Card>

        <Card className="space-y-3 p-4">
          <p className="theme-section-title">Next week</p>
          <div className="space-y-2.5">
            {getNextWeekAdjustments(week, days).map((item, index) => (
              <p key={index} className="theme-body-secondary">
                {index + 1}. {item}
              </p>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <p className="theme-section-title">Tags</p>
          <div className="flex flex-wrap gap-2">
            {week.tags.map((tagId) => {
              const tag = tags.find((item) => item.id === tagId)
              return tag ? <TagPill key={tag.id} tag={tag} active /> : null
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <div>
            <p className="theme-section-title">Weekly pattern</p>
            <p className="theme-body-secondary mt-1">This shows daily performance based on habit completion this week.</p>
          </div>
          {hasWeeklyPatternData ? (
            <div className="theme-chart-panel h-[220px] rounded-[22px] border px-2 pb-3 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap={14} margin={{ top: 10, right: 8, left: 0, bottom: 14 }}>
                  <XAxis
                    dataKey="name"
                    stroke="rgb(var(--theme-chart-axis-rgb))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--theme-surface-soft-rgb) / 0.42)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const point = payload[0]?.payload as
                        | { dayName: string; score: number; habits: string; mood: string; value: number | null; hasData: boolean }
                        | undefined
                      if (!point || !point.hasData) return null

                      return (
                        <div className="theme-chart-tooltip rounded-2xl px-3 py-2.5">
                          <p className="text-sm font-semibold theme-text-primary">{point.dayName}</p>
                          <div className="mt-2 space-y-1 text-xs theme-text-secondary">
                            <p>Score: <span className="theme-text-primary">{point.score}</span></p>
                            <p>Habits: <span className="theme-text-primary">{point.habits}</span></p>
                            <p>Mood: <span className="theme-text-primary">{point.mood}</span></p>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="theme-chart-panel rounded-2xl border px-4 py-4 text-sm theme-text-muted">
              No data available yet for this week
            </p>
          )}
        </Card>
      </div>
    </DetailDrawer>
  )
}

function Status({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`theme-surface-soft rounded-2xl border ${compact ? 'px-3 py-2' : 'px-3 py-3'}`}>
      <p className="theme-label">{label}</p>
      <p className="theme-body-primary mt-1">{value}</p>
    </div>
  )
}

function RowMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="theme-label theme-text-faint">{label}</p>
      <p className="theme-body-secondary mt-1 truncate">{value}</p>
    </div>
  )
}
