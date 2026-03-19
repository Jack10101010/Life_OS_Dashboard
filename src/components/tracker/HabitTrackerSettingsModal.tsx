import { useEffect, useState } from 'react'
import { HabitTracker } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'

const colorOptions = [
  '#17C964',
  '#22D3EE',
  '#5AC8FA',
  '#60A5FA',
  '#AF52DE',
  '#EC4899',
  '#FF9F0A',
  '#F59E0B',
  '#FF3B30',
  '#F87171',
  '#A3E635',
  '#34D399',
]

function getTrackerPreviewColor(color: string, intensity: number) {
  const hex = color.replace('#', '')
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  const base = { r: 38, g: 38, b: 38 }
  const normalizedIntensity = Math.max(intensity, 0)
  const mix = Math.min(normalizedIntensity, 100) / 100
  const mixChannel = (from: number, to: number, amount: number) => Math.round(from + (to - from) * amount)

  if (normalizedIntensity <= 100) {
    return `rgb(${mixChannel(base.r, r, mix)}, ${mixChannel(base.g, g, mix)}, ${mixChannel(base.b, b, mix)})`
  }

  const boost = normalizedIntensity / 100
  const brighten = (channel: number) => Math.min(Math.round(channel * boost), 255)
  return `rgb(${brighten(r)}, ${brighten(g)}, ${brighten(b)})`
}

