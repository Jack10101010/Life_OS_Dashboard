import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getWeekLabel } from '../../lib/date'
import { DayEntry, Tag, WeekEntry } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TagPill } from '../ui/TagPill'

export function WeekDrawer({
  week,
  days,
  tags,
  open,
  onClose,
  onOpenDay,
}: {
  week: WeekEntry | null
  days: DayEntry[]
  tags: Tag[]
  open: boolean
  onClose: () => void
  onOpenDay: (day: DayEntry) => void
}) {
  if (!week) return null

  const chartData = days.map((day) => ({
    name: new Date(day.date).toLocaleDateString('en-IE', { weekday: 'short' }),
    am: day.isLogged ? day.morningMood : null,
    pm: day.isLogged ? day.eveningMood : null,
    habits: day.isLogged ? Math.round((day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100) : null,
  }))

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="lg"
      subtitle={`Week ${week.weekNumber} • ${getWeekLabel(week.startDate, week.endDate)}`}
      title={`${week.weeklyScore} weekly score`}
    >
      <div className="space-y-4">
        <Card className="bg-[#121212] p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Quick status</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Status label="Habit completion" value={`${week.habitCompletionPercent}%`} />
                <Status label="Mood average" value={week.loggedDaysCount > 0 ? week.moodAverage.toFixed(1) : '-'} />
                <Status label="Drank" value={week.drankThisWeek ? 'Yes' : 'No'} />
                <Status label="Big win" value={week.bigWin ? 'Yes' : 'No'} />
              </div>
            </div>
            <Button>Edit week</Button>
          </div>
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Daily breakdown</p>
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => onOpenDay(day)}
              className="grid w-full grid-cols-[0.9fr_0.7fr_0.7fr_1fr_0.7fr] gap-3 rounded-2xl border border-[#2A2A2A] bg-[#181818] px-3 py-3 text-left transition hover:bg-[#202020]"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {new Date(day.date).toLocaleDateString('en-IE', { weekday: 'long' })}
                </p>
                <p className="text-xs text-mist">{new Date(day.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })}</p>
              </div>
              <Status label="Score" value={`${day.score}`} compact />
              <Status label="Mood" value={`${day.morningMood}/${day.eveningMood}`} compact />
              <Status label="Habits" value={`${day.habitsCompleted}/${day.habitsTotal}`} compact />
              <Status label="Drank" value={day.drank ? 'Yes' : 'No'} compact />
            </button>
          ))}
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Weekly notes</p>
            <div className="space-y-3 text-sm text-mist">
            <p><span className="font-semibold text-white">Reflection:</span> {week.reflection || 'No weekly reflection yet.'}</p>
            <p><span className="font-semibold text-white">What went well:</span> {week.whatWentWell || 'No notes yet.'}</p>
            <p><span className="font-semibold text-white">What slipped:</span> {week.whatSlipped || 'No notes yet.'}</p>
            <p><span className="font-semibold text-white">Big win:</span> {week.bigWin || 'No big win logged.'}</p>
            </div>
          </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tags</p>
          <div className="flex flex-wrap gap-2">
            {week.tags.map((tagId) => {
              const tag = tags.find((item) => item.id === tagId)
              return tag ? <TagPill key={tag.id} tag={tag} active /> : null
            })}
          </div>
        </Card>

        <Card className="space-y-4 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Mini charts</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="#243247" vertical={false} />
                <XAxis dataKey="name" stroke="#93A4BD" fontSize={12} />
                <YAxis stroke="#93A4BD" fontSize={12} domain={[0, 5]} />
                <Tooltip />
                <Area type="monotone" dataKey="am" stroke="#89B5E3" fill="#89B5E322" />
                <Area type="monotone" dataKey="pm" stroke="#D7A6B3" fill="#D7A6B322" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid stroke="#243247" vertical={false} />
                <XAxis dataKey="name" stroke="#93A4BD" fontSize={12} />
                <YAxis stroke="#93A4BD" fontSize={12} domain={[0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="habits" stroke="#9BE3C6" fill="#9BE3C622" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </DetailDrawer>
  )
}

function Status({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-white/[0.03] ${compact ? 'px-3 py-2' : 'px-3 py-3'}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/70">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
