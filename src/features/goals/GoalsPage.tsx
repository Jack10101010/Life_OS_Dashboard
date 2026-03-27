import { useEffect, useMemo, useState } from 'react'
import { DetailDrawer } from '../../components/layout/DetailDrawer'
import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'
import { Button } from '../../components/ui/Button'
import {
  getAchievementDetailLabel,
  getTrackerGoalLabel,
  getTrackerGoalProgress,
  getLiveTrackerStreak,
  isHabitTrackerActiveOnDate,
} from '../../lib/habitTrackerGoals'
import { HabitTracker, HabitTrackerAchievement, LifeGoal, LifeGoalMove, LifeGoalStatus } from '../../types'

type GoalDetailItem =
  | {
      kind: 'active'
      tracker: HabitTracker
      progress: NonNullable<ReturnType<typeof getTrackerGoalProgress>>
      completionDates: string[]
    }
  | {
      kind: 'completed'
      tracker: HabitTracker
      achievement: HabitTrackerAchievement
      completionDates: string[]
    }

type GoalsTab = 'life' | 'habit'

type LifeGoalDraft = {
  title: string
  whyItMatters: string
  nextMove: string
  minimumVersion: string
  targetDate: string
  ifThenPlan: string
  status: LifeGoalStatus
}

const EMPTY_LIFE_GOAL_DRAFT: LifeGoalDraft = {
  title: '',
  whyItMatters: '',
  nextMove: '',
  minimumVersion: '',
  targetDate: '',
  ifThenPlan: '',
  status: 'in-motion',
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getTargetLabel(tracker: HabitTracker, target: number, goalType: HabitTrackerAchievement['goalType']) {
  switch (goalType) {
    case 'streak':
      return `${target} days`
    case 'times-per-week':
      return `${target} times / week`
    case 'target-value':
      return tracker.habitType === 'number' ? `${target} target value` : `${target} target`
    case 'minutes-target':
      return `${target} minutes`
  }
}

function getGoalStatusLabel(item: GoalDetailItem) {
  if (item.kind === 'completed') return 'Completed'
  if (item.progress.scheduled) return 'Scheduled'
  return 'Active'
}

function getGoalAccentColor(item: GoalDetailItem) {
  return item.tracker.color
}

function getLifeGoalStatusMeta(status: LifeGoalStatus) {
  switch (status) {
    case 'complete':
      return {
        label: 'Complete',
        badgeClassName: 'border-[#3E7258] bg-[#14261D] text-[#B5E7C7]',
      }
    case 'paused':
      return {
        label: 'Paused',
        badgeClassName: 'border-white/[0.08] bg-white/[0.04] text-white/62',
      }
    default:
      return {
        label: 'In Motion',
        badgeClassName: 'border-[#35506E] bg-[#121B24] text-[#C9DEF7]',
      }
  }
}

function getLifeGoalProgress(goal: LifeGoal) {
  const totalMoves = goal.moves.length
  const completedMoves = goal.moves.filter((move) => move.completed).length
  const percent = goal.status === 'complete' ? 100 : totalMoves === 0 ? 0 : Math.round((completedMoves / totalMoves) * 100)
  const nextMove = goal.moves.find((move) => !move.completed) ?? null
  const completedMoveItems = goal.moves.filter((move) => move.completed)
  const lastCompletedMove = [...completedMoveItems]
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0] ?? null

  return {
    totalMoves,
    completedMoves,
    plannedMoves: goal.moves.filter((move) => !move.completed),
    completedMoveItems,
    lastCompletedMove,
    percent,
    nextMove,
  }
}

function getLifeGoalAnchorText(whyItMatters: string) {
  const trimmed = whyItMatters.trim()
  if (!trimmed) return ''
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed
  return firstSentence.length > 120 ? `${firstSentence.slice(0, 117).trim()}...` : firstSentence
}

