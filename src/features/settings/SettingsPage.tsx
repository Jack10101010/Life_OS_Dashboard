import { Habit, SettingsState } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export function SettingsPage({
  settings,
  habits,
  onUpdateSettings,
  onExportState,
  onImportState,
}: {
  settings: SettingsState
  habits: Habit[]
  onUpdateSettings: (next: SettingsState) => void
  onExportState: () => void
  onImportState: (file: File) => void
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="space-y-4">
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
      </Card>
      <Card className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Mood labels</h3>
        {settings.moodLabels.map((label, index) => (
          <SettingRow key={label} label={`Level ${index + 1}`} value={label} />
        ))}
      </Card>
      <Card className="space-y-4">
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
      </Card>
      <Card className="space-y-4">
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
      </Card>
    </div>
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
