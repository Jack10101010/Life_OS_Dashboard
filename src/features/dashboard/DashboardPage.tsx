import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { StatPill } from '../../components/ui/StatPill'
import { TagPill } from '../../components/ui/TagPill'
import { WeekHeatmap } from '../../components/tracker/WeekHeatmap'
import { DashboardBlockLayoutItem, DayEntry, Tag, WeekEntry } from '../../types'

export function DashboardPage({
  weeks,
  days,
  tags,
  alcoholFreeStreak,
  momentumScore,
  onExportState,
  onOpenWeek,
  onGoToTrackerWeek,
  onOpenToday,
  onOpenTracker,
  onOpenDay,
}: {
  weeks: WeekEntry[]
  days: DayEntry[]
  tags: Tag[]
  alcoholFreeStreak: number
  momentumScore: number
  layout?: DashboardBlockLayoutItem[]
  onLayoutChange?: React.Dispatch<React.SetStateAction<DashboardBlockLayoutItem[]>>
  onExportState: () => void
  onOpenWeek: (week: WeekEntry) => void
  onGoToTrackerWeek: (week: WeekEntry) => void
  onOpenToday: () => void
  onOpenTracker: () => void
  onOpenDay: (day: DayEntry) => void
}) {
  const currentWeek = weeks[weeks.length - 1]
  const recentDays = days.slice(-14)
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayEntry = days.find((day) => day.date === todayDate) ?? days[days.length - 1]
  const moodTrend = recentDays.map((day) => ({
    name: new Date(day.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }),
    am: day.isLogged ? day.morningMood : null,
    pm: day.isLogged ? day.eveningMood : null,
  }))

  const loggedDays = days.filter((day) => day.isLogged)
  const topHabits = [
    {
      label: 'Training',
      value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('training')).length / loggedDays.length) * 100)}%`,
    },
    {
      label: 'Walk',
      value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('walk')).length / loggedDays.length) * 100)}%`,
    },
    {
      label: 'Journal',
      value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('journal')).length / loggedDays.length) * 100)}%`,
    },
    {
      label: 'Sleep',
      value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.tags.includes('tag-clear')).length / loggedDays.length) * 100)}%`,
    },
  ]

  const journalHighlights = days
    .filter((day) => day.isLogged && (day.notes || day.moodNote))
    .slice()
    .reverse()
    .slice(0, 3)
  const recentWins = weeks.slice(-3).filter((week) => week.bigWin)

  const todayStatus = [
    todayEntry?.isLogged ? 'Logged' : 'Not logged yet',
    `Habits ${todayEntry?.habitsCompleted ?? 0}/${todayEntry?.habitsTotal ?? 0}`,
    todayEntry?.drank ? 'Alcohol logged' : 'No alcohol logged',
  ]

  return (
    <div className="space-y-5">
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr]">
          <div className="flex min-h-0 flex-col">
            <p className="text-xs uppercase tracking-[0.24em] text-mist/70">This week</p>
            <h3 className="mt-3 text-3xl font-semibold text-white">Week {currentWeek.weekNumber}</h3>
            <p className="mt-2 max-w-2xl text-sm text-mist">
              {currentWeek.loggedDaysCount > 0
                ? currentWeek.reflection || 'A quick weekly orientation block for momentum, habits, and where to focus next.'
                : 'No entries logged for this week yet. Use today as the easiest way to get back into the daily flow.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <StatPill label="Momentum" value={`${momentumScore}`} />
              <StatPill label="Habit completion" value={`${currentWeek.habitCompletionPercent}%`} />
              <StatPill label="Alcohol" value={currentWeek.drankThisWeek ? 'Drank' : 'Clear'} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="primary" onClick={onOpenToday}>
                Open Today
              </Button>
              <Button onClick={onOpenTracker}>Open Tracker</Button>
              <Button onClick={() => onOpenWeek(currentWeek)}>Review week</Button>
              <Button onClick={onExportState}>Backup state</Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Year in weeks</p>
                <p className="mt-2 text-sm text-mist">Jump straight into the core tracker from a weekly overview.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <WeekHeatmap weeks={weeks} mode="overall" onSelectWeek={onGoToTrackerWeek} compact />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Today focus</p>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-white">
                {new Date(`${todayEntry.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </h3>
              <p className="mt-2 text-sm text-mist">
                {todayEntry.isLogged ? 'Today already has an entry. Reopen it instantly and continue from where you left off.' : 'Today is still open. Start with the same focused day modal used from the heatmap.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2 text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Status</p>
              <p className="mt-2 text-sm font-semibold text-white">{todayEntry.isLogged ? 'Active' : 'Waiting'}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {todayStatus.map((item) => (
              <span key={item} className="rounded-full border border-white/6 bg-white/[0.03] px-3 py-2 text-xs text-white">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="primary" onClick={onOpenToday}>
              Open Today
            </Button>
            <Button onClick={onOpenTracker}>Go to Tracker</Button>
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Mood / state</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Recent mood trend</h3>
          <p className="mt-2 text-sm text-mist">A compact overview of your recent AM and PM state, without replacing the daily entry flow.</p>
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={moodTrend}>
                <CartesianGrid stroke="#243247" vertical={false} />
                <XAxis dataKey="name" stroke="#93A4BD" fontSize={12} />
                <YAxis stroke="#93A4BD" fontSize={12} domain={[0, 5]} />
                <Tooltip />
                <Area type="monotone" dataKey="am" stroke="#89B5E3" fill="#89B5E322" />
                <Area type="monotone" dataKey="pm" stroke="#D7A6B3" fill="#D7A6B322" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Momentum</p>
          <p className="mt-3 text-5xl font-semibold text-white">{momentumScore}</p>
          <p className="mt-3 max-w-xl text-sm text-mist">
            Momentum reflects how consistently you have been showing up across recent weeks. Use it as orientation, then jump back into today’s actual entry.
          </p>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Habit consistency</p>
          <div className="mt-5 space-y-4">
            {topHabits.slice(0, 4).map((habit) => (
              <div key={habit.label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">{habit.label}</p>
                  <p className="text-sm text-mist">{habit.value}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-glow" style={{ width: habit.value }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Recent wins</p>
          <div className="mt-4 space-y-3">
            {recentWins.map((week) => (
              <div key={week.id} className="rounded-2xl border border-white/5 bg-panelSoft/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Week {week.weekNumber}</p>
                    <p className="mt-1 text-sm text-mist">{week.bigWin}</p>
                  </div>
                  <Button onClick={() => onOpenWeek(week)}>Open</Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {week.tags.map((tagId) => {
                    const tag = tags.find((item) => item.id === tagId)
                    return tag ? <TagPill key={tag.id} tag={tag} /> : null
                  })}
                </div>
              </div>
            ))}
            {recentWins.length === 0 ? <p className="text-sm text-mist">No wins logged yet.</p> : null}
          </div>
        </Card>

        <Card>
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Journal highlights</p>
          <div className="mt-4 space-y-3">
            {journalHighlights.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => onOpenDay(day)}
                className="w-full rounded-2xl border border-white/5 bg-panelSoft/50 p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <p className="text-sm font-semibold text-white">
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-mist">{day.notes || day.moodNote}</p>
              </button>
            ))}
            {journalHighlights.length === 0 ? <p className="text-sm text-mist">No journal highlights yet.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Alcohol status</p>
            <p className="mt-3 text-3xl font-semibold text-white">{alcoholFreeStreak} days alcohol-free</p>
            <p className="mt-2 text-sm text-mist">
              Last drank date:{' '}
              {days
                .slice()
                .reverse()
                .find((day) => day.isLogged && day.drank)?.date ?? 'No drink logged'}
            </p>
          </div>
          <div className="flex min-h-0 items-end justify-end">
            <div className="max-w-xl rounded-[28px] border border-white/5 bg-white/[0.03] p-4">
              <p className="text-sm text-mist">
                Keep this block as a focused weekly context card. Use it for signal, then return to the main tracker and day entry flow for actual logging.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
