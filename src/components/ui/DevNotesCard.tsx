import { PageId } from '../../types'
import { Card } from './Card'

const pageLabels: Record<PageId, string> = {
  dashboard: 'Dashboard',
  tracker: 'Tracker',
  'journal-recordings': 'Daily Journal',
  gratitude: 'Gratitude',
  goals: 'Goals',
  tasks: 'Tasks',
  notes: 'Notes',
  'vision-board': 'Vision Board',
  analytics: 'Analytics',
  'trade-log': 'Trade Log',
  settings: 'Settings',
}

export function DevNotesCard({
  page,
  value,
  onChange,
}: {
  page: PageId
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Card className="mb-5">
      <p className="text-xs uppercase tracking-[0.22em] text-[#8F8F8F]">Dev notes</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Ideas for {pageLabels[page]}</h3>
        <p className="text-xs text-[#8D8D8D]">Persisted locally</p>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Capture ideas for ${pageLabels[page]} here...`}
        className="mt-4 min-h-28 w-full rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-3 text-sm text-white outline-none"
      />
    </Card>
  )
}
