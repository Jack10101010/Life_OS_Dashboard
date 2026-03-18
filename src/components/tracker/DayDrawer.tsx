import { useEffect, useState } from 'react'
import { DayEntry, Habit, ManualCellColor, Tag, WeekEntry } from '../../types'
import { DayColorSelector } from './DayColorSelector'
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
  onDeleteDay,
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
  onDeleteDay: (dayId: string) => boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    setShowDeleteConfirm(false)
  }, [day?.id, open])

  if (!day) return null

  const activeHabits = habits.filter((habit) => habit.active)
  const completionPercent = Math.round((day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100)
  const canDelete = hasEntryData(day)

  return (
    <>
      <DetailDrawer
        open={open}
        onClose={onClose}
        size="md"
        subtitle="Daily cockpit"
        title={new Date(day.date).toLocaleDateString('en-IE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        headerActions={
          <>
            <button
              onClick={() => onNavigateDay('prev')}
              className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
            >
              Prev
            </button>
            <button
              onClick={() => onNavigateDay('next')}
              className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
            >
              Next
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
                aria-label="More options"
              >
                •••
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[180px] rounded-2xl border border-[#2B2B2B] bg-[#151515] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.38)]">
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => {
                      if (!canDelete) return
                      setMenuOpen(false)
                      setShowDeleteConfirm(true)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${
                      canDelete
                        ? 'text-[#F0F0F0] hover:bg-[#202020]'
                        : 'cursor-not-allowed text-[#6F6F6F]'
                    }`}
                  >
                    <span>Delete entry</span>
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      >
        <div className="space-y-3">
        <Card className="min-h-[112px] bg-[#121212] p-4" />

        <Card className="space-y-3 bg-[#121212] p-4">
          <SectionHeader title="Check-in" />
          <div className="space-y-3">
            <CheckInRow
              label="Mood"
              value={day.mood}
              onSelect={(value) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  mood: value,
                }))
              }
            />
            <CheckInRow
              label="Motivation"
              value={day.motivation}
              onSelect={(value) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  motivation: value,
                }))
              }
            />
            <CheckInRow
              label="Clarity"
              value={day.clarity}
              onSelect={(value) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  clarity: value,
                }))
              }
            />
            <CheckInRow
              label="Energy"
              value={day.energy}
              onSelect={(value) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  energy: value,
                }))
              }
            />
            <CheckInRow
              label="Sleep quality"
              value={day.sleepQuality}
              onSelect={(value) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  sleepQuality: value,
                }))
              }
            />
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="space-y-3 bg-[#121212] p-4">
            <SectionHeader title="State" />
            <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-2 rounded-[24px] border border-white/6 bg-[#171717] p-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/70">Day Color</p>
                <DayColorSelector
                  value={day.cellColor}
                  onChange={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      cellColor: value,
                    }))
                  }
                />
              </div>
              <div className="space-y-3 rounded-[24px] border border-white/6 bg-[#171717] p-3.5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/70">Mood</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MoodSelector
                    label="Morning"
                    value={day.morningMood}
                    onSelect={(value) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        morningMood: value,
                      }))
                    }
                  />
                  <MoodSelector
                    label="Evening"
                    value={day.eveningMood}
                    onSelect={(value) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        eveningMood: value,
                      }))
                    }
                  />
                </div>
                <textarea
                  value={day.moodNote}
                  onChange={(event) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      moodNote: event.target.value,
                    }))
                  }
                  placeholder="A quick note on how the day feels"
                  className="min-h-20 w-full rounded-2xl border border-white/5 bg-panelSoft/50 px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-mist/50"
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-3 bg-[#121212] p-4">
            <SectionHeader
              title="Execution"
              description="Keep today’s tasks and reminders close so the day is easy to run."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              <QuickListEditor
                title="Tasks"
                subtitle="Short, actionable items"
                items={day.tasks}
                placeholder="Add a task"
                onChange={(items) =>
                  onUpdateDay(day.id, (current) => ({
                    ...current,
                    isLogged: true,
                    tasks: items,
                  }))
                }
              />
              <QuickListEditor
                title="Reminders"
                subtitle="Things to remember today"
                items={day.reminders}
                placeholder="Add a reminder"
                onChange={(items) =>
                  onUpdateDay(day.id, (current) => ({
                    ...current,
                    isLogged: true,
                    reminders: items,
                  }))
                }
              />
            </div>
          </Card>
        </div>

        <Card className="space-y-3 bg-[#121212] p-4">
          <SectionHeader
            title="Habits"
            description="Tap through your active habits quickly and keep the streak visible."
          />
          <div className="grid gap-2">
            {activeHabits.map((habit) => {
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition ${
                    complete
                      ? 'border-glow/30 bg-glow/10 hover:bg-glow/14'
                      : 'border-[#2A2A2A] bg-[#181818] hover:border-white/10 hover:bg-[#1B1B1B]'
                  }`}
                >
                  <span className="text-sm text-white">{habit.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      complete ? 'bg-glow/18 text-glow' : 'bg-white/5 text-mist'
                    }`}
                  >
                    {complete ? 'Done' : 'Open'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-mist">
              <span>Habit completion</span>
              <span>{completionPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-glow transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="space-y-3 bg-[#121212] p-4">
            <SectionHeader
              title="Reflection"
              description="Capture the day without turning this into a heavy writing task."
            />
            <textarea
              value={day.journal}
              onChange={(event) =>
                onUpdateDay(day.id, (current) => ({
                  ...current,
                  isLogged: true,
                  journal: event.target.value,
                }))
              }
              placeholder="A few lines is enough. What happened, what mattered, what should carry into tomorrow?"
              className="min-h-36 w-full rounded-[24px] border border-white/6 bg-[#171717] px-4 py-3.5 text-sm leading-7 text-white outline-none placeholder:text-mist/45"
            />
          </Card>

          <div className="space-y-3">
            <Card className="space-y-3 bg-[#121212] p-4">
              <SectionHeader title="Signals" description="Secondary context that still matters to the day." />
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/70">Alcohol</p>
                  <button
                    onClick={() =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        drank: !current.drank,
                      }))
                    }
                    className={`mt-3 w-full rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                      day.drank
                        ? 'bg-rose/18 text-rose hover:bg-rose/24'
                        : 'bg-glow/18 text-glow hover:bg-glow/24'
                    }`}
                  >
                    {day.drank ? 'Drank today' : 'Alcohol-free today'}
                  </button>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-mist/70">Big win</p>
                  <input
                    value={day.bigWin}
                    onChange={(event) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        bigWin: event.target.value,
                      }))
                    }
                    placeholder="One thing that went well"
                    className="mt-3 w-full rounded-2xl border border-white/5 bg-panelSoft/50 px-3 py-2.5 text-sm text-white outline-none placeholder:text-mist/50"
                  />
                </div>
              </div>
            </Card>

            <Card className="space-y-3 bg-[#121212] p-4">
              <SectionHeader title="Tags" description="Light metadata for filtering and pattern review later." />
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button key={tag.id} onClick={() => onSelectTag(tag.id)}>
                    <TagPill tag={tag} active={day.tags.includes(tag.id)} />
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card className="flex items-center justify-between bg-[#121212] p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Containing week</p>
            <p className="mt-2 text-sm text-white">{week ? `Week ${week.weekNumber}` : 'Unknown week'}</p>
          </div>
          <Button onClick={() => onUpdateDay(day.id, (current) => ({ ...current, isLogged: true }))}>
            {day.isLogged ? 'Save progress' : 'Start day'}
          </Button>
        </Card>
        </div>
      </DetailDrawer>

      {showDeleteConfirm ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(420px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <h4 className="text-xl font-semibold text-white">Delete this entry?</h4>
            <p className="mt-2 text-sm leading-6 text-mist">
              This will permanently remove this day&apos;s data.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const deleted = onDeleteDay(day.id)
                  setShowDeleteConfirm(false)
                  if (!deleted) return
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

function hasEntryData(day: DayEntry) {
  return (
    day.isLogged ||
    day.cellColor !== 'blank' ||
    day.mood !== null ||
    day.motivation !== null ||
    day.clarity !== null ||
    day.energy !== null ||
    day.sleepQuality !== null ||
    day.moodNote.trim().length > 0 ||
    day.completedHabitIds.length > 0 ||
    day.habitsCompleted > 0 ||
    day.drank ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
    day.tasks.length > 0 ||
    day.reminders.length > 0 ||
    day.dailyActions.length > 0 ||
    day.tags.length > 0
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-[0.22em] text-mist/70">{title}</p>
      {description ? <p className="text-sm leading-6 text-mist">{description}</p> : null}
    </div>
  )
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-[#171717] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/65">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-white">{value}</p>
    </div>
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
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${
              value === option ? 'bg-sky text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.12)]' : 'bg-white/5 text-mist hover:bg-white/10'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function CheckInRow({ label, value, onSelect }: { label: string; value: number | null; onSelect: (value: number) => void }) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const percent = value ? `${(value / 10) * 100}%` : '0%'
  const hoverPercent = hoveredValue ? `${(hoveredValue / 10) * 100}%` : '0%'

  return (
    <div className="grid items-center gap-2 md:grid-cols-[140px_1fr_28px]">
      <p className="text-sm font-medium text-white">{label}</p>
      <button
        type="button"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
          const nextValue = Math.min(10, Math.max(1, Math.floor(ratio * 10) + 1))
          setHoveredValue(nextValue)
        }}
        onMouseLeave={() => setHoveredValue(null)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
          const snapped = Math.min(10, Math.max(1, Math.floor(ratio * 10) + 1))
          onSelect(snapped)
        }}
        aria-label={label}
        className="relative h-7 w-full"
      >
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
          {hoveredValue ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/[0.06] transition-all duration-150"
              style={{ width: hoverPercent }}
            />
          ) : null}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-glow transition-all duration-200 ease-out"
            style={{
              width: percent,
              opacity: value ? 0.72 + value * 0.028 : 0,
              boxShadow: value ? '0 0 14px rgba(79,220,148,0.16)' : 'none',
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 10) 100%',
              backgroundPosition: '0 0',
            }}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.06]" />
        </div>
      </button>
      <span className="text-right text-sm font-medium text-mist">{hoveredValue ?? value ?? '–'}</span>
    </div>
  )
}

function QuickListEditor({
  title,
  subtitle,
  items,
  placeholder,
  onChange,
}: {
  title: string
  subtitle: string
  items: string[]
  placeholder: string
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft('')
  }, [items])

  const submit = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...items, value])
    setDraft('')
  }

  return (
    <div className="space-y-3 rounded-[24px] border border-white/6 bg-[#171717] p-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/70">{title}</p>
        <p className="mt-1 text-sm text-mist">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-2"
            >
              <span className="text-sm text-white">{item}</span>
              <button
                onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                className="text-xs text-mist transition hover:text-white"
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/8 px-3 py-4 text-sm text-mist/70">
            Nothing planned yet.
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-2xl border border-white/10 bg-[#202020] px-3 py-3 text-sm text-white outline-none placeholder:text-mist/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        />
        <button
          onClick={submit}
          className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
        >
          Add
        </button>
      </div>
    </div>
  )
}


function formatCellColor(value: ManualCellColor) {
  switch (value) {
    case 'green':
      return 'Green'
    case 'orange':
      return 'Orange'
    case 'red':
      return 'Red'
    default:
      return 'Blank'
  }
}
