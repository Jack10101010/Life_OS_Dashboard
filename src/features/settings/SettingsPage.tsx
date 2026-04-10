import { useMemo, useState } from 'react'
import { BadHabitDefinition, Habit, SettingsState } from '../../types'
import { Button } from '../../components/ui/Button'
import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'
import type { PersistedAppStateSnapshotSummary } from '../../lib/persistence'

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
  snapshots,
  snapshotsLoading,
  onCreateBackupNow,
  onRestoreSnapshot,
  onDeleteSnapshot,
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
  snapshots: PersistedAppStateSnapshotSummary[]
  snapshotsLoading: boolean
  onCreateBackupNow: () => void
  onRestoreSnapshot: (snapshotId: string) => void
  onDeleteSnapshot: (snapshotId: string) => void
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
        <h3 className="text-xl font-semibold theme-text-primary">General</h3>
        <div className="theme-surface-soft rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm theme-text-muted">Theme</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['dark', 'light'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, theme: option })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    settings.theme === option
                      ? 'theme-toggle-option-active'
                      : 'theme-toggle-option'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs theme-text-muted">Applies across the full app and persists on reload.</p>
        </div>
        <SettingRow label="Start day of week" value={settings.startDayOfWeek} />
        <SettingRow label="Default color mode" value={settings.defaultColorMode} />
        <div className="theme-surface-soft rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm theme-text-muted">Enable bad habit tracking</p>
              <p className="mt-1 text-xs theme-text-faint">Show or hide bad-habit logging, markers, and related summaries across the app.</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, enableBadHabitTracking: !settings.enableBadHabitTracking })}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                settings.enableBadHabitTracking
                  ? 'theme-toggle-option-active'
                  : 'theme-toggle-option'
              }`}
            >
              {settings.enableBadHabitTracking ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="theme-surface-soft rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm theme-text-muted">Track Medications & Supplements</p>
              <p className="mt-1 text-xs theme-text-faint">Show or hide the Medications & Supplements section in the daily log without deleting existing entries.</p>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, enableMedicationTracking: !settings.enableMedicationTracking })}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                settings.enableMedicationTracking
                  ? 'theme-toggle-option-active'
                  : 'theme-toggle-option'
              }`}
            >
              {settings.enableMedicationTracking ? 'On' : 'Off'}
            </button>
          </div>
        </div>
        <div className="theme-surface-soft rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm theme-text-muted">Panel hue</p>
            <div className="flex flex-wrap items-center gap-2">
              {(['blue', 'purple', 'green', 'amber', 'none'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, panelHue: option })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    settings.panelHue === option
                      ? 'theme-toggle-option-active'
                      : 'theme-toggle-option'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm theme-text-muted">Hue brightness</p>
              <p className="text-sm font-semibold theme-text-primary">{settings.panelHueIntensity}%</p>
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
        <h3 className="text-xl font-semibold theme-text-primary">Mood labels</h3>
        {settings.moodLabels.map((label, index) => (
          <SettingRow key={label} label={`Level ${index + 1}`} value={label} />
        ))}
      </SectionCard>
      <SectionCard className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold theme-text-primary">Habit management</h3>
          <Button>Add habit</Button>
        </div>
        {habits.map((habit) => (
          <div key={habit.id} className="theme-surface-soft flex items-center justify-between rounded-2xl border px-4 py-3">
            <div>
              <p className="text-sm font-semibold theme-text-primary">{habit.name}</p>
              <p className="text-xs theme-text-muted">{habit.targetFrequency}x per week</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs ${habit.active ? 'bg-glow/20 text-glow' : 'theme-muted-pill border'}`}>
              {habit.active ? 'active' : 'paused'}
            </span>
          </div>
        ))}
      </SectionCard>
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold theme-text-primary">Bad habit settings</h3>
        <p className="text-sm theme-text-muted">Control bad-habit visibility and manage the reusable bad-habit list.</p>
        <div className="theme-surface-soft flex items-center justify-between rounded-2xl border px-4 py-3">
          <div>
            <p className="text-sm font-semibold theme-text-primary">{visibleBadHabits.length} visible bad habits</p>
            <p className="text-xs theme-text-muted">Alcohol stays built in, and custom bad habits can be added or archived here.</p>
          </div>
          <button
            type="button"
            onClick={() => setManagingBadHabits(true)}
            className="theme-button-secondary rounded-full border px-4 py-2 text-sm font-semibold transition"
          >
            Manage bad habits
          </button>
        </div>
      </SectionCard>
      <SectionCard className="space-y-4">
        <h3 className="text-xl font-semibold theme-text-primary">Backups</h3>
        <p className="text-sm theme-text-muted">Create a full local snapshot, export the current state, import a backup, or restore an earlier snapshot.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="soft" onClick={onCreateBackupNow}>Create backup now</Button>
          <Button variant="soft" onClick={onExportState}>Export backup</Button>
          <label className="theme-button-secondary inline-flex cursor-pointer items-center rounded-2xl border px-4 py-2 text-sm font-semibold transition">
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
        <div className="theme-surface-soft rounded-2xl border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold theme-text-primary">Snapshot history</p>
              <p className="mt-1 text-xs theme-text-muted">Automatic snapshots are stored separately from the live app state.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.14em] theme-text-muted">
              {snapshotsLoading ? 'Loading' : `${snapshots.length} saved`}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {snapshots.length === 0 ? (
              <p className="text-sm theme-text-muted">No snapshots saved yet.</p>
            ) : (
              snapshots.map((snapshot) => (
                <div key={snapshot.id} className="theme-surface rounded-2xl border px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold theme-text-primary">
                        {new Date(snapshot.createdAt).toLocaleString()}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.14em] theme-text-muted">
                        <span>{snapshot.snapshotType.replace(/_/g, ' ')}</span>
                        <span>Schema {snapshot.schemaVersion}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="soft" onClick={() => onRestoreSnapshot(snapshot.id)}>Restore</Button>
                      <Button onClick={() => onDeleteSnapshot(snapshot.id)}>Delete</Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SectionCard>
    </ResponsiveGrid>
    {managingBadHabits ? (
      <>
        <div className="theme-overlay fixed inset-0 z-40" onClick={() => setManagingBadHabits(false)} />
        <div className="theme-popover fixed left-1/2 top-1/2 z-50 flex max-h-[82vh] w-[min(620px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
          <div className="theme-popover sticky top-0 z-10 flex items-start justify-between gap-4 pb-4">
            <div>
              <h4 className="text-xl font-semibold theme-text-primary">Manage bad habits</h4>
              <p className="mt-2 text-sm leading-6 theme-text-muted">Create custom bad habits and control streak visibility, color, and active state.</p>
            </div>
            <button
              type="button"
              onClick={() => setManagingBadHabits(false)}
              className="text-sm theme-text-muted transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
            >
              Close
            </button>
          </div>
          <div className="mt-1 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-3">
              {visibleBadHabits.map((habit) => (
                <div key={habit.id} className="theme-surface-soft rounded-[22px] border px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: habit.color }} />
                        <p className="text-sm font-semibold theme-text-primary">{habit.name}</p>
                        {habit.isBuiltIn ? <span className="text-[11px] uppercase tracking-[0.14em] theme-text-muted">Built-in</span> : null}
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
                          <p className="text-[10px] uppercase tracking-[0.18em] theme-text-faint">Color</p>
                          {habit.isBuiltIn ? (
                            <div className="theme-muted-pill mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs">
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
                                    habit.color === color ? 'theme-border-strong scale-105' : 'theme-border-subtle hover:theme-border-strong'
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
                          className="text-sm theme-text-muted transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchiveBadHabit(habit.id)}
                          className="text-sm theme-text-muted transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Archive
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              <div className="theme-surface-soft rounded-[22px] border px-4 py-4">
                <p className="text-sm font-semibold theme-text-primary">New custom bad habit</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={newBadHabitName}
                    onChange={(event) => setNewBadHabitName(event.target.value)}
                    placeholder="Name"
                    className="theme-input w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition"
                  />
                  <div className="flex flex-wrap gap-2">
                    {BAD_HABIT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewBadHabitColor(color)}
                        className={`h-9 w-9 rounded-full border transition ${
                          newBadHabitColor === color ? 'theme-border-strong scale-105' : 'theme-border-subtle hover:theme-border-strong'
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
    <div className="theme-surface-soft flex items-center justify-between rounded-2xl border px-4 py-3">
      <p className="text-sm theme-text-muted">{label}</p>
      <p className="text-sm font-semibold capitalize theme-text-primary">{value}</p>
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
      <p className="text-[10px] uppercase tracking-[0.18em] theme-text-faint">{label}</p>
      <button
        type="button"
        onClick={onChange}
        className={`mt-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
          value ? 'theme-toggle-option-active' : 'theme-toggle-option'
        }`}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  )
}
