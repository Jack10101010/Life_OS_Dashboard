import { type ReactNode, useMemo, useState } from 'react'
import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'
import { TagPill } from '../../components/ui/TagPill'
import { DayEntry, Tag } from '../../types'
import { getResolvedDayColorBadgeClassName, getResolvedDayColorLabel, getResolvedDayColorSwatch } from '../../lib/color'
import { formatReviewDayEventLine, formatReviewMedicationLine, formatReviewScore } from '../../lib/dayReview'
import { formatLongDate } from '../../lib/date'

export function YourDaysPage({
  days,
  tags,
  onOpenDay,
}: {
  days: DayEntry[]
  tags: Tag[]
  onOpenDay: (day: DayEntry) => void
}) {
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const loggedDays = useMemo(
    () =>
      [...days]
        .filter(isReviewableDay)
        .sort((left, right) => right.date.localeCompare(left.date)),
    [days],
  )

  return (
    <div className="space-y-5">
      <SectionCard className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Daily review</p>
        <h3 className="text-3xl font-semibold text-white">Your Days</h3>
        <p className="max-w-3xl text-sm leading-6 text-mist">
          Browse logged days in a quieter, read-only view. Open any day in the Daily Log when you want to edit it.
        </p>
      </SectionCard>

      {loggedDays.length > 0 ? (
        <div className="space-y-4">
          {loggedDays.map((day) => {
            const expanded = expandedDayId === day.id
            const dayTags = getVisibleDayTags(day, tags)

            return (
              <SectionCard key={day.id} className="space-y-4">
                <button
                  type="button"
                  onClick={() => setExpandedDayId((current) => (current === day.id ? null : day.id))}
                  className="w-full text-left"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-white">{formatLongDate(`${day.date}T00:00:00Z`)}</p>
                        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${getResolvedDayColorBadgeClassName(day)}`}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getResolvedDayColorSwatch(day) }} />
                          {getResolvedDayColorLabel(day)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getSleepSummary(day) ? (
                          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/76">
                            {getSleepSummary(day)}
                          </span>
                        ) : null}
                        {day.bigWin.trim() ? (
                          <span className="rounded-full border border-[rgba(34,197,94,0.18)] bg-[rgba(34,197,94,0.08)] px-3 py-1.5 text-xs text-[#D6F7E1]">
                            Big win logged
                          </span>
                        ) : null}
                        {day.journal.trim() ? (
                          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/76">
                            Reflection saved
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="shrink-0 text-xs uppercase tracking-[0.2em] text-mist/62">{expanded ? 'Collapse' : 'Open'}</p>
                  </div>
                </button>

                <ResponsiveGrid columns="two-uneven" className="xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    {day.morningIntention.trim() ? (
                      <PreviewBlock label="Intention" text={day.morningIntention} />
                    ) : null}
                    {day.bigWin.trim() ? <PreviewBlock label="Big win" text={day.bigWin} /> : null}
                    {day.journal.trim() ? <PreviewBlock label="Reflection" text={day.journal} clamp /> : null}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9A9A9A]">Key tags</p>
                      {dayTags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {dayTags.slice(0, 8).map((tag) => (
                            <TagPill key={`${day.id}-${tag.id}`} tag={tag} active emphasis="selected" />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-mist/70">No tags logged.</p>
                      )}
                    </div>
                  </div>
                </ResponsiveGrid>

                {expanded ? (
                  <div className="space-y-4 border-t border-white/[0.06] pt-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpenDay(day)
                      }}
                      className="rounded-full border border-white/[0.08] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#202020]"
                    >
                      Open in Daily Log
                    </button>

                    <ResponsiveGrid columns="two">
                      <ReadOnlyGroup title="Sleep">
                        <ReadOnlyItem label="Bedtime" value={day.bedtime || 'Not logged'} />
                        <ReadOnlyItem label="Wake time" value={day.wakeTime || 'Not logged'} />
                        <ReadOnlyItem label="Sleep quality" value={formatReviewScore(day.sleepQuality)} />
                        <ReadOnlyItem label="Woke during night" value={day.wokeDuringNight === null ? 'Not logged' : day.wokeDuringNight ? 'Yes' : 'No'} />
                      </ReadOnlyGroup>

                      <ReadOnlyGroup title="Morning">
                        <ReadOnlyItem label="Mood" value={formatReviewScore(day.mood)} />
                        <ReadOnlyItem label="Motivation" value={formatReviewScore(day.motivation)} />
                        <ReadOnlyItem label="Clarity" value={formatReviewScore(day.clarity)} />
                        <ReadOnlyItem label="Energy" value={formatReviewScore(day.energy)} />
                        <ReadOnlyText label="Intention" value={day.morningIntention} empty="No intention logged." />
                      </ReadOnlyGroup>

                      <ReadOnlyGroup title="Day">
                        <ReadOnlyList label="Tasks" items={day.tasks} empty="No tasks logged." />
                        <ReadOnlyList label="Medications & supplements" items={day.medications.map(formatReviewMedicationLine)} empty="Nothing logged." />
                        <ReadOnlyList label="Day Events" items={day.dailyActions.map(formatReviewDayEventLine)} empty="No day events logged." />
                      </ReadOnlyGroup>

                      <ReadOnlyGroup title="Signals">
                        <ReadOnlyItem label="Day color" value={getResolvedDayColorLabel(day)} />
                        <ReadOnlyText label="Big win" value={day.bigWin} empty="No big win logged." />
                      </ReadOnlyGroup>

                      <ReadOnlyGroup title="Tags">
                        {dayTags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {dayTags.map((tag) => (
                              <TagPill key={`${day.id}-${tag.id}-detail`} tag={tag} active emphasis="selected" />
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-mist/70">No tags logged.</p>
                        )}
                      </ReadOnlyGroup>

                      <ReadOnlyGroup title="Evening Reflection">
                        <ReadOnlyText label="Reflection" value={day.journal} empty="No reflection logged." />
                      </ReadOnlyGroup>
                    </ResponsiveGrid>
                  </div>
                ) : null}
              </SectionCard>
            )
          })}
        </div>
      ) : (
        <SectionCard>
          <p className="text-sm text-mist">No logged days yet. Once you log a few days, they’ll appear here for review.</p>
        </SectionCard>
      )}
    </div>
  )
}

function PreviewBlock({ label, text, clamp = false }: { label: string; text: string; clamp?: boolean }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9A9A9A]">{label}</p>
      <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/86 ${clamp ? 'line-clamp-3' : ''}`}>{text}</p>
    </div>
  )
}

function ReadOnlyGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9A9A9A]">{title}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0">
      <span className="text-sm text-mist/78">{label}</span>
      <span className="text-sm text-white/88">{value}</span>
    </div>
  )
}

function ReadOnlyText({ label, value, empty }: { label: string; value: string; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-mist/72">{label}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white/88">{value.trim() || empty}</p>
    </div>
  )
}

function ReadOnlyList({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-mist/72">{label}</p>
      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item) => (
            <p key={item} className="text-sm text-white/88">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mist/70">{empty}</p>
      )}
    </div>
  )
}