export function HabitTrackerSettingsModal({
  tracker,
  open,
  onClose,
  onSave,
  onOpenGoal,
  onDelete,
  onClearAchievements,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  tracker: HabitTracker | null
  open: boolean
  onClose: () => void
  onSave: (tracker: HabitTracker) => void
  onOpenGoal: (tracker: HabitTracker) => void
  onDelete: (trackerId: string) => void
  onClearAchievements: (trackerId: string) => void
  onMoveUp: (trackerId: string) => void
  onMoveDown: (trackerId: string) => void
  canMoveUp: boolean
  canMoveDown: boolean
}) {
  const [draft, setDraft] = useState<HabitTracker | null>(tracker)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClearAchievements, setConfirmClearAchievements] = useState(false)

  useEffect(() => {
    setDraft(tracker)
    setConfirmDelete(false)
    setConfirmClearAchievements(false)
  }, [tracker])

  if (!draft) return null

  return (
    <DetailDrawer open={open} onClose={onClose} size="md" subtitle="Custom habit tracker" title={tracker ? `Edit ${tracker.title}` : 'Create habit tracker'}>
      <div className="space-y-5">
        <div>
          <label className="text-sm text-[#B0B0B0]">Title</label>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            className="mt-2 w-full rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3 text-white outline-none"
            placeholder="Running"
          />
        </div>
        <div>
          <label className="text-sm text-[#B0B0B0]">Description</label>
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            className="mt-2 min-h-28 w-full rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3 text-white outline-none"
            placeholder="Short description of what this tracker measures."
          />
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#B0B0B0]">Tracker type</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">This shapes how goals and logging behave for the habit.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['checkbox', 'Checkbox'],
                ['number', 'Number'],
                ['timer', 'Timer'],
                ['options', 'Options'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, habitType: value, goal: value === draft.habitType ? draft.goal : null })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    draft.habitType === value
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#B0B0B0]">Goal</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">
                {draft.goal ? 'Edit or remove this habit goal in a dedicated setup modal.' : 'Goals are optional. Add one when you want a target to work toward.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSave(draft)
                onOpenGoal(draft)
                onClose()
              }}
              className="rounded-xl border border-[#2F2F2F] bg-[#141414] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#202020]"
            >
              {draft.goal ? 'Edit goal' : 'Set goal'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <p className="text-sm text-[#B0B0B0]">Tracker placement</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => onMoveUp(draft.id)}
              disabled={!canMoveUp}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border text-sm font-semibold transition ${
                canMoveUp
                  ? 'border-[#2F2F2F] bg-[#141414] text-white hover:bg-[#202020]'
                  : 'border-white/5 bg-[#141414] text-[#606060]'
              }`}
            >
              <span className="text-lg leading-none">↑</span>
              Move up
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(draft.id)}
              disabled={!canMoveDown}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] border text-sm font-semibold transition ${
                canMoveDown
                  ? 'border-[#2F2F2F] bg-[#141414] text-white hover:bg-[#202020]'
                  : 'border-white/5 bg-[#141414] text-[#606060]'
              }`}
            >
              <span className="text-lg leading-none">↓</span>
              Move down
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-[#B0B0B0]">Weekend handling</p>
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['show', 'Show'],
                ['disable', 'Black out'],
                ['hide', 'Weekdays only'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, weekendVisibility: value })}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    draft.weekendVisibility === value
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div>
            <p className="text-sm text-[#B0B0B0]">Show alcohol markers</p>
            <p className="mt-1 text-xs text-[#8C8C8C]">Overlay red dots on this heatmap for days marked as alcohol consumed in the mood tracker.</p>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, showAlcoholMarkers: !draft.showAlcoholMarkers })}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              draft.showAlcoholMarkers
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
            }`}
          >
            {draft.showAlcoholMarkers ? 'On' : 'Off'}
          </button>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div>
            <p className="text-sm text-[#B0B0B0]">Clamp description</p>
            <p className="mt-1 text-xs text-[#8C8C8C]">Limit the description to 3 lines on the tracker card.</p>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, clampDescription: !draft.clampDescription })}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              draft.clampDescription
                ? 'border-white/20 bg-white/10 text-white'
                : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
            }`}
          >
            {draft.clampDescription ? 'On' : 'Off'}
          </button>
        </div>
        <div>
          <p className="text-sm text-[#B0B0B0]">Tracker color</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setDraft({ ...draft, color })}
                className={`h-10 w-10 rounded-full border-2 ${draft.color === color ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#B0B0B0]">Color brightness</p>
            <p className="text-sm font-semibold text-white">{draft.colorIntensity ?? 100}%</p>
          </div>
          <input
            type="range"
            min={25}
            max={140}
            step={5}
            value={draft.colorIntensity ?? 100}
            onChange={(event) => setDraft({ ...draft, colorIntensity: Number(event.target.value) })}
            className="mt-3 w-full accent-white"
          />
          <div className="mt-3 rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8C8C8C]">Preview</p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-[10px] border border-white/10"
                style={{
                  backgroundColor: getTrackerPreviewColor(draft.color, draft.colorIntensity ?? 100),
                }}
              />
              <p className="text-sm text-[#BEBEBE]">Adjust how vivid this tracker appears on the heatmap.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-[#B0B0B0]">Trophies</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">
                {draft.achievements.length > 0
                  ? `Clear ${draft.achievements.length} completed goal ${draft.achievements.length === 1 ? 'trophy' : 'trophies'} from this habit.`
                  : 'No goal trophies recorded yet.'}
              </p>
              {confirmClearAchievements && draft.achievements.length > 0 ? (
                <p className="mt-3 text-sm font-semibold text-[#FFB4B4]">This will permanently remove previously earned trophies for this habit.</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={draft.achievements.length === 0}
              onClick={() => {
                if (!confirmClearAchievements) {
                  setConfirmClearAchievements(true)
                  return
                }
                onClearAchievements(draft.id)
                setDraft({ ...draft, achievements: [] })
                setConfirmClearAchievements(false)
              }}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                draft.achievements.length === 0
                  ? 'border-white/5 bg-[#141414] text-[#606060]'
                  : confirmClearAchievements
                    ? 'border-[#5A2B2B] bg-[#241414] text-[#FFB4B4] hover:bg-[#2D1717]'
                    : 'border-[#5A2B2B] bg-[#241414] text-[#FF8C8C] hover:bg-[#2D1717]'
              }`}
            >
              {confirmClearAchievements ? 'Confirm clear' : 'Clear trophies'}
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-[#3A2323] bg-[#161111] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#F0D4D4]">Delete heatmap</p>
              <p className="mt-1 text-sm text-[#B99898]">This permanently removes the heatmap and all of its entries. This action cannot be undone.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true)
                  return
                }
                onDelete(draft.id)
                onClose()
              }}
              className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#5A2B2B] bg-[#241414] text-[18px] text-[#FF8C8C] transition hover:bg-[#2D1717] hover:text-[#FFB4B4]"
              aria-label={confirmDelete ? 'Confirm delete heatmap' : 'Delete heatmap'}
            >
              🗑
            </button>
          </div>
          {confirmDelete ? <p className="mt-3 text-sm font-semibold text-[#FFB4B4]">Click the trash icon again to permanently delete this heatmap.</p> : null}
        </div>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save tracker
          </Button>
        </div>
      </div>
    </DetailDrawer>
  )
}
