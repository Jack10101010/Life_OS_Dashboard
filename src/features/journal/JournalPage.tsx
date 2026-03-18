import { DayEntry } from '../../types'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

export function JournalPage({
  entries,
  onOpenDay,
}: {
  entries: DayEntry[]
  onOpenDay: (day: DayEntry) => void
}) {
  const logged = entries
    .filter((day) => day.isLogged && (day.journal || day.moodNote || day.bigWin))
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8F8F8F]">Daily journal</p>
        <h3 className="mt-2 text-3xl font-semibold text-white">Journal recordings</h3>
        <p className="mt-3 text-sm text-[#A0A0A0]">Browse saved daily notes, mood entries, and wins. Click any entry to reopen it in the day editor.</p>
      </Card>

      {logged.length === 0 ? (
        <Card>
          <p className="text-sm text-[#A0A0A0]">No journal recordings yet. Start logging days from the tracker to build your journal history.</p>
        </Card>
      ) : (
        logged.map((day) => (
          <Card key={day.id} className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <p className="mt-2 text-sm text-[#A0A0A0]">{day.moodNote || day.bigWin || 'Journal entry'}</p>
              </div>
              <Button onClick={() => onOpenDay(day)}>Open</Button>
            </div>
            {day.journal ? <p className="text-sm leading-6 text-[#C8C8C8]">{day.journal}</p> : null}
          </Card>
        ))
      )}
    </div>
  )
}
