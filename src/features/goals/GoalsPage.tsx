import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

type GoalsView = 'life-overview' | 'life-detail' | 'habit-goals'
type LifeGoalDetailTab = 'focus' | 'moves' | 'why' | 'progress'
type LifeGoalComposerMode = 'create' | 'edit'

type LifeGoalDraftMove = {
  id: string
  text: string
  completed: boolean
  completedAt: string | null
}

type LifeGoalDraft = {
  title: string
  category: string
  whyItMatters: string
  minimumVersion: string
  startDate: string
  targetDate: string
  ifThenPlan: string
  status: LifeGoalStatus
  isPrimary: boolean
  moves: LifeGoalDraftMove[]
}

function createLifeGoalDraftMove(text = ''): LifeGoalDraftMove {
  return {
    id: `life-goal-draft-move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    completed: false,
    completedAt: null,
  }
}

function createEmptyLifeGoalDraft(): LifeGoalDraft {
  return {
    title: '',
    category: '',
    whyItMatters: '',
    minimumVersion: '',
    startDate: getTodayIsoDate(),
    targetDate: '',
    ifThenPlan: '',
    status: 'not-started',
    isPrimary: false,
    moves: [createLifeGoalDraftMove()],
  }
}

const LIFE_GOAL_CATEGORIES = ['Health', 'Career', 'Social', 'Finance', 'Home', 'Mind'] as const
const LIFE_GOAL_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function getCalendarMonthDate(date?: string) {
  if (date && isValidIsoDate(date)) {
    return new Date(`${date}T00:00:00Z`)
  }
  return new Date(`${getTodayIsoDate()}T00:00:00Z`)
}

function startOfCalendarMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function shiftCalendarMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

function formatCalendarMonthLabel(date: Date) {
  return date.toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getCalendarDays(date: Date) {
  const monthStart = startOfCalendarMonth(date)
  const startWeekday = (monthStart.getUTCDay() + 6) % 7
  const calendarStart = new Date(monthStart)
  calendarStart.setUTCDate(monthStart.getUTCDate() - startWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart)
    day.setUTCDate(calendarStart.getUTCDate() + index)
    return day
  })
}

function formatCalendarDayValue(date: Date) {
  return date.toISOString().slice(0, 10)
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

function isLifeGoalScheduled(status: LifeGoalStatus, startDate: string) {
  return status === 'not-started' && isValidIsoDate(startDate) && startDate > getTodayIsoDate()
}

function getLifeGoalStatusMeta(status: LifeGoalStatus, startDate = '') {
  if (isLifeGoalScheduled(status, startDate)) {
    return {
      label: 'Scheduled',
      badgeClassName:
        'border-[rgb(var(--theme-info-rgb)/0.16)] bg-[rgb(var(--theme-info-rgb)/0.08)] text-[rgb(var(--theme-info-rgb)/0.86)]',
    }
  }

  switch (status) {
    case 'not-started':
      return {
        label: 'Not Started',
        badgeClassName:
          'border-[rgb(var(--theme-border-subtle-rgb)/0.95)] bg-[rgb(var(--theme-surface-soft-rgb)/0.9)] text-[rgb(var(--theme-text-muted-rgb))]',
      }
    case 'complete':
      return {
        label: 'Complete',
        badgeClassName:
          'border-[rgb(var(--theme-accent-rgb)/0.26)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-[rgb(var(--theme-accent-rgb))]',
      }
    case 'paused':
      return {
        label: 'Paused',
        badgeClassName:
          'border-[rgb(var(--theme-border-subtle-rgb)/0.95)] bg-[rgb(var(--theme-surface-soft-rgb)/0.9)] text-[rgb(var(--theme-text-muted-rgb))]',
      }
    default:
      return {
        label: 'In Motion',
        badgeClassName:
          'border-[rgb(var(--theme-info-rgb)/0.24)] bg-[rgb(var(--theme-info-rgb)/0.11)] text-[rgb(var(--theme-info-rgb)/0.92)]',
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

function formatGoalCardTitle(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function normalizeLifeGoalDraftMoves(moves: LifeGoalDraftMove[]) {
  return moves
    .map((move) => {
      const text = move.text.trim()
      if (!text) return null
      return {
        id: move.id,
        text,
        completed: move.completed,
        completedAt: move.completed ? move.completedAt ?? new Date().toISOString() : null,
      }
    })
    .filter((move): move is LifeGoalDraftMove => move !== null)
}

function createLifeGoalDraftFromGoal(goal: LifeGoal): LifeGoalDraft {
  return {
    title: goal.title,
    category: goal.category,
    whyItMatters: goal.whyItMatters,
    minimumVersion: goal.minimumVersion,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    ifThenPlan: goal.ifThenPlan,
    status: goal.status,
    isPrimary: goal.isPrimary,
    moves:
      goal.moves.length > 0
        ? goal.moves.map((move) => ({
            id: move.id,
            text: move.text,
            completed: move.completed,
            completedAt: move.completedAt,
          }))
        : [createLifeGoalDraftMove()],
  }
}

function normalizeCategoryValue(category: string) {
  return category.trim().toLowerCase()
}

function getLifeGoalCategoryOptions(defaultCategories: readonly string[], usedCategories: string[]) {
  const seen = new Set<string>()
  const options: string[] = []

  for (const category of [...defaultCategories, ...usedCategories]) {
    const trimmed = category.trim()
    if (!trimmed) continue
    const normalized = normalizeCategoryValue(trimmed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    options.push(trimmed)
  }

  return options
}

function containScrollWithinElement(event: React.WheelEvent<HTMLDivElement>) {
  const container = event.currentTarget
  const { deltaY } = event

  if (deltaY === 0) return

  const atTop = container.scrollTop <= 0
  const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1
  const scrollingUp = deltaY < 0
  const scrollingDown = deltaY > 0

  if ((!atTop && !atBottom) || (atTop && scrollingDown) || (atBottom && scrollingUp)) {
    event.stopPropagation()
    return
  }

  event.preventDefault()
  event.stopPropagation()
}

type FloatingPanelPosition = {
  top: number
  left: number
  width: number
}

function getFloatingPanelPosition(
  anchor: HTMLElement,
  {
    minWidth = 0,
    preferredWidth,
    estimatedHeight,
  }: { minWidth?: number; preferredWidth?: number; estimatedHeight: number },
): FloatingPanelPosition {
  const rect = anchor.getBoundingClientRect()
  const viewportPadding = 16
  const gap = 8
  const width = Math.min(
    Math.max(preferredWidth ?? rect.width, minWidth, rect.width),
    window.innerWidth - viewportPadding * 2,
  )
  const left = Math.min(
    Math.max(viewportPadding, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - viewportPadding - width,
  )
  const showAbove = rect.bottom + gap + estimatedHeight > window.innerHeight - viewportPadding && rect.top - gap - estimatedHeight >= viewportPadding
  const top = showAbove ? rect.top - gap - estimatedHeight : rect.bottom + gap

  return { top, left, width }
}

function createLifeGoalFromDraft(draft: LifeGoalDraft): LifeGoal {
  const timestamp = new Date().toISOString()
  const moves = normalizeLifeGoalDraftMoves(draft.moves).map((move) => ({
    ...move,
    id: move.id.startsWith('life-goal-draft-move-')
      ? `life-goal-move-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      : move.id,
  }))
  return {
    id: `life-goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: draft.title.trim(),
    category: draft.category.trim(),
    whyItMatters: draft.whyItMatters.trim(),
    minimumVersion: draft.minimumVersion.trim(),
    ifThenPlan: draft.ifThenPlan.trim(),
    startDate: draft.startDate,
    targetDate: draft.targetDate,
    status: draft.status,
    isPrimary: draft.isPrimary,
    order: 0,
    moves,
    linkedHabitIds: [],
    archivedAt: null,
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
  return [...goals].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

const goalStatusChipClassName =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] leading-none'

export function GoalsPage({
  habitTrackers,
  lifeGoals,
  year,
  goalsView,
  selectedLifeGoalId,
  onSelectLifeGoal,
  onChangeGoalsView,
  onCreateHabitTracker,
  onCreateLifeGoal,
  onUpdateLifeGoal,
  onReorderLifeGoals,
  onSetPrimaryLifeGoal,
  onArchiveLifeGoal,
  onDeleteLifeGoal,
  onSetLifeGoalAsTodayTask,
}: {
  habitTrackers: HabitTracker[]
  lifeGoals: LifeGoal[]
  year: number
  goalsView: GoalsView
  selectedLifeGoalId: string | null
  onSelectLifeGoal: (goalId: string | null) => void
  onChangeGoalsView: (view: GoalsView) => void
  onCreateHabitTracker: (tracker: HabitTracker) => void
  onCreateLifeGoal: (goal: LifeGoal) => void
  onUpdateLifeGoal: (goalId: string, updater: (goal: LifeGoal) => LifeGoal) => void
  onReorderLifeGoals: (goalIds: string[]) => void
  onSetPrimaryLifeGoal: (goalId: string | null) => void
  onArchiveLifeGoal: (goalId: string) => void
  onDeleteLifeGoal: (goalId: string) => void
  onSetLifeGoalAsTodayTask: (goal: LifeGoal) => void
}) {
  const [selectedGoal, setSelectedGoal] = useState<GoalDetailItem | null>(null)
  const [lifeGoalDraft, setLifeGoalDraft] = useState<LifeGoalDraft>(() => createEmptyLifeGoalDraft())
  const [lifeGoalComposerMode, setLifeGoalComposerMode] = useState<LifeGoalComposerMode>('create')
  const [editingLifeGoalId, setEditingLifeGoalId] = useState<string | null>(null)
  const [lifeGoalComposerOpen, setLifeGoalComposerOpen] = useState(lifeGoals.length === 0)
  const [plannedMoveDraft, setPlannedMoveDraft] = useState('')
  const [lifeGoalActionFeedback, setLifeGoalActionFeedback] = useState<string | null>(null)
  const [linkHabitPickerOpen, setLinkHabitPickerOpen] = useState(false)
  const [habitDraftByMoveId, setHabitDraftByMoveId] = useState<Record<string, string>>({})
  const [lifeGoalDetailTab, setLifeGoalDetailTab] = useState<LifeGoalDetailTab>('focus')
  const [draggedLifeGoalId, setDraggedLifeGoalId] = useState<string | null>(null)
  const [dragOverLifeGoalId, setDragOverLifeGoalId] = useState<string | null>(null)
  const [lifeGoalCategoryFilter, setLifeGoalCategoryFilter] = useState<string>('all')
  const [lifeGoalCategoryMenuOpen, setLifeGoalCategoryMenuOpen] = useState(false)
  const [lifeGoalCategoryQuery, setLifeGoalCategoryQuery] = useState('')
  const [lifeGoalDatePickerOpen, setLifeGoalDatePickerOpen] = useState(false)
  const [lifeGoalActiveDateField, setLifeGoalActiveDateField] = useState<'startDate' | 'targetDate' | null>(null)
  const [lifeGoalStatusMenuOpen, setLifeGoalStatusMenuOpen] = useState(false)
  const [lifeGoalDateViewMonth, setLifeGoalDateViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate()))
  const [lifeGoalCategoryPanelPosition, setLifeGoalCategoryPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalDatePanelPosition, setLifeGoalDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalStatusPanelPosition, setLifeGoalStatusPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [deleteGoalConfirmationTarget, setDeleteGoalConfirmationTarget] = useState<{ goalId: string; context: 'edit' | 'detail' } | null>(null)
  const lifeGoalCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStartDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalCategoryPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDatePanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalTitleInputRef = useRef<HTMLInputElement | null>(null)
  const lifeGoalComposerTriggerRef = useRef<HTMLElement | null>(null)
  const lifeGoalComposerBodyRef = useRef<HTMLDivElement | null>(null)

  const sortedLifeGoals = useMemo(() => sortLifeGoals(lifeGoals.filter((goal) => !goal.archivedAt)), [lifeGoals])

  useEffect(() => {
    if (sortedLifeGoals.length === 0) {
      onSelectLifeGoal(null)
      setLifeGoalComposerMode('create')
      setEditingLifeGoalId(null)
      setLifeGoalDraft(createEmptyLifeGoalDraft())
      setLifeGoalComposerOpen(true)
      return
    }

    if (!selectedLifeGoalId || !sortedLifeGoals.some((goal) => goal.id === selectedLifeGoalId)) {
      onSelectLifeGoal(sortedLifeGoals[0].id)
    }
  }, [onSelectLifeGoal, selectedLifeGoalId, sortedLifeGoals])

  useEffect(() => {
    setLifeGoalDetailTab('focus')
    setLinkHabitPickerOpen(false)
  }, [selectedLifeGoalId])

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

  const draftMoves = useMemo(() => normalizeLifeGoalDraftMoves(lifeGoalDraft.moves), [lifeGoalDraft.moves])

  const handleSaveLifeGoal = () => {
    if (!lifeGoalDraft.title.trim() || !lifeGoalDraft.whyItMatters.trim() || !lifeGoalDraft.minimumVersion.trim() || draftMoves.length === 0) {
      return
    }

    if (lifeGoalComposerMode === 'edit' && editingLifeGoalId) {
      onUpdateLifeGoal(editingLifeGoalId, (goal) => ({
        ...goal,
        title: lifeGoalDraft.title.trim(),
        category: lifeGoalDraft.category.trim(),
        whyItMatters: lifeGoalDraft.whyItMatters.trim(),
        minimumVersion: lifeGoalDraft.minimumVersion.trim(),
        ifThenPlan: lifeGoalDraft.ifThenPlan.trim(),
        startDate: lifeGoalDraft.startDate,
        targetDate: lifeGoalDraft.targetDate,
        status: lifeGoalDraft.status,
        moves: draftMoves,
        updatedAt: new Date().toISOString(),
      }))
      if (lifeGoalDraft.isPrimary) {
        onSetPrimaryLifeGoal(editingLifeGoalId)
      } else if (selectedLifeGoal?.isPrimary) {
        onSetPrimaryLifeGoal(null)
      }
      closeLifeGoalComposer()
      return
    }

    const nextGoal = createLifeGoalFromDraft(lifeGoalDraft)
    onCreateLifeGoal(nextGoal)
    if (lifeGoalDraft.isPrimary) {
      onSetPrimaryLifeGoal(nextGoal.id)
    }
    onSelectLifeGoal(nextGoal.id)
    onChangeGoalsView('life-detail')
    setLifeGoalDraft(createEmptyLifeGoalDraft())
    setLifeGoalComposerMode('create')
    setEditingLifeGoalId(null)
    closeLifeGoalComposer()
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
    onUpdateLifeGoal(goalId, (goal) => {
      const updatedMoves = goal.moves.map((move) => {
        if (move.id !== moveId) return move
        const nextCompleted = !move.completed
        return {
          ...move,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        }
      })

      return {
        ...goal,
        moves: updatedMoves,
        updatedAt: new Date().toISOString(),
      }
    })
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

  const updateDraftMove = (moveId: string, updater: (move: LifeGoalDraftMove) => LifeGoalDraftMove) => {
    setLifeGoalDraft((current) => ({
      ...current,
      moves: current.moves.map((move) => (move.id === moveId ? updater(move) : move)),
    }))
  }

  const addDraftMove = () => {
    setLifeGoalDraft((current) => ({
      ...current,
      moves: [...current.moves, createLifeGoalDraftMove()],
    }))
  }

  const deleteDraftMove = (moveId: string) => {
    setLifeGoalDraft((current) => {
      const nextMoves = current.moves.filter((move) => move.id !== moveId)
      return {
        ...current,
        moves: nextMoves.length > 0 ? nextMoves : [createLifeGoalDraftMove()],
      }
    })
  }

  const moveDraftMove = (moveId: string, direction: 'up' | 'down') => {
    setLifeGoalDraft((current) => {
      const index = current.moves.findIndex((move) => move.id === moveId)
      if (index === -1) return current
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.moves.length) return current
      const nextMoves = [...current.moves]
      const [moved] = nextMoves.splice(index, 1)
      nextMoves.splice(targetIndex, 0, moved)
      return {
        ...current,
        moves: nextMoves,
      }
    })
  }

  const primaryOverviewGoalId = selectedLifeGoalId ?? sortedLifeGoals[0]?.id ?? null
  const explicitPrimaryGoalId = sortedLifeGoals.find((goal) => goal.isPrimary)?.id ?? null
  const featuredOverviewGoalId = explicitPrimaryGoalId ?? primaryOverviewGoalId
  const usedLifeGoalCategories = useMemo(
    () => Array.from(new Set(sortedLifeGoals.map((goal) => goal.category.trim()).filter(Boolean))),
    [sortedLifeGoals],
  )
  const lifeGoalCategoryOptions = useMemo(
    () => getLifeGoalCategoryOptions(LIFE_GOAL_CATEGORIES, usedLifeGoalCategories),
    [usedLifeGoalCategories],
  )
  const normalizedDraftCategory = normalizeCategoryValue(lifeGoalDraft.category)
  const normalizedCategoryQuery = normalizeCategoryValue(lifeGoalCategoryQuery)
  const filteredLifeGoalCategoryOptions = useMemo(() => {
    if (!normalizedCategoryQuery) return lifeGoalCategoryOptions
    return lifeGoalCategoryOptions.filter((category) => normalizeCategoryValue(category).includes(normalizedCategoryQuery))
  }, [lifeGoalCategoryOptions, normalizedCategoryQuery])
  const draftCategoryMatchesExisting = useMemo(
    () => lifeGoalCategoryOptions.some((category) => normalizeCategoryValue(category) === normalizedCategoryQuery),
    [lifeGoalCategoryOptions, normalizedCategoryQuery],
  )
  const visibleLifeGoals = useMemo(
    () =>
      lifeGoalCategoryFilter === 'all'
        ? sortedLifeGoals
        : sortedLifeGoals.filter((goal) => goal.category.trim() === lifeGoalCategoryFilter),
    [lifeGoalCategoryFilter, sortedLifeGoals],
  )

  useEffect(() => {
    if (lifeGoalCategoryFilter !== 'all' && !usedLifeGoalCategories.includes(lifeGoalCategoryFilter)) {
      setLifeGoalCategoryFilter('all')
    }
  }, [lifeGoalCategoryFilter, usedLifeGoalCategories])

  useEffect(() => {
    if (!lifeGoalCategoryMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!lifeGoalCategoryFieldRef.current?.contains(target) && !lifeGoalCategoryPanelRef.current?.contains(target)) {
        setLifeGoalCategoryMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalCategoryMenuOpen])

  useEffect(() => {
    if (!lifeGoalDatePickerOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const activeFieldRef =
        lifeGoalActiveDateField === 'startDate' ? lifeGoalStartDateFieldRef.current : lifeGoalDateFieldRef.current
      if (!activeFieldRef?.contains(target) && !lifeGoalDatePanelRef.current?.contains(target)) {
        setLifeGoalDatePickerOpen(false)
        setLifeGoalActiveDateField(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalActiveDateField, lifeGoalDatePickerOpen])

  useEffect(() => {
    if (!lifeGoalStatusMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!lifeGoalStatusFieldRef.current?.contains(target) && !lifeGoalStatusPanelRef.current?.contains(target)) {
        setLifeGoalStatusMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalStatusMenuOpen])

  useEffect(() => {
    if (!lifeGoalComposerOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalDatePickerOpen(false)
    setLifeGoalActiveDateField(null)
    setLifeGoalStatusMenuOpen(false)

    const frame = requestAnimationFrame(() => {
      lifeGoalTitleInputRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLifeGoalComposer()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [lifeGoalComposerOpen])

  useEffect(() => {
    if (!lifeGoalCategoryMenuOpen || !lifeGoalCategoryFieldRef.current) return

    const updatePosition = () => {
      if (!lifeGoalCategoryFieldRef.current) return
      setLifeGoalCategoryPanelPosition(
        getFloatingPanelPosition(lifeGoalCategoryFieldRef.current, {
          preferredWidth: lifeGoalCategoryFieldRef.current.getBoundingClientRect().width,
          estimatedHeight: 280,
        }),
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [lifeGoalCategoryMenuOpen])

  useEffect(() => {
    const activeFieldRef =
      lifeGoalActiveDateField === 'startDate' ? lifeGoalStartDateFieldRef.current : lifeGoalDateFieldRef.current
    if (!lifeGoalDatePickerOpen || !activeFieldRef) return

    const updatePosition = () => {
      const currentActiveFieldRef =
        lifeGoalActiveDateField === 'startDate' ? lifeGoalStartDateFieldRef.current : lifeGoalDateFieldRef.current
      if (!currentActiveFieldRef) return
      setLifeGoalDatePanelPosition(
        getFloatingPanelPosition(currentActiveFieldRef, {
          minWidth: 320,
          preferredWidth: 348,
          estimatedHeight: 360,
        }),
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [lifeGoalActiveDateField, lifeGoalDatePickerOpen])

  useEffect(() => {
    if (!lifeGoalStatusMenuOpen || !lifeGoalStatusFieldRef.current) return

    const updatePosition = () => {
      if (!lifeGoalStatusFieldRef.current) return
      setLifeGoalStatusPanelPosition(
        getFloatingPanelPosition(lifeGoalStatusFieldRef.current, {
          preferredWidth: lifeGoalStatusFieldRef.current.getBoundingClientRect().width,
          estimatedHeight: 216,
        }),
      )
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [lifeGoalStatusMenuOpen])

  const applyLifeGoalCategory = (category: string) => {
    setLifeGoalDraft((current) => ({ ...current, category }))
    setLifeGoalCategoryQuery('')
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalCategoryPanelPosition(null)
  }

  const applyLifeGoalStatus = (status: LifeGoalStatus) => {
    setLifeGoalDraft((current) => ({ ...current, status }))
    setLifeGoalStatusMenuOpen(false)
    setLifeGoalStatusPanelPosition(null)
  }

  const openLifeGoalCategoryMenu = () => {
    setLifeGoalCategoryQuery('')
    setLifeGoalCategoryMenuOpen(true)
  }

  const openLifeGoalDatePicker = (field: 'startDate' | 'targetDate') => {
    setLifeGoalActiveDateField(field)
    setLifeGoalDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(lifeGoalDraft[field])))
    setLifeGoalDatePickerOpen(true)
  }

  const openLifeGoalComposer = (opener?: HTMLElement | null) => {
    lifeGoalComposerTriggerRef.current = opener ?? null
    setLifeGoalActionFeedback(null)
    setLifeGoalComposerMode('create')
    setEditingLifeGoalId(null)
    setLifeGoalComposerOpen(true)
  }

  const openEditLifeGoalComposer = (goal: LifeGoal, opener?: HTMLElement | null) => {
    lifeGoalComposerTriggerRef.current = opener ?? null
    setLifeGoalActionFeedback(null)
    setLifeGoalComposerMode('edit')
    setEditingLifeGoalId(goal.id)
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal))
    setLifeGoalComposerOpen(true)
  }

  const closeLifeGoalComposer = () => {
    setLifeGoalComposerOpen(false)
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalCategoryQuery('')
    setLifeGoalDatePickerOpen(false)
    setLifeGoalActiveDateField(null)
    setLifeGoalStatusMenuOpen(false)
    setLifeGoalCategoryPanelPosition(null)
    setLifeGoalDatePanelPosition(null)
    setLifeGoalStatusPanelPosition(null)
    setEditingLifeGoalId(null)

    const trigger = lifeGoalComposerTriggerRef.current
    if (trigger) {
      requestAnimationFrame(() => {
        trigger.focus()
      })
    }
  }

  const requestDeleteLifeGoal = (goalId: string, context: 'edit' | 'detail') => {
    setDeleteGoalConfirmationTarget({ goalId, context })
  }

  const confirmDeleteLifeGoal = () => {
    if (!deleteGoalConfirmationTarget) return
    const { goalId, context } = deleteGoalConfirmationTarget
    onDeleteLifeGoal(goalId)
    if (selectedLifeGoalId === goalId) {
      onChangeGoalsView('life-overview')
    }
    if (context === 'edit') {
      closeLifeGoalComposer()
    }
    setDeleteGoalConfirmationTarget(null)
  }

  const applyLifeGoalDate = (date: string) => {
    if (!lifeGoalActiveDateField) return
    const nextDate = lifeGoalActiveDateField === 'startDate' && !date ? getTodayIsoDate() : date
    setLifeGoalDraft((current) => ({ ...current, [lifeGoalActiveDateField]: nextDate }))
    if (nextDate && isValidIsoDate(nextDate)) {
      setLifeGoalDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(nextDate)))
    }
    setLifeGoalDatePickerOpen(false)
    setLifeGoalActiveDateField(null)
    setLifeGoalDatePanelPosition(null)
  }

  const renderLifeGoalComposer = () => (
    <div className="space-y-5">
      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="theme-label">Title</span>
          <input
            ref={lifeGoalTitleInputRef}
            value={lifeGoalDraft.title}
            onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Build Life OS v1"
            className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
          />
        </label>
        <label className="space-y-2">
          <span className="theme-label">Why it matters</span>
          <textarea
            value={lifeGoalDraft.whyItMatters}
            onChange={(event) => setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))}
            placeholder="This matters because..."
            className="theme-input min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="theme-label">Next move</span>
            <input
              value={lifeGoalDraft.moves[0]?.text ?? ''}
              onChange={(event) =>
                setLifeGoalDraft((current) => {
                  const nextMoves = current.moves.length > 0 ? [...current.moves] : [createLifeGoalDraftMove()]
                  nextMoves[0] = {
                    ...(nextMoves[0] ?? createLifeGoalDraftMove()),
                    text: event.target.value,
                  }
                  return {
                    ...current,
                    moves: nextMoves,
                  }
                })
              }
              placeholder="Draft the first working version"
              className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="theme-label">Minimum version</span>
            <input
              value={lifeGoalDraft.minimumVersion}
              onChange={(event) => setLifeGoalDraft((current) => ({ ...current, minimumVersion: event.target.value }))}
              placeholder="Write the first rough outline"
              className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="theme-label">Primary goal</span>
            <button
              type="button"
              onClick={() => setLifeGoalDraft((current) => ({ ...current, isPrimary: !current.isPrimary }))}
              className={`theme-input flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                lifeGoalDraft.isPrimary ? 'theme-text-primary' : 'theme-text-secondary'
              }`}
            >
              <span>{lifeGoalDraft.isPrimary ? 'This is the primary goal' : 'Keep as a secondary goal'}</span>
              <span className="theme-text-faint text-xs uppercase tracking-[0.14em]">
                {lifeGoalDraft.isPrimary ? 'Primary' : 'Optional'}
              </span>
            </button>
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <span className="theme-label">Category</span>
            <div ref={lifeGoalCategoryFieldRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (lifeGoalCategoryMenuOpen) {
                    setLifeGoalCategoryMenuOpen(false)
                    return
                  }
                  openLifeGoalCategoryMenu()
                }}
                className="theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition"
              >
                <span className={lifeGoalDraft.category ? 'theme-text-primary' : 'theme-text-muted'}>
                  {lifeGoalDraft.category || 'Choose or type a category'}
                </span>
                <span className="theme-text-faint text-xs">▾</span>
              </button>

              {lifeGoalCategoryMenuOpen && lifeGoalCategoryPanelPosition && typeof document !== 'undefined'
                ? createPortal(
                <div
                  ref={lifeGoalCategoryPanelRef}
                  className="theme-popover fixed z-[80] overflow-hidden rounded-[22px] border shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                  style={{
                    top: `${lifeGoalCategoryPanelPosition.top}px`,
                    left: `${lifeGoalCategoryPanelPosition.left}px`,
                    width: `${lifeGoalCategoryPanelPosition.width}px`,
                  }}
                >
                  <div className="max-h-[260px] overflow-y-auto overscroll-contain p-2" onWheel={containScrollWithinElement}>
                    <div className="mb-2">
                      <input
                        value={lifeGoalCategoryQuery}
                        onChange={(event) => setLifeGoalCategoryQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setLifeGoalCategoryMenuOpen(false)
                          }
                          if (event.key === 'Enter' && lifeGoalCategoryQuery.trim()) {
                            event.preventDefault()
                            applyLifeGoalCategory(lifeGoalCategoryQuery.trim())
                          }
                        }}
                        placeholder="Choose or type a category"
                        className="theme-input w-full rounded-2xl border px-3 py-2.5 text-sm outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => applyLifeGoalCategory('')}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                        !lifeGoalDraft.category
                          ? 'theme-button-secondary theme-text-primary'
                          : 'theme-text-secondary hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                      }`}
                    >
                      <span>No category</span>
                      <span className="theme-text-faint text-[11px]">Optional</span>
                    </button>

                    {lifeGoalCategoryQuery.trim() && !draftCategoryMatchesExisting ? (
                      <button
                        type="button"
                        onClick={() => applyLifeGoalCategory(lifeGoalCategoryQuery.trim())}
                        className="flex w-full items-center justify-between rounded-2xl border border-[rgb(var(--theme-border-subtle-rgb)/0.72)] bg-[rgb(var(--theme-surface-soft-rgb)/0.45)] px-3 py-2.5 text-left text-sm transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-elevated-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                      >
                        <div className="min-w-0">
                          <span className="block">{`+ Add "${lifeGoalCategoryQuery.trim()}"`}</span>
                          <span className="theme-text-faint mt-1 block text-[11px]">Create a custom category inline</span>
                        </div>
                        <span className="theme-text-faint shrink-0 text-[11px]">Custom</span>
                      </button>
                    ) : null}

                    {filteredLifeGoalCategoryOptions.map((category) => {
                      const active = normalizeCategoryValue(category) === normalizedDraftCategory
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => applyLifeGoalCategory(category)}
                          className={`mt-1 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                            active
                              ? 'theme-button-secondary theme-text-primary'
                              : 'theme-text-secondary hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                          }`}
                        >
                          <span>{category}</span>
                          {usedLifeGoalCategories.includes(category) ? (
                            <span className="theme-text-faint text-[11px]">Used</span>
                          ) : (
                            <span className="theme-text-faint text-[11px]">Suggested</span>
                          )}
                        </button>
                      )
                    })}

                    {filteredLifeGoalCategoryOptions.length === 0 && !lifeGoalCategoryQuery.trim() ? (
                      <p className="theme-text-muted px-3 py-2.5 text-sm">No categories yet.</p>
                    ) : null}
                  </div>
                </div>,
                document.body,
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <span className="theme-label">Start date</span>
            <div ref={lifeGoalStartDateFieldRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (lifeGoalDatePickerOpen && lifeGoalActiveDateField === 'startDate') {
                    setLifeGoalDatePickerOpen(false)
                    setLifeGoalActiveDateField(null)
                    return
                  }
                  openLifeGoalDatePicker('startDate')
                }}
                className="theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition"
              >
                <span className={lifeGoalDraft.startDate ? 'theme-text-primary' : 'theme-text-muted'}>
                  {lifeGoalDraft.startDate ? formatDate(lifeGoalDraft.startDate) : 'Start today'}
                </span>
                <span className="theme-text-faint text-xs">▾</span>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <span className="theme-label">Target date</span>
            <div ref={lifeGoalDateFieldRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (lifeGoalDatePickerOpen && lifeGoalActiveDateField === 'targetDate') {
                    setLifeGoalDatePickerOpen(false)
                    setLifeGoalActiveDateField(null)
                    return
                  }
                  openLifeGoalDatePicker('targetDate')
                }}
                className="theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition"
              >
                <span className={lifeGoalDraft.targetDate ? 'theme-text-primary' : 'theme-text-muted'}>
                  {lifeGoalDraft.targetDate ? formatDate(lifeGoalDraft.targetDate) : 'Optional deadline'}
                </span>
                <span className="theme-text-faint text-xs">▾</span>
              </button>

              {lifeGoalDatePickerOpen && lifeGoalDatePanelPosition && typeof document !== 'undefined'
                ? createPortal(
                <div
                  ref={lifeGoalDatePanelRef}
                  className="theme-popover fixed z-[80] overflow-hidden rounded-[24px] border p-3 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
                  style={{
                    top: `${lifeGoalDatePanelPosition.top}px`,
                    left: `${lifeGoalDatePanelPosition.left}px`,
                    width: `${lifeGoalDatePanelPosition.width}px`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                      className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Prev
                    </button>
                    <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(lifeGoalDateViewMonth)}</p>
                    <button
                      type="button"
                      onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, 1))}
                      className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Next
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {LIFE_GOAL_WEEKDAY_LABELS.map((day) => (
                      <div key={day} className="theme-text-faint px-1 py-1 text-center text-[11px] uppercase tracking-[0.12em]">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="mt-1 grid grid-cols-7 gap-1.5">
                    {getCalendarDays(lifeGoalDateViewMonth).map((day) => {
                      const dayValue = formatCalendarDayValue(day)
                      const inCurrentMonth = day.getUTCMonth() === lifeGoalDateViewMonth.getUTCMonth()
                      const activeDateValue = lifeGoalActiveDateField ? lifeGoalDraft[lifeGoalActiveDateField] : ''
                      const isSelected = dayValue === activeDateValue
                      const isToday = dayValue === getTodayIsoDate()

                      return (
                        <button
                          key={dayValue}
                          type="button"
                          onClick={() => applyLifeGoalDate(dayValue)}
                          className={`rounded-2xl border px-0 py-2 text-center text-sm transition ${
                            isSelected
                              ? 'border-[rgb(var(--theme-info-rgb)/0.28)] bg-[rgb(var(--theme-info-rgb)/0.12)] text-[rgb(var(--theme-text-primary-rgb))]'
                              : isToday
                                ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-soft-rgb))] text-[rgb(var(--theme-text-primary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                                : inCurrentMonth
                                  ? 'border-[rgb(var(--theme-border-subtle-rgb)/0.75)] bg-transparent text-[rgb(var(--theme-text-secondary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                                  : 'border-transparent bg-transparent text-[rgb(var(--theme-text-faint-rgb))] hover:border-[rgb(var(--theme-border-subtle-rgb)/0.55)] hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.6)]'
                          }`}
                        >
                          {day.getUTCDate()}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] pt-3">
                    <button
                      type="button"
                      onClick={() => applyLifeGoalDate(getTodayIsoDate())}
                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Today
                    </button>
                    <div className="flex items-center gap-2">
                      {lifeGoalActiveDateField === 'targetDate' ? (
                        <button
                          type="button"
                          onClick={() => applyLifeGoalDate('')}
                          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Clear
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setLifeGoalDatePickerOpen(false)
                          setLifeGoalActiveDateField(null)
                        }}
                        className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <span className="theme-label">Status</span>
            <div ref={lifeGoalStatusFieldRef} className="relative">
              <button
                type="button"
                onClick={() => setLifeGoalStatusMenuOpen((current) => !current)}
                className="theme-input flex w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition"
              >
                <span className={`${goalStatusChipClassName} px-2.5 py-1 text-[10px] ${getLifeGoalStatusMeta(lifeGoalDraft.status).badgeClassName}`}>
                  {getLifeGoalStatusMeta(lifeGoalDraft.status).label}
                </span>
                <span className="theme-text-faint text-xs">▾</span>
              </button>

              {lifeGoalStatusMenuOpen && lifeGoalStatusPanelPosition && typeof document !== 'undefined'
                ? createPortal(
                <div
                  ref={lifeGoalStatusPanelRef}
                  className="theme-popover fixed z-[80] overflow-hidden rounded-[22px] border shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                  style={{
                    top: `${lifeGoalStatusPanelPosition.top}px`,
                    left: `${lifeGoalStatusPanelPosition.left}px`,
                    width: `${lifeGoalStatusPanelPosition.width}px`,
                  }}
                >
                  <div className="p-2">
                    <div className="flex flex-col items-start gap-2">
                    {(['not-started', 'in-motion', 'paused', 'complete'] as LifeGoalStatus[]).map((status) => {
                      const active = lifeGoalDraft.status === status
                      const meta = getLifeGoalStatusMeta(status)
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => applyLifeGoalStatus(status)}
                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] leading-none transition ${
                            active
                              ? 'theme-button-secondary theme-text-primary'
                              : `${meta.badgeClassName} hover:border-[rgb(var(--theme-border-strong-rgb))]`
                          }`}
                        >
                          {meta.label}
                        </button>
                      )
                    })}
                    </div>
                  </div>
                </div>,
                document.body,
              ) : null}
            </div>
          </div>
        </div>
        <label className="space-y-2">
          <span className="theme-label">If-Then plan</span>
          <textarea
            value={lifeGoalDraft.ifThenPlan}
            onChange={(event) => setLifeGoalDraft((current) => ({ ...current, ifThenPlan: event.target.value }))}
            placeholder="If I stall, then I..."
            className="theme-input min-h-[90px] w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none"
          />
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="theme-label">Moves</span>
            <Button variant="ghost" onClick={addDraftMove}>
              Add move
            </Button>
          </div>

          <div className="space-y-2">
            {lifeGoalDraft.moves.map((move, index) => (
              <div key={move.id} className="theme-surface-soft rounded-2xl border px-3.5 py-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraftMove(move.id, (current) => ({
                        ...current,
                        completed: !current.completed,
                        completedAt: !current.completed ? current.completedAt ?? new Date().toISOString() : null,
                      }))
                    }
                    className={`mt-1 h-4 w-4 rounded-full border transition ${
                      move.completed
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.34)] bg-[rgb(var(--theme-accent-rgb)/0.18)]'
                        : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-transparent'
                    }`}
                    aria-label={move.completed ? 'Mark move incomplete' : 'Mark move complete'}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={move.text}
                      onChange={(event) => updateDraftMove(move.id, (current) => ({ ...current, text: event.target.value }))}
                      placeholder={index === 0 ? 'Next move' : 'Planned move'}
                      className="w-full bg-transparent text-sm text-[rgb(var(--theme-text-primary-rgb))] outline-none placeholder:text-[rgb(var(--theme-text-muted-rgb))]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="theme-text-faint text-[11px] uppercase tracking-[0.14em]">
                        {move.completed ? 'Completed move' : index === 0 ? 'Next move' : 'Planned move'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveDraftMove(move.id, 'up')}
                          disabled={index === 0}
                          className="theme-text-muted text-xs transition disabled:opacity-30"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDraftMove(move.id, 'down')}
                          disabled={index === lifeGoalDraft.moves.length - 1}
                          className="theme-text-muted text-xs transition disabled:opacity-30"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDraftMove(move.id)}
                          className="theme-text-muted text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {lifeGoalComposerMode === 'edit' && editingLifeGoalId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] pt-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (!window.confirm('Archive this goal? It will be removed from the active Life Goals workspace.')) return
                onArchiveLifeGoal(editingLifeGoalId)
                if (selectedLifeGoalId === editingLifeGoalId) {
                  onChangeGoalsView('life-overview')
                }
                closeLifeGoalComposer()
              }}
            >
              Archive Goal
            </Button>
            <Button
              variant="ghost"
              className="theme-danger-soft"
              onClick={() => {
                requestDeleteLifeGoal(editingLifeGoalId, 'edit')
              }}
            >
              Delete Goal
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={closeLifeGoalComposer}>
          Cancel
        </Button>
        <Button variant="soft" onClick={handleSaveLifeGoal}>
          {lifeGoalComposerMode === 'edit' ? 'Save Changes' : 'Create Life Goal'}
        </Button>
      </div>
    </div>
  )

const renderLifeGoalOverviewPage = () => (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="theme-body-secondary">Choose what deserves your focus next</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="theme-surface-soft theme-text-muted rounded-full border px-2.5 py-1 text-[11px]">
            {sortedLifeGoals.length} total
          </span>
          <Button
            variant="soft"
            className="border-[rgb(var(--theme-border-strong-rgb))] bg-[linear-gradient(180deg,rgb(var(--theme-surface-elevated-rgb))_0%,rgb(var(--theme-surface-soft-rgb))_100%)] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.02em] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.24),inset_0_-1px_0_rgb(0_0_0_/_0.1),0_0_0_1px_rgb(255_255_255_/_0.08),0_8px_18px_rgb(15_23_42_/_0.12)]"
            style={{
              borderColor: 'rgb(var(--theme-border-strong-rgb))',
              boxShadow:
                'inset 0 1px 0 rgb(255 255 255 / 0.24), inset 0 -1px 0 rgb(0 0 0 / 0.1), 0 0 0 1px rgb(255 255 255 / 0.08), 0 8px 18px rgb(15 23 42 / 0.12)',
            }}
            onClick={(event) => {
              openLifeGoalComposer(event.currentTarget)
              setLifeGoalDraft(createEmptyLifeGoalDraft())
            }}
          >
            Create Goal
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['all', ...usedLifeGoalCategories].map((category) => {
          const active = lifeGoalCategoryFilter === category
          return (
            <button
              key={category}
              type="button"
              onClick={() => setLifeGoalCategoryFilter(category)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'theme-button-secondary theme-text-primary'
                  : 'theme-surface-soft theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))]'
              }`}
            >
              {category === 'all' ? 'All' : category}
            </button>
          )
        })}
      </div>

      {sortedLifeGoals.length === 0 && !lifeGoalComposerOpen ? (
        <div className="theme-surface-soft rounded-[24px] border px-5 py-5">
          <p className="theme-body-primary">No life goals yet</p>
          <p className="theme-body-secondary mt-2">Create one meaningful direction to start using the workspace.</p>
        </div>
      ) : null}

      {visibleLifeGoals.length > 0 ? (
        <div className="space-y-2">
          {visibleLifeGoals.map((goal) => {
            const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
            const progress = getLifeGoalProgress(goal)
            const whyPreview = getLifeGoalAnchorText(goal.whyItMatters)
            const isPrimary = goal.id === featuredOverviewGoalId
            const progressSummary = `${progress.completedMoves}/${Math.max(progress.totalMoves, 1)} moves`
            const dateSummary = goal.targetDate
              ? formatDate(goal.targetDate)
              : isLifeGoalScheduled(goal.status, goal.startDate)
                ? `Starts ${formatDate(goal.startDate)}`
                : null
            return (
              <button
                key={goal.id}
                type="button"
                draggable
                onDragStart={() => {
                  setDraggedLifeGoalId(goal.id)
                  setDragOverLifeGoalId(goal.id)
                }}
                onDragEnd={() => {
                  setDraggedLifeGoalId(null)
                  setDragOverLifeGoalId(null)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (dragOverLifeGoalId !== goal.id) {
                    setDragOverLifeGoalId(goal.id)
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!draggedLifeGoalId || draggedLifeGoalId === goal.id) {
                    setDraggedLifeGoalId(null)
                    setDragOverLifeGoalId(null)
                    return
                  }
                  const nextVisibleOrder = [...visibleLifeGoals]
                  const fromIndex = nextVisibleOrder.findIndex((item) => item.id === draggedLifeGoalId)
                  const toIndex = nextVisibleOrder.findIndex((item) => item.id === goal.id)
                  if (fromIndex === -1 || toIndex === -1) return
                  const [moved] = nextVisibleOrder.splice(fromIndex, 1)
                  nextVisibleOrder.splice(toIndex, 0, moved)

                  const reorderedVisibleIds = nextVisibleOrder.map((item) => item.id)
                  let visibleCursor = 0
                  const nextFullOrder = sortedLifeGoals.map((item) =>
                    reorderedVisibleIds.includes(item.id)
                      ? nextVisibleOrder[visibleCursor++]
                      : item,
                  )
                  onReorderLifeGoals(nextFullOrder.map((item) => item.id))
                  setDraggedLifeGoalId(null)
                  setDragOverLifeGoalId(null)
                }}
                onClick={() => {
                  onSelectLifeGoal(goal.id)
                  setLifeGoalComposerOpen(false)
                  setLifeGoalActionFeedback(null)
                  onChangeGoalsView('life-detail')
                }}
                className={`relative block w-full overflow-hidden rounded-[26px] border px-5 pt-4 pb-[15px] text-left transition-transform duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.995] ${
                  isPrimary
                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-elevated-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06),0_0_0_1px_rgb(var(--theme-border-strong-rgb)/0.16)] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                    : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_0_0_1px_rgb(var(--theme-border-subtle-rgb)/0.14)] hover:border-[rgb(var(--theme-border-strong-rgb)/0.88)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.56)]'
                } ${draggedLifeGoalId === goal.id ? 'opacity-60' : ''} ${dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id ? 'border-[rgb(var(--theme-info-rgb)/0.62)]' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-4 bottom-4 rounded-full ${
                    isPrimary
                      ? 'w-[3px] bg-[rgb(var(--theme-accent-rgb)/0.72)]'
                      : 'w-[2px] bg-[rgb(var(--theme-border-strong-rgb)/0.52)]'
                  }`}
                />

                <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.55fr)_190px] md:gap-5">
                  <div className="min-w-0 pl-3">
                    <h4 className="theme-text-primary text-[23px] font-[650] leading-[1.08] tracking-[-0.03em]">
                      {formatGoalCardTitle(goal.title)}
                    </h4>
                    {goal.category ? <p className="theme-text-faint mt-1 text-[12px] uppercase tracking-[0.14em]">{goal.category}</p> : null}
                    {whyPreview ? <p className="theme-body-secondary mt-2 max-w-[760px]">{whyPreview}</p> : null}

                    <div className="mt-3">
                      <p className={`text-[14px] leading-6 ${isPrimary ? 'theme-text-primary font-medium' : 'theme-text-secondary'}`}>
                        <span className="theme-text-muted mr-1">Next:</span>
                        {progress.nextMove?.text ?? 'No next move currently planned.'}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 md:border-l md:border-[rgb(var(--theme-border-subtle-rgb)/0.6)] md:pl-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {goal.isPrimary ? (
                          <span className="theme-surface-soft theme-text-primary inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none">
                            Primary Goal
                          </span>
                        ) : null}
                        <span className={`${goalStatusChipClassName} shrink-0 px-2.5 py-1 text-[10px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-right">
                      <p className="theme-body-secondary">
                        {progressSummary}
                        {dateSummary ? ` · ${dateSummary}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : sortedLifeGoals.length > 0 ? (
        <div className="theme-surface-soft rounded-[24px] border px-5 py-5">
          <p className="theme-body-primary">No goals in this category</p>
          <p className="theme-body-secondary mt-2">Switch back to All or choose a different life area.</p>
        </div>
      ) : null}
    </div>
  )

  const renderLifeGoalDetailPage = () =>
    selectedLifeGoal && selectedLifeGoalProgress ? (
      <div className="mx-auto max-w-[1160px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChangeGoalsView('life-overview')}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to Life Goals
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
            <Button
              variant="ghost"
              onClick={(event) => {
                openLifeGoalComposer(event.currentTarget)
                setLifeGoalDraft(createEmptyLifeGoalDraft())
              }}
            >
              New goal
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-[760px]">
                  <p className="theme-section-title">Selected goal</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="theme-page-title">{selectedLifeGoal.title}</h3>
                    {selectedLifeGoal.isPrimary ? (
                      <span className="theme-surface-soft theme-text-primary inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none">
                        Primary Goal
                      </span>
                    ) : null}
                    {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate) ? (
                      <span
                        className={`${goalStatusChipClassName} px-2.5 py-1 text-[10px] ${getLifeGoalStatusMeta(
                          selectedLifeGoal.status,
                          selectedLifeGoal.startDate,
                        ).badgeClassName}`}
                      >
                        Scheduled
                      </span>
                    ) : null}
                  </div>
                  {getLifeGoalAnchorText(selectedLifeGoal.whyItMatters) ? (
                    <p className="mt-2 max-w-[680px] text-sm leading-6 text-white/62">
                      {getLifeGoalAnchorText(selectedLifeGoal.whyItMatters)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={selectedLifeGoal.isPrimary ? 'soft' : 'ghost'}
                    onClick={() => onSetPrimaryLifeGoal(selectedLifeGoal.isPrimary ? null : selectedLifeGoal.id)}
                  >
                    {selectedLifeGoal.isPrimary ? 'Clear Primary' : 'Mark Primary'}
                  </Button>
                  {(['not-started', 'in-motion', 'paused', 'complete'] as LifeGoalStatus[]).map((status) => {
                    const meta = getLifeGoalStatusMeta(status)
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateLifeGoalStatus(selectedLifeGoal.id, status)}
                        className={`${goalStatusChipClassName} transition ${
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

              <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <div className="space-y-4 rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Next move</p>
                    <p className="mt-3 text-[24px] font-semibold leading-[1.38] text-white">
                      {selectedLifeGoalProgress.nextMove?.text ?? 'No next move currently planned.'}
                    </p>
                  </div>
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

                <div className="grid gap-4">
                  <div className="rounded-[22px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Progress</p>
                    <div className="mt-3 flex items-start justify-between gap-3">
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
                      {selectedLifeGoal.startDate || selectedLifeGoal.targetDate ? (
                        <div className="text-right text-sm text-mist">
                          <p className="uppercase tracking-[0.16em] text-mist/62">Dates</p>
                          <div className="mt-1 space-y-1 text-white/72">
                            <p>Start: {formatDate(selectedLifeGoal.startDate)}</p>
                            {selectedLifeGoal.targetDate ? <p>Target: {formatDate(selectedLifeGoal.targetDate)}</p> : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-4 h-1.5 rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[#5F8F4E]"
                        style={{ width: `${Math.max(selectedLifeGoalProgress.percent, selectedLifeGoal.status === 'complete' ? 100 : 6)}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/62">Workspace note</p>
                    <p className="mt-2 text-sm leading-6 text-mist">
                      Keep this move small enough to start today. The deeper planning stays below so this surface keeps driving action.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="theme-section-title">Goal detail</p>
                  <p className="mt-1 text-sm text-mist">Supporting detail stays close, but secondary to the main goal workspace above.</p>
                </div>
                <div className="theme-surface-soft inline-flex rounded-full border p-1">
                  {([
                    ['focus', 'Focus'],
                    ['moves', 'Moves'],
                    ['why', 'Why'],
                    ['progress', 'Progress'],
                  ] as Array<[LifeGoalDetailTab, string]>).map(([tabId, label]) => (
                    <button
                      key={tabId}
                      type="button"
                      onClick={() => setLifeGoalDetailTab(tabId)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        lifeGoalDetailTab === tabId
                          ? 'theme-button-secondary'
                          : 'theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {lifeGoalDetailTab === 'focus' ? (
              <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/62">Minimum version</p>
                  <p className="mt-2 text-sm leading-6 text-white/76">{selectedLifeGoal.minimumVersion}</p>
                </div>
                {selectedLifeGoal.ifThenPlan ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/62">If-Then plan</p>
                    <p className="mt-2 text-sm leading-6 text-white/72">{selectedLifeGoal.ifThenPlan}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {lifeGoalDetailTab === 'moves' ? (
              <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Moves</p>
                    <p className="mt-1 text-sm text-mist">Keep the next steps visible and mark them honestly.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
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
                          className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                        >
                          <span className="text-sm leading-6 text-white/78">{move.text}</span>
                          <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-mist/72">
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
              </div>
            ) : null}

            {lifeGoalDetailTab === 'why' ? (
              <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Why it matters</p>
                <p className="mt-3 max-w-[760px] text-sm leading-7 text-white/86">{selectedLifeGoal.whyItMatters}</p>
              </div>
            ) : null}

            {lifeGoalDetailTab === 'progress' ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Supporting habits</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-mist">Recurring support systems linked to this goal.</p>
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

                <div className="flex justify-end border-t border-white/[0.05] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      requestDeleteLifeGoal(selectedLifeGoal.id, 'detail')
                    }}
                    className="theme-danger-soft rounded-2xl border px-3 py-2 text-sm transition"
                  >
                    Delete goal
                  </button>
                </div>
              </div>
            ) : null}
        </div>
      </div>
    ) : (
      renderLifeGoalOverviewPage()
    )

  const renderHabitGoalsTab = () => (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3">
        <div>
          <p className="theme-section-title">Habit goals</p>
          <h3 className="theme-page-title mt-2">Active targets and completed wins</h3>
        </div>
        <Button variant="ghost" onClick={() => onChangeGoalsView('life-overview')}>
          Life Goals
        </Button>
      </div>
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
    </div>
  )

  return (
    <div className="space-y-4">
      {goalsView === 'habit-goals'
        ? renderHabitGoalsTab()
        : goalsView === 'life-detail'
          ? renderLifeGoalDetailPage()
          : renderLifeGoalOverviewPage()}

      <DetailDrawer
        open={lifeGoalComposerOpen}
        onClose={closeLifeGoalComposer}
        size="lg"
        subtitle={lifeGoalComposerMode === 'edit' ? 'Edit life goal' : 'New life goal'}
        title={lifeGoalComposerMode === 'edit' ? 'Refine the goal without losing momentum' : 'Create a serious goal, keep it simple'}
        bodyRef={lifeGoalComposerBodyRef}
        panelClassName="top-[5vh] max-h-[90vh]"
        bodyClassName="max-h-[calc(90vh-92px)]"
      >
        {renderLifeGoalComposer()}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(deleteGoalConfirmationTarget)}
        onClose={() => setDeleteGoalConfirmationTarget(null)}
        size="md"
        subtitle="Delete life goal"
        title="Delete goal?"
      >
        <div className="space-y-5">
          <p className="theme-text-muted text-sm leading-6">
            This will permanently delete the goal, its moves, notes, and related progress. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteGoalConfirmationTarget(null)}>
              Cancel
            </Button>
            <Button variant="ghost" className="theme-danger-soft" onClick={confirmDeleteLifeGoal}>
              Delete Goal
            </Button>
          </div>
        </div>
      </DetailDrawer>
    </div>
  )
}