function isReviewableDay(day: DayEntry) {
  return (
    day.isLogged ||
    day.morningIntention.trim().length > 0 ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
    day.tagEntries.length > 0 ||
    day.dailyActions.length > 0 ||
    day.tasks.length > 0 ||
    day.medications.length > 0 ||
    day.sleepQuality !== null ||
    day.bedtime.trim().length > 0 ||
    day.wakeTime.trim().length > 0
  )
}

function getVisibleDayTags(day: DayEntry, tags: Tag[]) {
  return day.tagEntries
    .filter((entry) => entry.selected)
    .map((entry) => {
      if (entry.tagId) {
        return tags.find((tag) => tag.id === entry.tagId) ?? null
      }

      if (!entry.customLabel) return null

      return {
        id: entry.id,
        name: entry.customLabel,
        color: getPolarityColor(entry.polarity),
        section: entry.section,
        availableIn: [entry.timeSection],
        kind: entry.kind,
        polarity: entry.polarity,
        flag: entry.flag,
        isCustom: true,
        isActive: true,
      } satisfies Tag
    })
    .filter((tag): tag is Tag => tag != null)
}

function getSleepSummary(day: DayEntry) {
  const parts = [day.bedtime || null, day.wakeTime || null].filter(Boolean)
  if (day.sleepQuality != null) parts.push(`Sleep ${day.sleepQuality}/10`)
  return parts.join(' · ')
}

function getPolarityColor(polarity: Tag['polarity']) {
  if (polarity === 'positive') return '#22C55E'
  if (polarity === 'neutral') return '#60A5FA'
  return '#B35A65'
}
