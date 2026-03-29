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
import {
  HabitTracker,
  HabitTrackerAchievement,
  LifeGoal,
  LifeGoalCategoryColor,
  LifeGoalCategoryDefinition,
  LifeGoalTask,
  LifeGoalStatus,
  LIFE_GOAL_CATEGORY_COLOR_OPTIONS,
} from '../../types'

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
type LifeGoalDetailTab = 'focus' | 'tasks' | 'roadmap' | 'why' | 'progress'
type LifeGoalComposerMode = 'create' | 'edit'
type LifeGoalOverviewMode = 'manual' | 'grouped'

type LifeGoalDraftTask = {
  id: string
  text: string
  dueDate: string | null
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
  tasks: LifeGoalDraftTask[]
}

function createLifeGoalDraftTask(text = ''): LifeGoalDraftTask {
  return {
    id: `life-goal-draft-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    dueDate: null,
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
    tasks: [createLifeGoalDraftTask()],
  }
}

const LIFE_GOAL_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTaskDueDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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

function getLifeGoalSecondaryContext(goal: LifeGoal) {
  const today = getTodayIsoDate()

  if (isLifeGoalScheduled(goal.status, goal.startDate)) {
    return `Starts ${formatDate(goal.startDate)}`
  }

  if (goal.status !== 'complete' && isValidIsoDate(goal.targetDate) && goal.targetDate < today) {
    return 'Overdue'
  }

  if (goal.status === 'not-started' && isValidIsoDate(goal.startDate) && goal.startDate < today) {
    return 'Past start date'
  }

  if (isValidIsoDate(goal.targetDate)) {
    return `Due ${formatDate(goal.targetDate)}`
  }

  return null
}

function getLifeGoalProgress(goal: LifeGoal) {
  const totalTasks = goal.tasks.length
  const completedTasks = goal.tasks.filter((task) => task.completed).length
  const percent = goal.status === 'complete' ? 100 : totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const nextTask = goal.tasks.find((task) => !task.completed) ?? null
  const completedTaskItems = goal.tasks.filter((task) => task.completed)
  const lastCompletedTask = [...completedTaskItems]
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0] ?? null

  return {
    totalTasks,
    completedTasks,
    plannedTasks: goal.tasks.filter((task) => !task.completed),
    completedTaskItems,
    lastCompletedTask,
    percent,
    nextTask,
  }
}

function getLifeGoalMomentumState(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
  if (goal.status === 'complete') return null
  if (!progress.lastCompletedTask?.completedAt) {
    return {
      tone: 'cold' as const,
      label: 'none',
    }
  }

  const completedAt = new Date(progress.lastCompletedTask.completedAt).getTime()
  if (Number.isNaN(completedAt)) {
    return {
      tone: 'cold' as const,
      label: 'none',
    }
  }

  const diffHours = (Date.now() - completedAt) / 3600000
  if (diffHours <= 24) {
    return {
      tone: 'active' as const,
      label: 'today',
    }
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays <= 3) {
    return {
      tone: 'warming' as const,
      label: `${diffDays}d ago`,
    }
  }

  return {
    tone: 'cold' as const,
    label: `${diffDays}d ago`,
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

function normalizeLifeGoalDraftTasks(tasks: LifeGoalDraftTask[]) {
  return tasks
    .map((task) => {
      const text = task.text.trim()
      if (!text) return null
      return {
        id: task.id,
        text,
        dueDate: task.dueDate && isValidIsoDate(task.dueDate) ? task.dueDate : null,
        completed: task.completed,
        completedAt: task.completed ? task.completedAt ?? new Date().toISOString() : null,
      }
    })
    .filter((task): task is LifeGoalDraftTask => task !== null)
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
    tasks:
      goal.tasks.length > 0
        ? goal.tasks.map((task) => ({
            id: task.id,
            text: task.text,
            dueDate: task.dueDate,
            completed: task.completed,
            completedAt: task.completedAt,
          }))
        : [createLifeGoalDraftTask()],
  }
}

function normalizeCategoryValue(category: string) {
  return category.trim().toLowerCase()
}

function getLifeGoalCategoryColorTokenVariable(color: LifeGoalCategoryColor) {
  switch (color) {
    case 'green':
      return '--theme-accent-rgb'
    case 'blue':
      return '--theme-info-rgb'
    case 'purple':
      return '--theme-violet-rgb'
    case 'amber':
      return '--theme-warning-rgb'
    case 'teal':
      return '--theme-teal-rgb'
    case 'red':
      return '--theme-negative-rgb'
    default:
      return '--theme-border-strong-rgb'
  }
}

function getLifeGoalCategoryColor(name: string, categories: LifeGoalCategoryDefinition[]) {
  const normalizedName = normalizeCategoryValue(name)
  return categories.find((category) => normalizeCategoryValue(category.name) === normalizedName)?.color ?? 'neutral'
}

function getLifeGoalCategoryOptions(
  categories: readonly LifeGoalCategoryDefinition[],
  usedCategories: string[],
) {
  const seen = new Set<string>()
  const options: string[] = []

  for (const category of [...categories.map((item) => item.name), ...usedCategories]) {
    const trimmed = category.trim()
    if (!trimmed) continue
    const normalized = normalizeCategoryValue(trimmed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    options.push(trimmed)
  }

  return options
}

function getLifeGoalCategoryDotStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    backgroundColor: `rgb(var(${variable}) / 0.9)`,
    boxShadow: `0 0 0 1px rgb(var(${variable}) / 0.18)`,
  }
}

function getLifeGoalCategoryChipStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    borderColor: `rgb(var(${variable}) / 0.24)`,
    backgroundColor: `rgb(var(${variable}) / 0.055)`,
  }
}

function getLifeGoalAccentBarStyle(color: LifeGoalCategoryColor, isPrimary: boolean) {
  if (isPrimary) {
    return {
      background: 'linear-gradient(180deg, rgb(var(--theme-text-primary-rgb) / 0.92) 0%, rgb(var(--theme-border-strong-rgb) / 0.9) 100%)',
      boxShadow:
        'inset 0 1px 0 rgb(255 255 255 / 0.22), inset 0 -1px 0 rgb(0 0 0 / 0.2), 0 0 10px rgb(var(--theme-text-primary-rgb) / 0.12)',
    }
  }
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  const alpha = color === 'neutral' ? 0.72 : 0.72
  return {
    backgroundColor: `rgb(var(${variable}) / ${alpha})`,
    boxShadow: `0 0 8px rgb(var(${variable}) / 0.12)`,
  }
}

function getLifeGoalCardHighlightStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(var(${variable}) / 0.14), 0 16px 34px rgb(15 23 42 / 0.12)`,
  }
}

