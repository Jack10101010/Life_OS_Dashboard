import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'

export function HabitTrackerEntryModal({
  open,
  onClose,
  trackerTitle,
  trackerColor,
  date,
  completed,
  note,
  onChange,
  onSave,
}: {
  open: boolean
  onClose: () => void
  trackerTitle: string
  trackerColor: string
  date: string
  completed: boolean
  note: string
  onChange: (next: { completed: boolean; note: string }) => void
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
          <p className="text-sm text-[#A3A3A3]">Status</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => onChange({ completed: true, note })}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${completed ? 'border-white text-white' : 'border-[#2A2A2A] text-[#B0B0B0]'}`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: trackerColor }} />
              Yes
            </button>
            <button
              onClick={() => onChange({ completed: false, note })}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${!completed ? 'border-white text-white' : 'border-[#2A2A2A] text-[#B0B0B0]'}`}
            >
              Blank
            </button>
          </div>
        </div>
        <div className="rounded-3xl border border-[#2A2A2A] bg-[#121212] p-5">
          <p className="text-sm text-[#A3A3A3]">Note</p>
          <textarea
            value={note}
            onChange={(event) => onChange({ completed, note: event.target.value })}
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
