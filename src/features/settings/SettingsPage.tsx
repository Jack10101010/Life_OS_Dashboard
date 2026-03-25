import { useMemo, useState } from 'react'
import { BadHabitDefinition, Habit, SettingsState } from '../../types'
import { Button } from '../../components/ui/Button'
import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'

const BAD_HABIT_COLORS = ['#FF4D4F', '#D97706', '#C2414B', '#B35A65', '#A16207', '#7C3AED']

export function SettingsPage({
  settings,
  habits,
  badHabits,
  onUpdateSettings,
  onCreateBadHabit,
  onUpdateBadHabit,
  onArchiveBadHabit,
  onExportState,
  onImportState,
}: {
  settings: SettingsState
  habits: Habit[]
  badHabits: BadHabitDefinition[]
  onUpdateSettings: (next: SettingsState) => void
  onCreateBadHabit: (input: { name: string; color: string; isActive: boolean; showStreakInUI: boolean }) => BadHabitDefinition | null
  onUpdateBadHabit: (badHabitId: string, updater: (habit: BadHabitDefinition) => BadHabitDefinition) => void
  onArchiveBadHabit: (badHabitId: string) => void
  onExportState: () => void
  onImportState: (file: File) => void
}) {
  const [managingBadHabits, setManagingBadHabits] = useState(false)
  const [newBadHabitName, setNewBadHabitName] = useState('')
  const [newBadHabitColor, setNewBadHabitColor] = useState(BAD_HABIT_COLORS[0])
  const [newBadHabitActive, setNewBadHabitActive] = useState(true)
  const [newBadHabitShowStreak, setNewBadHabitShowStreak] = useState(false)
  const visibleBadHabits = useMemo(() => badHabits.filter((habit) => !habit.isArchived), [badHabits])

  return (
    <>
    <ResponsiveGrid columns="two">
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold text-white">General</h3>
        <div className="rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-mist">Theme</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['cyberpunk', 'dark'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, theme: option })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    settings.theme === option
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          {settings.theme === 'cyberpunk' ? (
            <p className="mt-3 text-xs text-[#9A9A9A]">High-contrast neon surfaces with a darker sci-fi backdrop.</p>
          ) : null}
        </div>
        <SettingRow label="Start day of week" value={settings.startDayOfWeek} />
        <SettingRow label="Default color mode" value={settings.defaultColorMode} />
        <div className="rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-mist">Enable bad habit tracking</p>
              <p className="mt-1 text-xs text-[#9A9A9A]">Show or hide bad-habit logging, markers, and related summaries across the app.</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, enableBadHabitTracking: !settings.enableBadHabitTracking })}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                settings.enableBadHabitTracking
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
              }`}
            >
              {settings.enableBadHabitTracking ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-mist">Track Medications & Supplements</p>
              <p className="mt-1 text-xs text-[#9A9A9A]">Show or hide the Medications & Supplements section in the daily log without deleting existing entries.</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, enableMedicationTracking: !settings.enableMedicationTracking })}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                settings.enableMedicationTracking
                  ? 'border-white/20 bg-white/10 text-white'
                  : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
              }`}
            >
              {settings.enableMedicationTracking ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-mist">Panel hue</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['blue', 'purple', 'green', 'amber', 'none'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, panelHue: option })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    settings.panelHue === option
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-mist">Hue brightness</p>
              <p className="text-sm font-semibold text-white">{settings.panelHueIntensity}%</p>
            </div>
            <input
              type="range"
              min={0}
              max={160}
              step={5}
              value={settings.panelHueIntensity}
              onChange={(event) => onUpdateSettings({ ...settings, panelHueIntensity: Number(event.target.value) })}
              className="w-full accent-white"
              disabled={settings.panelHue === 'none'}
            />
          </div>
        </div>
      </SectionCard>
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Mood labels</h3>
        {settings.moodLabels.map((label, index) => (
          <SettingRow key={label} label={`Level ${index + 1}`} value={label} />
        ))}
      </SectionCard>
      <SectionCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Habit management</h3>
          <Button>Add habit</Button>
        </div>
        {habits.map((habit) => (
          <div key={habit.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">{habit.name}</p>
              <p className="text-xs text-mist">{habit.targetFrequency}x per week</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs ${habit.active ? 'bg-glow/20 text-glow' : 'bg-white/5 text-mist'}`}>
              {habit.active ? 'active' : 'paused'}
            </span>
          </div>
        ))}
      </SectionCard>
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Bad habit settings</h3>
        <p className="text-sm text-mist">Control bad-habit visibility and manage the reusable bad-habit list.</p>
        <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">{visibleBadHabits.length} visible bad habits</p>
            <p className="text-xs text-mist">Alcohol stays built in, and custom bad habits can be added or archived here.</p>
          </div>
          <button
            type="button"
            onClick={() => setManagingBadHabits(true)}
            className="rounded-full border border-white/8 bg-[#1A1A1A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#202020]"
          >
            Manage bad habits
          </button>
        </div>
      </SectionCard>
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Export</h3>
        <p className="text-sm text-mist">Download a full local backup of your saved dashboard state, or import one later to restore everything.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="soft" onClick={onExportState}>Export backup</Button>
          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-[#2F2F2F] bg-[#1B1B1B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#262626]">
            Import backup
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onImportState(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        </div>
      </SectionCard>
    </ResponsiveGrid>
    {managingBadHabits ? (
      <>
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setManagingBadHabits(false)} />
        <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[82vh] w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[#111111] pb-4">
            <div>
              <h4 className="text-xl font-semibold text-white">Manage bad habits</h4>
              <p className="mt-2 text-sm leading-6 text-mist">Create custom bad habits and control streak visibility, color, and active state.</p>
            </div>
            <button
              type="button"
              onClick={() => setManagingBadHabits(false)}
              className="text-sm text-mist transition hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="mt-1 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-3">
              {visibleBadHabits.map((habit) => (
                <div key={habit.id} className="rounded-[22px] border border-white/[0.05] bg-[#161616] px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: habit.color }} />
                        <p className="text-sm font-semibold text-white">{habit.name}</p>
                        {habit.isBuiltIn ? <span className="text-[11px] uppercase tracking-[0.14em] text-mist/70">Built-in</span> : null}
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <LabeledToggle
                          label="Active"
                          value={habit.isActive}
                          onChange={() => onUpdateBadHabit(habit.id, (current) => ({ ...current, isActive: !current.isActive }))}
                        />
                        <LabeledToggle
                          label="Show streak in UI"
                          value={habit.showStreakInUI}
                          onChange={() =>
                            onUpdateBadHabit(habit.id, (current) => ({ ...current, showStreakInUI: !current.showStreakInUI }))
                          }
                        />
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8F8F8F]">Color</p>
                          {habit.isBuiltIn ? (
                            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/6 bg-white/[0.03] px-3 py-2 text-xs text-mist">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
                              Built-in
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {BAD_HABIT_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => onUpdateBadHabit(habit.id, (current) => ({ ...current, color }))}
                                  className={`h-7 w-7 rounded-full border transition ${
                                    habit.color === color ? 'border-white/35 scale-105' : 'border-white/10 hover:border-white/18'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  aria-label={`Set ${habit.name} color`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {!habit.isBuiltIn ? (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const nextName = window.prompt('Rename bad habit', habit.name)?.trim()
                            if (!nextName) return
                            onUpdateBadHabit(habit.id, (current) => ({ ...current, name: nextName }))
                          }}
                          className="text-sm text-mist transition hover:text-white"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchiveBadHabit(habit.id)}
                          className="text-sm text-mist transition hover:text-white"
                        >
                          Archive
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="rounded-[22px] border border-white/[0.05] bg-[#161616] px-4 py-4">
                <p className="text-sm font-semibold text-white">New custom bad habit</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={newBadHabitName}
                    onChange={(event) => setNewBadHabitName(event.target.value)}
                    placeholder="Name"
                    className="w-full rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/[0.14] focus:bg-[#202020]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {BAD_HABIT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewBadHabitColor(color)}
                        className={`h-9 w-9 rounded-full border transition ${
                          newBadHabitColor === color ? 'border-white/35 scale-105' : 'border-white/10 hover:border-white/18'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Choose ${color}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <LabeledToggle label="Active" value={newBadHabitActive} onChange={() => setNewBadHabitActive((value) => !value)} />
                  <LabeledToggle
                    label="Show streak in UI"
                    value={newBadHabitShowStreak}
                    onChange={() => setNewBadHabitShowStreak((value) => !value)}
                  />
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setNewBadHabitName('')
                      setNewBadHabitColor(BAD_HABIT_COLORS[0])
                      setNewBadHabitActive(true)
                      setNewBadHabitShowStreak(false)
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => {
                      const created = onCreateBadHabit({
                        name: newBadHabitName,
                        color: newBadHabitColor,
                        isActive: newBadHabitActive,
                        showStreakInUI: newBadHabitShowStreak,
                      })
                      if (!created) return
                      setNewBadHabitName('')
                      setNewBadHabitColor(BAD_HABIT_COLORS[0])
                      setNewBadHabitActive(true)
                      setNewBadHabitShowStreak(false)
                    }}
                  >
                    Add bad habit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    ) : null}
    </>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-panelSoft/50 px-4 py-3">
      <p className="text-sm text-mist">{label}</p>
      <p className="text-sm font-semibold capitalize text-white">{value}</p>
    </div>
  )
}

function LabeledToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: () => void
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#8F8F8F]">{label}</p>
      <button
        type="button"
        onClick={onChange}
        className={`mt-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          value ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
        }`}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  )
}