function getLifeGoalPrimaryGlowStyle(
  hover = false,
  momentumTone: 'active' | 'warming' | 'cold' | null = null,
) {
  const topAlpha =
    momentumTone === 'active'
      ? hover
        ? '0.095'
        : '0.07'
      : momentumTone === 'cold'
        ? hover
          ? '0.065'
          : '0.042'
        : hover
          ? '0.08'
          : '0.055'
  const midAlpha =
    momentumTone === 'active'
      ? hover
        ? '0.034'
        : '0.024'
      : momentumTone === 'cold'
        ? hover
          ? '0.022'
          : '0.014'
        : hover
          ? '0.028'
          : '0.018'
  return {
    background: `radial-gradient(120% 78% at 18% 0%, rgb(var(--theme-text-primary-rgb) / ${topAlpha}) 0%, rgb(var(--theme-text-primary-rgb) / ${midAlpha}) 34%, transparent 68%)`,
  }
}

function getLifeGoalCategorySurfaceWashStyle(color: LifeGoalCategoryColor, isPrimary: boolean, hover = false) {
  if (color === 'neutral') return undefined
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  const topAlpha = isPrimary ? (hover ? 0.034 : 0.026) : hover ? 0.082 : 0.072
  const midAlpha = isPrimary ? (hover ? 0.016 : 0.012) : hover ? 0.038 : 0.03
  const tailAlpha = isPrimary ? (hover ? 0.006 : 0.004) : hover ? 0.014 : 0.01
  return {
    backgroundImage: `linear-gradient(180deg, rgb(var(${variable}) / ${topAlpha}) 0%, rgb(var(${variable}) / ${midAlpha}) 18%, rgb(var(${variable}) / ${tailAlpha}) 32%, transparent 48%)`,
  }
}

function getLifeGoalProgressTone(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
  if (goal.status === 'complete') return 'complete'
  if (progress.completedTasks > 0) return 'active'
  return 'quiet'
}

