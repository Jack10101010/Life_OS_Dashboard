import { getManualCellColor } from '../../lib/color'
import { DayEntry, Habit, ManualCellColor, Tag, WeekEntry } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TagPill } from '../ui/TagPill'

export function DayDrawer({
  day,
  week,
  habits,
  tags,
  open,
  onClose,
  onSelectTag,
  onNavigateDay,
  onUpdateDay,
}: {
  day: DayEntry | null
  week: WeekEntry | null
  habits: Habit[]
  tags: Tag[]
  open: boolean
  onClose: () => void
  onSelectTag: (tagId: string) => void
  onNavigateDay: (direction: 'prev' | 'next') => void
  onUpdateDay: (dayId: string, updater: (day: DayEntry) => DayEntry) => void
}) {
  if (!day) return null

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="md"
      subtitle="Day detail"
      title={new Date(day.date).toLocaleDateString('en-IE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}
    >
      <div className="space-y-4">
        <Card className="flex items-start justify-between bg-[#121212] p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Day score</p>
            <p className="mt-2 text-3xl font-semibold text-white">{day.score}</p>
            <p className="mt-2 text-sm text-mist">{day.isLogged ? 'Entry saved locally' : 'No entry yet. Start logging below.'}</p>
          </div>
          <Button onClick={() => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true }))}>
            {day.isLogged ? 'Update day' : 'Start entry'}
          </Button>
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Cell color</p>
          <div className="grid grid-cols-4 gap-2">
            {([
              ['blank', 'Blank'],
              ['green', 'Green'],
              ['orange', 'Orange'],
              ['red', 'Red'],
            ] as Array<[ManualCellColor, string]>).map(([value, label]) => {
              const active = day.cellColor === value
              return (
                <button
                  key={value}
                  onClick={() => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, cellColor: value }))}
                  className={`rounded-2xl border px-3 py-3 text-sm transition ${
                    active ? 'border-white bg-white/[0.08] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)]' : 'border-white/5 bg-panelSoft/50 text-mist'
                  }`}
                >
                  <span
                    className="mx-auto mb-2 block h-3.5 w-3.5 rounded-full border border-white/10 shadow-[0_0_14px_rgba(255,255,255,0.08)]"
                    style={{ backgroundColor: getManualCellColor(value) }}
                  />
                  {label}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Mood</p>
          <div className="grid grid-cols-2 gap-3">
            <MoodSelector
              label="Morning"
              value={day.morningMood}
              onSelect={(value) => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, morningMood: value }))}
            />
            <MoodSelector
              label="Evening"
              value={day.eveningMood}
              onSelect={(value) => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, eveningMood: value }))}
            />
          </div>
          <textarea
            value={day.moodNote}
            onChange={(event) =>
              onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, moodNote: event.target.value }))
            }
            placeholder="Optional mood note"
            className="min-h-20 w-full rounded-2xl border border-white/5 bg-panelSoft/50 px-3 py-3 text-sm text-white outline-none placeholder:text-mist/50"
          />
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Habits</p>
          <div className="space-y-2">
            {habits.filter((habit) => habit.active).map((habit) => {
              const complete = day.completedHabitIds.includes(habit.id)
              return (
                <button
                  key={habit.id}
                  onClick={() =>
                    onUpdateDay(day.id, (current) => {
                      const completedHabitIds = current.completedHabitIds.includes(habit.id)
                        ? current.completedHabitIds.filter((item) => item !== habit.id)
                        : [...current.completedHabitIds, habit.id]
                      return {
                        ...current,
                        isLogged: true,
                        completedHabitIds,
                        habitsCompleted: completedHabitIds.length,
                      }
                    })
                  }
                  className="flex w-full items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#181818] px-3 py-2 text-left"
                >
                  <span className="text-sm text-white">{habit.name}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${complete ? 'bg-glow/20 text-glow' : 'bg-white/5 text-mist'}`}>
                    {complete ? 'done' : 'open'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="h-2 rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-glow"
              style={{ width: `${(day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100}%` }}
            />
          </div>
        </Card>

        <Card className="grid gap-4 bg-[#121212] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Alcohol</p>
            <button
              onClick={() => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, drank: !current.drank }))}
              className={`mt-3 rounded-2xl px-4 py-2 text-sm font-semibold ${day.drank ? 'bg-rose/20 text-rose' : 'bg-glow/20 text-glow'}`}
            >
              {day.drank ? 'Drank' : 'Didn’t drink'}
            </button>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Big win</p>
            <input
              value={day.bigWin}
              onChange={(event) =>
                onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, bigWin: event.target.value }))
              }
              placeholder="Short big win"
              className="mt-3 w-full rounded-2xl border border-white/5 bg-panelSoft/50 px-3 py-2 text-sm text-white outline-none placeholder:text-mist/50"
            />
          </div>
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Journal</p>
          <textarea
            value={day.notes}
            onChange={(event) =>
              onUpdateDay(day.id, (current) => ({ ...current, isLogged: true, notes: event.target.value }))
            }
            placeholder="Free text note"
            className="min-h-28 w-full rounded-2xl border border-white/5 bg-panelSoft/50 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-mist/50"
          />
        </Card>

        <Card className="space-y-3 bg-[#121212] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tags</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button key={tag.id} onClick={() => onSelectTag(tag.id)}>
                <TagPill tag={tag} active={day.tags.includes(tag.id)} />
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex items-center justify-between bg-[#121212] p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Containing week</p>
            <p className="mt-2 text-sm text-white">{week ? `Week ${week.weekNumber}` : 'Unknown week'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onNavigateDay('prev')}>Previous</Button>
            <Button onClick={() => onNavigateDay('next')}>Next</Button>
          </div>
        </Card>
      </div>
    </DetailDrawer>
  )
}

function MoodSelector({ label, value, onSelect }: { label: string; value: number; onSelect: (value: number) => void }) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/70">{label}</p>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((option) => (
          <button
            key={option}
            onClick={() => onSelect(option)}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
              value === option ? 'bg-sky text-ink' : 'bg-white/5 text-mist'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}
