import { DAY_NAMES, formatShortDate } from '../../lib/date'
import { DayEntry, Tag, WeekEntry } from '../../types'
import { TagPill } from '../ui/TagPill'

export function WeekSummaryStrip({
  week,
  days,
  tags,
}: {
  week: WeekEntry
  days: DayEntry[]
  tags: Tag[]
}) {
  return (
    <div className="grid gap-5 rounded-3xl border border-white/5 bg-white/[0.03] p-5 lg:grid-cols-[1.6fr_1fr_1fr_1.1fr]">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Selected week</p>
        <div className="mt-3 flex gap-2">
          {days.map((day, index) => (
            <div key={day.id} className="flex-1 rounded-2xl border border-white/5 bg-panelSoft/70 p-2">
              <p className="text-[11px] text-mist/70">{DAY_NAMES[index]}</p>
              <p className="mt-1 text-sm font-semibold text-white">{day.score}</p>
              <p className="text-[11px] text-mist">{formatShortDate(day.date)}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Mood average</p>
        <p className="mt-3 text-3xl font-semibold text-white">{week.moodAverage.toFixed(1)}</p>
        <p className="mt-2 text-sm text-mist">AM/PM balance across the week.</p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Habit completion</p>
        <p className="mt-3 text-3xl font-semibold text-white">{week.habitCompletionPercent}%</p>
        <div className="mt-3 h-2 rounded-full bg-white/5">
          <div className="h-full rounded-full bg-glow" style={{ width: `${week.habitCompletionPercent}%` }} />
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tags + big win</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {week.tags.map((tagId) => {
            const tag = tags.find((item) => item.id === tagId)
            return tag ? <TagPill key={tag.id} tag={tag} /> : null
          })}
        </div>
        <p className="mt-3 text-sm text-white">{week.bigWin || 'No explicit big win logged this week.'}</p>
      </div>
    </div>
  )
}
