import { ReactNode, useEffect, useMemo, useState } from 'react'
import { DayEntry, Tag, WeekEntry } from '../../types'
import { formatShortDate } from '../../lib/date'
import { TagPill } from '../ui/TagPill'

export function WeekSummaryStrip({
  week,
  days,
  tags,
  selectedDay,
  canGoPrev,
  canGoNext,
  onPrevWeek,
  onNextWeek,
  onOpenWeek,
  onSelectDay,
}: {
  week: WeekEntry
  days: DayEntry[]
  tags: Tag[]
  selectedDay: DayEntry | null
  canGoPrev: boolean
  canGoNext: boolean
  onPrevWeek: () => void
  onNextWeek: () => void
  onOpenWeek: () => void
  onSelectDay: (day: DayEntry) => void
}) {
  const [reviewMode, setReviewMode] = useState<'weekly' | 'daily'>('weekly')
  const [dailyReviewDayId, setDailyReviewDayId] = useState<string | null>(selectedDay?.id ?? null)
  const loggedDays = days.filter((day) => day.isLogged)
  const orderedDays = useMemo(() => [...days].sort((left, right) => left.date.localeCompare(right.date)), [days])
  const fallbackDay = orderedDays[orderedDays.length - 1] ?? null
  const activeDailyReview = useMemo(() => {
    if (dailyReviewDayId) {
      const localMatch = orderedDays.find((day) => day.id === dailyReviewDayId)
      if (localMatch) return localMatch
    }
    if (selectedDay && orderedDays.some((day) => day.id === selectedDay.id)) return selectedDay
    return fallbackDay
  }, [dailyReviewDayId, fallbackDay, orderedDays, selectedDay])
  const activeDailyIndex = activeDailyReview ? orderedDays.findIndex((day) => day.id === activeDailyReview.id) : -1
  const previousDailyDay = activeDailyIndex > 0 ? orderedDays[activeDailyIndex - 1] : null
  const nextDailyDay = activeDailyIndex >= 0 ? orderedDays[activeDailyIndex + 1] ?? null : null
  const outcomeCounts = countOutcomes(loggedDays)
  const trajectoryCounts = countTrajectories(loggedDays)
  const selfInfluenceCounts = countSelfInfluence(loggedDays)
  const sleepInsight = getSleepInsight(loggedDays)
  const tagInsights = getTagInsights(loggedDays, tags)
  const weeklyInsights = getWeeklyInsights({
    loggedDays,
    outcomeCounts,
    trajectoryCounts,
    selfInfluenceCounts,
    sleepInsight,
    tagInsights,
  })
  const dailyReviewTags = activeDailyReview ? getVisibleDayTags(activeDailyReview, tags) : []

  useEffect(() => {
    if (selectedDay && orderedDays.some((day) => day.id === selectedDay.id)) {
      setDailyReviewDayId(selectedDay.id)
      return
    }
    if (!dailyReviewDayId && fallbackDay) {
      setDailyReviewDayId(fallbackDay.id)
    }
  }, [dailyReviewDayId, fallbackDay, orderedDays, selectedDay])

  return (
    <div className="space-y-4 rounded-3xl border border-white/5 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-white/[0.05] bg-black/10 p-1">
            {([
              ['weekly', 'Weekly'],
              ['daily', 'Daily'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setReviewMode(value)}
                className={`rounded-[14px] px-3 py-1.5 text-sm transition ${
                  reviewMode === value ? 'bg-white/[0.08] text-white' : 'text-mist hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {reviewMode === 'weekly' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevWeek}
                disabled={!canGoPrev}
                className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                ← Prev
              </button>
              <p className="text-sm font-medium text-white">{formatWeekLabel(week)}</p>
              <button
                type="button"
                onClick={onNextWeek}
                disabled={!canGoNext}
                className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                Next →
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => previousDailyDay && setDailyReviewDayId(previousDailyDay.id)}
                disabled={!previousDailyDay}
                className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                ← Prev
              </button>
              <p className="text-sm font-medium text-white">
                {activeDailyReview ? formatLongDateLabel(activeDailyReview.date) : 'No day selected'}
              </p>
              <button
                type="button"
                onClick={() => nextDailyDay && setDailyReviewDayId(nextDailyDay.id)}
                disabled={!nextDailyDay}
                className="text-sm text-mist transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                Next →
              </button>
            </div>
          )}
        </div>
        {reviewMode === 'weekly' ? (
          <button
            type="button"
            onClick={onOpenWeek}
            className="text-sm font-medium text-mist transition hover:text-white"
          >
            Open Week
          </button>
        ) : activeDailyReview ? (
          <button
            type="button"
            onClick={() => onSelectDay(activeDailyReview)}
            className="text-sm font-medium text-mist transition hover:text-white"
          >
            Open in Daily Cockpit
          </button>
        ) : null}
      </div>

      {reviewMode === 'weekly' ? (
        <>
          <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr_1fr]">
            <InsightCard
              title="Weekly summary"
              body={formatOutcomeSummary(outcomeCounts)}
              detail={loggedDays.length > 0 ? `${loggedDays.length} logged ${loggedDays.length === 1 ? 'day' : 'days'} this week` : 'No days logged yet'}
            />
            <InsightCard
              title="Trajectory"
              body={formatTrajectoryHeadline(trajectoryCounts)}
              detail={formatTrajectoryBreakdown(trajectoryCounts)}
            />
            <InsightCard
              title="Self influence"
              body={formatSelfInfluenceSummary(selfInfluenceCounts)}
              detail={formatSelfInfluenceDetail(selfInfluenceCounts)}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
            <div className="rounded-[24px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.018)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <p className="text-xs uppercase tracking-[0.22em] text-white/72">Patterns</p>
              <div className="mt-3 space-y-3">
                {weeklyInsights.length > 0 ? (
                  weeklyInsights.map((insight, index) => (
                    <div key={`${insight}-${index}`} className="rounded-2xl border border-white/[0.04] bg-black/10 px-3.5 py-3">
                      <p className="text-[15px] leading-6 text-white/92">{insight}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-mist">Log a few more days this week to surface clearer patterns.</p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Week at a glance</p>
              <div className="mt-3 grid gap-2">
                {days.map((day) => (
                  <div key={day.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.04] bg-black/10 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{formatShortDate(day.date)}</p>
                      <p className="mt-0.5 truncate text-xs text-mist/75">{getDayContext(day)}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-white/58">{getDaySecondaryContext(day)}</p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.12em] text-white/56">{formatDayOutcomeBadge(day)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(sleepInsight || tagInsights.length > 0) ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {sleepInsight ? (
                <InsightCard
                  title="Sleep correlation"
                  body={sleepInsight.headline}
                  detail={sleepInsight.detail}
                />
              ) : null}
              {tagInsights.length > 0 ? (
                <InsightCard
                  title="Tag correlation"
                  body={tagInsights[0].headline}
                  detail={tagInsights[0].detail}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : activeDailyReview ? (
        <DailyReviewPanel day={activeDailyReview} visibleTags={dailyReviewTags} />
      ) : (
        <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] p-4">
          <p className="text-sm text-mist">No day is available to review in this week yet.</p>
        </div>
      )}
    </div>
  )
}

function DailyReviewPanel({ day, visibleTags }: { day: DayEntry; visibleTags: Tag[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <ReadOnlyGroup title="Sleep">
          <ReadOnlyItem label="Bedtime" value={day.bedtime || 'Not logged'} />
          <ReadOnlyItem label="Wake time" value={day.wakeTime || 'Not logged'} />
          <ReadOnlyItem label="Sleep quality" value={day.sleepQuality != null ? `${day.sleepQuality}/10` : 'Not logged'} />
          <ReadOnlyItem label="Woke during night" value={day.wokeDuringNight == null ? 'Not logged' : day.wokeDuringNight ? 'Yes' : 'No'} />
        </ReadOnlyGroup>

        <ReadOnlyGroup title="Morning">
          <ReadOnlyItem label="Mood" value={formatScore(day.mood)} />
          <ReadOnlyItem label="Motivation" value={formatScore(day.motivation)} />
          <ReadOnlyItem label="Clarity" value={formatScore(day.clarity)} />
          <ReadOnlyItem label="Energy" value={formatScore(day.energy)} />
          <ReadOnlyText label="Morning intention" value={day.morningIntention} empty="No intention logged." />
        </ReadOnlyGroup>

        <ReadOnlyGroup title="Day">
          <ReadOnlyList label="Tasks" items={day.tasks} empty="No tasks logged." />
          <ReadOnlyList label="Habits" items={getHabitLines(day)} empty="No habits logged." />
          <ReadOnlyList label="Medications & supplements" items={day.medications.map(formatMedicationLine)} empty="Nothing logged." />
          <ReadOnlyList label="Day events" items={day.dailyActions.map(formatDayEventLine)} empty="No day events logged." />
        </ReadOnlyGroup>
      </div>

      <div className="space-y-4">
        <ReadOnlyGroup title="Tags">
          <ReadOnlyTagCluster label="Morning tags" tags={visibleTags.filter((tag) => isVisibleInTimeSection(day, tag.id, 'morning'))} empty="No morning tags logged." />
          <ReadOnlyTagCluster label="Day tags" tags={visibleTags.filter((tag) => isVisibleInTimeSection(day, tag.id, 'day'))} empty="No day tags logged." />
          <ReadOnlyTagCluster label="Evening tags" tags={visibleTags.filter((tag) => isVisibleInTimeSection(day, tag.id, 'evening'))} empty="No evening tags logged." />
        </ReadOnlyGroup>

        <ReadOnlyGroup title="Signals">
          <ReadOnlyItem label="Day color" value={getDayColorLabel(day.cellColor)} />
          <ReadOnlyText label="Big win" value={day.bigWin} empty="No big win logged." />
        </ReadOnlyGroup>

        <ReadOnlyGroup title="Evening">
          <ReadOnlyItem label="Outcome" value={day.eveningOutcome ? titleCase(day.eveningOutcome) : 'No evening check-out'} />
          <ReadOnlyItem label="Trajectory" value={day.eveningTrajectory ? titleCase(day.eveningTrajectory) : 'Not logged'} />
          <ReadOnlyItem label="Self influence" value={day.eveningSelfInfluence ? titleCase(day.eveningSelfInfluence) : 'Not logged'} />
          <ReadOnlyText label="Reflection" value={day.journal} empty="No reflection logged." />
        </ReadOnlyGroup>
      </div>
    </div>
  )
}

function InsightCard({ title, body, detail }: { title: string; body: string; detail?: string }) {
  return (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] p-3.5">
      <p className="text-xs uppercase tracking-[0.22em] text-mist/70">{title}</p>
      <p className="mt-2.5 text-sm leading-6 text-white">{body}</p>
      {detail ? <p className="mt-1.5 text-xs leading-5 text-mist/80">{detail}</p> : null}
    </div>
  )
}

function countOutcomes(days: DayEntry[]) {
  return {
    good: days.filter((day) => day.eveningOutcome === 'good').length,
    mixed: days.filter((day) => day.eveningOutcome === 'mixed').length,
    poor: days.filter((day) => day.eveningOutcome === 'poor').length,
    unstable: days.filter((day) => day.eveningOutcome === 'unstable').length,
  }
}

function countTrajectories(days: DayEntry[]) {
  return {
    improved: days.filter((day) => day.eveningTrajectory === 'improved').length,
    declined: days.filter((day) => day.eveningTrajectory === 'declined').length,
    stable: days.filter((day) => day.eveningTrajectory === 'stable').length,
    unstable: days.filter((day) => day.eveningTrajectory === 'unstable').length,
  }
}

function countSelfInfluence(days: DayEntry[]) {
  return {
    helped: days.filter((day) => day.eveningSelfInfluence === 'helped').length,
    neutral: days.filter((day) => day.eveningSelfInfluence === 'neutral').length,
    hurt: days.filter((day) => day.eveningSelfInfluence === 'hurt').length,
  }
}

function formatOutcomeSummary(counts: ReturnType<typeof countOutcomes>) {
  const parts = [
    counts.good ? `${counts.good} good ${counts.good === 1 ? 'day' : 'days'}` : null,
    counts.mixed ? `${counts.mixed} mixed` : null,
    counts.poor ? `${counts.poor} poor` : null,
    counts.unstable ? `${counts.unstable} unstable` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.length > 0 ? parts.join(', ') : 'No evening outcomes logged yet'
}

function formatTrajectoryHeadline(counts: ReturnType<typeof countTrajectories>) {
  const ranked = [
    { key: 'improved', label: 'improved', count: counts.improved },
    { key: 'declined', label: 'declined', count: counts.declined },
    { key: 'stable', label: 'stable', count: counts.stable },
    { key: 'unstable', label: 'unstable', count: counts.unstable },
  ].sort((left, right) => right.count - left.count)

  if (ranked[0].count === 0) return 'No trajectory data logged yet'
  return `You ${ranked[0].label} on most days this week`
}

function formatTrajectoryBreakdown(counts: ReturnType<typeof countTrajectories>) {
  const parts = [
    counts.improved ? `${counts.improved} improved` : null,
    counts.declined ? `${counts.declined} declined` : null,
    counts.stable ? `${counts.stable} stable` : null,
    counts.unstable ? `${counts.unstable} unstable` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.join(' · ')
}

function formatSelfInfluenceSummary(counts: ReturnType<typeof countSelfInfluence>) {
  const helpedDays = counts.helped
  const hurtDays = counts.hurt

  if (helpedDays === 0 && hurtDays === 0 && counts.neutral === 0) {
    return 'No self-influence check-ins logged yet'
  }

  const parts = [
    `You helped your state on ${helpedDays} ${helpedDays === 1 ? 'day' : 'days'}`,
    hurtDays > 0 ? `hurt it on ${hurtDays}` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.join(', ')
}

function formatSelfInfluenceDetail(counts: ReturnType<typeof countSelfInfluence>) {
  const parts = [
    counts.helped ? `${counts.helped} helped` : null,
    counts.neutral ? `${counts.neutral} neutral` : null,
    counts.hurt ? `${counts.hurt} hurt` : null,
  ].filter((value): value is string => Boolean(value))

  return parts.join(' · ')
}

function getSleepInsight(days: DayEntry[]) {
  const poorSleepDays = days.filter((day) => typeof day.sleepQuality === 'number' && day.sleepQuality <= 5)
  if (poorSleepDays.length === 0) return null

  const declinedOrUnstable = poorSleepDays.filter(
    (day) => day.eveningTrajectory === 'declined' || day.eveningOutcome === 'poor' || day.eveningOutcome === 'unstable',
  ).length

  const percent = Math.round((declinedOrUnstable / poorSleepDays.length) * 100)
  return {
    headline: `${percent}% of low-sleep days ended in decline, poor, or unstable outcomes`,
    detail: `${declinedOrUnstable} of ${poorSleepDays.length} ${poorSleepDays.length === 1 ? 'day with lower sleep' : 'days with lower sleep'} matched that pattern`,
    strength: percent,
  }
}

function getTagInsights(days: DayEntry[], tags: Tag[]) {
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]))
  const stats = new Map<string, { days: number; improved: number; declined: number; good: number; poorOrUnstable: number }>()

  days.forEach((day) => {
    const seen = new Set<string>()
    day.tagEntries
      .filter((entry) => entry.selected)
      .forEach((entry) => {
        const label = entry.tagId ? tagNameById.get(entry.tagId) : entry.customLabel
        const normalized = label?.trim().toLowerCase()
        if (!normalized || seen.has(normalized)) return
        seen.add(normalized)

        const current = stats.get(normalized) ?? { days: 0, improved: 0, declined: 0, good: 0, poorOrUnstable: 0 }
        current.days += 1
        if (day.eveningTrajectory === 'improved') current.improved += 1
        if (day.eveningTrajectory === 'declined') current.declined += 1
        if (day.eveningOutcome === 'good') current.good += 1
        if (day.eveningOutcome === 'poor' || day.eveningOutcome === 'unstable') current.poorOrUnstable += 1
        stats.set(normalized, current)
      })
  })

  return Array.from(stats.entries())
    .filter(([, value]) => value.days >= 2)
    .map(([name, value]) => {
      const improvedRate = value.improved / value.days
      const declinedRate = value.declined / value.days
      const goodRate = value.good / value.days
      const poorRate = value.poorOrUnstable / value.days

      if (improvedRate >= 0.6 || goodRate >= 0.6) {
        const percent = Math.round(Math.max(improvedRate, goodRate) * 100)
        return {
          headline: `${titleCase(name)} tended to show up on better days`,
          detail: `${titleCase(name)} appeared on ${value.days} days and matched improvement or good outcomes ${percent}% of the time`,
          strength: percent,
        }
      }

      if (declinedRate >= 0.6 || poorRate >= 0.6) {
        const percent = Math.round(Math.max(declinedRate, poorRate) * 100)
        return {
          headline: `${titleCase(name)} tended to show up on tougher days`,
          detail: `${titleCase(name)} appeared on ${value.days} days and matched decline, poor, or unstable outcomes ${percent}% of the time`,
          strength: percent,
        }
      }

      return null
    })
    .filter((value): value is { headline: string; detail: string; strength: number } => value != null)
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 2)
}

function getWeeklyInsights({
  loggedDays,
  trajectoryCounts,
  selfInfluenceCounts,
  sleepInsight,
  tagInsights,
}: {
  loggedDays: DayEntry[]
  outcomeCounts: ReturnType<typeof countOutcomes>
  trajectoryCounts: ReturnType<typeof countTrajectories>
  selfInfluenceCounts: ReturnType<typeof countSelfInfluence>
  sleepInsight: ReturnType<typeof getSleepInsight>
  tagInsights: ReturnType<typeof getTagInsights>
}) {
  const insights: Array<{ text: string; strength: number }> = []

  const trajectoryTotal = trajectoryCounts.improved + trajectoryCounts.declined + trajectoryCounts.stable + trajectoryCounts.unstable
  if (trajectoryTotal > 0) {
    const ranked = [
      { label: 'improved', count: trajectoryCounts.improved },
      { label: 'declined', count: trajectoryCounts.declined },
      { label: 'stable', count: trajectoryCounts.stable },
      { label: 'unstable', count: trajectoryCounts.unstable },
    ].sort((left, right) => right.count - left.count)

    if (ranked[0].count > 0) {
      insights.push({
        text: `Your week leaned ${ranked[0].label}, with ${ranked[0].count} of ${trajectoryTotal} logged days moving that way.`,
        strength: ranked[0].count / trajectoryTotal,
      })
    }
  }

  if (sleepInsight) {
    insights.push({
      text: sleepInsight.headline,
      strength: sleepInsight.strength / 100,
    })
  }

  tagInsights.forEach((insight) => {
    insights.push({
      text: insight.headline,
      strength: insight.strength / 100,
    })
  })

  const selfInfluenceTotal = selfInfluenceCounts.helped + selfInfluenceCounts.neutral + selfInfluenceCounts.hurt
  if (selfInfluenceTotal > 0) {
    if (selfInfluenceCounts.helped > selfInfluenceCounts.hurt && selfInfluenceCounts.helped >= 2) {
      insights.push({
        text: `You helped your state more often than you hurt it this week.`,
        strength: selfInfluenceCounts.helped / selfInfluenceTotal,
      })
    } else if (selfInfluenceCounts.hurt > selfInfluenceCounts.helped && selfInfluenceCounts.hurt >= 2) {
      insights.push({
        text: `You marked yourself as hurting your state more often than helping it this week.`,
        strength: selfInfluenceCounts.hurt / selfInfluenceTotal,
      })
    }
  }

  if (loggedDays.length === 0) return []

  return insights
    .sort((left, right) => right.strength - left.strength)
    .slice(0, 2)
    .map((item) => item.text)
}

function getDayContext(day: DayEntry) {
  if (day.sleepQuality != null) return `Sleep ${day.sleepQuality}/10`
  if (day.bigWin.trim()) return `Big win: ${day.bigWin.trim()}`
  if (day.morningIntention.trim()) return day.morningIntention.trim()
  return 'No extra context logged'
}

function getDaySecondaryContext(day: DayEntry) {
  if (day.bigWin.trim() && day.sleepQuality != null) return day.bigWin.trim()
  if (day.morningIntention.trim() && (day.bigWin.trim() || day.sleepQuality != null)) return day.morningIntention.trim()
  if (day.journal.trim()) return day.journal.trim()
  return 'No day summary added'
}

function formatDayOutcomeBadge(day: DayEntry) {
  if (!day.eveningOutcome) return 'No evening check-out'
  return titleCase(day.eveningOutcome)
}

function ReadOnlyGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-mist/70">{title}</p>
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

function ReadOnlyTagCluster({ label, tags, empty }: { label: string; tags: Tag[]; empty: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-mist/72">{label}</p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagPill key={`${label}-${tag.id}`} tag={tag} active emphasis="selected" />
          ))}
        </div>
      ) : (
        <p className="text-sm text-mist/70">{empty}</p>
      )}
    </div>
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
        isCustom: true,
        isActive: true,
      } satisfies Tag
    })
    .filter((tag): tag is Tag => tag != null)
}

function isVisibleInTimeSection(day: DayEntry, tagId: string, timeSection: 'morning' | 'day' | 'evening') {
  return day.tagEntries.some((entry) => entry.selected && entry.timeSection === timeSection && ((entry.tagId && entry.tagId === tagId) || entry.id === tagId))
}

function getHabitLines(day: DayEntry) {
  if (day.completedHabitIds.length > 0) {
    return day.completedHabitIds.map((id) => `Completed habit ${id}`)
  }
  if (day.habitsCompleted > 0) {
    return [`${day.habitsCompleted} habits completed`]
  }
  return []
}

function formatScore(value: number | null) {
  return value != null ? `${value}/10` : 'Not logged'
}

function formatMedicationLine(item: DayEntry['medications'][number]) {
  const dose = item.dose.trim() ? `${item.dose.trim()}${item.unit.trim()}` : item.unit.trim()
  return [item.name.trim(), dose || null, item.timeTaken || null].filter(Boolean).join(' · ')
}

function formatDayEventLine(item: DayEntry['dailyActions'][number]) {
  return [item.time || null, item.title, item.description.trim() || null].filter(Boolean).join(' · ')
}

function getDayColorLabel(color: DayEntry['cellColor']) {
  if (color === 'blank') return 'Blank'
  if (color === 'green') return 'Green'
  if (color === 'yellow') return 'Yellow'
  if (color === 'orange') return 'Orange'
  return 'Red'
}

function getPolarityColor(polarity: Tag['polarity']) {
  if (polarity === 'positive') return '#22C55E'
  if (polarity === 'neutral') return '#60A5FA'
  return '#B35A65'
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatWeekLabel(week: WeekEntry) {
  const start = new Date(`${week.startDate}T00:00:00Z`)
  const end = new Date(`${week.endDate}T00:00:00Z`)
  const startLabel = start.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const endLabel = end.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${startLabel}–${endLabel}`
}

function formatLongDateLabel(dateIso: string) {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