function createLifeGoalFromDraft(draft: LifeGoalDraft): LifeGoal {
  const timestamp = new Date().toISOString()
  const moveId = `life-goal-move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  return {
    id: `life-goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: draft.title.trim(),
    whyItMatters: draft.whyItMatters.trim(),
    minimumVersion: draft.minimumVersion.trim(),
    ifThenPlan: draft.ifThenPlan.trim(),
    targetDate: draft.targetDate,
    status: draft.status,
    moves: [
      {
        id: moveId,
        text: draft.nextMove.trim(),
        completed: false,
        completedAt: null,
      },
    ],
    linkedHabitIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function getRecentHabitSupportState(tracker: HabitTracker) {
  const today = new Date()
  const dates = Array.from({ length: 7 }, (_, index) => {
    const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    cursor.setUTCDate(cursor.getUTCDate() - index)
    return cursor.toISOString().slice(0, 10)
  }).reverse()

  const activeDates = dates.filter((date) => isHabitTrackerActiveOnDate(tracker, date))
  const completedCount = activeDates.filter((date) => tracker.entries[date]?.completed).length
  const rate = activeDates.length ? completedCount / activeDates.length : 0

  if (activeDates.length === 0) return 'Building'
  if (rate >= 0.75) return 'On track'
  if (rate >= 0.4) return 'Building'
  return 'Slipping'
}

function createLinkedHabitFromMove(title: string): HabitTracker {
  const now = Date.now().toString(36)
  return {
    id: `tracker-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    description: '',
    habitType: 'checkbox',
    color: '#5F8F4E',
    colorIntensity: 100,
    showAlcoholMarkers: false,
    showCurrentWeekHighlight: false,
    weekendVisibility: 'show',
    clampDescription: true,
    goal: null,
    achievements: [],
    entries: {},
  }
}

function sortLifeGoals(goals: LifeGoal[]) {
  const statusOrder: Record<LifeGoalStatus, number> = {
    'in-motion': 0,
    paused: 1,
    complete: 2,
  }

  return [...goals].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status]
    if (statusDiff !== 0) return statusDiff
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function GoalsPage({
  habitTrackers,
  lifeGoals,
  year,
  onCreateHabitTracker,
  onCreateLifeGoal,
  onUpdateLifeGoal,
  onDeleteLifeGoal,
  onSetLifeGoalAsTodayTask,
}: {
  habitTrackers: HabitTracker[]
  lifeGoals: LifeGoal[]
  year: number
  onCreateHabitTracker: (tracker: HabitTracker) => void
  onCreateLifeGoal: (goal: LifeGoal) => void
  onUpdateLifeGoal: (goalId: string, updater: (goal: LifeGoal) => LifeGoal) => void
  onDeleteLifeGoal: (goalId: string) => void
  onSetLifeGoalAsTodayTask: (goal: LifeGoal) => void
}) {
  const [activeTab, setActiveTab] = useState<GoalsTab>('life')
  const [selectedGoal, setSelectedGoal] = useState<GoalDetailItem | null>(null)
  const [selectedLifeGoalId, setSelectedLifeGoalId] = useState<string | null>(lifeGoals[0]?.id ?? null)
  const [lifeGoalDraft, setLifeGoalDraft] = useState<LifeGoalDraft>(EMPTY_LIFE_GOAL_DRAFT)
  const [lifeGoalComposerOpen, setLifeGoalComposerOpen] = useState(lifeGoals.length === 0)
  const [plannedMoveDraft, setPlannedMoveDraft] = useState('')
  const [lifeGoalActionFeedback, setLifeGoalActionFeedback] = useState<string | null>(null)
  const [linkHabitPickerOpen, setLinkHabitPickerOpen] = useState(false)
  const [habitDraftByMoveId, setHabitDraftByMoveId] = useState<Record<string, string>>({})

  const sortedLifeGoals = useMemo(() => sortLifeGoals(lifeGoals), [lifeGoals])

  useEffect(() => {
    if (sortedLifeGoals.length === 0) {
      setSelectedLifeGoalId(null)
      setLifeGoalComposerOpen(true)
      return
    }

    if (!selectedLifeGoalId || !sortedLifeGoals.some((goal) => goal.id === selectedLifeGoalId)) {
      setSelectedLifeGoalId(sortedLifeGoals[0].id)
    }
  }, [selectedLifeGoalId, sortedLifeGoals])

  const selectedLifeGoal = useMemo(
    () => sortedLifeGoals.find((goal) => goal.id === selectedLifeGoalId) ?? null,
    [selectedLifeGoalId, sortedLifeGoals],
  )

  const selectedLifeGoalProgress = useMemo(
    () => (selectedLifeGoal ? getLifeGoalProgress(selectedLifeGoal) : null),
    [selectedLifeGoal],
  )
  const selectedLinkedHabits = useMemo(
    () =>
      selectedLifeGoal
        ? selectedLifeGoal.linkedHabitIds
            .map((habitId) => habitTrackers.find((tracker) => tracker.id === habitId) ?? null)
            .filter((tracker): tracker is HabitTracker => tracker !== null)
        : [],
    [habitTrackers, selectedLifeGoal],
  )
  const availableHabitsToLink = useMemo(
    () =>
      selectedLifeGoal
        ? habitTrackers.filter((tracker) => !selectedLifeGoal.linkedHabitIds.includes(tracker.id))
        : [],
    [habitTrackers, selectedLifeGoal],
  )

  const activeGoals = useMemo(
    () =>
      habitTrackers
        .filter((tracker) => tracker.goal)
        .map((tracker) => {
          const progress = getTrackerGoalProgress(tracker, year)
          if (!progress) return null
          const completionDates = Object.values(tracker.entries)
            .filter((entry) => entry.completed && entry.date >= progress.startDate)
            .map((entry) => entry.date)
            .sort()

          return {
            kind: 'active' as const,
            tracker,
            progress,
            completionDates,
          }
        })
        .filter((item): item is Exclude<typeof item, null> => item !== null)
        .sort((left, right) => left.tracker.title.localeCompare(right.tracker.title)),
    [habitTrackers, year],
  )

  const completedGoals = useMemo(
    () =>
      habitTrackers
        .flatMap((tracker) =>
          tracker.achievements.map((achievement) => ({
            kind: 'completed' as const,
            tracker,
            achievement,
            completionDates: Object.values(tracker.entries)
              .filter(
                (entry) =>
                  entry.completed &&
                  entry.date >= achievement.startedDate &&
                  entry.date <= achievement.completedDate,
              )
              .map((entry) => entry.date)
              .sort(),
          })),
        )
        .sort((left, right) => right.achievement.completedDate.localeCompare(left.achievement.completedDate)),
    [habitTrackers],
  )

  const handleCreateLifeGoal = () => {
    if (
      !lifeGoalDraft.title.trim() ||
      !lifeGoalDraft.whyItMatters.trim() ||
      !lifeGoalDraft.nextMove.trim() ||
      !lifeGoalDraft.minimumVersion.trim()
    ) {
      return
    }

    const nextGoal = createLifeGoalFromDraft(lifeGoalDraft)
    onCreateLifeGoal(nextGoal)
    setSelectedLifeGoalId(nextGoal.id)
    setLifeGoalDraft(EMPTY_LIFE_GOAL_DRAFT)
    setLifeGoalComposerOpen(false)
  }

  const addPlannedMove = () => {
    const trimmed = plannedMoveDraft.trim()
    if (!selectedLifeGoal || !trimmed) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      moves: [
        ...goal.moves,
        {
          id: `life-goal-move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          text: trimmed,
          completed: false,
          completedAt: null,
        },
      ],
      updatedAt: new Date().toISOString(),
    }))
    setPlannedMoveDraft('')
  }

  const toggleMoveCompletion = (goalId: string, moveId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      moves: goal.moves.map((move) =>
        move.id !== moveId
          ? move
          : {
              ...move,
              completed: !move.completed,
              completedAt: !move.completed ? new Date().toISOString() : null,
            },
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateLifeGoalStatus = (goalId: string, status: LifeGoalStatus) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      status,
      updatedAt: new Date().toISOString(),
    }))
  }

  const linkHabitToLifeGoal = (goalId: string, trackerId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      linkedHabitIds: goal.linkedHabitIds.includes(trackerId) ? goal.linkedHabitIds : [...goal.linkedHabitIds, trackerId],
      updatedAt: new Date().toISOString(),
    }))
  }

  const unlinkHabitFromLifeGoal = (goalId: string, trackerId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      linkedHabitIds: goal.linkedHabitIds.filter((id) => id !== trackerId),
      updatedAt: new Date().toISOString(),
    }))
  }

  const createHabitFromMove = (goal: LifeGoal, move: LifeGoalMove) => {
    const draftTitle = (habitDraftByMoveId[move.id] ?? move.text).trim()
    if (!draftTitle) return

    const tracker = createLinkedHabitFromMove(draftTitle)
    onCreateHabitTracker(tracker)
    linkHabitToLifeGoal(goal.id, tracker.id)
    setHabitDraftByMoveId((current) => {
      const next = { ...current }
      delete next[move.id]
      return next
    })
    setLifeGoalActionFeedback(`Linked habit created for "${goal.title}".`)
  }

  const renderLifeGoalsTab = () => (
    <ResponsiveGrid columns="two-uneven" className="items-start">
      <SectionCard className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="theme-section-title">Life goals</p>
            <h2 className="theme-page-title mt-2">Meaningful work, kept visible</h2>
            <p className="theme-body-secondary mt-2 max-w-[560px]">
              A focused planning layer for the goals that matter most, with one clear next move always in view.
            </p>
          </div>
          <Button
            variant="soft"
            onClick={() => {
              setLifeGoalComposerOpen(true)
              setLifeGoalDraft(EMPTY_LIFE_GOAL_DRAFT)
              setLifeGoalActionFeedback(null)
            }}
          >
            New Life Goal
          </Button>
        </div>

        {sortedLifeGoals.length === 0 ? (
          <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] px-5 py-6">
            <p className="text-lg font-medium text-white">No life goals yet</p>
            <p className="mt-2 max-w-[420px] text-sm leading-6 text-mist">
              Define one meaningful direction, keep the next move visible, and let the page stay practical rather than complicated.
            </p>
            <Button
              variant="soft"
              className="mt-4"
              onClick={() => {
                setLifeGoalComposerOpen(true)
                setLifeGoalDraft(EMPTY_LIFE_GOAL_DRAFT)
              }}
            >
              Create your first life goal
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedLifeGoals.map((goal) => {
              const progress = getLifeGoalProgress(goal)
              const statusMeta = getLifeGoalStatusMeta(goal.status)
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => {
                    setSelectedLifeGoalId(goal.id)
                    setLifeGoalComposerOpen(false)
                    setLifeGoalActionFeedback(null)
                  }}
                  className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                    selectedLifeGoalId === goal.id
                      ? 'border-white/[0.12] bg-white/[0.045]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold text-white">{goal.title}</p>
                      {progress.nextMove ? (
                        <p className="mt-1 truncate text-sm text-white/68">→ {progress.nextMove.text}</p>
                      ) : (
                        <p className="mt-1 truncate text-sm text-mist">No next move set yet.</p>
                      )}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${statusMeta.badgeClassName}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#5F8F4E]"
                        style={{ width: `${Math.max(progress.percent, goal.status === 'complete' ? 100 : 6)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-sm font-medium text-white/52">{progress.completedMoves}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard className="space-y-5">
        {lifeGoalComposerOpen ? (
          <div className="space-y-5">
            <div>
              <p className="theme-section-title">New life goal</p>
              <h3 className="theme-page-title mt-2">Create a serious goal, keep it simple</h3>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="theme-label">Title</span>
                <input
                  value={lifeGoalDraft.title}
                  onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Build Life OS v1"
                  className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.12] focus:bg-white/[0.035]"
                />
              </label>
              <label className="space-y-2">
                <span className="theme-label">Why it matters</span>
                <textarea
                  value={lifeGoalDraft.whyItMatters}
                  onChange={(event) => setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))}
                  placeholder="This matters because..."
                  className="min-h-[96px] w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.12] focus:bg-white/[0.035]"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="theme-label">Next move</span>
                  <input
                    value={lifeGoalDraft.nextMove}
                    onChange={(event) => setLifeGoalDraft((current) => ({ ...current, nextMove: event.target.value }))}
                    placeholder="Draft the first working version"
                    className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.12] focus:bg-white/[0.035]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="theme-label">Minimum version</span>
                  <input
                    value={lifeGoalDraft.minimumVersion}
                    onChange={(event) => setLifeGoalDraft((current) => ({ ...current, minimumVersion: event.target.value }))}
                    placeholder="Write the first rough outline"
                    className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.12] focus:bg-white/[0.035]"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="theme-label">Target date</span>
                  <input
                    type="date"
                    value={lifeGoalDraft.targetDate}
                    onChange={(event) => setLifeGoalDraft((current) => ({ ...current, targetDate: event.target.value }))}
                    className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none transition focus:border-white/[0.12] focus:bg-white/[0.035]"
                  />
                </label>
                <label className="space-y-2">
                  <span className="theme-label">Status</span>
                  <select
                    value={lifeGoalDraft.status}
                    onChange={(event) => setLifeGoalDraft((current) => ({ ...current, status: event.target.value as LifeGoalStatus }))}
                    className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white outline-none transition focus:border-white/[0.12] focus:bg-white/[0.035]"
                  >
                    <option value="in-motion">In Motion</option>
                    <option value="paused">Paused</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>
              </div>
              <label className="space-y-2">
                <span className="theme-label">If-Then plan</span>
                <textarea
                  value={lifeGoalDraft.ifThenPlan}
                  onChange={(event) => setLifeGoalDraft((current) => ({ ...current, ifThenPlan: event.target.value }))}
                  placeholder="If I stall, then I..."
                  className="min-h-[90px] w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.12] focus:bg-white/[0.035]"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {sortedLifeGoals.length > 0 ? (
                <Button variant="ghost" onClick={() => setLifeGoalComposerOpen(false)}>
                  Cancel
                </Button>
              ) : null}
              <Button variant="soft" onClick={handleCreateLifeGoal}>
                Create Life Goal
              </Button>
            </div>
          </div>
        ) : selectedLifeGoal && selectedLifeGoalProgress ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="theme-section-title">Selected goal</p>
                <h3 className="theme-page-title mt-2">{selectedLifeGoal.title}</h3>
                {getLifeGoalAnchorText(selectedLifeGoal.whyItMatters) ? (
                  <p className="mt-2 max-w-[640px] text-sm leading-6 text-white/62">
                    {getLifeGoalAnchorText(selectedLifeGoal.whyItMatters)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(['in-motion', 'paused', 'complete'] as LifeGoalStatus[]).map((status) => {
                  const meta = getLifeGoalStatusMeta(status)
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => updateLifeGoalStatus(selectedLifeGoal.id, status)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] transition ${
                        selectedLifeGoal.status === status
                          ? meta.badgeClassName
                          : 'border-white/[0.06] bg-white/[0.025] text-white/56 hover:border-white/[0.1] hover:text-white/76'
                      }`}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-5">
              <div className="max-w-[760px] space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Next move</p>
                  <p className="mt-3 text-[22px] font-semibold leading-[1.42] text-white">
                    {selectedLifeGoalProgress.nextMove?.text ?? 'No next move currently planned.'}
                  </p>
                </div>

                <div className="space-y-3 rounded-[20px] border border-white/[0.06] bg-white/[0.018] px-4 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/62">Minimum version</p>
                    <p className="mt-2 text-sm leading-6 text-white/76">{selectedLifeGoal.minimumVersion}</p>
                  </div>
                  {selectedLifeGoal.ifThenPlan ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-mist/62">If-Then plan</p>
                      <p className="mt-2 text-sm leading-6 text-white/72">{selectedLifeGoal.ifThenPlan}</p>
                    </div>
                  ) : null}
                  <p className="text-sm leading-6 text-mist">
                    Keep this move small enough to start today. Future momentum-aware guidance can sit here.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      variant="soft"
                      onClick={() => {
                        onSetLifeGoalAsTodayTask(selectedLifeGoal)
                        setLifeGoalActionFeedback('Focused for today.')
                      }}
                    >
                      Focus this today
                    </Button>
                    {selectedLifeGoalProgress.nextMove ? (
                      <Button
                        variant="ghost"
                        onClick={() => toggleMoveCompletion(selectedLifeGoal.id, selectedLifeGoalProgress.nextMove!.id)}
                      >
                        Done — move forward
                      </Button>
                    ) : null}
                  </div>
                  {lifeGoalActionFeedback ? <p className="text-sm text-mist">{lifeGoalActionFeedback}</p> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(220px,0.95fr)]">
              <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Why it matters</p>
                <p className="mt-3 text-sm leading-7 text-white/86">{selectedLifeGoal.whyItMatters}</p>
              </div>
              <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Progress</p>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[22px] font-semibold text-white">
                      {selectedLifeGoalProgress.completedMoves} {selectedLifeGoalProgress.completedMoves === 1 ? 'move' : 'moves'} completed
                    </p>
                    <p className="mt-2 text-sm text-mist">
                      {selectedLifeGoalProgress.nextMove
                        ? `Next milestone: ${selectedLifeGoalProgress.nextMove.text}`
                        : selectedLifeGoalProgress.lastCompletedMove
                          ? `Last completed step: ${selectedLifeGoalProgress.lastCompletedMove.text}`
                          : 'No steps completed yet.'}
                    </p>
                  </div>
                  {selectedLifeGoal.targetDate ? (
                    <div className="text-right text-sm text-mist">
                      <p className="uppercase tracking-[0.16em] text-mist/62">Target</p>
                      <p className="mt-1 text-white/72">{formatDate(selectedLifeGoal.targetDate)}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#6C8A58]"
                    style={{ width: `${Math.max(selectedLifeGoalProgress.percent, selectedLifeGoal.status === 'complete' ? 100 : 6)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Supporting habits</p>
                  <p className="mt-1 text-sm text-mist">Recurring support systems linked to this goal.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkHabitPickerOpen((current) => !current)}
                  className="text-sm text-white/66 transition hover:text-white"
                >
                  + Link existing habit
                </button>
              </div>

              {linkHabitPickerOpen && selectedLifeGoal ? (
                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                  {availableHabitsToLink.length > 0 ? (
                    <div className="space-y-2">
                      {availableHabitsToLink.map((tracker) => (
                        <button
                          key={tracker.id}
                          type="button"
                          onClick={() => {
                            linkHabitToLifeGoal(selectedLifeGoal.id, tracker.id)
                            setLinkHabitPickerOpen(false)
                          }}
                          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 text-left transition hover:border-white/[0.1] hover:bg-white/[0.03]"
                        >
                          <span className="text-sm text-white">{tracker.title}</span>
                          <span className="text-xs uppercase tracking-[0.16em] text-mist/60">Link</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-mist">All current habits are already linked to this goal.</p>
                  )}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {selectedLinkedHabits.length > 0 ? (
                  selectedLinkedHabits.map((tracker) => {
                    const liveStreak = getLiveTrackerStreak(tracker, year)
                    const supportState = getRecentHabitSupportState(tracker)
                    return (
                      <div
                        key={tracker.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{tracker.title}</p>
                          <p className="mt-1 text-xs text-mist">
                            {liveStreak > 0 ? `${liveStreak}d streak` : 'No live streak'} • {supportState}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectedLifeGoal && unlinkHabitFromLifeGoal(selectedLifeGoal.id, tracker.id)}
                          className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/34 transition hover:text-white/62"
                        >
                          Unlink
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                    No supporting habits linked yet.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Moves</p>
                  <p className="mt-1 text-sm text-mist">Keep the next steps visible and mark them honestly.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Upcoming moves</p>
                  {selectedLifeGoalProgress.plannedMoves.length > 0 ? (
                    selectedLifeGoalProgress.plannedMoves.map((move, index) => (
                      <div
                        key={move.id}
                        className={`rounded-2xl border px-3.5 py-3 ${
                          index === 0
                            ? 'border-white/[0.14] bg-white/[0.045]'
                            : 'border-white/[0.06] bg-white/[0.02]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMoveCompletion(selectedLifeGoal.id, move.id)}
                          className="flex w-full items-start justify-between gap-3 text-left transition"
                        >
                          <div className="min-w-0">
                            <span className={`block leading-6 ${index === 0 ? 'text-[15px] font-medium text-white/92' : 'text-sm text-white/84'}`}>{move.text}</span>
                            <span className={`mt-1 block text-[11px] uppercase tracking-[0.16em] ${index === 0 ? 'text-white/58' : 'text-mist/56'}`}>
                              {index === 0 ? 'Next move' : 'Upcoming'}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-mist/62">Done</span>
                        </button>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setHabitDraftByMoveId((current) => ({
                                ...current,
                                [move.id]: current[move.id] ?? move.text,
                              }))
                            }
                            className="text-xs uppercase tracking-[0.16em] text-white/46 transition hover:text-white/72"
                          >
                            Make this a habit
                          </button>
                        </div>
                        {habitDraftByMoveId[move.id] !== undefined ? (
                          <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                            <input
                              value={habitDraftByMoveId[move.id]}
                              onChange={(event) =>
                                setHabitDraftByMoveId((current) => ({
                                  ...current,
                                  [move.id]: event.target.value,
                                }))
                              }
                              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                              placeholder="Habit name"
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setHabitDraftByMoveId((current) => {
                                    const next = { ...current }
                                    delete next[move.id]
                                    return next
                                  })
                                }
                              >
                                Cancel
                              </Button>
                              <Button variant="soft" onClick={() => createHabitFromMove(selectedLifeGoal, move)}>
                                Create and link habit
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                      No upcoming moves yet. Add the next concrete step.
                    </p>
                  )}

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3.5 py-3">
                    <input
                      value={plannedMoveDraft}
                      onChange={(event) => setPlannedMoveDraft(event.target.value)}
                      placeholder="Add another planned move"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button variant="soft" onClick={addPlannedMove}>
                        Add another move
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Completed steps</p>
                  {selectedLifeGoalProgress.completedMoveItems.length > 0 ? (
                    selectedLifeGoalProgress.completedMoveItems.map((move) => (
                      <button
                        key={move.id}
                        type="button"
                        onClick={() => toggleMoveCompletion(selectedLifeGoal.id, move.id)}
                        className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[#315441]/35 bg-[#122018] px-3.5 py-3 text-left transition hover:border-[#3C6A51]/45 hover:bg-[#16271D]"
                      >
                        <span className="text-sm leading-6 text-[#D9F0DF]">{move.text}</span>
                        <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-[#9FC8AB]">
                          {move.completedAt ? formatDate(move.completedAt.slice(0, 10)) : 'Done'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                      Completed steps will collect here as proof of progress.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex justify-end border-t border-white/[0.05] pt-4">
                <button
                  type="button"
                  onClick={() => onDeleteLifeGoal(selectedLifeGoal.id)}
                  className="text-sm text-white/34 transition hover:text-white/62"
                >
                  Delete goal
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </SectionCard>
    </ResponsiveGrid>
  )

  const renderHabitGoalsTab = () => (
    <>
      <ResponsiveGrid columns="two-uneven">
        <SectionCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Active habit goals</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Current targets</h3>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-mist">
              {activeGoals.length} live
            </div>
          </div>

          {activeGoals.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4 text-sm text-mist">
              No active habit goals yet. Set a goal on any custom habit heatmap to start tracking it here.
            </div>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((item) => (
                <button
                  key={`${item.tracker.id}-active`}
                  type="button"
                  onClick={() => setSelectedGoal(item)}
                  className="w-full rounded-2xl border border-white/5 bg-panelSoft/45 p-4 text-left transition hover:border-white/10 hover:bg-panelSoft/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getGoalAccentColor(item) }}
                        />
                        <p className="truncate text-base font-semibold text-white">{item.tracker.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-mist">{getTrackerGoalLabel(item.tracker.goal)}</p>
                    </div>
                    <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-mist/80">
                      {getGoalStatusLabel(item)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-2.5 flex-1 gap-1.5">
                      {Array.from({ length: Math.max(item.progress.target, 1) }, (_, index) => {
                        const isFilled = index < item.progress.current
                        const isMissed = item.progress.missed && index === 0 && !isFilled
                        return (
                          <div
                            key={index}
                            className={`h-full flex-1 rounded-full ${isMissed ? 'bg-[#8D3D37]' : !isFilled ? 'bg-[#262626]' : ''}`}
                            style={isFilled ? { backgroundColor: getGoalAccentColor(item) } : undefined}
                          />
                        )
                      })}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-white">{item.progress.progressText}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist/85">
                    <span>Type: {getTrackerGoalLabel(item.tracker.goal)}</span>
                    <span>Target: {getTargetLabel(item.tracker, item.progress.target, item.tracker.goal!.type)}</span>
                    <span>Start: {formatDate(item.progress.startDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Completed habit goals</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Achievement archive</h3>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-mist">
              {completedGoals.length} total
            </div>
          </div>

          {completedGoals.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4 text-sm text-mist">
              Completed goals will stay here even after they roll off the habit card trophy shelf.
            </div>
          ) : (
            <div className="space-y-3">
              {completedGoals.map((item) => (
                <button
                  key={item.achievement.id}
                  type="button"
                  onClick={() => setSelectedGoal(item)}
                  className="w-full rounded-2xl border border-white/5 bg-panelSoft/45 p-4 text-left transition hover:border-white/10 hover:bg-panelSoft/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] text-[#F2C76B]">Trophy</span>
                        <p className="truncate text-base font-semibold text-white">{item.tracker.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-mist">{getAchievementDetailLabel(item.achievement)}</p>
                    </div>
                    <span className="rounded-full border border-[#3B2E15] bg-[#20180C] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-[#E7C976]">
                      Completed
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist/85">
                    <span>Target: {getTargetLabel(item.tracker, item.achievement.target, item.achievement.goalType)}</span>
                    <span>Started: {formatDate(item.achievement.startedDate)}</span>
                    <span>Completed: {formatDate(item.achievement.completedDate)}</span>
                    <span>Duration: {item.achievement.durationDays} days</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </ResponsiveGrid>

      <DetailDrawer
        open={Boolean(selectedGoal)}
        onClose={() => setSelectedGoal(null)}
        size="md"
        subtitle={selectedGoal ? `${selectedGoal.tracker.title} goal history` : 'Goal detail'}
        title={
          !selectedGoal
            ? 'Goal detail'
            : selectedGoal.kind === 'active'
              ? getTrackerGoalLabel(selectedGoal.tracker.goal) ?? 'Active goal'
              : getAchievementDetailLabel(selectedGoal.achievement)
        }
      >
        {selectedGoal ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Status</p>
                  <p className="mt-2 text-xl font-semibold text-white">{getGoalStatusLabel(selectedGoal)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getGoalAccentColor(selectedGoal) }} />
                  <span className="text-sm text-mist">{selectedGoal.tracker.title}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Goal snapshot</p>
                <div className="mt-3 space-y-2 text-sm text-mist">
                  <p>
                    <span className="text-white">Type:</span>{' '}
                    {selectedGoal.kind === 'active'
                      ? getTrackerGoalLabel(selectedGoal.tracker.goal)
                      : getAchievementDetailLabel(selectedGoal.achievement)}
                  </p>
                  <p>
                    <span className="text-white">Target:</span>{' '}
                    {selectedGoal.kind === 'active'
                      ? getTargetLabel(selectedGoal.tracker, selectedGoal.progress.target, selectedGoal.tracker.goal!.type)
                      : getTargetLabel(
                          selectedGoal.tracker,
                          selectedGoal.achievement.target,
                          selectedGoal.achievement.goalType,
                        )}
                  </p>
                  <p>
                    <span className="text-white">Start date:</span>{' '}
                    {formatDate(
                      selectedGoal.kind === 'active'
                        ? selectedGoal.progress.startDate
                        : selectedGoal.achievement.startedDate,
                    )}
                  </p>
                  {selectedGoal.kind === 'completed' ? (
                    <>
                      <p>
                        <span className="text-white">Completed:</span> {formatDate(selectedGoal.achievement.completedDate)}
                      </p>
                      <p>
                        <span className="text-white">Duration:</span> {selectedGoal.achievement.durationDays} days
                      </p>
                    </>
                  ) : (
                    <p>
                      <span className="text-white">Progress:</span> {selectedGoal.progress.progressText}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-mist/60">
                  {selectedGoal.kind === 'completed' ? 'Achievement' : 'Live progress'}
                </p>
                {selectedGoal.kind === 'completed' ? (
                  <div className="mt-3 space-y-2 text-sm text-mist">
                    <p className="text-[#E7C976]">Trophy earned and preserved in your goal history.</p>
                    <p>
                      <span className="text-white">Completion day:</span> {formatDate(selectedGoal.achievement.completedDate)}
                    </p>
                    <p>
                      <span className="text-white">History record:</span> {selectedGoal.achievement.id}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="flex h-2.5 gap-1.5">
                      {Array.from({ length: Math.max(selectedGoal.progress.target, 1) }, (_, index) => {
                        const isFilled = index < selectedGoal.progress.current
                        const isMissed = selectedGoal.progress.missed && index === 0 && !isFilled
                        return (
                          <div
                            key={index}
                            className={`h-full flex-1 rounded-full ${isMissed ? 'bg-[#8D3D37]' : !isFilled ? 'bg-[#262626]' : ''}`}
                            style={isFilled ? { backgroundColor: getGoalAccentColor(selectedGoal) } : undefined}
                          />
                        )
                      })}
                    </div>
                    <p className="mt-3 text-sm text-mist">
                      {selectedGoal.progress.scheduled
                        ? `This goal starts on ${formatDate(selectedGoal.progress.startDate)}.`
                        : selectedGoal.progress.completed
                          ? 'This goal is currently completed.'
                          : selectedGoal.progress.missed
                            ? 'The goal has been reset after a missed day.'
                            : 'Progress is tracked live from the goal start date.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Relevant completion dates</p>
              {selectedGoal.completionDates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedGoal.completionDates.slice(-18).map((date) => (
                    <span key={date} className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs text-mist">
                      {formatDate(date)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-mist">No qualifying completion dates recorded yet.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setSelectedGoal(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[36px] font-semibold tracking-[-0.02em] theme-text-primary">Serious goals, cleanly separated</h2>
          <p className="mt-3 max-w-[720px] text-sm leading-6 theme-text-muted">
            Life Goals stay focused on meaningful direction and next moves. Habit Goals stay available as a separate tracking layer.
          </p>
        </div>
        <div className="theme-surface-soft inline-flex rounded-full border p-1">
          {([
            ['life', 'Life Goals'],
            ['habit', 'Habit Goals'],
          ] as Array<[GoalsTab, string]>).map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              onClick={() => setActiveTab(tabId)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tabId
                  ? 'theme-button-secondary'
                  : 'theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'life' ? renderLifeGoalsTab() : renderHabitGoalsTab()}
    </div>
  )
}
