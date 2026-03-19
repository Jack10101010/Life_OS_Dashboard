import { HabitTrackerType } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'

export function HabitTrackerEntryModal({
  open,
  onClose,
  trackerTitle,
  trackerColor,
  trackerType,
  date,
  hasGoal,
  completed,
  value,
  note,
  onOpenGoal,
  onChange,
  onSave,
}: {
  open: boolean
  onClose: () => void
  trackerTitle: string
  trackerColor: string
  trackerType: HabitTrackerType
  date: string
  hasGoal: boolean
  completed: boolean
  value: number | null
  note: string
  onOpenGoal: () => void
  onChange: (next: { completed: boolean; value: number | null; note: string }) => void
  onSave: () => void
}) {
  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="md"
      subtitle={trackerTitle}
      title={new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-[#2A2A2A] bg-[#121212] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[#A3A3A3]">Daily entry</p>
            <button
              type="button"
              onClick={onOpenGoal}
              className="rounded-full border border-[#2B2B2B] bg-[#171717] px-3 py-1.5 text-xs font-semibold text-[#D8D8D8] transition hover:border-[#3A3A3A] hover:bg-[#1D1D1D] hover:text-white"
            >
              {hasGoal ? 'Edit goal' : 'Set goal'}
            </button>
          </div>
          {trackerType === 'checkbox' ? (
            <>
              <p className="mt-4 text-sm text-[#A3A3A3]">Status</p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => onChange({ completed: true, value, note })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${completed ? 'border-white text-white' : 'border-[#2A2A2A] text-[#B0B0B0]'}`}
                >
                  <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: trackerColor }} />
                  Yes
                </button>
                <button
                  onClick={() => onChange({ completed: false, value: null, note })}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${!completed ? 'border-white text-white' : 'border-[#2A2A2A] text-[#B0B0B0]'}`}
                >
                  Blank
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-[#A3A3A3]">{trackerType === 'timer' ? 'Minutes logged' : 'Value logged'}</p>
              <input
                type="number"
                min={0}
                step={1}
                value={value ?? ''}
                onChange={(event) => {
                  const nextValue = event.target.value === '' ? null : Math.max(Number(event.target.value), 0)
                  onChange({ completed: (nextValue ?? 0) > 0, value: nextValue, note })
                }}
                className="mt-3 w-full rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3 text-white outline-none"
                placeholder={trackerType === 'timer' ? '30' : '1'}
              />
            </>
          )}
        </div>
        <div className="rounded-3xl border border-[#2A2A2A] bg-[#121212] p-5">
          <p className="text-sm text-[#A3A3A3]">Note</p>
          <textarea
            value={note}
            onChange={(event) => onChange({ completed, value, note: event.target.value })}
            className="mt-3 min-h-32 w-full rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3 text-white outline-none"
            placeholder="Optional note for this day"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={onSave}>Save selection</Button>
        </div>
      </div>
    </DetailDrawer>
  )
}