function getLifeGoalProgressSurfaceStyle(
  color: LifeGoalCategoryColor,
  tone: ReturnType<typeof getLifeGoalProgressTone>,
  isPrimary: boolean,
) {
  if (isPrimary) {
    return {
      background: 'linear-gradient(180deg, rgb(255 255 255 / 0.02) 0%, rgb(255 255 255 / 0.008) 100%)',
    }
  }

  if (tone === 'active') {
    const variable = getLifeGoalCategoryColorTokenVariable(color)
    return {
      boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 0 0 1px rgb(var(${variable}) / 0.08)`,
    }
  }

  return undefined
}

function getLifeGoalUrgencyMeta(goal: LifeGoal) {
  const today = getTodayIsoDate()
  if (!isValidIsoDate(goal.targetDate) || goal.status === 'complete') return null

  const daysUntilTarget = Math.round(
    (new Date(`${goal.targetDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000,
  )

  if (daysUntilTarget < 0) {
    return {
      toneClassName: 'text-[rgb(var(--theme-negative-rgb)/0.82)]',
    }
  }

  if (daysUntilTarget <= 7) {
    return {
      toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.76)]',
    }
  }

  return {
    toneClassName: 'theme-text-muted',
  }
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
  const tasks = normalizeLifeGoalDraftTasks(draft.tasks).map((task) => ({
    ...task,
    id: task.id.startsWith('life-goal-draft-task-')
      ? `life-goal-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      : task.id,
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
    tasks,
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

function createLinkedHabitFromTask(title: string): HabitTracker {
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
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1
    if (left.order !== right.order) return left.order - right.order
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

const goalStatusChipClassName =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] leading-none'

export function GoalsPage({
  habitTrackers,
  lifeGoals,
  lifeGoalCategories,
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
  onEnsureLifeGoalCategory,
  onSetLifeGoalCategoryColor,
  onArchiveLifeGoal,
  onDeleteLifeGoal,
  onSetLifeGoalAsTodayTask,
}: {
  habitTrackers: HabitTracker[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
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
  onEnsureLifeGoalCategory: (name: string) => void
  onSetLifeGoalCategoryColor: (name: string, color: LifeGoalCategoryColor) => void
  onArchiveLifeGoal: (goalId: string) => void
  onDeleteLifeGoal: (goalId: string) => void
  onSetLifeGoalAsTodayTask: (goal: LifeGoal) => void
}) {
  const [selectedGoal, setSelectedGoal] = useState<GoalDetailItem | null>(null)
  const [lifeGoalDraft, setLifeGoalDraft] = useState<LifeGoalDraft>(() => createEmptyLifeGoalDraft())
  const [lifeGoalComposerMode, setLifeGoalComposerMode] = useState<LifeGoalComposerMode>('create')
  const [editingLifeGoalId, setEditingLifeGoalId] = useState<string | null>(null)
  const [lifeGoalComposerOpen, setLifeGoalComposerOpen] = useState(lifeGoals.length === 0)
  const [plannedTaskDraft, setPlannedTaskDraft] = useState('')
  const [taskDraftEntryOpen, setTaskDraftEntryOpen] = useState(false)
  const [lifeGoalActionFeedback, setLifeGoalActionFeedback] = useState<string | null>(null)
  const [linkHabitPickerOpen, setLinkHabitPickerOpen] = useState(false)
  const [habitDraftByTaskId, setHabitDraftByTaskId] = useState<Record<string, string>>({})
  const [lifeGoalDetailTab, setLifeGoalDetailTab] = useState<LifeGoalDetailTab>('focus')
  const [lifeGoalWhyExpanded, setLifeGoalWhyExpanded] = useState(false)
  const [selectedRoadmapTaskId, setSelectedRoadmapTaskId] = useState<string | null>(null)
  const [draggedLifeGoalId, setDraggedLifeGoalId] = useState<string | null>(null)
  const [dragOverLifeGoalId, setDragOverLifeGoalId] = useState<string | null>(null)
  const [lifeGoalCategoryFilter, setLifeGoalCategoryFilter] = useState<string>('all')
  const [lifeGoalCategoryMenuOpen, setLifeGoalCategoryMenuOpen] = useState(false)
  const [lifeGoalCategoryQuery, setLifeGoalCategoryQuery] = useState('')
  const [lifeGoalDatePickerOpen, setLifeGoalDatePickerOpen] = useState(false)
  const [lifeGoalActiveDateField, setLifeGoalActiveDateField] = useState<'startDate' | 'targetDate' | null>(null)
  const [lifeGoalStatusMenuOpen, setLifeGoalStatusMenuOpen] = useState(false)
  const [lifeGoalOverviewMode, setLifeGoalOverviewMode] = useState<LifeGoalOverviewMode>('manual')
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

  useEffect(() => {
    setLifeGoalWhyExpanded(false)
  }, [selectedLifeGoal?.id])

  useEffect(() => {
    if (!selectedLifeGoal) {
      setSelectedRoadmapTaskId(null)
      return
    }

    const nextSelectedTaskId =
      selectedLifeGoal.tasks.find((task) => !task.completed)?.id ??
      selectedLifeGoal.tasks[selectedLifeGoal.tasks.length - 1]?.id ??
      null
    setSelectedRoadmapTaskId(nextSelectedTaskId)
  }, [selectedLifeGoal])
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

  const draftTasks = useMemo(() => normalizeLifeGoalDraftTasks(lifeGoalDraft.tasks), [lifeGoalDraft.tasks])

  const handleSaveLifeGoal = () => {
    if (!lifeGoalDraft.title.trim() || !lifeGoalDraft.whyItMatters.trim() || !lifeGoalDraft.minimumVersion.trim() || draftTasks.length === 0) {
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
        tasks: draftTasks,
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
    setTaskDraftEntryOpen(false)
    closeLifeGoalComposer()
  }

  const addPlannedTask = () => {
    const trimmed = plannedTaskDraft.trim()
    if (!selectedLifeGoal || !trimmed) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      tasks: [
        ...goal.tasks,
        {
          id: `life-goal-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          text: trimmed,
          dueDate: null,
          completed: false,
          completedAt: null,
        },
      ],
      updatedAt: new Date().toISOString(),
    }))
    setPlannedTaskDraft('')
    setTaskDraftEntryOpen(false)
  }

  const toggleTaskCompletion = (goalId: string, taskId: string) => {
    onUpdateLifeGoal(goalId, (goal) => {
      const updatedTasks = goal.tasks.map((task) => {
        if (task.id !== taskId) return task
        const nextCompleted = !task.completed
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        }
      })

      return {
        ...goal,
        tasks: updatedTasks,
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

  const createHabitFromTask = (goal: LifeGoal, task: LifeGoalTask) => {
    const draftTitle = (habitDraftByTaskId[task.id] ?? task.text).trim()
    if (!draftTitle) return

    const tracker = createLinkedHabitFromTask(draftTitle)
    onCreateHabitTracker(tracker)
    linkHabitToLifeGoal(goal.id, tracker.id)
    setHabitDraftByTaskId((current) => {
      const next = { ...current }
      delete next[task.id]
      return next
    })
    setLifeGoalActionFeedback(`Linked habit created for "${goal.title}".`)
  }

  const updateDraftTask = (taskId: string, updater: (task: LifeGoalDraftTask) => LifeGoalDraftTask) => {
    setLifeGoalDraft((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
    }))
  }

  const addDraftTask = () => {
    setLifeGoalDraft((current) => ({
      ...current,
      tasks: [...current.tasks, createLifeGoalDraftTask()],
    }))
  }

  const deleteDraftTask = (taskId: string) => {
    setLifeGoalDraft((current) => {
      const nextTasks = current.tasks.filter((task) => task.id !== taskId)
      return {
        ...current,
        tasks: nextTasks.length > 0 ? nextTasks : [createLifeGoalDraftTask()],
      }
    })
  }

  const reorderDraftTask = (taskId: string, direction: 'up' | 'down') => {
    setLifeGoalDraft((current) => {
      const index = current.tasks.findIndex((task) => task.id === taskId)
      if (index === -1) return current
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.tasks.length) return current
      const nextTasks = [...current.tasks]
      const [movedTask] = nextTasks.splice(index, 1)
      nextTasks.splice(targetIndex, 0, movedTask)
      return {
        ...current,
        tasks: nextTasks,
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
    () => getLifeGoalCategoryOptions(lifeGoalCategories, usedLifeGoalCategories),
    [lifeGoalCategories, usedLifeGoalCategories],
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
  const selectedLifeGoalCategoryColor = useMemo(
    () => getLifeGoalCategoryColor(lifeGoalDraft.category, lifeGoalCategories),
    [lifeGoalDraft.category, lifeGoalCategories],
  )
  const selectedLifeGoalCategoryName = useMemo(
    () => lifeGoalDraft.category.trim(),
    [lifeGoalDraft.category],
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
    const trimmedCategory = category.trim()
    if (trimmedCategory) {
      onEnsureLifeGoalCategory(trimmedCategory)
    }
    setLifeGoalDraft((current) => ({ ...current, category: trimmedCategory }))
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
            <span className="theme-label">Next task</span>
            <input
              value={lifeGoalDraft.tasks[0]?.text ?? ''}
              onChange={(event) =>
                setLifeGoalDraft((current) => {
                  const nextTasks = current.tasks.length > 0 ? [...current.tasks] : [createLifeGoalDraftTask()]
                  nextTasks[0] = {
                    ...(nextTasks[0] ?? createLifeGoalDraftTask()),
                    text: event.target.value,
                  }
                  return {
                    ...current,
                    tasks: nextTasks,
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
                  {lifeGoalDraft.category || 'Select category'}
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
                  <div className="max-h-[280px] overflow-y-auto overscroll-contain p-2" onWheel={containScrollWithinElement}>
                    <div className="mb-2.5 px-1.5 pt-1.5">
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
                        placeholder="Create a category..."
                        className="w-full rounded-2xl border border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-rgb))] px-4 py-3 text-sm text-[rgb(var(--theme-text-primary-rgb))] outline-none placeholder:text-[rgb(var(--theme-text-muted-rgb))] focus:border-[rgb(var(--theme-border-strong-rgb))]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => applyLifeGoalCategory('')}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                        !lifeGoalDraft.category
                          ? 'border border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-soft-rgb))] theme-text-primary'
                          : 'theme-text-secondary hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={getLifeGoalCategoryDotStyle('neutral')} />
                        <span>No category</span>
                      </span>
                      <span className="theme-text-faint text-[11px]">Optional</span>
                    </button>

                    {lifeGoalCategoryQuery.trim() && !draftCategoryMatchesExisting ? (
                      <button
                        type="button"
                        onClick={() => applyLifeGoalCategory(lifeGoalCategoryQuery.trim())}
                        className="flex w-full items-center justify-between rounded-2xl border border-[rgb(var(--theme-border-subtle-rgb)/0.72)] bg-[rgb(var(--theme-surface-soft-rgb)/0.45)] px-3 py-2.5 text-left text-sm transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-elevated-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                      >
                        <div className="min-w-0">
                          <span className="block">{`+ Create "${lifeGoalCategoryQuery.trim()}"`}</span>
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
                              ? 'border border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-soft-rgb))] theme-text-primary'
                              : 'theme-text-secondary hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={getLifeGoalCategoryDotStyle(getLifeGoalCategoryColor(category, lifeGoalCategories))}
                            />
                            <span className="truncate">{category}</span>
                          </span>
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

                    {selectedLifeGoalCategoryName ? (
                      <div className="mt-2 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.72)] px-1 pt-2">
                        <div className="flex items-center justify-between gap-3 px-2 pb-2">
                          <div className="min-w-0">
                            <p className="theme-text-muted text-[11px] uppercase tracking-[0.14em]">Category color</p>
                            <p className="theme-text-faint mt-1 truncate text-[11px]">{selectedLifeGoalCategoryName}</p>
                          </div>
                          <span className="h-2.5 w-2.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedLifeGoalCategoryColor)} />
                        </div>
                        <div className="flex flex-wrap gap-2 px-1 pb-1">
                          {LIFE_GOAL_CATEGORY_COLOR_OPTIONS.map((color) => {
                            const active = selectedLifeGoalCategoryColor === color
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => onSetLifeGoalCategoryColor(selectedLifeGoalCategoryName, color)}
                                className={`flex h-7 w-7 items-center justify-center rounded-full border transition ${
                                  active
                                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-elevated-rgb))]'
                                    : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))]'
                                }`}
                                aria-label={`Set category color to ${color}`}
                                title={color}
                              >
                                <span className="h-3 w-3 rounded-full" style={getLifeGoalCategoryDotStyle(color)} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
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
            <span className="theme-label">Tasks</span>
            <Button variant="ghost" onClick={addDraftTask}>
              Add task
            </Button>
          </div>

          <div className="space-y-2">
            {lifeGoalDraft.tasks.map((task, index) => (
              <div key={task.id} className="theme-surface-soft rounded-2xl border px-3.5 py-2.5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraftTask(task.id, (current) => ({
                        ...current,
                        completed: !current.completed,
                        completedAt: !current.completed ? current.completedAt ?? new Date().toISOString() : null,
                      }))
                    }
                    className={`mt-1 h-4 w-4 rounded-full border transition ${
                      task.completed
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.34)] bg-[rgb(var(--theme-accent-rgb)/0.18)]'
                        : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-transparent'
                    }`}
                    aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={task.text}
                      onChange={(event) => updateDraftTask(task.id, (current) => ({ ...current, text: event.target.value }))}
                      placeholder={index === 0 ? 'Next task' : 'Planned task'}
                      className="w-full bg-transparent text-sm text-[rgb(var(--theme-text-primary-rgb))] outline-none placeholder:text-[rgb(var(--theme-text-muted-rgb))]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="theme-text-faint text-[11px] uppercase tracking-[0.14em]">
                        {task.completed ? 'Completed task' : index === 0 ? 'Next task' : 'Planned task'}
                      </span>
                      <input
                        type="date"
                        value={task.dueDate ?? ''}
                        onChange={(event) =>
                          updateDraftTask(task.id, (current) => ({
                            ...current,
                            dueDate: event.target.value || null,
                          }))
                        }
                        className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/70 outline-none"
                        aria-label="Task due date"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => reorderDraftTask(task.id, 'up')}
                          disabled={index === 0}
                          className="theme-text-muted text-xs transition disabled:opacity-30"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => reorderDraftTask(task.id, 'down')}
                          disabled={index === lifeGoalDraft.tasks.length - 1}
                          className="theme-text-muted text-xs transition disabled:opacity-30"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDraftTask(task.id)}
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgb(var(--theme-border-subtle-rgb)/0.68)] pb-4">
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
        <div className="theme-surface-soft inline-flex rounded-full border p-1">
          {(['manual', 'grouped'] as LifeGoalOverviewMode[]).map((mode) => {
            const active = lifeGoalOverviewMode === mode
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setLifeGoalOverviewMode(mode)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'theme-button-secondary theme-text-primary'
                    : 'theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))]'
                }`}
              >
                {mode === 'manual' ? 'Manual' : 'Grouped'}
              </button>
            )
          })}
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

      {visibleLifeGoals.length > 0 ? (() => {
        const renderOverviewGoalCard = (goal: LifeGoal) => {
            const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
            const secondaryContext = getLifeGoalSecondaryContext(goal)
            const progress = getLifeGoalProgress(goal)
            const momentum = getLifeGoalMomentumState(goal, progress)
            const progressTone = getLifeGoalProgressTone(goal, progress)
            const urgencyMeta = getLifeGoalUrgencyMeta(goal)
            const whyPreview = getLifeGoalAnchorText(goal.whyItMatters)
            const isPrimary = goal.id === featuredOverviewGoalId
            const isSelected = goal.id === selectedLifeGoalId
            const canDrag = lifeGoalOverviewMode === 'manual' && !goal.isPrimary
            const progressSummary = `${progress.completedTasks}/${Math.max(progress.totalTasks, 1)} tasks`
            const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, lifeGoalCategories) : 'neutral'
            return (
              <button
                key={goal.id}
                type="button"
                draggable={canDrag}
                onDragStart={() => {
                  if (!canDrag) return
                  setDraggedLifeGoalId(goal.id)
                  setDragOverLifeGoalId(goal.id)
                }}
                onDragEnd={() => {
                  if (!canDrag) return
                  setDraggedLifeGoalId(null)
                  setDragOverLifeGoalId(null)
                }}
                onDragOver={(event) => {
                  if (!canDrag || goal.isPrimary) return
                  event.preventDefault()
                  if (dragOverLifeGoalId !== goal.id) {
                    setDragOverLifeGoalId(goal.id)
                  }
                }}
                onDrop={(event) => {
                  if (!canDrag || goal.isPrimary) return
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
                className={`group relative block w-full overflow-hidden rounded-[26px] border px-5 pt-4 pb-[15px] text-left transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.995] ${
                  isPrimary
                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-elevated-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06),0_0_0_1px_rgb(var(--theme-border-strong-rgb)/0.16)] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                    : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_0_0_1px_rgb(var(--theme-border-subtle-rgb)/0.14)] hover:border-[rgb(var(--theme-border-strong-rgb)/0.88)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.62)]'
                } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${draggedLifeGoalId === goal.id ? 'opacity-60' : ''} ${dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id ? 'border-[rgb(var(--theme-info-rgb)/0.62)]' : ''}`}
                style={{
                  ...(isSelected ? getLifeGoalCardHighlightStyle(categoryColor) : {}),
                  ...(getLifeGoalProgressSurfaceStyle(categoryColor, progressTone, isPrimary) ?? {}),
                }}
              >
                {isPrimary ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 transition-opacity duration-150 ease-out"
                    style={getLifeGoalPrimaryGlowStyle(false, momentum?.tone ?? null)}
                  />
                ) : null}
                {isPrimary ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                    style={getLifeGoalPrimaryGlowStyle(true, momentum?.tone ?? null)}
                  />
                ) : null}
                {getLifeGoalCategorySurfaceWashStyle(categoryColor, isPrimary) ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 transition-opacity duration-150 ease-out"
                    style={getLifeGoalCategorySurfaceWashStyle(categoryColor, isPrimary)}
                  />
                ) : null}
                {getLifeGoalCategorySurfaceWashStyle(categoryColor, isPrimary, true) ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
                    style={getLifeGoalCategorySurfaceWashStyle(categoryColor, isPrimary, true)}
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-4 bottom-4 rounded-full ${
                    isPrimary
                      ? 'w-[3px]'
                      : 'w-[2px]'
                  }`}
                  style={getLifeGoalAccentBarStyle(categoryColor, isPrimary)}
                />
                <span
                  aria-hidden="true"
                  className="absolute right-[230px] top-4 bottom-[15px] hidden w-px bg-[rgb(var(--theme-border-subtle-rgb)/0.6)] md:block"
                />

                <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.55fr)_190px] md:gap-5">
                  <div className="min-w-0 pl-3">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                      <h4 className="theme-text-primary text-[23px] font-[650] leading-[1.08] tracking-[-0.03em]">
                        {formatGoalCardTitle(goal.title)}
                      </h4>
                      {goal.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-[rgb(var(--theme-text-muted-rgb))] leading-none"
                          style={getLifeGoalCategoryChipStyle(categoryColor)}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                          <span>{goal.category}</span>
                        </span>
                      ) : null}
                      {goal.isPrimary ? (
                        <span className="inline-flex items-center rounded-full border border-[rgb(var(--theme-border-strong-rgb)/0.9)] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-[rgb(var(--theme-text-primary-rgb))] uppercase leading-none shadow-[inset_0_1px_0_rgb(255_255_255_/_0.16),inset_0_-1px_0_rgb(0_0_0_/_0.18),0_0_0_1px_rgb(255_255_255_/_0.04)]">
                          Primary Goal
                        </span>
                      ) : null}
                    </div>
                    {whyPreview ? <p className="theme-body-secondary mt-1.5 max-w-[760px]">{whyPreview}</p> : null}

                    <div
                      aria-hidden="true"
                      className={`mt-2 h-px max-w-[760px] bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.72)_0%,rgb(var(--theme-border-subtle-rgb)/0.22)_82%,transparent_100%)] ${
                        isPrimary ? 'opacity-90' : 'opacity-70'
                      }`}
                    />

                    <div className="mt-2.5">
                      <div
                        className="rounded-2xl px-3 py-2 transition-colors duration-150 ease-out group-hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.44)]"
                        style={{
                          background:
                            'linear-gradient(90deg, rgb(var(--theme-surface-soft-rgb) / 0.38) 0%, rgb(var(--theme-surface-soft-rgb) / 0.38) 30%, rgb(var(--theme-surface-soft-rgb) / 0.12) 40%, transparent 50%)',
                        }}
                      >
                        <p className="flex items-start gap-2 text-[14px] leading-6">
                          <span
                            className="mt-[1px] shrink-0 text-[12px] leading-6"
                            style={{ color: `rgb(var(${getLifeGoalCategoryColorTokenVariable(isPrimary ? 'neutral' : categoryColor)}) / 0.68)` }}
                          >
                            →
                          </span>
                          <span className="min-w-0">
                            <span className="theme-text-faint mr-1 text-[12px]">Next:</span>
                            <span
                              className={`font-medium ${
                                isPrimary
                                  ? momentum?.tone === 'cold'
                                    ? 'text-[rgb(var(--theme-text-primary-rgb)/0.92)]'
                                    : 'theme-text-primary'
                                  : momentum?.tone === 'active'
                                    ? 'text-[rgb(var(--theme-text-primary-rgb)/0.98)]'
                                    : momentum?.tone === 'cold'
                                      ? 'text-[rgb(var(--theme-text-primary-rgb)/0.84)]'
                                      : 'text-[rgb(var(--theme-text-primary-rgb)/0.94)]'
                              }`}
                            >
                              {progress.nextTask?.text ?? 'No next task currently planned.'}
                            </span>
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 md:pl-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 md:justify-end">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`${goalStatusChipClassName} shrink-0 px-2.5 py-1 text-[10px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 space-y-0.5 text-right">
                      {secondaryContext ? (
                        <p className={`text-[12px] leading-5 ${urgencyMeta?.toneClassName ?? 'theme-text-muted'}`}>{secondaryContext}</p>
                      ) : null}
                      <p className="theme-text-faint text-[12px] leading-5">{progressSummary}</p>
                      <p className="theme-text-faint text-[11px] leading-5">Last task: {momentum?.label ?? 'none'}</p>
                      <div className="ml-auto mt-1 h-[2px] w-[52px] overflow-hidden rounded-full bg-[rgb(var(--theme-border-subtle-rgb)/0.24)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${goal.status === 'complete' ? 100 : progress.totalTasks > 0 ? Math.round((progress.completedTasks / progress.totalTasks) * 100) : 0}%`,
                            backgroundColor: `rgb(var(${getLifeGoalCategoryColorTokenVariable(categoryColor)}) / ${
                              goal.status === 'complete' ? '0.42' : '0.34'
                            })`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            )
          }

        if (lifeGoalOverviewMode === 'manual') {
          return <div className="space-y-3">{visibleLifeGoals.map((goal) => renderOverviewGoalCard(goal))}</div>
        }

        const primaryGoal = visibleLifeGoals.find((goal) => goal.isPrimary) ?? null
        const groupedGoals = visibleLifeGoals.filter((goal) => !goal.isPrimary)
        const orderedCategoryKeys: string[] = []
        const groupedByCategory = new Map<string, LifeGoal[]>()

        for (const goal of groupedGoals) {
          const categoryKey = goal.category.trim() || 'uncategorized'
          if (!groupedByCategory.has(categoryKey)) {
            groupedByCategory.set(categoryKey, [])
            orderedCategoryKeys.push(categoryKey)
          }
          groupedByCategory.get(categoryKey)!.push(goal)
        }

        const orderedGroupedKeys = [
          ...orderedCategoryKeys.filter((key) => key !== 'uncategorized'),
          ...orderedCategoryKeys.filter((key) => key === 'uncategorized'),
        ]

        return (
          <div className="space-y-4">
            {primaryGoal ? <div className="space-y-3">{renderOverviewGoalCard(primaryGoal)}</div> : null}
            {orderedGroupedKeys.map((categoryKey) => {
              const goals = groupedByCategory.get(categoryKey)
              if (!goals || goals.length === 0) return null
              const categoryName = categoryKey === 'uncategorized' ? 'Other' : categoryKey
              const categoryColor = categoryKey === 'uncategorized' ? 'neutral' : getLifeGoalCategoryColor(categoryKey, lifeGoalCategories)
              return (
                <section key={categoryKey} className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                      <h3
                        className="text-[11px] font-medium uppercase tracking-[0.16em]"
                        style={{ color: `rgb(var(${getLifeGoalCategoryColorTokenVariable(categoryColor)}) / 0.74)` }}
                      >
                        {categoryName}
                      </h3>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-px bg-[linear-gradient(90deg,transparent_0%,rgb(var(--theme-border-subtle-rgb)/0.16)_10%,rgb(var(--theme-border-subtle-rgb)/0.1)_56%,transparent_100%)]"
                    />
                  </div>
                  <div className="space-y-3">{goals.map((goal) => renderOverviewGoalCard(goal))}</div>
                </section>
              )
            })}
          </div>
        )
      })() : sortedLifeGoals.length > 0 ? (
        <div className="theme-surface-soft rounded-[24px] border px-5 py-5">
          <p className="theme-body-primary">No goals in this category</p>
          <p className="theme-body-secondary mt-2">Switch back to All or choose a different life area.</p>
        </div>
      ) : null}
    </div>
  )

  const renderLifeGoalDetailPage = () => {
    if (!selectedLifeGoal || !selectedLifeGoalProgress) {
      return renderLifeGoalOverviewPage()
    }

    const selectedGoalCategory = selectedLifeGoal.category.trim()
    const selectedGoalCategoryColor = selectedGoalCategory
      ? getLifeGoalCategoryColor(selectedGoalCategory, lifeGoalCategories)
      : 'neutral'
    const anchorText = getLifeGoalAnchorText(selectedLifeGoal.whyItMatters)
    const shouldTruncateWhy = anchorText.length > 180 && !lifeGoalWhyExpanded
    const visibleWhyText = shouldTruncateWhy ? `${anchorText.slice(0, 180).trimEnd()}…` : anchorText
    const progressWidth = Math.max(selectedLifeGoalProgress.percent, selectedLifeGoal.status === 'complete' ? 100 : 6)
    const isRoadmapMode = lifeGoalDetailTab === 'tasks' || lifeGoalDetailTab === 'roadmap'

    const tasksTabContent = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Tasks</p>
            <p className="mt-1 text-sm text-mist">Keep the next steps visible and mark them honestly.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Upcoming tasks</p>
            {selectedLifeGoalProgress.plannedTasks.length > 0 ? (
              selectedLifeGoalProgress.plannedTasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`rounded-2xl border px-3.5 py-2.5 ${
                    index === 0
                      ? 'border-white/[0.16] bg-white/[0.045]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTaskCompletion(selectedLifeGoal.id, task.id)}
                    className="flex w-full items-start justify-between gap-3 text-left transition"
                  >
                    <div className="min-w-0">
                      {index === 0 ? (
                        <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
                          Next
                        </span>
                      ) : null}
                      <span className={`mt-1 block leading-6 ${index === 0 ? 'text-[15px] font-medium text-white' : 'text-sm text-white/84'}`}>{task.text}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pl-2">
                      {task.dueDate ? (
                        <span className="text-xs text-mist/70">{formatTaskDueDate(task.dueDate)}</span>
                      ) : null}
                      <span className="text-xs uppercase tracking-[0.16em] text-mist/62">Done</span>
                    </div>
                  </button>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setHabitDraftByTaskId((current) => ({
                          ...current,
                          [task.id]: current[task.id] ?? task.text,
                        }))
                      }
                      className="text-xs uppercase tracking-[0.16em] text-white/46 transition hover:text-white/72"
                    >
                      Make this a habit
                    </button>
                  </div>
                  {habitDraftByTaskId[task.id] !== undefined ? (
                    <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                      <input
                        value={habitDraftByTaskId[task.id]}
                        onChange={(event) =>
                          setHabitDraftByTaskId((current) => ({
                            ...current,
                            [task.id]: event.target.value,
                          }))
                        }
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                        placeholder="Habit name"
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setHabitDraftByTaskId((current) => {
                              const next = { ...current }
                              delete next[task.id]
                              return next
                            })
                          }
                        >
                          Cancel
                        </Button>
                        <Button variant="soft" onClick={() => createHabitFromTask(selectedLifeGoal, task)}>
                          Create and link habit
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                No upcoming tasks yet. Add the next concrete step.
              </p>
            )}

            {taskDraftEntryOpen ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3 py-2">
                <input
                  value={plannedTaskDraft}
                  onChange={(event) => setPlannedTaskDraft(event.target.value)}
                  placeholder="Add a task"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                />
                <Button variant="soft" onClick={addPlannedTask}>
                  Save
                </Button>
              </div>
            ) : null}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setTaskDraftEntryOpen((current) => !current)}
                className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/62 transition hover:border-white/[0.12] hover:text-white/82"
              >
                + Add task
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Completed tasks</p>
            {selectedLifeGoalProgress.completedTaskItems.length > 0 ? (
              selectedLifeGoalProgress.completedTaskItems.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggleTaskCompletion(selectedLifeGoal.id, task.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <span className="text-sm leading-6 text-white/62 line-through">{task.text}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    {task.dueDate ? <p className="text-xs text-mist/62">{formatTaskDueDate(task.dueDate)}</p> : null}
                    <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-mist/72">
                      {task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : 'Done'}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                Completed tasks will collect here as proof of progress.
              </p>
            )}
          </div>
        </div>
      </div>
    )

    const roadmapTabContent = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Roadmap</p>
            <p className="mt-1 text-sm text-mist">A clean view of the path from the current task to the goal.</p>
          </div>
        </div>

        {selectedLifeGoal.tasks.length > 0 ? (
          <div className="mx-auto mt-5 max-w-[720px] space-y-7">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Upcoming tasks</p>
              <div className="mt-3">
                {selectedLifeGoal.tasks.filter((task) => !task.completed).length > 0 ? (
                  selectedLifeGoal.tasks
                    .filter((task) => !task.completed)
                    .map((task) => {
                      const isCurrent = selectedLifeGoalProgress.nextTask?.id === task.id
                      const isSelected = selectedRoadmapTaskId === task.id

                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedRoadmapTaskId(task.id)}
                          className={`grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.05] py-3 text-left transition last:border-b-0 hover:border-white/[0.08] ${
                            isSelected ? 'bg-white/[0.015]' : ''
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pt-0.5 text-[16px] leading-none ${
                              isCurrent ? 'text-white/92' : 'text-white/44'
                            }`}
                          >
                            {isCurrent ? '◎' : '○'}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className={`${isCurrent ? 'text-[15px] font-medium text-white' : 'text-[15px] text-white/84'}`}>
                                {task.text}
                              </p>
                              {task.dueDate ? (
                                <span className="shrink-0 pt-0.5 text-[12px] text-mist/66">{formatTaskDueDate(task.dueDate)}</span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[12px] text-mist/58">
                              {isCurrent ? 'Current task' : 'Upcoming'}
                              {isSelected && !isCurrent ? ' · Focused' : ''}
                            </p>
                          </div>
                        </button>
                      )
                    })
                ) : (
                  <p className="text-sm text-mist">No upcoming tasks yet. Add the first concrete step below.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Goal</p>
              <div className="mt-3 grid grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 border-b border-white/[0.05] py-3">
                <span aria-hidden="true" className="pt-0.5 text-[16px] leading-none text-white/84">
                  ◉
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white/88">Goal</p>
                  <p className="mt-1 text-[12px] text-mist/58">Completion point</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Completed tasks</p>
              <div className="mt-3">
                {selectedLifeGoal.tasks.filter((task) => task.completed).length > 0 ? (
                  selectedLifeGoal.tasks
                    .filter((task) => task.completed)
                    .map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedRoadmapTaskId(task.id)}
                        className={`grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.05] py-3 text-left transition last:border-b-0 hover:border-white/[0.08] ${
                          selectedRoadmapTaskId === task.id ? 'bg-white/[0.015]' : ''
                        }`}
                      >
                        <span aria-hidden="true" className="pt-0.5 text-[16px] leading-none text-white/62">
                          ●
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[15px] text-white/56 line-through">{task.text}</p>
                            {task.completedAt ? (
                              <span className="shrink-0 pt-0.5 text-[12px] text-mist/66">{formatDate(task.completedAt.slice(0, 10))}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[12px] text-mist/58">
                            {task.dueDate ? formatTaskDueDate(task.dueDate) : 'Completed'}
                          </p>
                        </div>
                      </button>
                    ))
                ) : (
                  <p className="text-sm text-mist">Completed tasks will appear here as proof of progress.</p>
                )}
              </div>
            </div>

            <div className="border-t border-white/[0.05] pt-3">
              {taskDraftEntryOpen ? (
                <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
                  <span aria-hidden="true" className="text-[16px] leading-none text-white/44">
                    ○
                  </span>
                  <input
                    value={plannedTaskDraft}
                    onChange={(event) => setPlannedTaskDraft(event.target.value)}
                    placeholder="Add a task"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                  />
                  <Button variant="soft" onClick={addPlannedTask}>
                    Save
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTaskDraftEntryOpen(true)}
                  className="text-sm text-white/62 transition hover:text-white/84"
                >
                  + Add task
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-mist">No tasks yet. Add the first concrete step to build the roadmap.</p>
        )}
      </div>
    )

    if (isRoadmapMode) {
      return (
        <div className="mx-auto max-w-[1160px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLifeGoalDetailTab('focus')}
              className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
            >
              ← Back to Goal
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
              >
                Edit Goal
              </Button>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="theme-page-title">{selectedLifeGoal.title}</h3>
                  {selectedGoalCategory ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none text-white/70"
                      style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                      {selectedGoalCategory}
                    </span>
                  ) : null}
                  {selectedLifeGoal.isPrimary ? (
                    <span className="theme-surface-soft theme-text-primary inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none">
                      Primary Goal
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-mist">Roadmap and task history for this goal.</p>
              </div>
              <div className="theme-surface-soft inline-flex rounded-full border p-1">
                {([
                  ['tasks', 'Tasks'],
                  ['roadmap', 'Roadmap'],
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

          {lifeGoalDetailTab === 'tasks' ? tasksTabContent : roadmapTabContent}
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-[1160px] space-y-4">
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
              onClick={() => onSetPrimaryLifeGoal(selectedLifeGoal.isPrimary ? null : selectedLifeGoal.id)}
            >
              {selectedLifeGoal.isPrimary ? 'Clear Primary' : 'Mark Primary'}
            </Button>
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

        <div className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,1fr)]">
            <div className="self-start rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="theme-page-title">{selectedLifeGoal.title}</h3>
                    {selectedGoalCategory ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none text-white/70"
                        style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                        {selectedGoalCategory}
                      </span>
                    ) : null}
                    {selectedLifeGoal.isPrimary ? (
                      <span className="theme-surface-soft theme-text-primary inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none">
                        Primary Goal
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
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
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Next task</p>
                  <p className="mt-2 text-[22px] font-semibold leading-[1.32] text-white">
                    {selectedLifeGoalProgress.nextTask?.text ?? 'No next task currently planned.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="soft"
                    onClick={() => {
                      onSetLifeGoalAsTodayTask(selectedLifeGoal)
                      setLifeGoalActionFeedback('Focused for today.')
                    }}
                  >
                    Focus this today
                  </Button>
                  {selectedLifeGoalProgress.nextTask ? (
                    <Button
                      variant="ghost"
                      onClick={() => toggleTaskCompletion(selectedLifeGoal.id, selectedLifeGoalProgress.nextTask!.id)}
                    >
                      Done — continue
                    </Button>
                  ) : null}
                </div>
                {lifeGoalActionFeedback ? <p className="text-sm text-mist">{lifeGoalActionFeedback}</p> : null}
              </div>

              {anchorText ? (
                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Why it matters</p>
                    {anchorText.length > 180 ? (
                      <button
                        type="button"
                        onClick={() => setLifeGoalWhyExpanded((current) => !current)}
                        className="text-xs uppercase tracking-[0.16em] text-white/44 transition hover:text-white/72"
                      >
                        {lifeGoalWhyExpanded ? 'Show less' : 'Show more'}
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/66">{visibleWhyText}</p>
                </div>
              ) : null}
            </div>

            <div className="self-start rounded-[24px] border border-white/[0.05] bg-white/[0.018] xl:flex xl:h-[78vh] xl:flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Task roadmap</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLifeGoalDetailTab('roadmap')}
                  className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                >
                  Open roadmap
                </button>
              </div>

              <div className="roadmap-scroll border-t border-white/[0.08] px-4 pt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain">
                {selectedLifeGoalProgress.plannedTasks.length > 0 ? (
                  selectedLifeGoalProgress.plannedTasks.map((task, index) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTaskCompletion(selectedLifeGoal.id, task.id)}
                      className="grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.05] py-3 text-left transition last:border-b-0 hover:border-white/[0.08]"
                    >
                      <span
                        aria-hidden="true"
                        className={`pt-0.5 text-[16px] leading-none ${
                          index === 0 ? 'text-white/92' : 'text-white/44'
                        }`}
                      >
                        {index === 0 ? '◎' : '○'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={`${index === 0 ? 'text-[15px] font-medium text-white' : 'text-[15px] text-white/84'}`}>
                              {task.text}
                            </p>
                            <p className="mt-1 text-[12px] text-mist/58">{index === 0 ? 'Current task' : 'Upcoming task'}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            {task.dueDate ? <p className="text-[12px] text-mist/66">{formatTaskDueDate(task.dueDate)}</p> : null}
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-mist/62">Done</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="py-2 text-sm text-mist">
                    No upcoming tasks yet. Add the next concrete step.
                  </p>
                )}
              </div>

              <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
                {taskDraftEntryOpen ? (
                  <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
                    <span aria-hidden="true" className="text-[16px] leading-none text-white/44">
                      ○
                    </span>
                    <input
                      value={plannedTaskDraft}
                      onChange={(event) => setPlannedTaskDraft(event.target.value)}
                      placeholder="Add a task"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                    />
                    <Button variant="soft" onClick={addPlannedTask}>
                      Save
                    </Button>
                  </div>
                ) : null}
                <div className={`${taskDraftEntryOpen ? 'mt-3 border-t border-white/[0.05] pt-3' : ''} flex flex-wrap items-end justify-between gap-3`}>
                  <div className="space-y-1 text-xs text-mist">
                    <p>
                      {selectedLifeGoalProgress.plannedTasks.length} upcoming
                      <span className="px-1.5 text-white/26">•</span>
                      {selectedLifeGoalProgress.completedTaskItems.length} completed
                    </p>
                    {selectedLifeGoalProgress.lastCompletedTask ? (
                      <p>Last: {selectedLifeGoalProgress.lastCompletedTask.text}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskDraftEntryOpen((current) => !current)}
                    className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                  >
                    + Add task
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs uppercase tracking-[0.18em] text-mist/52">Supporting detail</p>
            <div className="theme-surface-soft inline-flex rounded-full border p-1">
              {([
                ['focus', 'Focus'],
                ['tasks', 'Tasks'],
                ['roadmap', 'Roadmap'],
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

          <div className="mt-2 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.8fr))]">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Progress</p>
                <div className="mt-1 flex items-end gap-3">
                  <p className="text-[20px] font-semibold text-white">
                    {selectedLifeGoalProgress.completedTasks}/{selectedLifeGoalProgress.totalTasks} tasks
                  </p>
                  <p className="pb-0.5 text-sm text-mist">{selectedLifeGoalProgress.percent}% complete</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#5F8F4E]" style={{ width: `${progressWidth}%` }} />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Start</p>
                <p className="mt-1 text-sm text-white/82">{formatDate(selectedLifeGoal.startDate)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Target</p>
                <p className="mt-1 text-sm text-white/82">{selectedLifeGoal.targetDate ? formatDate(selectedLifeGoal.targetDate) : 'Not set'}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Minimum version</p>
                <p className="mt-1 line-clamp-2 text-sm text-white/78">{selectedLifeGoal.minimumVersion}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">If-Then plan</p>
                <p className="mt-1 line-clamp-2 text-sm text-white/74">{selectedLifeGoal.ifThenPlan || 'Not set'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
            This will permanently delete the goal, its tasks, notes, and related progress. This action cannot be undone.
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
