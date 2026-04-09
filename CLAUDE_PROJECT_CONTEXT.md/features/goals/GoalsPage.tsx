import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import EmojiPicker, { EmojiStyle, Theme as EmojiPickerTheme, SuggestionMode, type EmojiClickData } from 'emoji-picker-react'
import { Flag, Pin, icons, type LucideIcon } from 'lucide-react'
import { DetailDrawer } from '../../components/layout/DetailDrawer'
import { ResponsiveGrid, SectionCard } from '../../components/layout/LayoutPrimitives'
import {
  DialogSurface,
  FloatingPanelPosition,
  ModalSurface,
  OverlayBackdrop,
  OverlayRoot,
  PopoverSurface,
  getFocusableElements,
  getFloatingPanelPosition,
  useFocusTrap,
  useOverlayScrollLock,
  useReturnFocusOnClose,
} from '../../components/layout/OverlayPrimitives'
import { Button } from '../../components/ui/Button'
import { readJsonStorage, writeJsonStorage } from '../../lib/persistence/storage'
import {
  getAchievementDetailLabel,
  getTrackerGoalLabel,
  getTrackerGoalProgress,
  getLiveTrackerStreak,
  isHabitTrackerActiveOnDate,
} from '../../lib/habitTrackerGoals'
import {
  BadHabitDefinition,
  DayEntry,
  HabitTracker,
  HabitTrackerAchievement,
  LifeGoal,
  LifeGoalCategoryColor,
  LifeGoalCategoryDefinition,
  LifeGoalTask,
  LifeGoalTaskPriority,
  LifeGoalStatus,
  LifeGoalType,
  LifeGoalIcon,
  Task,
  LIFE_GOAL_CATEGORY_COLOR_OPTIONS,
} from '../../types'
import {
  LIFE_GOAL_PHASE_OPTIONS,
  getDaysFromToday,
  getLifeGoalTaskPriorityMeta,
  getPriorityScore,
  getRelativeDueMeta,
  getRoadmapTagGroups,
  getRoadmapTaskSections,
  getRoadmapTaskVisualState,
  normalizeTaskTag,
  normalizeTaskTags,
  normalizeLifeGoalPhaseValue,
  sortTasksForDisplay,
  suggestPhase,
} from './lib/taskDerivations'
import { useRoadmapSections } from './hooks/useGoalTaskDerivations'
import { LifeGoalFocusCard } from './components/LifeGoalFocusCard'
import { GoalProgressTimelineChart } from './components/GoalProgressTimelineChart'
import { LifeGoalNotesEditor } from './components/LifeGoalNotesEditor'
import { LifeGoalRoadmapPanel } from './components/LifeGoalRoadmapPanel'
import { LifeGoalTaskPeek } from './components/LifeGoalTaskPeek'
import { LifeGoalVisionCard } from './components/LifeGoalVisionCard'

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
type GoalOverviewViewMode = 'list' | 'board' | 'timeline'
type GoalOverviewGroupBy = 'none' | 'status' | 'category' | 'life-direction'
type GoalOverviewSortBy = 'manual' | 'due' | 'priority' | 'updated'
type GoalOverviewColumnKey =
  | 'category'
  | 'belongsTo'
  | 'due'
  | 'status'
  | 'completion'
  | 'milestones'
  | 'startDate'
  | 'targetDate'
  | 'priority'
type GoalOverviewColumns = Record<GoalOverviewColumnKey, boolean>
type GoalOverviewRowContentKey = 'icons' | 'why' | 'startDate' | 'targetDate' | 'dueAmount' | 'milestones' | 'directional'
type GoalOverviewRowContent = Record<GoalOverviewRowContentKey, boolean>
type GoalDetailContentKey = 'icon' | 'category' | 'status' | 'why' | 'vision' | 'metrics'
type GoalDetailContentVisibility = Record<GoalDetailContentKey, boolean>
type GoalDetailContentVisibilityByGoal = Record<string, GoalDetailContentVisibility>
type GoalOverviewRowActionState = {
  pinnedGoalIds: string[]
  highlightedGoalIds: string[]
}
type GoalOverviewViewControls = {
  view: GoalOverviewViewMode
  groupBy: GoalOverviewGroupBy
  sortBy: GoalOverviewSortBy
  showNextTask: boolean
  showCompleted: boolean
  columns: GoalOverviewColumns
  rowContent: GoalOverviewRowContent
  columnOrder: GoalOverviewColumnKey[]
}
type LifeGoalComposerMode = 'create' | 'edit'
type LifeGoalOverviewMode = 'manual' | 'grouped'
type LifeGoalOverviewDensity = 'compact' | 'expanded'
type LifeGoalOverviewSort = 'due' | 'recent' | 'name' | 'status'
type LifeGoalCreateStep = 'define' | 'path'
type LifeGoalRoadmapOrganization = 'default' | 'tag'
type LifeGoalTaskListSort = 'default' | 'due' | 'priority'
type GoalMilestone = NonNullable<LifeGoal['milestones']>[number]
type LifeGoalRoadmapPanelView = 'tasks' | 'milestones' | 'notes'

const LIFE_GOAL_TYPE_OPTIONS: Array<{
  value: LifeGoalType
  label: string
  description: string
}> = [
  { value: 'outcome', label: 'Outcome', description: 'Clear outcome with a defined finish' },
  { value: 'directional', label: 'Directional', description: 'Ongoing path — not meant to be completed' },
]

function canGoalTypeLinkToGoalType(sourceType: LifeGoalType, targetType: LifeGoalType) {
  if (sourceType === 'directional') {
    return targetType === 'outcome'
  }
  return false
}

const LIFE_GOAL_ICON_OPTIONS = Object.entries(icons)
  .filter(([name]) => !name.endsWith('Icon'))
  .map(([name, Icon]) => ({
    value: name,
    label: name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    search: name
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase(),
    Icon: Icon as LucideIcon,
  }))
  .sort((left, right) => left.label.localeCompare(right.label))

const LIFE_GOAL_ICON_MAP = Object.fromEntries(LIFE_GOAL_ICON_OPTIONS.map((option) => [option.value, option])) as Record<
  string,
  (typeof LIFE_GOAL_ICON_OPTIONS)[number]
>

const GOALS_UTILITY_PANEL_SHELL_CLASSNAME =
  'overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
const GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME = 'text-[12px] text-[rgba(255,255,255,0.85)]'
const GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME = 'text-[11px] text-[rgba(255,255,255,0.55)]'
const GOALS_UTILITY_PANEL_SELECT_CLASSNAME =
  'h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]'

function getOrderedGoalMilestones(goal: LifeGoal): GoalMilestone[] {
  return (goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
}

function getCurrentGoalMilestone(milestones: GoalMilestone[]) {
  return milestones.find((milestone) => !milestone.completed) ?? (milestones.length > 0 ? milestones[milestones.length - 1] : null)
}

function getMilestoneSelectOptions(milestones: GoalMilestone[], currentMilestoneId: string | null) {
  return [
    { value: '', label: 'No milestone' },
    ...milestones.map((milestone, index) => ({
      value: milestone.id,
      label: `${index + 1}. ${milestone.title.trim() || `Milestone ${index + 1}`}${
        currentMilestoneId === milestone.id ? ' — Current' : ''
      }`,
    })),
  ]
}

function getRoadmapTasksGroupedByMilestone(
  milestones: GoalMilestone[],
  sortedPlannedTasks: LifeGoalTask[],
  currentMilestoneId: string | null,
) {
  if (!currentMilestoneId) return []

  const milestoneIds = new Set(milestones.map((milestone) => milestone.id))

  return milestones
    .map((milestone) => {
      const tasks = sortedPlannedTasks.filter((task) => {
        const assignedMilestoneId = task.milestoneId && milestoneIds.has(task.milestoneId) ? task.milestoneId : currentMilestoneId
        return assignedMilestoneId === milestone.id
      })
      return tasks.length > 0 ? { milestone, tasks } : null
    })
    .filter((group): group is { milestone: GoalMilestone; tasks: LifeGoalTask[] } => Boolean(group))
}

type LifeGoalDraftTask = {
  id: string
  text: string
  milestoneId?: string | null
  phase?: string
  description: string
  notes: string
  dueDate: string | null
  priority: LifeGoalTaskPriority
  tags: string[]
  subtasks: Array<{
    id: string
    text: string
    completed: boolean
  }>
  completed: boolean
  completedAt: string | null
}

type LifeGoalDraftMilestone = {
  id: string
  title: string
  description: string
  targetDate: string | null
  completed: boolean
  completedAt: string | null
  order: number
}

type LifeGoalDraft = {
  title: string
  icon: LifeGoalIcon | null
  category: string
  goalType: LifeGoalType
  relatedGoalIds: string[]
  milestonesEnabled: boolean
  showProgressStrip: boolean
  whyItMatters: string
  minimumVersion: string
  startDate: string
  targetDate: string
  ifThenPlan: string
  status: LifeGoalStatus
  milestones: LifeGoalDraftMilestone[]
  tasks: LifeGoalDraftTask[]
}

type CompletionUndoState =
  | {
      kind: 'task'
      goalId: string
      taskId: string
      message: string
    }
  | {
      kind: 'subtask'
      goalId: string
      taskId: string
      subtaskId: string
      message: string
    }

type CompletionPulseState = {
  id: number
  top: number
  left: number
}

type LifeGoalVisionMode = 'images' | 'statement' | 'images-statement'
type LifeGoalVisionEditMode = LifeGoalVisionMode | 'hide'

const GOAL_OVERVIEW_VIEW_CONTROLS_STORAGE_KEY = 'goals-overview-view-controls-v1'
const GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY = 'goals-overview-row-actions-v1'
const GOAL_DETAIL_CONTENT_VISIBILITY_STORAGE_KEY = 'goal-detail-content-visibility-v1'
const GOAL_OVERVIEW_COLUMN_ORDER: GoalOverviewColumnKey[] = [
  'completion',
  'priority',
  'category',
  'belongsTo',
  'due',
  'startDate',
  'targetDate',
  'milestones',
  'status',
]
const DEFAULT_GOAL_OVERVIEW_COLUMNS: GoalOverviewColumns = {
  category: true,
  belongsTo: true,
  due: true,
  status: true,
  completion: true,
  milestones: false,
  startDate: true,
  targetDate: true,
  priority: true,
}
const DEFAULT_GOAL_OVERVIEW_ROW_CONTENT: GoalOverviewRowContent = {
  icons: true,
  why: true,
  startDate: true,
  targetDate: true,
  dueAmount: true,
  milestones: true,
  directional: true,
}
const DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS: GoalOverviewViewControls = {
  view: 'list',
  groupBy: 'none',
  sortBy: 'manual',
  showNextTask: false,
  showCompleted: false,
  columns: DEFAULT_GOAL_OVERVIEW_COLUMNS,
  rowContent: DEFAULT_GOAL_OVERVIEW_ROW_CONTENT,
  columnOrder: GOAL_OVERVIEW_COLUMN_ORDER,
}
const DEFAULT_GOAL_OVERVIEW_ROW_ACTIONS: GoalOverviewRowActionState = {
  pinnedGoalIds: [],
  highlightedGoalIds: [],
}
const DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY: GoalDetailContentVisibility = {
  icon: true,
  category: true,
  status: true,
  why: true,
  vision: true,
  metrics: true,
}
const GOAL_OVERVIEW_USE_TITLE_CASE = false

function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function normalizeGoalOverviewViewControls(
  value: Partial<GoalOverviewViewControls> | null | undefined,
): GoalOverviewViewControls {
  const candidateColumnOrder = Array.isArray(value?.columnOrder)
    ? value.columnOrder.filter((column): column is GoalOverviewColumnKey => GOAL_OVERVIEW_COLUMN_ORDER.includes(column as GoalOverviewColumnKey))
    : []
  const normalizedColumnOrder = [
    ...candidateColumnOrder,
    ...GOAL_OVERVIEW_COLUMN_ORDER.filter((column) => !candidateColumnOrder.includes(column)),
  ]

  return {
    view:
      value?.view === 'list' || value?.view === 'board' || value?.view === 'timeline'
        ? value.view
        : DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS.view,
    groupBy:
      value?.groupBy === 'none' ||
      value?.groupBy === 'status' ||
      value?.groupBy === 'category' ||
      value?.groupBy === 'life-direction'
        ? value.groupBy
        : DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS.groupBy,
    sortBy:
      value?.sortBy === 'manual' ||
      value?.sortBy === 'due' ||
      value?.sortBy === 'priority' ||
      value?.sortBy === 'updated'
        ? value.sortBy
        : DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS.sortBy,
    showNextTask:
      typeof value?.showNextTask === 'boolean'
        ? value.showNextTask
        : DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS.showNextTask,
    showCompleted:
      typeof value?.showCompleted === 'boolean'
        ? value.showCompleted
        : DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS.showCompleted,
    columns: {
      ...DEFAULT_GOAL_OVERVIEW_COLUMNS,
      ...(value?.columns ?? {}),
      milestones: false,
    },
    rowContent: {
      ...DEFAULT_GOAL_OVERVIEW_ROW_CONTENT,
      ...(value?.rowContent ?? {}),
    },
    columnOrder: normalizedColumnOrder,
  }
}

function normalizeGoalOverviewRowActions(
  value: Partial<GoalOverviewRowActionState> | null | undefined,
): GoalOverviewRowActionState {
  const pinnedGoalIds = Array.isArray(value?.pinnedGoalIds)
    ? Array.from(new Set(value.pinnedGoalIds.filter((item): item is string => typeof item === 'string' && item.length > 0)))
    : []
  const highlightedGoalIds = Array.isArray(value?.highlightedGoalIds)
    ? Array.from(new Set(value.highlightedGoalIds.filter((item): item is string => typeof item === 'string' && item.length > 0)))
    : []

  return {
    pinnedGoalIds,
    highlightedGoalIds,
  }
}

function normalizeGoalDetailContentVisibility(
  value: Partial<GoalDetailContentVisibility> | null | undefined,
): GoalDetailContentVisibility {
  return {
    icon: typeof value?.icon === 'boolean' ? value.icon : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.icon,
    category: typeof value?.category === 'boolean' ? value.category : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.category,
    status: typeof value?.status === 'boolean' ? value.status : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.status,
    why: typeof value?.why === 'boolean' ? value.why : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.why,
    vision: typeof value?.vision === 'boolean' ? value.vision : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.vision,
    metrics: typeof value?.metrics === 'boolean' ? value.metrics : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY.metrics,
  }
}

function normalizeGoalDetailContentVisibilityByGoal(
  value: GoalDetailContentVisibilityByGoal | Partial<GoalDetailContentVisibility> | null | undefined,
): GoalDetailContentVisibilityByGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  if (
    'icon' in value ||
    'category' in value ||
    'status' in value ||
    'why' in value ||
    'vision' in value ||
    'metrics' in value
  ) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([goalId, visibility]) => {
      if (!goalId || typeof visibility !== 'object' || visibility === null || Array.isArray(visibility)) return []
      return [[goalId, normalizeGoalDetailContentVisibility(visibility as Partial<GoalDetailContentVisibility>)]]
    }),
  )
}

function createLifeGoalDraftTask(text = ''): LifeGoalDraftTask {
  return {
    id: `life-goal-draft-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    milestoneId: null,
    phase: suggestPhase(text) ?? '',
    description: '',
    notes: '',
    dueDate: null,
    priority: 'none',
    tags: [],
    subtasks: [],
    completed: false,
    completedAt: null,
  }
}

function createLifeGoalDraftMilestone(title = ''): LifeGoalDraftMilestone {
  return {
    id: `life-goal-milestone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    description: '',
    targetDate: null,
    completed: false,
    completedAt: null,
    order: 0,
  }
}

function normalizeLifeGoalDraftMilestones(milestones: LifeGoalDraftMilestone[]): LifeGoalDraftMilestone[] {
  return milestones
    .map((milestone, index) => {
      const title = milestone.title.trim()
      if (!title) return null
      return {
        ...milestone,
        title,
        description: milestone.description.trim(),
        targetDate: milestone.targetDate && isValidIsoDate(milestone.targetDate) ? milestone.targetDate : null,
        completedAt: milestone.completed ? milestone.completedAt ?? new Date().toISOString() : null,
        order: index,
      }
    })
    .filter((milestone): milestone is LifeGoalDraftMilestone => Boolean(milestone))
}

function reindexLifeGoalMilestones(milestones: LifeGoalDraftMilestone[]): LifeGoalDraftMilestone[] {
  return milestones.map((milestone, index) => ({
    ...milestone,
    targetDate: milestone.targetDate && isValidIsoDate(milestone.targetDate) ? milestone.targetDate : null,
    completedAt: milestone.completed ? milestone.completedAt ?? new Date().toISOString() : null,
    order: index,
  }))
}

function createEmptyLifeGoalTask(): LifeGoalTask {
  return {
    id: `life-goal-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: '',
    milestoneId: null,
    phase: undefined,
    description: '',
    notes: '',
    dueDate: null,
    priority: 'none',
    tags: [],
    subtasks: [],
    completed: false,
    completedAt: null,
  }
}

function isLifeGoalTaskDraftEmpty(task: LifeGoalTask) {
  const normalizedPhase = normalizeLifeGoalPhaseValue(task.phase)
  return (
    !task.text.trim() &&
    !task.description.trim() &&
    !task.notes.trim() &&
    !task.dueDate &&
    task.priority === 'none' &&
    task.tags.length === 0 &&
    task.subtasks.length === 0 &&
    normalizedPhase === 'general'
  )
}

function getMilestoneTaskProgress(tasks: LifeGoalTask[]) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : null
  return { total, completed, percent }
}

function inferLifeGoalVisionMode(goal: Pick<LifeGoal, 'visionImages' | 'visionStatement'>): LifeGoalVisionMode {
  if (goal.visionStatement.trim() && goal.visionImages.length > 0) return 'images-statement'
  if (goal.visionStatement.trim() && goal.visionImages.length === 0) return 'statement'
  return 'images'
}

function createEmptyLifeGoalDraft(): LifeGoalDraft {
  return {
    title: '',
    icon: null,
    category: '',
    goalType: 'outcome',
    relatedGoalIds: [],
    milestonesEnabled: false,
    showProgressStrip: true,
    whyItMatters: '',
    minimumVersion: '',
    startDate: getTodayIsoDate(),
    targetDate: '',
    ifThenPlan: '',
    status: 'not-started',
    milestones: [],
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

function formatDateShortYear(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatDateContextual(date: string) {
  const targetDate = new Date(`${date}T00:00:00Z`)
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`)
  const sameYear = targetDate.getUTCFullYear() === today.getUTCFullYear()

  return targetDate.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' as const }),
  })
}

function formatTaskDueDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTaskCompletedDate(date: string) {
  return new Date(date).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
  })
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function shiftIsoDate(date: string, deltaDays: number) {
  const shiftedDate = new Date(`${date}T00:00:00Z`)
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + deltaDays)
  return shiftedDate.toISOString().slice(0, 10)
}

function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function getLifeSignalBucket(day: DayEntry): 'good' | 'neutral' | 'low' | null {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)
  if (values.length === 0) return null
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  if (average >= 7) return 'good'
  if (average <= 4) return 'low'
  return 'neutral'
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
        label: 'Completed',
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
        label: 'Active',
        badgeClassName:
          'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.9)]',
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

function getLifeGoalFlowState(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
  if (goal.status === 'complete') return null
  if (!progress.lastCompletedTask?.completedAt) {
    return {
      label: 'Stalled',
      toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.72)]',
    }
  }

  const completedAt = new Date(progress.lastCompletedTask.completedAt).getTime()
  if (Number.isNaN(completedAt)) {
    return {
      label: 'Stalled',
      toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.72)]',
    }
  }

  const diffDays = Math.floor((Date.now() - completedAt) / 86400000)
  if (diffDays <= 2) {
    return {
      label: 'Active',
      toneClassName: 'text-[rgb(var(--theme-accent-rgb)/0.76)]',
    }
  }
  if (diffDays <= 5) {
    return {
      label: 'Cooling',
      toneClassName: 'theme-text-muted',
    }
  }
  return {
    label: 'Stalled',
    toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.72)]',
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

function renderCalendarAddIcon(size = 18) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 2.45V4.35M2.55 6.1H12.35M4.45 3.1H11.35C12.565 3.1 13.55 4.085 13.55 5.3V7.55M2.35 5.3C2.35 4.085 3.335 3.1 4.55 3.1M2.35 5.3V11.25C2.35 12.465 3.335 13.45 4.55 13.45H7.55"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.45 9.9V14.25M10.25 12.075H14.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
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

function renderLifeGoalIcon(icon: LifeGoalIcon | null | undefined, className: string, size = 15) {
  if (!icon) return null
  if (icon.startsWith('emoji:')) {
    return (
      <span
        className={className}
        style={{ fontSize: `${size}px`, lineHeight: 1 }}
        aria-hidden="true"
      >
        {icon.slice(6)}
      </span>
    )
  }
  const option = LIFE_GOAL_ICON_MAP[icon]
  if (!option) return null
  const Icon = option.Icon
  return <Icon className={className} size={size} strokeWidth={1.8} aria-hidden="true" />
}

function renderLifeGoalTitleWithIcon(
  icon: LifeGoalIcon | null | undefined,
  title: string,
  options?: {
    iconClassName?: string
    iconSize?: number
    titleClassName?: string
    wrapperClassName?: string
  },
) {
  return (
    <span className={options?.wrapperClassName ?? 'inline-flex min-w-0 items-center gap-2'}>
      {renderLifeGoalIcon(icon, options?.iconClassName ?? 'shrink-0 text-white/50', options?.iconSize ?? 15)}
      <span className={options?.titleClassName ?? 'truncate'}>{title}</span>
    </span>
  )
}

function normalizeLifeGoalDraftTasks(tasks: LifeGoalDraftTask[]): LifeGoalTask[] {
  const normalizedTasks: LifeGoalTask[] = []

  for (const task of tasks) {
    const text = task.text.trim()
    if (!text) continue

    normalizedTasks.push({
      id: task.id,
      text,
      milestoneId: task.milestoneId ?? null,
      phase: normalizeLifeGoalPhaseValue(task.phase),
      description: task.description.trim(),
      notes: task.notes,
      dueDate: task.dueDate && isValidIsoDate(task.dueDate) ? task.dueDate : null,
      priority: task.priority,
      tags: normalizeTaskTags(task.tags),
      subtasks: task.subtasks
        .map((subtask) => ({
          id: subtask.id,
          text: subtask.text.trim(),
          completed: subtask.completed,
        }))
        .filter((subtask) => subtask.text.length > 0),
      completed: task.completed,
      completedAt: task.completed ? task.completedAt ?? new Date().toISOString() : null,
    })
  }

  return normalizedTasks
}

function collapseCreateDraftTasks(tasks: LifeGoalDraftTask[]): LifeGoalDraftTask[] {
  const nonEmptyTasks = tasks.filter((task) => task.text.trim().length > 0)
  const emptyTask = tasks.find((task) => task.text.trim().length === 0) ?? createLifeGoalDraftTask()
  return [...nonEmptyTasks, emptyTask]
}

function createLifeGoalDraftFromGoal(goal: LifeGoal): LifeGoalDraft {
  return {
    title: goal.title,
    icon: goal.icon ?? null,
    category: goal.category,
    goalType: goal.goalType,
    relatedGoalIds: goal.relatedGoalIds ?? [],
    milestonesEnabled: goal.goalType === 'outcome' ? (goal.milestonesEnabled ?? (goal.milestones?.length ?? 0) > 0) : false,
    showProgressStrip: goal.showProgressStrip !== false,
    whyItMatters: goal.whyItMatters,
    minimumVersion: goal.minimumVersion,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    ifThenPlan: goal.ifThenPlan,
    status: goal.status,
    milestones: (goal.milestones ?? []).map((milestone, index) => ({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description ?? '',
      targetDate: milestone.targetDate ?? null,
      completed: milestone.completed,
      completedAt: milestone.completedAt,
      order: typeof milestone.order === 'number' ? milestone.order : index,
    })),
    tasks:
      goal.tasks.length > 0
        ? goal.tasks.map((task) => ({
            id: task.id,
            text: task.text,
            milestoneId: task.milestoneId ?? null,
            phase: normalizeLifeGoalPhaseValue(task.phase),
            description: task.description,
            notes: task.notes,
            dueDate: task.dueDate,
            priority: task.priority,
            tags: task.tags,
            subtasks: task.subtasks,
            completed: task.completed,
            completedAt: task.completedAt,
          }))
        : [createLifeGoalDraftTask()],
  }
}

function createLifeGoalTaskSubtask(text = '') {
  return {
    id: `life-goal-subtask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    completed: false,
  }
}

function getTaskPriorityOptions(): Array<{ value: LifeGoalTaskPriority; label: string }> {
  return [
    { value: 'none', label: 'None' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]
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

function getLifeGoalCategoryChipTextStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    color: `rgb(var(${variable}) / 0.82)`,
  }
}

function getLifeGoalAccentBarStyle(color: LifeGoalCategoryColor): CSSProperties {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    ['--goal-rail-rgb' as string]: `var(${variable})`,
  }
}

function getLifeGoalCardHighlightStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(var(${variable}) / 0.14), 0 16px 34px rgb(15 23 42 / 0.12)`,
  }
}

function getLifeGoalRowHighlightStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 0 0 1px rgb(var(${variable}) / 0.12)`,
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

function getSubtaskProgressDots(subtasks: LifeGoalTask['subtasks']) {
  const total = subtasks.length
  if (total === 0) return []

  const completed = subtasks.filter((subtask) => subtask.completed).length
  const visibleCount = Math.min(5, total)

  return Array.from({ length: visibleCount }, (_, index) => {
    const threshold = Math.round(((index + 1) / visibleCount) * total)
    return completed >= threshold
  })
}

function getSubtaskProgressSummary(subtasks: LifeGoalTask['subtasks']) {
  const total = subtasks.length
  const completed = subtasks.filter((subtask) => subtask.completed).length
  return { total, completed }
}

function getGoalSubtaskProgress(tasks: LifeGoalTask[]) {
  const total = tasks.reduce((sum, task) => sum + task.subtasks.length, 0)
  const completed = tasks.reduce(
    (sum, task) => sum + task.subtasks.filter((subtask) => subtask.completed).length,
    0,
  )
  return { total, completed }
}

function renderSubtaskProgressDots(subtasks: LifeGoalTask['subtasks'], tone: 'active' | 'completed' = 'active') {
  const summary = getSubtaskProgressSummary(subtasks)
  if (summary.total === 0) return null

  return (
    <span className="group/subtasks relative inline-flex items-center" aria-label={`${summary.completed} of ${summary.total} subtasks complete`}>
      <span className="flex items-center gap-1 pt-0.5">
        {getSubtaskProgressDots(subtasks).map((filled, dotIndex) => (
          <span
            key={`subtask-dot-${dotIndex}`}
            className={`h-1.5 w-1.5 rounded-full border ${
              filled
                ? tone === 'completed'
                  ? 'border-[rgb(var(--theme-accent-rgb)/0.36)] bg-[rgb(var(--theme-accent-rgb)/0.46)]'
                  : 'border-[rgb(var(--theme-accent-rgb)/0.5)] bg-[rgb(var(--theme-accent-rgb)/0.62)]'
                : tone === 'completed'
                  ? 'border-white/[0.14] bg-transparent'
                  : 'border-white/[0.18] bg-transparent'
            }`}
          />
        ))}
      </span>
      <span className="theme-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/subtasks:block group-hover/subtasks:opacity-100 group-hover/subtasks:translate-y-0">
        {summary.completed} of {summary.total} subtasks complete
      </span>
    </span>
  )
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

function createLifeGoalFromDraft(draft: LifeGoalDraft): LifeGoal {
  const timestamp = new Date().toISOString()
  const tasks = normalizeLifeGoalDraftTasks(draft.tasks).map((task) => ({
    ...task,
    phase:
      task.phase?.trim()
        ? task.phase.trim()
        : task.id.startsWith('life-goal-draft-task-')
          ? suggestPhase(task.text) ?? undefined
          : task.phase,
    id: task.id.startsWith('life-goal-draft-task-')
      ? `life-goal-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      : task.id,
  }))
  return {
    id: `life-goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    title: draft.title.trim(),
    icon: draft.icon ?? null,
    category: draft.category.trim(),
    goalType: draft.goalType,
    relatedGoalIds: Array.from(new Set(draft.relatedGoalIds.filter(Boolean))),
    milestonesEnabled: draft.goalType === 'outcome' ? draft.milestonesEnabled : false,
    showProgressStrip: draft.showProgressStrip,
    showExpectedProgressLine: true,
    whyItMatters: draft.whyItMatters.trim(),
    notes: '',
    visionStatement: '',
    visionImages: [],
    visionCollapsed: true,
    visionMode: 'images',
    minimumVersion: draft.minimumVersion.trim(),
    ifThenPlan: draft.ifThenPlan.trim(),
    startDate: draft.startDate,
    targetDate: draft.targetDate,
    status: draft.status,
    isPrimary: false,
    order: 0,
    milestones: draft.goalType === 'outcome' ? normalizeLifeGoalDraftMilestones(draft.milestones) : [],
    tasks,
    linkedHabitIds: [],
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createLifeGoalUpdateFromDraft(goal: LifeGoal, draft: LifeGoalDraft, relatedGoalIds: string[], tasks: LifeGoalTask[]): LifeGoal {
  return {
    ...goal,
    title: draft.title.trim(),
    icon: draft.icon ?? null,
    category: draft.category.trim(),
    goalType: draft.goalType,
    relatedGoalIds: Array.from(new Set(relatedGoalIds.filter((goalId) => goalId !== goal.id))),
    milestonesEnabled: draft.goalType === 'outcome' ? draft.milestonesEnabled : false,
    showProgressStrip: draft.showProgressStrip,
    whyItMatters: draft.whyItMatters.trim(),
    minimumVersion: draft.minimumVersion.trim(),
    ifThenPlan: draft.ifThenPlan.trim(),
    startDate: draft.startDate,
    targetDate: draft.targetDate,
    status: draft.status,
    milestones: draft.goalType === 'outcome' ? normalizeLifeGoalDraftMilestones(draft.milestones) : [],
    tasks,
  }
}

function getLifeGoalEditSnapshot(goal: LifeGoal) {
  return JSON.stringify({
    title: goal.title.trim(),
    icon: goal.icon ?? null,
    category: goal.category.trim(),
    goalType: goal.goalType,
    relatedGoalIds: [...(goal.relatedGoalIds ?? [])].sort(),
    milestonesEnabled: Boolean(goal.milestonesEnabled),
    showProgressStrip: goal.showProgressStrip !== false,
    whyItMatters: goal.whyItMatters.trim(),
    minimumVersion: goal.minimumVersion.trim(),
    ifThenPlan: goal.ifThenPlan.trim(),
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    status: goal.status,
    milestones: goal.milestones ?? [],
    tasks: goal.tasks,
  })
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
    linkedGoalIds: [],
    linkedDirectionIds: [],
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

function sortLifeGoalsByDue(goals: LifeGoal[]) {
  const today = getTodayIsoDate()

  const getDueRank = (goal: LifeGoal) => {
    if (!isValidIsoDate(goal.targetDate)) {
      return { bucket: 3, distance: Number.POSITIVE_INFINITY }
    }

    const dueTime = new Date(`${goal.targetDate}T00:00:00Z`).getTime()
    const todayTime = new Date(`${today}T00:00:00Z`).getTime()
    const diffDays = Math.round((dueTime - todayTime) / 86400000)

    if (diffDays < 0) {
      return { bucket: 0, distance: Math.abs(diffDays) }
    }

    if (diffDays === 0) {
      return { bucket: 1, distance: 0 }
    }

    return { bucket: 2, distance: diffDays }
  }

  return [...goals].sort((left, right) => {
    const leftRank = getDueRank(left)
    const rightRank = getDueRank(right)

    if (leftRank.bucket !== rightRank.bucket) {
      return leftRank.bucket - rightRank.bucket
    }

    if (leftRank.bucket === 0) {
      if (leftRank.distance !== rightRank.distance) {
        return rightRank.distance - leftRank.distance
      }
    } else if (leftRank.distance !== rightRank.distance) {
      return leftRank.distance - rightRank.distance
    }

    return left.title.localeCompare(right.title)
  })
}

function sortLifeGoalsByRecentlyAdded(goals: LifeGoal[]) {
  return [...goals].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function sortLifeGoalsByName(goals: LifeGoal[]) {
  return [...goals].sort((left, right) => left.title.localeCompare(right.title))
}

function sortLifeGoalsByStatus(goals: LifeGoal[]) {
  const getStatusRank = (goal: LifeGoal) => {
    if (goal.status === 'in-motion') return 0
    if (goal.status === 'not-started') return 1
    if (goal.status === 'paused') return 2
    return 3
  }

  return [...goals].sort((left, right) => {
    const rankDiff = getStatusRank(left) - getStatusRank(right)
    if (rankDiff !== 0) return rankDiff
    return left.title.localeCompare(right.title)
  })
}

function sortLifeGoalsForOverview(goals: LifeGoal[], sortMode: LifeGoalOverviewSort) {
  switch (sortMode) {
    case 'recent':
      return sortLifeGoalsByRecentlyAdded(goals)
    case 'name':
      return sortLifeGoalsByName(goals)
    case 'status':
      return sortLifeGoalsByStatus(goals)
    case 'due':
    default:
      return sortLifeGoalsByDue(goals)
  }
}

const goalStatusChipClassName =
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] leading-none'
const LIFE_GOAL_VISION_IMAGE_LIMIT = 4

function renderVisionImageTile(
  image: string,
  index: number,
  className: string,
  options?: {
    fitMode?: 'cover' | 'contain'
    displayStyle?: 'default' | 'minimal'
    onOpenPreview?: (image: string) => void
    overlayLabel?: string | null
    draggableState?: {
      enabled: boolean
      draggedIndex: number | null
      dragOverIndex: number | null
      onDragStart: (index: number) => void
      onDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void
      onDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void
      onDragEnd: () => void
    }
    removable?: boolean
    onRemove?: (index: number) => void
    interactive?: {
      enabled: boolean
      rotateX: any
      rotateY: any
      shiftX: any
      shiftY: any
      sheenX: any
      onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void
      onMouseLeave: () => void
    }
  },
) {
  const fitMode = options?.fitMode ?? 'cover'
  const displayStyle = options?.displayStyle ?? 'default'
  const isMinimalDisplay = displayStyle === 'minimal'
  const isDragged = options?.draggableState?.draggedIndex === index
  const isDragOver =
    options?.draggableState?.dragOverIndex === index &&
    options.draggableState.draggedIndex !== null &&
    options.draggableState.draggedIndex !== index
  const content = (
    <>
      <div
        onClick={(event) => {
          if (!options?.onOpenPreview) return
          event.stopPropagation()
          options.onOpenPreview(image)
        }}
        className={`flex w-full justify-center overflow-hidden rounded-[inherit] ${
          isMinimalDisplay ? 'items-start' : 'h-full items-center'
        } ${
          options?.onOpenPreview ? 'cursor-zoom-in' : ''
        } ${
          isMinimalDisplay ? '' : 'bg-white/[0.03]'
        }`}
      >
        <motion.img
          src={image}
          alt=""
          className={`transition duration-300 group-hover:scale-[1.02] ${
            isMinimalDisplay
              ? 'h-auto w-full max-h-[360px] object-contain'
              : fitMode === 'contain'
                ? 'h-full w-full max-h-full object-contain'
                : 'h-full w-full object-cover'
          }`}
          style={
            options?.interactive?.enabled
              ? {
                  x: options.interactive.shiftX,
                  y: options.interactive.shiftY,
                  scale: 1.035,
                }
              : undefined
          }
        />
      </div>
      {options?.interactive?.enabled ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_18%,rgba(255,255,255,0.08)_50%,transparent_82%)] opacity-40"
          style={{ x: options.interactive.sheenX }}
        />
      ) : null}
      {options?.overlayLabel ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/26">
          <span className="rounded-full border border-white/[0.08] bg-black/38 px-3 py-1 text-[12px] font-medium tracking-[0.08em] text-white/86">
            {options.overlayLabel}
          </span>
        </div>
      ) : null}
      {options?.removable && options.onRemove ? (
        <button
          type="button"
          onClick={() => options.onRemove?.(index)}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-black/38 text-[11px] uppercase tracking-[0.12em] text-white/70 opacity-0 transition group-hover:opacity-100 hover:text-white"
        >
          ×
        </button>
      ) : null}
    </>
  )

  if (options?.interactive?.enabled) {
    return (
      <motion.div
        key={`vision-image-${index}`}
        onMouseMove={options.interactive.onMouseMove}
        onMouseLeave={options.interactive.onMouseLeave}
        style={{
          rotateX: options.interactive.rotateX,
          rotateY: options.interactive.rotateY,
          transformPerspective: 1200,
          transformStyle: 'preserve-3d',
        }}
        draggable={options?.draggableState?.enabled}
        onDragStart={() => options?.draggableState?.onDragStart(index)}
        onDragOver={(event) => options?.draggableState?.onDragOver(event, index)}
        onDrop={(event) => options?.draggableState?.onDrop(event, index)}
        onDragEnd={options?.draggableState?.onDragEnd}
        className={`group relative overflow-hidden rounded-[18px] transition duration-300 ${className} ${
          isMinimalDisplay
            ? 'bg-transparent hover:shadow-[0_10px_24px_rgba(0,0,0,0.14)]'
            : 'border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)]'
        } ${options?.draggableState?.enabled ? 'cursor-grab active:cursor-grabbing' : ''} ${
          isDragged ? 'z-[2] scale-[1.02] opacity-80 shadow-[0_16px_36px_rgba(0,0,0,0.22)]' : ''
        } ${isDragOver ? 'ring-1 ring-white/14' : ''}`}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <div
      key={`vision-image-${index}`}
      draggable={options?.draggableState?.enabled}
      onDragStart={() => options?.draggableState?.onDragStart(index)}
      onDragOver={(event) => options?.draggableState?.onDragOver(event, index)}
      onDrop={(event) => options?.draggableState?.onDrop(event, index)}
      onDragEnd={options?.draggableState?.onDragEnd}
      className={`group relative overflow-hidden rounded-[18px] transition duration-300 ${className} ${
        isMinimalDisplay
          ? 'bg-transparent hover:shadow-[0_10px_24px_rgba(0,0,0,0.14)]'
          : 'border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)]'
      } ${options?.draggableState?.enabled ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isDragged ? 'z-[2] scale-[1.02] opacity-80 shadow-[0_16px_36px_rgba(0,0,0,0.22)]' : ''
      } ${isDragOver ? 'ring-1 ring-white/14' : ''}`}
    >
      {content}
    </div>
  )
}

function renderVisionImageLayout(
  images: string[],
  options?: {
    fitMode?: 'cover' | 'contain'
    displayStyle?: 'default' | 'minimal'
    onOpenPreview?: (image: string) => void
    draggableState?: {
      enabled: boolean
      draggedIndex: number | null
      dragOverIndex: number | null
      onDragStart: (index: number) => void
      onDragOver: (event: React.DragEvent<HTMLDivElement>, index: number) => void
      onDrop: (event: React.DragEvent<HTMLDivElement>, index: number) => void
      onDragEnd: () => void
    }
    removable?: boolean
    onRemove?: (index: number) => void
    interactive?: {
      enabled: boolean
      rotateX: any
      rotateY: any
      shiftX: any
      shiftY: any
      sheenX: any
      onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void
      onMouseLeave: () => void
    }
  },
) {
  const visibleImages =
    options?.displayStyle === 'minimal'
      ? images.slice(0, Math.min(2, LIFE_GOAL_VISION_IMAGE_LIMIT))
      : images.slice(0, LIFE_GOAL_VISION_IMAGE_LIMIT)
  if (visibleImages.length === 0) return null
  const hiddenImageCount = Math.max(0, images.length - visibleImages.length)

  const renderTile = (image: string, index: number, tileClassName: string) =>
    renderVisionImageTile(image, index, tileClassName, {
      ...options,
      overlayLabel: hiddenImageCount > 0 && index === visibleImages.length - 1 ? `+${hiddenImageCount}` : null,
    })

  if (visibleImages.length === 1) {
    return (
      <div className="w-full">
        {renderTile(
          visibleImages[0],
          0,
          options?.displayStyle === 'minimal' ? 'w-full' : 'aspect-[16/9] w-full',
        )}
      </div>
    )
  }

  if (visibleImages.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-3 ${options?.displayStyle === 'minimal' ? 'items-start' : ''}`}>
        {visibleImages.map((image, index) =>
          renderTile(image, index, options?.displayStyle === 'minimal' ? 'w-full' : 'aspect-[1.08/1]'),
        )}
      </div>
    )
  }

  if (visibleImages.length === 3) {
    return (
      <div className="space-y-3">
        <div className={`grid grid-cols-2 gap-3 ${options?.displayStyle === 'minimal' ? 'items-start' : ''}`}>
          {visibleImages
            .slice(0, 2)
            .map((image, index) => renderTile(image, index, options?.displayStyle === 'minimal' ? 'w-full' : 'aspect-[1.08/1]'))}
        </div>
        {renderTile(
          visibleImages[2],
          2,
          options?.displayStyle === 'minimal' ? 'w-full' : 'aspect-[2.1/1] w-full',
        )}
      </div>
    )
  }

  return (
    <div className={`grid grid-cols-2 gap-3 ${options?.displayStyle === 'minimal' ? 'items-start' : ''}`}>
      {visibleImages.map((image, index) =>
        renderTile(image, index, options?.displayStyle === 'minimal' ? 'w-full' : 'aspect-[1.08/1]'),
      )}
    </div>
  )
}

export function GoalsPage({
  habitTrackers,
  lifeGoals,
  lifeGoalCategories,
  tasks,
  days,
  badHabitDateMap,
  year,
  goalsView,
  selectedLifeGoalId,
  onSelectLifeGoal,
  onChangeGoalsView,
  onCreateHabitTracker,
  onCreateLifeGoal,
  onUpdateLifeGoal,
  onReorderLifeGoals,
  onEnsureLifeGoalCategory,
  onSetLifeGoalCategoryColor,
  onArchiveLifeGoal,
  onDeleteLifeGoal,
  onSetLifeGoalAsTodayTask,
  onOpenGlobalTasks,
  onOpenHabitTracker,
}: {
  habitTrackers: HabitTracker[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  tasks: Task[]
  days: DayEntry[]
  badHabitDateMap: Map<string, BadHabitDefinition[]>
  year: number
  goalsView: GoalsView
  selectedLifeGoalId: string | null
  onSelectLifeGoal: (goalId: string | null) => void
  onChangeGoalsView: (view: GoalsView) => void
  onCreateHabitTracker: (tracker: HabitTracker) => void
  onCreateLifeGoal: (goal: LifeGoal) => void
  onUpdateLifeGoal: (goalId: string, updater: (goal: LifeGoal) => LifeGoal) => void
  onReorderLifeGoals: (goalIds: string[]) => void
  onEnsureLifeGoalCategory: (name: string) => void
  onSetLifeGoalCategoryColor: (name: string, color: LifeGoalCategoryColor) => void
  onArchiveLifeGoal: (goalId: string) => void
  onDeleteLifeGoal: (goalId: string) => void
  onSetLifeGoalAsTodayTask: (goal: LifeGoal) => void
  onOpenGlobalTasks: () => void
  onOpenHabitTracker: (trackerId: string) => void
}) {
  const safeHabitTrackers = habitTrackers ?? []
  const safeLifeGoals = lifeGoals ?? []
  const safeLifeGoalCategories = lifeGoalCategories ?? []
  const safeTasks = tasks ?? []
  const [selectedGoal, setSelectedGoal] = useState<GoalDetailItem | null>(null)
  const [lifeGoalDraft, setLifeGoalDraft] = useState<LifeGoalDraft>(() => createEmptyLifeGoalDraft())
  const [lifeGoalComposerMode, setLifeGoalComposerMode] = useState<LifeGoalComposerMode>('create')
  const [lifeGoalCreateStep, setLifeGoalCreateStep] = useState<LifeGoalCreateStep>('define')
  const [editingLifeGoalId, setEditingLifeGoalId] = useState<string | null>(null)
  const [inlineLifeGoalEditingField, setInlineLifeGoalEditingField] = useState<'title' | 'why' | null>(null)
  const [inlineLifeGoalIconGoalId, setInlineLifeGoalIconGoalId] = useState<string | null>(null)
  const [lifeGoalComposerOpen, setLifeGoalComposerOpen] = useState(lifeGoals.length === 0)
  const [creatingTaskPeekId, setCreatingTaskPeekId] = useState<string | null>(null)
  const [lifeGoalActionFeedback, setLifeGoalActionFeedback] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const [canUseVisionTilt, setCanUseVisionTilt] = useState(false)
  const [visionCollapsedByGoal, setVisionCollapsedByGoal] = useState<Record<string, boolean>>({})
  const [visionEditorOpenByGoal, setVisionEditorOpenByGoal] = useState<Record<string, boolean>>({})
  const [visionModeByGoal, setVisionModeByGoal] = useState<Record<string, LifeGoalVisionMode>>({})
  const [visionEditModeByGoal, setVisionEditModeByGoal] = useState<Record<string, LifeGoalVisionEditMode>>({})
  const [visionPreviewImage, setVisionPreviewImage] = useState<string | null>(null)
  const [visionDropActive, setVisionDropActive] = useState(false)
  const [draggedVisionImageIndex, setDraggedVisionImageIndex] = useState<number | null>(null)
  const [dragOverVisionImageIndex, setDragOverVisionImageIndex] = useState<number | null>(null)
  const [roadmapPanelViewByGoal, setRoadmapPanelViewByGoal] = useState<Record<string, LifeGoalRoadmapPanelView>>({})
  const [selectedMilestoneIdByGoal, setSelectedMilestoneIdByGoal] = useState<Record<string, string | null>>({})
  const [linkHabitPickerOpen, setLinkHabitPickerOpen] = useState(false)
  const [habitDraftByTaskId, setHabitDraftByTaskId] = useState<Record<string, string>>({})
  const [lifeGoalDetailTab, setLifeGoalDetailTab] = useState<LifeGoalDetailTab>('focus')
  const [roadmapHighPriorityFocus, setRoadmapHighPriorityFocus] = useState(false)
  const [roadmapOrganizationMode, setRoadmapOrganizationMode] = useState<LifeGoalRoadmapOrganization>('default')
  const [taskListSortMode, setTaskListSortMode] = useState<LifeGoalTaskListSort>('default')
  const [roadmapCompletedOpen, setRoadmapCompletedOpen] = useState(false)
  const [selectedRoadmapTaskId, setSelectedRoadmapTaskId] = useState<string | null>(null)
  const [selectedTaskPeekId, setSelectedTaskPeekId] = useState<string | null>(null)
  const [taskPeekLockedMilestoneContext, setTaskPeekLockedMilestoneContext] = useState<{ id: string; title: string } | null>(null)
  const [taskPeekSubtaskDraft, setTaskPeekSubtaskDraft] = useState('')
  const [taskPeekTagDraft, setTaskPeekTagDraft] = useState('')
  const [taskPeekSubtaskEntryOpen, setTaskPeekSubtaskEntryOpen] = useState(false)
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null)
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null)
  const [pendingSubtaskFocusId, setPendingSubtaskFocusId] = useState<string | null>(null)
  const [taskPeekNotesOpen, setTaskPeekNotesOpen] = useState(false)
  const [taskPeekCompletedSubtasksOpen, setTaskPeekCompletedSubtasksOpen] = useState(false)
  const [taskPeekDatePickerOpen, setTaskPeekDatePickerOpen] = useState(false)
  const [taskPeekDateViewMonth, setTaskPeekDateViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate()))
  const [taskPeekDatePanelPosition, setTaskPeekDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [milestoneDatePickerMilestoneId, setMilestoneDatePickerMilestoneId] = useState<string | null>(null)
  const [milestoneDateViewMonth, setMilestoneDateViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate()))
  const [milestoneDatePanelPosition, setMilestoneDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [taskPeekDeleteConfirmation, setTaskPeekDeleteConfirmation] = useState<
    | { kind: 'task'; taskId: string }
    | { kind: 'subtask'; taskId: string; subtaskId: string; subtaskText: string }
    | null
  >(null)
  const [completionUndo, setCompletionUndo] = useState<CompletionUndoState | null>(null)
  const [completionPulse, setCompletionPulse] = useState<CompletionPulseState | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [draggedLifeGoalId, setDraggedLifeGoalId] = useState<string | null>(null)
  const [dragOverLifeGoalId, setDragOverLifeGoalId] = useState<string | null>(null)
  const [goalOverviewDragPreviewOrder, setGoalOverviewDragPreviewOrder] = useState<string[] | null>(null)
  const [createGoalVisualState, setCreateGoalVisualState] = useState<'idle' | 'starting'>('idle')
  const [pendingGoalStartCue, setPendingGoalStartCue] = useState<{ goalId: string; taskId: string } | null>(null)
  const [visibleGoalStartCueTaskId, setVisibleGoalStartCueTaskId] = useState<string | null>(null)
  const [roadmapArrivalCueActive, setRoadmapArrivalCueActive] = useState(false)
  const [completeNextVisualState, setCompleteNextVisualState] = useState<'idle' | 'active'>('idle')
  const [goalCompletionFlashGoalId, setGoalCompletionFlashGoalId] = useState<string | null>(null)
  const [taskMomentumTransition, setTaskMomentumTransition] = useState<{
    completedTaskId: string
    nextTaskId: string | null
  } | null>(null)

  useEffect(() => {
    setRoadmapCompletedOpen(false)
    setVisionDropActive(false)
    setMilestoneDatePickerMilestoneId(null)
    setMilestoneDatePanelPosition(null)
  }, [selectedLifeGoalId])

  useEffect(() => {
    if (prefersReducedMotion) {
      setCanUseVisionTilt(false)
      return
    }
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const syncCapability = () => setCanUseVisionTilt(mediaQuery.matches)
    syncCapability()
    mediaQuery.addEventListener('change', syncCapability)
    return () => mediaQuery.removeEventListener('change', syncCapability)
  }, [prefersReducedMotion])
  const [lifeGoalCategoryFilter, setLifeGoalCategoryFilter] = useState<string>('all')
  const [lifeGoalCategoryMenuOpen, setLifeGoalCategoryMenuOpen] = useState(false)
  const [lifeGoalCategoryQuery, setLifeGoalCategoryQuery] = useState('')
  const [lifeGoalRelatedGoalsQuery, setLifeGoalRelatedGoalsQuery] = useState('')
  const [debouncedLifeGoalRelatedGoalsQuery, setDebouncedLifeGoalRelatedGoalsQuery] = useState('')
  const [lifeGoalRelationIntent, setLifeGoalRelationIntent] = useState('')
  const [lifeGoalActiveDateField, setLifeGoalActiveDateField] = useState<'startDate' | 'targetDate' | null>(null)
  const [lifeGoalStatusMenuOpen, setLifeGoalStatusMenuOpen] = useState(false)
  const [lifeGoalOverviewMode, setLifeGoalOverviewMode] = useState<LifeGoalOverviewMode>('manual')
  const [lifeGoalOverviewDensity, setLifeGoalOverviewDensity] = useState<LifeGoalOverviewDensity>('compact')
  const [lifeGoalOverviewSort, setLifeGoalOverviewSort] = useState<LifeGoalOverviewSort>('due')
  const [goalOverviewViewControls, setGoalOverviewViewControls] = useState<GoalOverviewViewControls>(() =>
    normalizeGoalOverviewViewControls(readJsonStorage<GoalOverviewViewControls>(GOAL_OVERVIEW_VIEW_CONTROLS_STORAGE_KEY)),
  )
  const [goalOverviewRowActions, setGoalOverviewRowActions] = useState<GoalOverviewRowActionState>(() =>
    normalizeGoalOverviewRowActions(readJsonStorage<GoalOverviewRowActionState>(GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY)),
  )
  const [goalDetailContentVisibilityByGoal, setGoalDetailContentVisibilityByGoal] = useState<GoalDetailContentVisibilityByGoal>(() =>
    normalizeGoalDetailContentVisibilityByGoal(
      readJsonStorage<GoalDetailContentVisibilityByGoal | GoalDetailContentVisibility>(GOAL_DETAIL_CONTENT_VISIBILITY_STORAGE_KEY),
    ),
  )
  const [goalOverviewControlsPanelOpen, setGoalOverviewControlsPanelOpen] = useState(false)
  const [goalOverviewCompletedOpen, setGoalOverviewCompletedOpen] = useState(false)
  const [goalOverviewHeaderControlsSticky, setGoalOverviewHeaderControlsSticky] = useState(false)
  const [goalOverviewHeaderControlsTop, setGoalOverviewHeaderControlsTop] = useState(18)
  const [goalOverviewHeaderControlsRight, setGoalOverviewHeaderControlsRight] = useState(12)
  const [lifeGoalIconPickerOpen, setLifeGoalIconPickerOpen] = useState(false)
  const [lifeGoalIconPickerTab, setLifeGoalIconPickerTab] = useState<'icons' | 'emojis'>('icons')
  const [lifeGoalIconPickerQuery, setLifeGoalIconPickerQuery] = useState('')
  const [lifeGoalIconPickerPosition, setLifeGoalIconPickerPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalComposerExpanded, setLifeGoalComposerExpanded] = useState(false)
  const [goalOverviewDraggedColumn, setGoalOverviewDraggedColumn] = useState<Exclude<GoalOverviewColumnKey, 'milestones'> | null>(null)
  const [goalOverviewStatusMenuGoalId, setGoalOverviewStatusMenuGoalId] = useState<string | null>(null)
  const [goalOverviewActiveDateField, setGoalOverviewActiveDateField] = useState<{
    goalId: string
    field: 'startDate' | 'targetDate'
  } | null>(null)
  const [goalOverviewDatePanelPosition, setGoalOverviewDatePanelPosition] = useState<FloatingPanelPosition | null>(null)

  useEffect(() => {
    setGoalOverviewViewControls((current) => {
      const normalized = normalizeGoalOverviewViewControls(current)
      return JSON.stringify(normalized) === JSON.stringify(current) ? current : normalized
    })
  }, [])

  const [lifeGoalOverviewViewMenuOpen, setLifeGoalOverviewViewMenuOpen] = useState(false)
  const [lifeGoalOverviewViewPanelPosition, setLifeGoalOverviewViewPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalOverviewSortMenuOpen, setLifeGoalOverviewSortMenuOpen] = useState(false)
  const [lifeGoalOverviewSortPanelPosition, setLifeGoalOverviewSortPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalOverviewCategoryMenuOpen, setLifeGoalOverviewCategoryMenuOpen] = useState(false)
  const [lifeGoalOverviewCategoryPanelPosition, setLifeGoalOverviewCategoryPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalDateViewMonth, setLifeGoalDateViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate()))
  const [lifeGoalCategoryPanelPosition, setLifeGoalCategoryPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalDatePanelPosition, setLifeGoalDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [lifeGoalStatusPanelPosition, setLifeGoalStatusPanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [editRelatedGoalsCollapsed, setEditRelatedGoalsCollapsed] = useState(true)
  const [deleteGoalConfirmationTarget, setDeleteGoalConfirmationTarget] = useState<{ goalId: string; context: 'edit' | 'detail' } | null>(null)
  const [editGoalActionsMenuOpen, setEditGoalActionsMenuOpen] = useState(false)

  const setGoalOverviewDraggingCursor = (active: boolean) => {
    document.body.style.cursor = active ? 'grabbing' : ''
    document.body.style.userSelect = active ? 'none' : ''
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = active ? 'none' : ''
  }

  useEffect(() => {
    if (
      goalOverviewViewControls.view !== 'list' ||
      goalOverviewViewControls.groupBy !== 'none' ||
      goalOverviewViewControls.sortBy !== 'manual'
    ) {
      goalOverviewPointerDragCleanupRef.current?.()
      goalOverviewPointerDragCleanupRef.current = null
      goalOverviewPendingPointerDragRef.current = null
      goalOverviewActivePointerDragRef.current = null
      setGoalOverviewDraggingCursor(false)
      setDraggedLifeGoalId(null)
      setDragOverLifeGoalId(null)
      setGoalOverviewDragPreviewOrder(null)
    }
  }, [goalOverviewViewControls.groupBy, goalOverviewViewControls.sortBy, goalOverviewViewControls.view])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      goalOverviewPointerDragCleanupRef.current?.()
    }
  }, [])

  const lifeGoalCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStartDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusFieldRef = useRef<HTMLDivElement | null>(null)
  const editGoalActionsButtonRef = useRef<HTMLButtonElement | null>(null)
  const editGoalActionsMenuRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewViewFieldRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewPageRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewControlsPanelRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewStatusMenuRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewDatePanelRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewStartDateFieldRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const goalOverviewTargetDateFieldRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lifeGoalOverviewSortFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalCategoryPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewCategoryPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDatePanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewViewPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewSortPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalTitleInputRef = useRef<HTMLInputElement | null>(null)
  const lifeGoalWhyTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const lifeGoalComposerTriggerRef = useRef<HTMLElement | null>(null)
  const lifeGoalComposerBodyRef = useRef<HTMLDivElement | null>(null)
  const editRelatedGoalsAvailableListRef = useRef<HTMLDivElement | null>(null)
  const createRelatedGoalsAvailableListRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDraftTaskInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const visionUploadInputRef = useRef<HTMLInputElement | null>(null)
  const taskPeekPanelRef = useRef<HTMLDivElement | null>(null)
  const taskPeekTitleRef = useRef<HTMLTextAreaElement | null>(null)
  const taskPeekTriggerRef = useRef<HTMLElement | null>(null)
  const taskPeekDateFieldRef = useRef<HTMLDivElement | null>(null)
  const taskPeekDatePanelRef = useRef<HTMLDivElement | null>(null)
  const milestoneDateFieldRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const milestoneDatePanelRef = useRef<HTMLDivElement | null>(null)
  const taskPeekSubtaskDraftRef = useRef<HTMLInputElement | null>(null)
  const taskPeekSubtaskInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const roadmapTaskRowRefs = useRef<Record<string, HTMLElement | null>>({})
  const completionUndoTimeoutRef = useRef<number | null>(null)
  const completionPulseTimeoutRef = useRef<number | null>(null)
  const goalStartCueTimeoutRef = useRef<number | null>(null)
  const roadmapArrivalCueTimeoutRef = useRef<number | null>(null)
  const completeNextVisualTimeoutRef = useRef<number | null>(null)
  const taskMomentumTransitionTimeoutRef = useRef<number | null>(null)
  const lifeGoalActionFeedbackTimeoutRef = useRef<number | null>(null)
  const goalCompletionFlashTimeoutRef = useRef<number | null>(null)
  const taskPeekDeleteDialogRef = useRef<HTMLDivElement | null>(null)
  const taskPeekDeleteTriggerRef = useRef<HTMLElement | null>(null)
  const suppressGoalOverviewRowClickRef = useRef(false)
  const goalOverviewControlsDismissUntilRef = useRef(0)
  const goalOverviewStatusDismissUntilRef = useRef(0)
  const goalOverviewDateDismissUntilRef = useRef(0)
  const goalOverviewHeaderControlsRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewControlsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const goalOverviewActiveDateTriggerRef = useRef<HTMLElement | null>(null)
  const lifeGoalIconFieldRef = useRef<HTMLButtonElement | null>(null)
  const lifeGoalIconPickerRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewPointerDragCleanupRef = useRef<(() => void) | null>(null)
  const goalOverviewPendingPointerDragRef = useRef<{
    goalId: string
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const goalOverviewActivePointerDragRef = useRef<{
    goalId: string
    targetGoalId: string | null
  } | null>(null)
  const [pendingDraftTaskFocusId, setPendingDraftTaskFocusId] = useState<string | null>(null)

  const sortedLifeGoals = useMemo(() => sortLifeGoals(safeLifeGoals.filter((goal) => !goal.archivedAt)), [safeLifeGoals])

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
    if (!pendingDraftTaskFocusId) return
    const target = lifeGoalDraftTaskInputRefs.current[pendingDraftTaskFocusId]
    if (!target) return
    target.focus()
    const nextCaret = target.value.length
    target.setSelectionRange(nextCaret, nextCaret)
    setPendingDraftTaskFocusId(null)
  }, [lifeGoalDraft.tasks, pendingDraftTaskFocusId])

  useEffect(() => {
    if (!lifeGoalComposerOpen || lifeGoalComposerMode !== 'edit') return
    setEditRelatedGoalsCollapsed(true)
  }, [editingLifeGoalId, lifeGoalComposerMode, lifeGoalComposerOpen])

  useEffect(() => {
    if (!editGoalActionsMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!editGoalActionsButtonRef.current?.contains(target) && !editGoalActionsMenuRef.current?.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
        setEditGoalActionsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [editGoalActionsMenuOpen])

  useEffect(() => {
    if (!lifeGoalComposerOpen || lifeGoalComposerMode !== 'edit') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLifeGoalComposer()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lifeGoalComposerMode, lifeGoalComposerOpen])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedLifeGoalRelatedGoalsQuery(lifeGoalRelatedGoalsQuery)
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [lifeGoalRelatedGoalsQuery])

  useEffect(() => {
    if (editRelatedGoalsAvailableListRef.current) {
      editRelatedGoalsAvailableListRef.current.scrollTop = 0
    }
    if (createRelatedGoalsAvailableListRef.current) {
      createRelatedGoalsAvailableListRef.current.scrollTop = 0
    }
  }, [debouncedLifeGoalRelatedGoalsQuery])

  useEffect(
    () => () => {
      if (goalStartCueTimeoutRef.current) {
        window.clearTimeout(goalStartCueTimeoutRef.current)
      }
      if (roadmapArrivalCueTimeoutRef.current) {
        window.clearTimeout(roadmapArrivalCueTimeoutRef.current)
      }
      if (completeNextVisualTimeoutRef.current) {
        window.clearTimeout(completeNextVisualTimeoutRef.current)
      }
      if (taskMomentumTransitionTimeoutRef.current) {
        window.clearTimeout(taskMomentumTransitionTimeoutRef.current)
      }
      if (lifeGoalActionFeedbackTimeoutRef.current) {
        window.clearTimeout(lifeGoalActionFeedbackTimeoutRef.current)
      }
      if (goalCompletionFlashTimeoutRef.current) {
        window.clearTimeout(goalCompletionFlashTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    setLifeGoalDetailTab('focus')
    setLinkHabitPickerOpen(false)
  }, [selectedLifeGoalId])

  const selectedLifeGoal = useMemo(
    () => sortedLifeGoals.find((goal) => goal.id === selectedLifeGoalId) ?? null,
    [selectedLifeGoalId, sortedLifeGoals],
  )
  const safeDraftRelatedGoalIds = lifeGoalDraft.relatedGoalIds ?? []
  const safeSelectedLifeGoalLinkedHabitIds = selectedLifeGoal?.linkedHabitIds ?? []

  const selectedLifeGoalProgress = useMemo(
    () => (selectedLifeGoal ? getLifeGoalProgress(selectedLifeGoal) : null),
    [selectedLifeGoal],
  )
  const selectedGoalDetailContentVisibility = useMemo(
    () =>
      selectedLifeGoal
        ? (goalDetailContentVisibilityByGoal[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY)
        : DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY,
    [goalDetailContentVisibilityByGoal, selectedLifeGoal],
  )
  const selectedLifeGoalMilestones = useMemo(
    () => (selectedLifeGoal ? getOrderedGoalMilestones(selectedLifeGoal) : []),
    [selectedLifeGoal],
  )
  const selectedMilestoneId = selectedLifeGoal ? selectedMilestoneIdByGoal[selectedLifeGoal.id] ?? null : null
  const selectedMilestone = useMemo(
    () => (selectedMilestoneId ? selectedLifeGoalMilestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null : null),
    [selectedLifeGoalMilestones, selectedMilestoneId],
  )

  useEffect(() => {
    setInlineLifeGoalEditingField(null)
    setInlineLifeGoalIconGoalId(null)
    setLifeGoalIconPickerOpen(false)
    setLifeGoalIconPickerPosition(null)
  }, [selectedLifeGoalId])

  useEffect(() => {
    if (lifeGoalComposerOpen) {
      setInlineLifeGoalEditingField(null)
      setInlineLifeGoalIconGoalId(null)
    }
  }, [lifeGoalComposerOpen])

  useEffect(() => {
    if (inlineLifeGoalEditingField === 'title') {
      requestAnimationFrame(() => lifeGoalTitleInputRef.current?.focus())
    }
    if (inlineLifeGoalEditingField === 'why') {
      requestAnimationFrame(() => {
        const textarea = lifeGoalWhyTextareaRef.current
        if (!textarea) return
        textarea.focus()
        textarea.style.height = 'auto'
        textarea.style.height = `${textarea.scrollHeight}px`
      })
    }
  }, [inlineLifeGoalEditingField])
  const selectedMilestoneIndex = selectedMilestone ? selectedLifeGoalMilestones.findIndex((milestone) => milestone.id === selectedMilestone.id) : -1
  const selectedMilestoneTasks = useMemo(
    () => (selectedLifeGoal && selectedMilestone ? selectedLifeGoal.tasks.filter((task) => task.milestoneId === selectedMilestone.id) : []),
    [selectedLifeGoal, selectedMilestone],
  )
  const selectedMilestoneTaskProgress = useMemo(
    () => (selectedMilestone ? getMilestoneTaskProgress(selectedMilestoneTasks) : null),
    [selectedMilestone, selectedMilestoneTasks],
  )
  const nextTaskVisualState =
    taskMomentumTransition?.nextTaskId &&
    selectedLifeGoalProgress?.nextTask &&
    taskMomentumTransition.nextTaskId === selectedLifeGoalProgress.nextTask.id
      ? 'active'
      : 'idle'
  const selectedLifeGoalHasVision = Boolean(
    selectedLifeGoal?.visionStatement.trim() || (selectedLifeGoal?.visionImages.length ?? 0) > 0,
  )
  const selectedLifeGoalVisionCollapsed = selectedLifeGoal
    ? (visionCollapsedByGoal[selectedLifeGoal.id] ?? selectedLifeGoal.visionCollapsed ?? !selectedLifeGoalHasVision)
    : false
  const selectedLifeGoalVisionEditorOpen = selectedLifeGoal ? (visionEditorOpenByGoal[selectedLifeGoal.id] ?? false) : false
  const selectedLifeGoalVisionMode = selectedLifeGoal
    ? (visionModeByGoal[selectedLifeGoal.id] ?? selectedLifeGoal.visionMode ?? inferLifeGoalVisionMode(selectedLifeGoal))
    : 'images'
  const selectedLifeGoalVisionEditMode = selectedLifeGoal
    ? (visionEditModeByGoal[selectedLifeGoal.id] ?? (selectedLifeGoalVisionCollapsed && selectedLifeGoalHasVision ? 'hide' : selectedLifeGoalVisionMode))
    : 'images'
  const selectedLifeGoalShowVisionEditUI = selectedLifeGoalVisionEditorOpen
  const selectedLifeGoalVisionImageCount = selectedLifeGoal?.visionImages.length ?? 0
  const selectedLifeGoalVisionHasImages = selectedLifeGoalVisionImageCount > 0
  const selectedLifeGoalVisionHasStatement = Boolean(selectedLifeGoal?.visionStatement.trim())
  const selectedLifeGoalCanUploadVisionImages = selectedLifeGoalVisionImageCount < LIFE_GOAL_VISION_IMAGE_LIMIT
  const selectedLifeGoalVisionShowsImagesInDisplay = Boolean(
    !selectedLifeGoalShowVisionEditUI &&
      (selectedLifeGoalVisionMode === 'images' || selectedLifeGoalVisionMode === 'images-statement') &&
      selectedLifeGoalVisionHasImages,
  )
  const selectedLifeGoalVisionShowsStatementInDisplay = Boolean(
    !selectedLifeGoalShowVisionEditUI &&
      (selectedLifeGoalVisionMode === 'statement' || selectedLifeGoalVisionMode === 'images-statement') &&
      selectedLifeGoalVisionHasStatement,
  )
  const selectedLifeGoalVisionEditShowsImages =
    selectedLifeGoalVisionEditMode === 'images' || selectedLifeGoalVisionEditMode === 'images-statement'
  const selectedLifeGoalVisionEditShowsStatement =
    selectedLifeGoalVisionEditMode === 'statement' || selectedLifeGoalVisionEditMode === 'images-statement'
  const visionPreviewSurfaceRef = useRef<HTMLDivElement | null>(null)
  const visionTiltX = useMotionValue(0)
  const visionTiltY = useMotionValue(0)
  const visionShiftX = useMotionValue(0)
  const visionShiftY = useMotionValue(0)
  const visionSheen = useMotionValue(0)
  const visionRotateX = useSpring(visionTiltX, { stiffness: 180, damping: 20, mass: 0.5 })
  const visionRotateY = useSpring(visionTiltY, { stiffness: 180, damping: 20, mass: 0.5 })
  const visionImageShiftX = useSpring(visionShiftX, { stiffness: 140, damping: 20, mass: 0.5 })
  const visionImageShiftY = useSpring(visionShiftY, { stiffness: 140, damping: 20, mass: 0.5 })
  const visionSheenX = useSpring(visionSheen, { stiffness: 120, damping: 24, mass: 0.5 })
  useOverlayScrollLock(Boolean(visionPreviewImage))
  useFocusTrap(Boolean(visionPreviewImage), visionPreviewSurfaceRef, {
    onEscape: () => setVisionPreviewImage(null),
  })
  const selectedRoadmapSections = useRoadmapSections(selectedLifeGoal?.tasks ?? [])
  const selectedTaskPeek = useMemo(
    () => (selectedLifeGoal && selectedTaskPeekId ? selectedLifeGoal.tasks.find((task) => task.id === selectedTaskPeekId) ?? null : null),
    [selectedLifeGoal, selectedTaskPeekId],
  )
  const selectedTaskPeekActiveSubtasks = useMemo(
    () => (selectedTaskPeek ? selectedTaskPeek.subtasks.filter((subtask) => !subtask.completed) : []),
    [selectedTaskPeek],
  )
  const selectedTaskPeekCompletedSubtasks = useMemo(
    () => (selectedTaskPeek ? selectedTaskPeek.subtasks.filter((subtask) => subtask.completed) : []),
    [selectedTaskPeek],
  )

  useEffect(() => {
    if (selectedLifeGoalShowVisionEditUI && selectedLifeGoalVisionEditShowsImages) return
    setVisionDropActive(false)
    setDraggedVisionImageIndex(null)
    setDragOverVisionImageIndex(null)
  }, [selectedLifeGoalShowVisionEditUI, selectedLifeGoalVisionEditShowsImages, selectedLifeGoal?.id])

  useEffect(() => {
    if (visionPreviewImage && !selectedLifeGoalVisionHasImages) {
      setVisionPreviewImage(null)
    }
  }, [selectedLifeGoalVisionHasImages, visionPreviewImage])

  useEffect(() => {
    if (goalsView !== 'life-detail' || !selectedLifeGoal?.id) return
    setRoadmapArrivalCueActive(true)
    if (roadmapArrivalCueTimeoutRef.current) {
      window.clearTimeout(roadmapArrivalCueTimeoutRef.current)
    }
    roadmapArrivalCueTimeoutRef.current = window.setTimeout(() => {
      setRoadmapArrivalCueActive(false)
      roadmapArrivalCueTimeoutRef.current = null
    }, prefersReducedMotion ? 0 : 1100)
  }, [goalsView, prefersReducedMotion, selectedLifeGoal?.id])

  useEffect(() => {
    if (!pendingGoalStartCue || goalsView !== 'life-detail' || selectedLifeGoal?.id !== pendingGoalStartCue.goalId) return

    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const target = roadmapTaskRowRefs.current[pendingGoalStartCue.taskId]
        if (target) {
          target.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          })
          setVisibleGoalStartCueTaskId(pendingGoalStartCue.taskId)
          if (goalStartCueTimeoutRef.current) {
            window.clearTimeout(goalStartCueTimeoutRef.current)
          }
          goalStartCueTimeoutRef.current = window.setTimeout(() => {
            setVisibleGoalStartCueTaskId((current) => (current === pendingGoalStartCue.taskId ? null : current))
            goalStartCueTimeoutRef.current = null
          }, 1450)
        }
        setPendingGoalStartCue(null)
      }, 48)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [goalsView, pendingGoalStartCue, prefersReducedMotion, selectedLifeGoal?.id])

  useEffect(() => {
    if (!taskMomentumTransition?.nextTaskId || goalsView !== 'life-detail') return

    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        const target = roadmapTaskRowRefs.current[taskMomentumTransition.nextTaskId!]
        if (!target) return

        const rect = target.getBoundingClientRect()
        const viewportPadding = 72
        const offscreen = rect.top < viewportPadding || rect.bottom > window.innerHeight - viewportPadding

        if (offscreen) {
          target.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          })
        }
      }, 48)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [goalsView, prefersReducedMotion, taskMomentumTransition?.nextTaskId])
  const updateSelectedLifeGoalVisionStatement = (value: string) => {
    if (!selectedLifeGoal) return
    setVisionModeByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: 'statement',
    }))
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionStatement: value.slice(0, 120),
      visionMode: 'statement',
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateSelectedLifeGoalNotes = (value: string) => {
    if (!selectedLifeGoal) return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      notes: value,
      updatedAt: new Date().toISOString(),
    }))
  }

  const updateSelectedLifeGoalMilestones = (
    updater: (milestones: LifeGoalDraftMilestone[]) => LifeGoalDraftMilestone[],
  ) => {
    if (!selectedLifeGoal || selectedLifeGoal.goalType !== 'outcome') return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => {
      const nextMilestones = reindexLifeGoalMilestones(
        updater(
          (goal.milestones ?? []).map((milestone, index) => ({
            id: milestone.id,
            title: milestone.title,
            description: milestone.description ?? '',
            targetDate: milestone.targetDate ?? null,
            completed: milestone.completed,
            completedAt: milestone.completedAt,
            order: typeof milestone.order === 'number' ? milestone.order : index,
          })),
        ),
      )
      return {
        ...goal,
        milestones: nextMilestones,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const addSelectedLifeGoalMilestone = () => {
    if (!selectedLifeGoal) return
    const nextMilestone = {
      ...createLifeGoalDraftMilestone(),
      title: `Milestone ${((selectedLifeGoal.milestones ?? []).length || 0) + 1}`,
      order: (selectedLifeGoal.milestones ?? []).length,
    }
    updateSelectedLifeGoalMilestones((milestones) => [
      ...milestones,
      nextMilestone,
    ])
    setSelectedMilestoneIdByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: nextMilestone.id,
    }))
  }

  const updateSelectedLifeGoalMilestone = (
    milestoneId: string,
    updater: (milestone: LifeGoalDraftMilestone) => LifeGoalDraftMilestone,
  ) => {
    updateSelectedLifeGoalMilestones((milestones) =>
      milestones.map((milestone) => (milestone.id === milestoneId ? updater(milestone) : milestone)),
    )
  }

  const reorderSelectedLifeGoalMilestone = (milestoneId: string, direction: 'up' | 'down') => {
    updateSelectedLifeGoalMilestones((milestones) => {
      const index = milestones.findIndex((milestone) => milestone.id === milestoneId)
      if (index === -1) return milestones
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= milestones.length) return milestones
      const nextMilestones = [...milestones]
      const [movedMilestone] = nextMilestones.splice(index, 1)
      nextMilestones.splice(targetIndex, 0, movedMilestone)
      return nextMilestones.map((milestone, milestoneIndex) => ({
        ...milestone,
        order: milestoneIndex,
      }))
    })
  }

  const deleteSelectedLifeGoalMilestone = (milestoneId: string) => {
    if (milestoneDatePickerMilestoneId === milestoneId) {
      setMilestoneDatePickerMilestoneId(null)
      setMilestoneDatePanelPosition(null)
    }
    if (selectedLifeGoal) {
      setSelectedMilestoneIdByGoal((current) => ({
        ...current,
        [selectedLifeGoal.id]: current[selectedLifeGoal.id] === milestoneId ? null : current[selectedLifeGoal.id] ?? null,
      }))
    }
    updateSelectedLifeGoalMilestones((milestones) =>
      milestones
        .filter((milestone) => milestone.id !== milestoneId)
        .map((milestone, milestoneIndex) => ({
          ...milestone,
          order: milestoneIndex,
        })),
    )
  }

  const setSelectedLifeGoalVisionCollapsed = (value: boolean | ((current: boolean) => boolean)) => {
    if (!selectedLifeGoal) return
    const nextValue =
      typeof value === 'function'
        ? value(visionCollapsedByGoal[selectedLifeGoal.id] ?? selectedLifeGoal.visionCollapsed ?? false)
        : value
    setVisionCollapsedByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: nextValue,
    }))
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionCollapsed: nextValue,
      updatedAt: new Date().toISOString(),
    }))
  }

  const setSelectedLifeGoalVisionEditorOpen = (value: boolean | ((current: boolean) => boolean)) => {
    if (!selectedLifeGoal) return
    setVisionEditorOpenByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]:
        typeof value === 'function' ? value(current[selectedLifeGoal.id] ?? false) : value,
    }))
  }

  const setSelectedLifeGoalVisionEditMode = (value: LifeGoalVisionEditMode) => {
    if (!selectedLifeGoal) return
    setVisionEditModeByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: value,
    }))
  }

  const openSelectedLifeGoalVisionEditor = () => {
    if (!selectedLifeGoal) return
    setSelectedLifeGoalVisionEditMode(selectedLifeGoalVisionCollapsed && selectedLifeGoalHasVision ? 'hide' : selectedLifeGoalVisionMode)
    setSelectedLifeGoalVisionEditorOpen(true)
  }

  const applySelectedLifeGoalVisionEditMode = () => {
    if (!selectedLifeGoal) return

    const selectedModeHasContent =
      selectedLifeGoalVisionEditMode === 'images'
        ? selectedLifeGoalVisionHasImages
        : selectedLifeGoalVisionEditMode === 'statement'
          ? selectedLifeGoalVisionHasStatement
          : selectedLifeGoalVisionEditMode === 'images-statement'
            ? selectedLifeGoalVisionHasImages || selectedLifeGoalVisionHasStatement
            : false

    if (selectedLifeGoalVisionEditMode === 'hide' || !selectedModeHasContent) {
      setSelectedLifeGoalVisionCollapsed(true)
    } else {
      setSelectedLifeGoalVisionCollapsed(false)
      setVisionModeByGoal((current) => ({
        ...current,
        [selectedLifeGoal.id]: selectedLifeGoalVisionEditMode,
      }))
      onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
        ...goal,
        visionMode: selectedLifeGoalVisionEditMode,
        visionCollapsed: false,
        updatedAt: new Date().toISOString(),
      }))
    }
    setSelectedLifeGoalVisionEditorOpen(false)
  }

  const appendSelectedLifeGoalVisionImages = async (files: FileList | File[]) => {
    if (!selectedLifeGoal) return
    const fileList = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (fileList.length === 0) return

    const remainingSlots = Math.max(0, LIFE_GOAL_VISION_IMAGE_LIMIT - selectedLifeGoal.visionImages.length)
    if (remainingSlots === 0) return

    const nextImages = await Promise.all(
      fileList.slice(0, remainingSlots).map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          }),
      ),
    )

    const validImages = nextImages.filter(Boolean)
    if (validImages.length === 0) return

    setVisionModeByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: 'images',
    }))
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImages: [...goal.visionImages, ...validImages].slice(0, LIFE_GOAL_VISION_IMAGE_LIMIT),
      visionMode: 'images',
      updatedAt: new Date().toISOString(),
    }))
  }

  const removeSelectedLifeGoalVisionImage = (imageIndex: number) => {
    if (!selectedLifeGoal) return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImages: goal.visionImages.filter((_, index) => index !== imageIndex),
      updatedAt: new Date().toISOString(),
    }))
  }

  const reorderSelectedLifeGoalVisionImages = (fromIndex: number, toIndex: number) => {
    if (!selectedLifeGoal || fromIndex === toIndex) return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= goal.visionImages.length ||
        toIndex >= goal.visionImages.length
      ) {
        return goal
      }
      const nextImages = [...goal.visionImages]
      const [movedImage] = nextImages.splice(fromIndex, 1)
      nextImages.splice(toIndex, 0, movedImage)
      return {
        ...goal,
        visionImages: nextImages,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const handleVisionImageMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const relativeX = (event.clientX - bounds.left) / bounds.width
    const relativeY = (event.clientY - bounds.top) / bounds.height
    visionTiltX.set((0.5 - relativeY) * 5)
    visionTiltY.set((relativeX - 0.5) * 5)
    visionShiftX.set((relativeX - 0.5) * 8)
    visionShiftY.set((relativeY - 0.5) * 8)
    visionSheen.set((relativeX - 0.5) * 16)
  }

  const resetVisionImageTilt = () => {
    visionTiltX.set(0)
    visionTiltY.set(0)
    visionShiftX.set(0)
    visionShiftY.set(0)
    visionSheen.set(0)
  }

  const singleVisionInteractive = Boolean(
    canUseVisionTilt && !prefersReducedMotion && (selectedLifeGoal?.visionImages.length ?? 0) === 1,
  )
  const visionImageInteractiveOptions = singleVisionInteractive
    ? {
        enabled: true,
        rotateX: visionRotateX,
        rotateY: visionRotateY,
        shiftX: visionImageShiftX,
        shiftY: visionImageShiftY,
        sheenX: visionSheenX,
        onMouseMove: handleVisionImageMouseMove,
        onMouseLeave: resetVisionImageTilt,
      }
    : undefined

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

  useEffect(() => {
    if (!selectedLifeGoal || !selectedTaskPeekId) {
      setCreatingTaskPeekId(null)
      setSelectedTaskPeekId(null)
      setTaskPeekSubtaskDraft('')
      setTaskPeekTagDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
      return
    }

    if (!selectedLifeGoal.tasks.some((task) => task.id === selectedTaskPeekId)) {
      setCreatingTaskPeekId(null)
      setSelectedTaskPeekId(null)
      setTaskPeekSubtaskDraft('')
      setTaskPeekTagDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
    }
  }, [selectedLifeGoal, selectedTaskPeekId])

  useEffect(() => {
    if (!selectedTaskPeek) {
      setTaskPeekDatePickerOpen(false)
      setTaskPeekNotesOpen(false)
      setTaskPeekTagDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      taskPeekTitleRef.current?.focus()
      taskPeekTitleRef.current?.setSelectionRange(
        taskPeekTitleRef.current.value.length,
        taskPeekTitleRef.current.value.length,
      )
    })

    return () => window.cancelAnimationFrame(frame)
  }, [selectedTaskPeek?.id])

  useEffect(() => {
    if (!selectedTaskPeek) return
    setTaskPeekNotesOpen(Boolean(selectedTaskPeek.notes.trim()))
    setTaskPeekCompletedSubtasksOpen(false)
    setTaskPeekTagDraft('')
  }, [selectedTaskPeek?.id])

  useEffect(() => {
    if (!taskPeekSubtaskEntryOpen) return
    const frame = window.requestAnimationFrame(() => {
      taskPeekSubtaskDraftRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [taskPeekSubtaskEntryOpen])

  useEffect(() => {
    if (!pendingSubtaskFocusId) return
    const frame = window.requestAnimationFrame(() => {
      const target = taskPeekSubtaskInputRefs.current[pendingSubtaskFocusId]
      if (target) {
        target.focus()
        target.setSelectionRange(target.value.length, target.value.length)
      }
      setPendingSubtaskFocusId(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pendingSubtaskFocusId, selectedTaskPeek])

  useEffect(() => {
    if (!taskPeekDatePickerOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!taskPeekDateFieldRef.current?.contains(target) && !taskPeekDatePanelRef.current?.contains(target)) {
        setTaskPeekDatePickerOpen(false)
        setTaskPeekDatePanelPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [taskPeekDatePickerOpen])

  useEffect(() => {
    if (!milestoneDatePickerMilestoneId) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const activeFieldRef = milestoneDateFieldRefs.current[milestoneDatePickerMilestoneId]
      if (!activeFieldRef?.contains(target) && !milestoneDatePanelRef.current?.contains(target)) {
        setMilestoneDatePickerMilestoneId(null)
        setMilestoneDatePanelPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [milestoneDatePickerMilestoneId])

  useEffect(() => {
    if (!taskPeekDeleteConfirmation) return

    taskPeekDeleteTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : taskPeekTriggerRef.current

    const frame = window.requestAnimationFrame(() => {
      const focusable = taskPeekDeleteDialogRef.current ? getFocusableElements(taskPeekDeleteDialogRef.current) : []
      focusable[0]?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [taskPeekDeleteConfirmation])

  useEffect(() => {
    if (!taskPeekDatePickerOpen || !taskPeekDateFieldRef.current) return

    const updatePosition = () => {
      if (!taskPeekDateFieldRef.current) return
      setTaskPeekDatePanelPosition(
        getFloatingPanelPosition(taskPeekDateFieldRef.current, {
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
  }, [taskPeekDatePickerOpen])

  useEffect(() => {
    if (!milestoneDatePickerMilestoneId) return

    const updatePosition = () => {
      const activeFieldRef = milestoneDateFieldRefs.current[milestoneDatePickerMilestoneId]
      if (!activeFieldRef) return
      setMilestoneDatePanelPosition(
        getFloatingPanelPosition(activeFieldRef, {
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
  }, [milestoneDatePickerMilestoneId])

  useEffect(() => {
    return () => {
      if (completionUndoTimeoutRef.current) {
        window.clearTimeout(completionUndoTimeoutRef.current)
      }
      if (completionPulseTimeoutRef.current) {
        window.clearTimeout(completionPulseTimeoutRef.current)
      }
    }
  }, [])
  const selectedLinkedHabits = useMemo(
    () =>
      selectedLifeGoal
        ? safeSelectedLifeGoalLinkedHabitIds
            .map((habitId) => safeHabitTrackers.find((tracker) => tracker.id === habitId) ?? null)
            .filter((tracker): tracker is HabitTracker => tracker !== null)
        : [],
    [safeHabitTrackers, safeSelectedLifeGoalLinkedHabitIds, selectedLifeGoal],
  )
  const availableHabitsToLink = useMemo(
    () =>
      selectedLifeGoal
        ? safeHabitTrackers.filter((tracker) => !safeSelectedLifeGoalLinkedHabitIds.includes(tracker.id))
        : [],
    [safeHabitTrackers, safeSelectedLifeGoalLinkedHabitIds, selectedLifeGoal],
  )

  const activeGoals = useMemo(
    () =>
      safeHabitTrackers
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
    [safeHabitTrackers, year],
  )

  const completedGoals = useMemo(
    () =>
      safeHabitTrackers
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
    [safeHabitTrackers],
  )

  const draftTasks = useMemo(() => normalizeLifeGoalDraftTasks(lifeGoalDraft.tasks), [lifeGoalDraft.tasks])
  const taskPriorityOptions = useMemo(() => getTaskPriorityOptions(), [])
  const canAdvanceCreateGoal = Boolean(lifeGoalDraft.title.trim() && lifeGoalDraft.whyItMatters.trim())
  const normalizedRelatedGoalsQuery = debouncedLifeGoalRelatedGoalsQuery.trim().toLowerCase()
  const selectedRelatedGoals = useMemo(
    () => {
      const seen = new Set<string>()
      return safeDraftRelatedGoalIds
        .map((goalId) => safeLifeGoals.find((goal) => goal.id === goalId && !goal.archivedAt))
        .filter((goal): goal is LifeGoal => Boolean(goal))
        .filter((goal) => {
          if (seen.has(goal.id)) return false
          seen.add(goal.id)
          return true
        })
    },
    [safeDraftRelatedGoalIds, safeLifeGoals],
  )
  const allowedDraftRelatedGoalIds = useMemo(
    () =>
      safeDraftRelatedGoalIds.filter((goalId) => {
        const candidate = safeLifeGoals.find((goal) => goal.id === goalId && !goal.archivedAt)
        if (!candidate) return false
        return canGoalTypeLinkToGoalType(lifeGoalDraft.goalType ?? 'outcome', candidate.goalType ?? 'outcome')
      }),
    [lifeGoalDraft.goalType, safeDraftRelatedGoalIds, safeLifeGoals],
  )
  const editDraftGoalPayload = useMemo(
    () =>
      lifeGoalComposerMode === 'edit' && selectedLifeGoal
        ? createLifeGoalUpdateFromDraft(selectedLifeGoal, lifeGoalDraft, allowedDraftRelatedGoalIds, draftTasks)
        : null,
    [allowedDraftRelatedGoalIds, draftTasks, lifeGoalComposerMode, lifeGoalDraft, selectedLifeGoal],
  )
  const editDraftGoalSnapshot = useMemo(
    () => (editDraftGoalPayload ? getLifeGoalEditSnapshot(editDraftGoalPayload) : null),
    [editDraftGoalPayload],
  )
  const selectedLifeGoalEditSnapshot = useMemo(
    () => (lifeGoalComposerMode === 'edit' && selectedLifeGoal ? getLifeGoalEditSnapshot(selectedLifeGoal) : null),
    [lifeGoalComposerMode, selectedLifeGoal],
  )
  const relatedGoalCandidates = useMemo(
    () =>
      safeLifeGoals
        .filter((goal) => !goal.archivedAt && goal.id !== editingLifeGoalId)
        .filter((goal) => canGoalTypeLinkToGoalType(lifeGoalDraft.goalType ?? 'outcome', goal.goalType ?? 'outcome'))
        .filter((goal) => {
          if (!normalizedRelatedGoalsQuery) return true
          const title = goal.title.trim().toLowerCase()
          const category = goal.category.trim().toLowerCase()
          return title.includes(normalizedRelatedGoalsQuery) || category.includes(normalizedRelatedGoalsQuery)
        })
        .sort((left, right) => {
          const leftSelected = allowedDraftRelatedGoalIds.includes(left.id)
          const rightSelected = allowedDraftRelatedGoalIds.includes(right.id)
          if (leftSelected !== rightSelected) return leftSelected ? -1 : 1
          return left.title.localeCompare(right.title)
        }),
    [allowedDraftRelatedGoalIds, editingLifeGoalId, lifeGoalDraft.goalType, normalizedRelatedGoalsQuery, safeLifeGoals],
  )

  useEffect(() => {
    if (
      !lifeGoalComposerOpen ||
      lifeGoalComposerMode !== 'edit' ||
      !editingLifeGoalId ||
      !selectedLifeGoal ||
      !editDraftGoalPayload ||
      !editDraftGoalSnapshot ||
      !selectedLifeGoalEditSnapshot
    ) {
      return
    }

    if (!lifeGoalDraft.title.trim()) {
      return
    }

    if (editDraftGoalSnapshot !== selectedLifeGoalEditSnapshot) {
      onUpdateLifeGoal(editingLifeGoalId, () => ({
        ...editDraftGoalPayload,
        updatedAt: new Date().toISOString(),
      }))
    }

  }, [
    editDraftGoalPayload,
    editDraftGoalSnapshot,
    editingLifeGoalId,
    lifeGoalComposerMode,
    lifeGoalComposerOpen,
    lifeGoalDraft.title,
    lifeGoalDraft.whyItMatters,
    onUpdateLifeGoal,
    selectedLifeGoal,
    selectedLifeGoalEditSnapshot,
  ])

  const commitCreateLifeGoal = (tasksOverride?: LifeGoalTask[]) => {
    const createTasks = tasksOverride ?? draftTasks
    const nextGoal = createLifeGoalFromDraft({
      ...lifeGoalDraft,
      minimumVersion: lifeGoalDraft.minimumVersion.trim() || createTasks[0]?.text.trim() || lifeGoalDraft.title.trim(),
      relatedGoalIds: allowedDraftRelatedGoalIds,
      milestonesEnabled: lifeGoalDraft.goalType === 'outcome' ? lifeGoalDraft.milestonesEnabled : false,
      milestones: lifeGoalDraft.goalType === 'outcome' ? normalizeLifeGoalDraftMilestones(lifeGoalDraft.milestones) : [],
      tasks: createTasks,
    })
    if (createTasks[0]?.id) {
      setPendingGoalStartCue({
        goalId: nextGoal.id,
        taskId: createTasks[0].id,
      })
    }
    onCreateLifeGoal(nextGoal)
    onSelectLifeGoal(nextGoal.id)
    onChangeGoalsView('life-detail')
    setLifeGoalDraft(createEmptyLifeGoalDraft())
    setLifeGoalComposerMode('create')
    setLifeGoalCreateStep('define')
    setEditingLifeGoalId(null)
    closeLifeGoalComposer()
  }

  const handleStartGoalClick = () => {
    setCreateGoalVisualState('starting')
    handleSaveLifeGoal()
  }

  const handleSaveLifeGoal = () => {
    if (!lifeGoalDraft.title.trim()) {
      return
    }

    commitCreateLifeGoal()
  }

  const handleAdvanceCreateGoalStep = () => {
    if (!canAdvanceCreateGoal) return
    setLifeGoalCreateStep('path')
  }

  const draftGoalLinkLabel =
    (lifeGoalDraft.goalType ?? 'outcome') === 'directional' ? 'Related goals' : null
  const draftGoalLinkDescription =
    (lifeGoalDraft.goalType ?? 'outcome') === 'directional' ? 'Link goals that already move this direction forward.' : null

  const showCompletionUndo = (nextUndo: CompletionUndoState) => {
    if (completionUndoTimeoutRef.current) {
      window.clearTimeout(completionUndoTimeoutRef.current)
    }
    setCompletionUndo(nextUndo)
    completionUndoTimeoutRef.current = window.setTimeout(() => {
      setCompletionUndo(null)
      completionUndoTimeoutRef.current = null
    }, 4500)
  }

  const clearCompletionUndo = () => {
    if (completionUndoTimeoutRef.current) {
      window.clearTimeout(completionUndoTimeoutRef.current)
      completionUndoTimeoutRef.current = null
    }
    setCompletionUndo(null)
  }

  const showLifeGoalActionFeedback = (message: string, duration = 1450) => {
    if (lifeGoalActionFeedbackTimeoutRef.current) {
      window.clearTimeout(lifeGoalActionFeedbackTimeoutRef.current)
    }
    setLifeGoalActionFeedback(message)
    lifeGoalActionFeedbackTimeoutRef.current = window.setTimeout(() => {
      setLifeGoalActionFeedback(null)
      lifeGoalActionFeedbackTimeoutRef.current = null
    }, duration)
  }

  const showCompletionPulse = (sourceElement?: HTMLElement | null) => {
    if (completionPulseTimeoutRef.current) {
      window.clearTimeout(completionPulseTimeoutRef.current)
    }

    const fallbackLeft = window.innerWidth - 120
    const fallbackTop = window.innerHeight - 96
    const rect = sourceElement?.getBoundingClientRect()
    const left = rect ? rect.left + rect.width / 2 : fallbackLeft
    const top = rect ? Math.max(24, rect.top - 8) : fallbackTop

    setCompletionPulse({
      id: Date.now(),
      top,
      left,
    })

    completionPulseTimeoutRef.current = window.setTimeout(() => {
      setCompletionPulse(null)
      completionPulseTimeoutRef.current = null
    }, 820)
  }

  const setTaskAsNext = (goalId: string, taskId: string) => {
    onUpdateLifeGoal(goalId, (goal) => {
      const fromIndex = goal.tasks.findIndex((task) => task.id === taskId)
      if (fromIndex === -1) return goal
      const targetTask = goal.tasks[fromIndex]
      if (targetTask.completed) return goal
      const firstIncompleteIndex = goal.tasks.findIndex((task) => !task.completed)
      if (firstIncompleteIndex === -1 || fromIndex === firstIncompleteIndex) return goal

      const nextTasks = [...goal.tasks]
      const [movedTask] = nextTasks.splice(fromIndex, 1)
      nextTasks.splice(firstIncompleteIndex, 0, movedTask)

      return {
        ...goal,
        tasks: nextTasks,
        updatedAt: new Date().toISOString(),
      }
    })
    setSelectedRoadmapTaskId(taskId)
  }

  const reorderGoalTask = (goalId: string, draggedTaskId: string, targetTaskId: string) => {
    if (draggedTaskId === targetTaskId) return

    onUpdateLifeGoal(goalId, (goal) => {
      const upcomingTasks = goal.tasks.filter((task) => !task.completed)
      const visibleUpcomingIds = upcomingTasks.map((task) => task.id)
      const fromIndex = visibleUpcomingIds.indexOf(draggedTaskId)
      const toIndex = visibleUpcomingIds.indexOf(targetTaskId)
      if (fromIndex === -1 || toIndex === -1) return goal

      const reorderedUpcoming = [...upcomingTasks]
      const [movedTask] = reorderedUpcoming.splice(fromIndex, 1)
      reorderedUpcoming.splice(toIndex, 0, movedTask)
      let upcomingCursor = 0
      const nextTasks = goal.tasks.map((task) => {
        if (task.completed) return task
        const nextTask = reorderedUpcoming[upcomingCursor]
        upcomingCursor += 1
        return nextTask
      })
      return {
        ...goal,
        tasks: nextTasks,
        updatedAt: new Date().toISOString(),
      }
    })
    setSelectedRoadmapTaskId(draggedTaskId)
  }

  const toggleTaskCompletion = (goalId: string, taskId: string, sourceElement?: HTMLElement | null) => {
    onUpdateLifeGoal(goalId, (goal) => {
      const currentTask = goal.tasks.find((task) => task.id === taskId)
      if (!currentTask) return goal

      let completedTaskWasOpen = false
      const updatedTasks = goal.tasks.map((task) => {
        if (task.id !== taskId) return task
        const nextCompleted = !task.completed
        completedTaskWasOpen = nextCompleted
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        }
      })
      const nextTaskId = updatedTasks.find((task) => !task.completed)?.id ?? null
      if (completedTaskWasOpen) {
        setSelectedRoadmapTaskId(nextTaskId)
        if (selectedTaskPeekId === taskId) {
          setSelectedTaskPeekId(nextTaskId)
          setTaskPeekSubtaskDraft('')
        }
      } else if (selectedRoadmapTaskId === taskId) {
        setSelectedRoadmapTaskId(taskId)
      }

      return {
        ...goal,
        tasks: updatedTasks,
        updatedAt: new Date().toISOString(),
      }
    })

    const sourceGoal = sortedLifeGoals.find((goal) => goal.id === goalId)
    const sourceTask = sourceGoal?.tasks.find((task) => task.id === taskId)
    if (sourceGoal && sourceTask && !sourceTask.completed) {
      const updatedTasks = sourceGoal.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: true,
              completedAt: task.completedAt ?? new Date().toISOString(),
            }
          : task,
      )
      const nextTaskId = updatedTasks.find((task) => !task.completed)?.id ?? null
      setTaskMomentumTransition({ completedTaskId: taskId, nextTaskId })
      showLifeGoalActionFeedback('Step complete', 1350)
      if (taskMomentumTransitionTimeoutRef.current) {
        window.clearTimeout(taskMomentumTransitionTimeoutRef.current)
      }
      taskMomentumTransitionTimeoutRef.current = window.setTimeout(() => {
        setTaskMomentumTransition((current) => (current?.completedTaskId === taskId ? null : current))
        taskMomentumTransitionTimeoutRef.current = null
      }, 1150)
      showCompletionPulse(sourceElement)
      showCompletionUndo({
        kind: 'task',
        goalId,
        taskId,
        message: 'Task completed',
      })
    } else if (completionUndo?.kind === 'task' && completionUndo.goalId === goalId && completionUndo.taskId === taskId) {
      clearCompletionUndo()
    }
  }

  const handleCompleteNextWithFeedback = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!selectedLifeGoal || !selectedLifeGoalProgress?.nextTask) return
    setCompleteNextVisualState('active')
    if (completeNextVisualTimeoutRef.current) {
      window.clearTimeout(completeNextVisualTimeoutRef.current)
    }
    completeNextVisualTimeoutRef.current = window.setTimeout(() => {
      setCompleteNextVisualState('idle')
      completeNextVisualTimeoutRef.current = null
    }, 300)
    toggleTaskCompletion(selectedLifeGoal.id, selectedLifeGoalProgress.nextTask.id, event.currentTarget)
  }

  const completeLifeGoal = (goalId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      status: 'complete',
      updatedAt: new Date().toISOString(),
    }))
    setGoalCompletionFlashGoalId(goalId)
    if (goalCompletionFlashTimeoutRef.current) {
      window.clearTimeout(goalCompletionFlashTimeoutRef.current)
    }
    goalCompletionFlashTimeoutRef.current = window.setTimeout(() => {
      setGoalCompletionFlashGoalId((current) => (current === goalId ? null : current))
      goalCompletionFlashTimeoutRef.current = null
    }, 1450)
    showLifeGoalActionFeedback('You finished this', 1450)
  }

  const updateLifeGoalTask = (goalId: string, taskId: string, updater: (task: LifeGoalTask) => LifeGoalTask) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      tasks: goal.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const openTaskPeek = (taskId: string, trigger?: HTMLElement | null) => {
    taskPeekTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setCreatingTaskPeekId(null)
    setTaskPeekLockedMilestoneContext(null)
    setSelectedTaskPeekId(taskId)
    setSelectedRoadmapTaskId(taskId)
    setTaskPeekSubtaskDraft('')
  }

  const openNewTaskPeek = (
    trigger?: HTMLElement | null,
    milestoneContext?: { milestoneId: string; milestoneTitle: string } | null,
  ) => {
    if (!selectedLifeGoal) return
    const currentGoalMilestones = (selectedLifeGoal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
    const currentGoalMilestone =
      currentGoalMilestones.find((milestone) => !milestone.completed) ??
      (currentGoalMilestones.length > 0 ? currentGoalMilestones[currentGoalMilestones.length - 1] : null)
    const nextTask = {
      ...createEmptyLifeGoalTask(),
      milestoneId:
        selectedLifeGoal.goalType === 'outcome' && selectedLifeGoal.milestonesEnabled
          ? milestoneContext?.milestoneId ?? currentGoalMilestone?.id ?? null
          : null,
    }
    taskPeekTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      tasks: [...goal.tasks, nextTask],
      updatedAt: new Date().toISOString(),
    }))
    setCreatingTaskPeekId(nextTask.id)
    setTaskPeekLockedMilestoneContext(
      milestoneContext
        ? { id: milestoneContext.milestoneId, title: milestoneContext.milestoneTitle }
        : null,
    )
    setSelectedTaskPeekId(nextTask.id)
    setSelectedRoadmapTaskId(nextTask.id)
    setTaskPeekSubtaskDraft('')
    setTaskPeekSubtaskEntryOpen(false)
    setTaskPeekCompletedSubtasksOpen(false)
    setTaskPeekNotesOpen(false)
  }

  const openMilestonePeek = (milestoneId: string) => {
    if (!selectedLifeGoal) return
    setSelectedMilestoneIdByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: milestoneId,
    }))
  }

  const closeMilestonePeek = () => {
    if (!selectedLifeGoal) return
    setSelectedMilestoneIdByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]: null,
    }))
  }

  const closeTaskPeek = () => {
    if (selectedLifeGoal && selectedTaskPeek && creatingTaskPeekId === selectedTaskPeek.id && isLifeGoalTaskDraftEmpty(selectedTaskPeek)) {
      onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
        ...goal,
        tasks: goal.tasks.filter((task) => task.id !== selectedTaskPeek.id),
        updatedAt: new Date().toISOString(),
      }))
      if (selectedRoadmapTaskId === selectedTaskPeek.id) {
        setSelectedRoadmapTaskId(null)
      }
    }
    setCreatingTaskPeekId(null)
    setTaskPeekLockedMilestoneContext(null)
    setSelectedTaskPeekId(null)
    setTaskPeekSubtaskDraft('')
  }

  const updateSelectedTaskPeek = (updater: (task: LifeGoalTask) => LifeGoalTask) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    updateLifeGoalTask(selectedLifeGoal.id, selectedTaskPeekId, updater)
  }

  const addTagToSelectedTaskPeek = () => {
    const normalizedTag = normalizeTaskTag(taskPeekTagDraft)
    if (!normalizedTag) return

    updateSelectedTaskPeek((task) => {
      const nextTags = normalizeTaskTags([...task.tags, normalizedTag])
      if (nextTags.join('|') === normalizeTaskTags(task.tags).join('|')) {
        return task
      }
      return {
        ...task,
        tags: nextTags,
      }
    })
    setTaskPeekTagDraft('')
  }

  const removeTagFromSelectedTaskPeek = (tagToRemove: string) => {
    const normalizedTag = normalizeTaskTag(tagToRemove)
    updateSelectedTaskPeek((task) => ({
      ...task,
      tags: normalizeTaskTags(task.tags).filter((tag) => tag !== normalizedTag),
    }))
  }

  const completeTaskById = (goalId: string, taskId: string, mode: 'close' | 'next' = 'close', sourceElement?: HTMLElement | null) => {
    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if (!goal) return

    const currentTaskIndex = goal.tasks.findIndex((task) => task.id === taskId)
    if (currentTaskIndex === -1) return

    const currentTask = goal.tasks[currentTaskIndex]
    const updatedTasks = goal.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            completed: true,
            completedAt: task.completedAt ?? new Date().toISOString(),
          }
        : task,
    )
    if (!currentTask.completed) {
      toggleTaskCompletion(goalId, taskId, sourceElement)
    }

    if (mode === 'next') {
      const nextTask = updatedTasks.find((task) => !task.completed)
      if (nextTask) {
        setSelectedRoadmapTaskId(nextTask.id)
        setSelectedTaskPeekId(nextTask.id)
        setTaskPeekSubtaskDraft('')
        return
      }
    }

    closeTaskPeek()
  }

  const completeTaskFromPeek = (mode: 'close' | 'next', sourceElement?: HTMLElement | null) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    completeTaskById(selectedLifeGoal.id, selectedTaskPeekId, mode, sourceElement)
  }

  const toggleSelectedTaskPeekCompletion = (sourceElement?: HTMLElement | null) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    toggleTaskCompletion(selectedLifeGoal.id, selectedTaskPeekId, sourceElement)
  }

  const addSelectedTaskPeekSubtask = () => {
    const text = taskPeekSubtaskDraft.trim()
    if (!text) return
    const nextSubtaskId = `life-goal-subtask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    updateSelectedTaskPeek((task) => ({
      ...task,
      subtasks: [...task.subtasks, { id: nextSubtaskId, text, completed: false }],
    }))
    setTaskPeekSubtaskDraft('')
    setTaskPeekSubtaskEntryOpen(false)
  }

  const focusNextIncompleteSubtask = (subtasks: LifeGoalTask['subtasks'], fromSubtaskId: string) => {
    const currentIndex = subtasks.findIndex((subtask) => subtask.id === fromSubtaskId)
    if (currentIndex === -1) return
    const nextIncomplete =
      subtasks.find((subtask, index) => index > currentIndex && !subtask.completed) ??
      subtasks.find((subtask) => !subtask.completed && subtask.id !== fromSubtaskId)
    if (nextIncomplete) {
      setPendingSubtaskFocusId(nextIncomplete.id)
    }
  }

  const toggleSelectedTaskPeekSubtaskCompletion = (subtaskId: string, sourceElement?: HTMLElement | null) => {
    if (!selectedTaskPeek || !selectedLifeGoal) return
    const currentSubtask = selectedTaskPeek.subtasks.find((subtask) => subtask.id === subtaskId)
    if (!currentSubtask) return
    const nextSubtasks = selectedTaskPeek.subtasks.map((subtask) =>
      subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
    )
    updateSelectedTaskPeek((task) => ({
      ...task,
      subtasks: nextSubtasks,
    }))
    if (!currentSubtask.completed) {
      showCompletionPulse(sourceElement)
      focusNextIncompleteSubtask(nextSubtasks, subtaskId)
      showCompletionUndo({
        kind: 'subtask',
        goalId: selectedLifeGoal.id,
        taskId: selectedTaskPeek.id,
        subtaskId,
        message: 'Subtask completed',
      })
    } else if (
      completionUndo?.kind === 'subtask' &&
      completionUndo.goalId === selectedLifeGoal.id &&
      completionUndo.taskId === selectedTaskPeek.id &&
      completionUndo.subtaskId === subtaskId
    ) {
      clearCompletionUndo()
    }
  }

  const reorderSelectedTaskPeekSubtasks = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    updateSelectedTaskPeek((task) => {
      const fromIndex = task.subtasks.findIndex((subtask) => subtask.id === draggedId)
      const toIndex = task.subtasks.findIndex((subtask) => subtask.id === targetId)
      if (fromIndex === -1 || toIndex === -1) return task
      const nextSubtasks = [...task.subtasks]
      const [moved] = nextSubtasks.splice(fromIndex, 1)
      nextSubtasks.splice(toIndex, 0, moved)
      return {
        ...task,
        subtasks: nextSubtasks,
      }
    })
    setPendingSubtaskFocusId(draggedId)
  }

  const deleteSelectedTaskPeek = () => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    const fallbackTaskId =
      selectedLifeGoal.tasks.find((task) => task.id !== selectedTaskPeekId && !task.completed)?.id ??
      selectedLifeGoal.tasks.find((task) => task.id !== selectedTaskPeekId)?.id ??
      null

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      tasks: goal.tasks.filter((task) => task.id !== selectedTaskPeekId),
      updatedAt: new Date().toISOString(),
    }))

    setTaskPeekDeleteConfirmation(null)
    if (creatingTaskPeekId === selectedTaskPeekId) {
      setCreatingTaskPeekId(null)
    }
    setSelectedTaskPeekId(fallbackTaskId)
    setSelectedRoadmapTaskId(fallbackTaskId)
    if (!fallbackTaskId) {
      closeTaskPeek()
    }
  }

  const deleteSelectedTaskPeekSubtask = (subtaskId: string) => {
    updateSelectedTaskPeek((task) => ({
      ...task,
      subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }))
    setTaskPeekDeleteConfirmation(null)
  }

  const confirmTaskPeekDelete = () => {
    if (!taskPeekDeleteConfirmation) return
    if (taskPeekDeleteConfirmation.kind === 'task') {
      deleteSelectedTaskPeek()
      return
    }
    deleteSelectedTaskPeekSubtask(taskPeekDeleteConfirmation.subtaskId)
  }

  const closeTaskPeekDeleteConfirmation = () => {
    setTaskPeekDeleteConfirmation(null)
  }

  useOverlayScrollLock(Boolean(selectedTaskPeek || taskPeekDeleteConfirmation))
  useReturnFocusOnClose(Boolean(selectedTaskPeek), taskPeekTriggerRef, [selectedTaskPeek?.id])
  useReturnFocusOnClose(Boolean(taskPeekDeleteConfirmation), taskPeekDeleteTriggerRef, [
    taskPeekDeleteConfirmation?.kind,
    taskPeekDeleteConfirmation?.taskId,
  ])
  useFocusTrap(Boolean(selectedTaskPeek) && !taskPeekDeleteConfirmation, taskPeekPanelRef, {
    onEscape: () => {
      if (taskPeekDatePickerOpen) {
        setTaskPeekDatePickerOpen(false)
        setTaskPeekDatePanelPosition(null)
        return
      }
      closeTaskPeek()
    },
  })
  useFocusTrap(Boolean(taskPeekDeleteConfirmation), taskPeekDeleteDialogRef, {
    onEscape: closeTaskPeekDeleteConfirmation,
  })

  const restoreTask = (goalId: string, taskId: string) => {
    toggleTaskCompletion(goalId, taskId)
    setSelectedRoadmapTaskId(taskId)
  }

  const undoCompletion = () => {
    if (!completionUndo) return

    if (completionUndo.kind === 'task') {
      toggleTaskCompletion(completionUndo.goalId, completionUndo.taskId)
      setSelectedRoadmapTaskId(completionUndo.taskId)
      clearCompletionUndo()
      return
    }

    updateLifeGoalTask(completionUndo.goalId, completionUndo.taskId, (task) => ({
      ...task,
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === completionUndo.subtaskId ? { ...subtask, completed: false } : subtask,
      ),
    }))
    setPendingSubtaskFocusId(completionUndo.subtaskId)
    clearCompletionUndo()
  }

  const handleTaskRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, taskId: string) => {
    if (!selectedLifeGoal) return
    if (event.shiftKey && event.key === 'Enter') {
      event.preventDefault()
      openNewTaskPeek(event.currentTarget)
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    openTaskPeek(taskId, event.currentTarget)
  }

  const openTaskPeekDatePicker = () => {
    setTaskPeekDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(selectedTaskPeek?.dueDate ?? undefined)))
    setTaskPeekDatePickerOpen(true)
  }

  const applyTaskPeekDate = (date: string) => {
    updateSelectedTaskPeek((task) => ({
      ...task,
      dueDate: date || null,
    }))
    if (date && isValidIsoDate(date)) {
      setTaskPeekDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(date)))
    }
    setTaskPeekDatePickerOpen(false)
    setTaskPeekDatePanelPosition(null)
  }

  const openMilestoneDatePicker = (milestoneId: string, date?: string | null) => {
    setMilestoneDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(date ?? undefined)))
    setMilestoneDatePickerMilestoneId((current) => (current === milestoneId ? null : milestoneId))
  }

  const applySelectedMilestoneDate = (date: string) => {
    if (!milestoneDatePickerMilestoneId) return
    updateSelectedLifeGoalMilestone(milestoneDatePickerMilestoneId, (milestone) => ({
      ...milestone,
      targetDate: date || null,
    }))
    if (date && isValidIsoDate(date)) {
      setMilestoneDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(date)))
    }
    setMilestoneDatePickerMilestoneId(null)
    setMilestoneDatePanelPosition(null)
  }

  const updateLifeGoalStatus = (goalId: string, status: LifeGoalStatus) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      status,
      updatedAt: new Date().toISOString(),
    }))
  }

  const scheduleLifeGoalFromList = (goalId: string) => {
    const today = getTodayIsoDate()
    const tomorrowDate = new Date(`${today}T00:00:00Z`)
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
    const tomorrow = tomorrowDate.toISOString().slice(0, 10)

    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      status: 'not-started',
      startDate: isValidIsoDate(goal.startDate) && goal.startDate > today ? goal.startDate : tomorrow,
      updatedAt: new Date().toISOString(),
    }))
  }

  const getGoalOverviewDatePanelPositionFromRect = (anchorRect: DOMRect): FloatingPanelPosition | null => {
    const panelHeight = 432
    const panelGap = 6
    const viewportInset = 12
    const panelWidth = 296
    const overviewBounds = goalOverviewPageRef.current?.getBoundingClientRect()
    if (!overviewBounds) return null

    const inset = 12
    const minLeft = Math.max(overviewBounds.left + inset, viewportInset)
    const maxLeft = Math.max(
      minLeft,
      Math.min(overviewBounds.right - inset - panelWidth, window.innerWidth - viewportInset - panelWidth),
    )
    const preferredLeft = anchorRect.right + panelGap
    const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft)

    const minTop = Math.max(overviewBounds.top + inset, viewportInset)
    const maxTop = Math.max(
      minTop,
      Math.min(overviewBounds.bottom - inset - panelHeight, window.innerHeight - viewportInset - panelHeight),
    )
    const anchoredTop = anchorRect.bottom - panelHeight + 40
    const anchoredAboveTop = anchorRect.top - panelGap - panelHeight

    let top = Math.min(Math.max(anchoredTop, minTop), maxTop)
    if (anchoredTop <= maxTop) {
      top = anchoredTop
    } else if (anchoredAboveTop >= minTop) {
      top = anchoredAboveTop
    }

    return { top, left, width: panelWidth }
  }

  const openGoalOverviewDatePicker = (
    goalId: string,
    field: 'startDate' | 'targetDate',
    anchorElement?: HTMLElement | null,
  ) => {
    const goal = safeLifeGoals.find((item) => item.id === goalId)
    if (!goal) return

    const activeDateValue = goal[field]
    const nextViewMonth = isValidIsoDate(activeDateValue)
      ? startOfCalendarMonth(new Date(`${activeDateValue}T00:00:00Z`))
      : startOfCalendarMonth(getCalendarMonthDate())

    setLifeGoalDateViewMonth(nextViewMonth)
    const isTogglingClosed = goalOverviewActiveDateField?.goalId === goalId && goalOverviewActiveDateField.field === field
    setGoalOverviewActiveDateField((current) => (current?.goalId === goalId && current.field === field ? null : { goalId, field }))
    if (isTogglingClosed) {
      goalOverviewActiveDateTriggerRef.current = null
      setGoalOverviewDatePanelPosition(null)
      return
    }

    if (anchorElement) {
      goalOverviewActiveDateTriggerRef.current = anchorElement
      const nextPosition = getGoalOverviewDatePanelPositionFromRect(anchorElement.getBoundingClientRect())
      if (nextPosition) {
        setGoalOverviewDatePanelPosition(nextPosition)
      }
    }
  }

  const applyGoalOverviewDate = (goalId: string, field: 'startDate' | 'targetDate', value: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      [field]: value,
      updatedAt: new Date().toISOString(),
    }))
    goalOverviewActiveDateTriggerRef.current = null
    setGoalOverviewActiveDateField(null)
    setGoalOverviewDatePanelPosition(null)
  }

  const linkHabitToLifeGoal = (goalId: string, trackerId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      linkedHabitIds: (goal.linkedHabitIds ?? []).includes(trackerId) ? (goal.linkedHabitIds ?? []) : [...(goal.linkedHabitIds ?? []), trackerId],
      updatedAt: new Date().toISOString(),
    }))
  }

  const unlinkHabitFromLifeGoal = (goalId: string, trackerId: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      linkedHabitIds: (goal.linkedHabitIds ?? []).filter((id) => id !== trackerId),
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
    setLifeGoalDraft((current) => {
      const nextTasks = current.tasks.map((task) => (task.id === taskId ? updater(task) : task))
      const updatedTask = nextTasks.find((task) => task.id === taskId) ?? null
      return {
        ...current,
        tasks:
          lifeGoalComposerMode === 'create' && updatedTask && updatedTask.text.trim().length === 0
            ? collapseCreateDraftTasks(nextTasks)
            : nextTasks,
      }
    })
  }

  const insertDraftTaskAt = (index: number) => {
    const nextTask = createLifeGoalDraftTask()
    setLifeGoalDraft((current) => {
      const nextTasks = [...current.tasks]
      nextTasks.splice(index, 0, nextTask)
      return {
        ...current,
        tasks: nextTasks,
      }
    })
    setPendingDraftTaskFocusId(nextTask.id)
  }

  const addDraftTask = () => {
    insertDraftTaskAt(lifeGoalDraft.tasks.length)
  }

  const deleteDraftTask = (taskId: string) => {
    setLifeGoalDraft((current) => {
      const nextTasks = current.tasks.filter((task) => task.id !== taskId)
      return {
        ...current,
        tasks:
          lifeGoalComposerMode === 'create'
            ? collapseCreateDraftTasks(nextTasks)
            : nextTasks.length > 0
              ? nextTasks
              : [createLifeGoalDraftTask()],
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

  const handleCreatePathTaskKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, taskId: string, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      insertDraftTaskAt(index + 1)
    }
  }

  const usedLifeGoalCategories = useMemo(
    () => Array.from(new Set(sortedLifeGoals.map((goal) => goal.category.trim()).filter(Boolean))),
    [sortedLifeGoals],
  )
  const lifeGoalCategoryOptions = useMemo(
    () => getLifeGoalCategoryOptions(lifeGoalCategories, usedLifeGoalCategories),
    [lifeGoalCategories, usedLifeGoalCategories],
  )
  const normalizedDraftCategory = normalizeCategoryValue(lifeGoalDraft.category)
  const selectedDraftGoalType = lifeGoalDraft.goalType ?? 'outcome'
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
    () => {
      const filteredGoals =
        lifeGoalCategoryFilter === 'all'
          ? sortedLifeGoals
          : sortedLifeGoals.filter((goal) => goal.category.trim() === lifeGoalCategoryFilter)

      return sortLifeGoalsForOverview(filteredGoals, lifeGoalOverviewSort)
    },
    [lifeGoalCategoryFilter, lifeGoalOverviewSort, sortedLifeGoals],
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
    if (!lifeGoalActiveDateField) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const activeFieldRef =
        lifeGoalActiveDateField === 'startDate' ? lifeGoalStartDateFieldRef.current : lifeGoalDateFieldRef.current
      if (!activeFieldRef?.contains(target) && !lifeGoalDatePanelRef.current?.contains(target)) {
        event.preventDefault()
        event.stopPropagation()
        setLifeGoalActiveDateField(null)
        setLifeGoalDatePanelPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    return () => document.removeEventListener('mousedown', handlePointerDown, true)
  }, [lifeGoalActiveDateField])

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
    if (!lifeGoalOverviewViewMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!lifeGoalOverviewViewFieldRef.current?.contains(target) && !lifeGoalOverviewViewPanelRef.current?.contains(target)) {
        setLifeGoalOverviewViewMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalOverviewViewMenuOpen])

  useEffect(() => {
    if (!lifeGoalOverviewSortMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (!lifeGoalOverviewSortFieldRef.current?.contains(target) && !lifeGoalOverviewSortPanelRef.current?.contains(target)) {
        setLifeGoalOverviewSortMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalOverviewSortMenuOpen])

  useEffect(() => {
    if (!lifeGoalOverviewCategoryMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !lifeGoalOverviewCategoryFieldRef.current?.contains(target) &&
        !lifeGoalOverviewCategoryPanelRef.current?.contains(target)
      ) {
        setLifeGoalOverviewCategoryMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [lifeGoalOverviewCategoryMenuOpen])

  useEffect(() => {
    if (!lifeGoalOverviewCategoryMenuOpen || !lifeGoalOverviewCategoryFieldRef.current) return

    const updatePosition = () => {
      if (!lifeGoalOverviewCategoryFieldRef.current) return
      setLifeGoalOverviewCategoryPanelPosition(
        getFloatingPanelPosition(lifeGoalOverviewCategoryFieldRef.current, {
          preferredWidth: 240,
          minWidth: 220,
          estimatedHeight: 220,
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
  }, [lifeGoalOverviewCategoryMenuOpen])

  useEffect(() => {
    if (!lifeGoalOverviewViewMenuOpen || !lifeGoalOverviewViewFieldRef.current) return

    const updatePosition = () => {
      if (!lifeGoalOverviewViewFieldRef.current) return
      setLifeGoalOverviewViewPanelPosition(
        getFloatingPanelPosition(lifeGoalOverviewViewFieldRef.current, {
          preferredWidth: 168,
          minWidth: 148,
          estimatedHeight: 144,
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
  }, [lifeGoalOverviewViewMenuOpen])

  useEffect(() => {
    if (!lifeGoalOverviewSortMenuOpen || !lifeGoalOverviewSortFieldRef.current) return

    const updatePosition = () => {
      if (!lifeGoalOverviewSortFieldRef.current) return
      setLifeGoalOverviewSortPanelPosition(
        getFloatingPanelPosition(lifeGoalOverviewSortFieldRef.current, {
          preferredWidth: 168,
          minWidth: 148,
          estimatedHeight: 180,
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
  }, [lifeGoalOverviewSortMenuOpen])

  useEffect(() => {
    writeJsonStorage(GOAL_OVERVIEW_VIEW_CONTROLS_STORAGE_KEY, goalOverviewViewControls)
  }, [goalOverviewViewControls])

  useEffect(() => {
    writeJsonStorage(GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY, goalOverviewRowActions)
  }, [goalOverviewRowActions])

  useEffect(() => {
    writeJsonStorage(GOAL_DETAIL_CONTENT_VISIBILITY_STORAGE_KEY, goalDetailContentVisibilityByGoal)
  }, [goalDetailContentVisibilityByGoal])

  useEffect(() => {
    if (!goalOverviewControlsPanelOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        goalOverviewControlsPanelRef.current?.contains(target) ||
        goalOverviewControlsTriggerRef.current?.contains(target)
      ) {
        return
      }

      if (!goalOverviewControlsPanelRef.current?.contains(target)) {
        goalOverviewControlsDismissUntilRef.current = Date.now() + 220
        suppressGoalOverviewRowClickRef.current = true
        setGoalOverviewControlsPanelOpen(false)
        event.preventDefault()
        event.stopPropagation()
        window.setTimeout(() => {
          suppressGoalOverviewRowClickRef.current = false
        }, 240)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGoalOverviewControlsPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewControlsPanelOpen])

  useEffect(() => {
    if (!lifeGoalIconPickerOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        lifeGoalIconPickerRef.current?.contains(target) ||
        lifeGoalIconFieldRef.current?.contains(target)
      ) {
        return
      }
      setLifeGoalIconPickerOpen(false)
      setLifeGoalIconPickerPosition(null)
      setInlineLifeGoalIconGoalId(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLifeGoalIconPickerOpen(false)
        setLifeGoalIconPickerPosition(null)
        setInlineLifeGoalIconGoalId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [lifeGoalIconPickerOpen])

  useEffect(() => {
    if (!lifeGoalIconPickerOpen) return

    const updatePosition = () => {
      const trigger = lifeGoalIconFieldRef.current
      if (!trigger) return

      const triggerRect = trigger.getBoundingClientRect()
      const panelWidth = Math.min(380, window.innerWidth - 24)
      const panelHeight = Math.min(465, window.innerHeight - 24)
      const gap = 8

      let left = triggerRect.left
      let top = triggerRect.bottom + gap

      if (left + panelWidth > window.innerWidth - 12) {
        left = window.innerWidth - panelWidth - 12
      }
      if (left < 12) {
        left = 12
      }

      if (top + panelHeight > window.innerHeight - 12) {
        top = triggerRect.top - panelHeight - gap
      }
      if (top < 12) {
        top = 12
      }

      setLifeGoalIconPickerPosition({
        top: Math.round(top),
        left: Math.round(left),
        width: Math.round(panelWidth),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [lifeGoalIconPickerOpen])

  useEffect(() => {
    const updateHeaderControlsStickyState = () => {
      if (typeof document === 'undefined') return
      const slot = document.getElementById('goals-header-controls-slot')
      if (!slot) return

      const rect = slot.getBoundingClientRect()
      const stickyEnterOffset = 18
      const stickyExitOffset = 30
      const nextRightOffset = Math.round(Math.max(12, window.innerWidth - rect.right))
      const restingTopOffset = Math.round(Math.max(0, rect.top))

      setGoalOverviewHeaderControlsRight(nextRightOffset)
      setGoalOverviewHeaderControlsSticky((current) => {
        const nextSticky = current ? restingTopOffset <= stickyExitOffset : restingTopOffset <= stickyEnterOffset
        setGoalOverviewHeaderControlsTop((previousTop) => {
          if (!nextSticky) {
            return restingTopOffset
          }
          return current ? previousTop : restingTopOffset
        })
        return nextSticky
      })
    }

    updateHeaderControlsStickyState()
    window.addEventListener('scroll', updateHeaderControlsStickyState, { passive: true })
    window.addEventListener('resize', updateHeaderControlsStickyState)
    return () => {
      window.removeEventListener('scroll', updateHeaderControlsStickyState)
      window.removeEventListener('resize', updateHeaderControlsStickyState)
    }
  }, [])

  useEffect(() => {
    if (!goalOverviewStatusMenuGoalId) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const targetElement = target instanceof Element ? target : null
      const clickedStatusTrigger = targetElement?.closest('[data-goal-status-trigger="true"]')
      if (!goalOverviewStatusMenuRef.current?.contains(target) && !clickedStatusTrigger) {
        goalOverviewStatusDismissUntilRef.current = Date.now() + 220
        suppressGoalOverviewRowClickRef.current = true
        setGoalOverviewStatusMenuGoalId(null)
        event.preventDefault()
        event.stopPropagation()
        window.setTimeout(() => {
          suppressGoalOverviewRowClickRef.current = false
        }, 240)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGoalOverviewStatusMenuGoalId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewStatusMenuGoalId])

  useEffect(() => {
    if (!goalOverviewActiveDateField) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const activeFieldRef =
        goalOverviewActiveDateTriggerRef.current ??
        (goalOverviewActiveDateField.field === 'startDate'
          ? goalOverviewStartDateFieldRefs.current[goalOverviewActiveDateField.goalId]
          : goalOverviewTargetDateFieldRefs.current[goalOverviewActiveDateField.goalId])

      if (!activeFieldRef?.contains(target) && !goalOverviewDatePanelRef.current?.contains(target)) {
        goalOverviewDateDismissUntilRef.current = Date.now() + 220
        suppressGoalOverviewRowClickRef.current = true
        goalOverviewActiveDateTriggerRef.current = null
        setGoalOverviewActiveDateField(null)
        setGoalOverviewDatePanelPosition(null)
        event.preventDefault()
        event.stopPropagation()
        window.setTimeout(() => {
          suppressGoalOverviewRowClickRef.current = false
        }, 240)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        goalOverviewActiveDateTriggerRef.current = null
        setGoalOverviewActiveDateField(null)
        setGoalOverviewDatePanelPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewActiveDateField])

  useEffect(() => {
    if (!lifeGoalComposerOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalActiveDateField(null)
    setLifeGoalDatePanelPosition(null)
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
    if (!lifeGoalComposerOpen && createGoalVisualState !== 'idle') {
      setCreateGoalVisualState('idle')
    }
  }, [createGoalVisualState, lifeGoalComposerOpen])

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
    if (!lifeGoalActiveDateField || !activeFieldRef) return

    const updatePosition = () => {
      const currentActiveFieldRef =
        lifeGoalActiveDateField === 'startDate' ? lifeGoalStartDateFieldRef.current : lifeGoalDateFieldRef.current
      if (!currentActiveFieldRef) return
      setLifeGoalDatePanelPosition(
        getFloatingPanelPosition(currentActiveFieldRef, {
          minWidth: 288,
          preferredWidth: 296,
          estimatedHeight: 360,
          respectAnchorWidth: false,
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
  }, [lifeGoalActiveDateField])

  useEffect(() => {
    if (!goalOverviewActiveDateField) return

    const updatePosition = () => {
      const activeFieldRef =
        goalOverviewActiveDateTriggerRef.current ??
        (goalOverviewActiveDateField.field === 'startDate'
          ? goalOverviewStartDateFieldRefs.current[goalOverviewActiveDateField.goalId]
          : goalOverviewTargetDateFieldRefs.current[goalOverviewActiveDateField.goalId])
      if (!activeFieldRef) return

      const nextPosition = getGoalOverviewDatePanelPositionFromRect(activeFieldRef.getBoundingClientRect())
      if (nextPosition) {
        setGoalOverviewDatePanelPosition(nextPosition)
      }
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [goalOverviewActiveDateField])

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

  const applyLifeGoalType = (goalType: LifeGoalType) => {
    setLifeGoalDraft((current) => ({
      ...current,
      goalType,
      milestonesEnabled: goalType === 'outcome' ? current.milestonesEnabled : false,
      relatedGoalIds: (current.relatedGoalIds ?? []).filter((goalId) => {
        const candidate = safeLifeGoals.find((goal) => goal.id === goalId && !goal.archivedAt)
        if (!candidate) return false
        return canGoalTypeLinkToGoalType(goalType, candidate.goalType ?? 'outcome')
      }),
    }))
  }

  const renderLifeGoalTypeSelector = (mode: 'create' | 'edit-change') => (
    <div className="relative">
      <select
        value={selectedDraftGoalType}
        onChange={(event) => applyLifeGoalType(event.target.value as LifeGoalType)}
        className={`appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08] ${
          mode === 'create' ? 'h-11 w-full px-3.5' : 'h-9 w-full px-3'
        }`}
        aria-label="Goal type"
      >
        {LIFE_GOAL_TYPE_OPTIONS.map((option) => (
          <option key={`${mode}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )

  const renderLifeGoalIconPicker = () => {
    const selectedIconOption =
      lifeGoalDraft.icon && !lifeGoalDraft.icon.startsWith('emoji:') ? LIFE_GOAL_ICON_MAP[lifeGoalDraft.icon] : null
    const selectedEmoji = lifeGoalDraft.icon && lifeGoalDraft.icon.startsWith('emoji:') ? lifeGoalDraft.icon.slice(6) : null

    return (
      <button
        ref={lifeGoalIconFieldRef}
        type="button"
        onClick={() => {
          if (lifeGoalIconPickerOpen) {
            setLifeGoalIconPickerOpen(false)
            setLifeGoalIconPickerPosition(null)
            return
          }
          setLifeGoalIconPickerQuery('')
          setLifeGoalIconPickerTab(lifeGoalDraft.icon?.startsWith('emoji:') ? 'emojis' : 'icons')
          setLifeGoalIconPickerOpen(true)
        }}
        className="theme-input flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border text-left transition hover:border-white/[0.08] hover:bg-white/[0.03]"
        aria-label={selectedIconOption?.label ?? (selectedEmoji ? 'Selected emoji' : 'Select icon')}
        title={selectedIconOption?.label ?? (selectedEmoji ? 'Selected emoji' : 'Select icon')}
      >
        {selectedEmoji ? (
          <span className="text-[18px] leading-none" aria-hidden="true">
            {selectedEmoji}
          </span>
        ) : selectedIconOption ? (
          <selectedIconOption.Icon size={16} strokeWidth={1.85} className="text-white/68" aria-hidden="true" />
        ) : (
          <span className="text-[13px] text-white/34" aria-hidden="true">+</span>
        )}
      </button>
    )
  }

  const renderLifeGoalIconPickerPanel = () => {
    const normalizedIconQuery = lifeGoalIconPickerQuery.trim().toLowerCase()
    const iconResults = normalizedIconQuery
      ? LIFE_GOAL_ICON_OPTIONS.filter((option) => option.search.includes(normalizedIconQuery))
      : LIFE_GOAL_ICON_OPTIONS
    const showingEmojiPicker = lifeGoalIconPickerTab === 'emojis'

    return lifeGoalIconPickerOpen && lifeGoalIconPickerPosition && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[90]" onMouseDown={(event) => event.stopPropagation()}>
            <div
              ref={lifeGoalIconPickerRef}
              className="theme-popover fixed z-[91] flex h-[min(54vh,465px)] flex-col overflow-hidden rounded-[24px] border bg-[rgb(var(--theme-surface-elevated-rgb))] shadow-[0_22px_46px_rgba(15,23,42,0.24)]"
              style={{
                top: `${lifeGoalIconPickerPosition.top}px`,
                left: `${lifeGoalIconPickerPosition.left}px`,
                width: `${lifeGoalIconPickerPosition.width}px`,
              }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/[0.06] px-2.5 pt-2">
                <div className="flex items-center gap-3">
                  {([
                    ['icons', 'Icons'],
                    ['emojis', 'Emojis'],
                  ] as const).map(([tab, label]) => {
                    const active = lifeGoalIconPickerTab === tab
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setLifeGoalIconPickerTab(tab)}
                        className={`relative pb-2 text-[14px] font-medium transition ${
                          active ? 'text-white/92' : 'text-white/54 hover:text-white/76'
                        }`}
                      >
                        {label}
                        <span
                          className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full transition ${
                            active ? 'bg-[rgb(var(--theme-accent-rgb)/0.9)]' : 'bg-transparent'
                          }`}
                        />
                      </button>
                    )
                  })}
                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setLifeGoalDraft((current) => ({ ...current, icon: null }))
                        setLifeGoalIconPickerOpen(false)
                        setLifeGoalIconPickerPosition(null)
                        if (inlineLifeGoalIconGoalId) {
                          onUpdateLifeGoal(inlineLifeGoalIconGoalId, (goal) => ({
                            ...goal,
                            icon: null,
                            updatedAt: new Date().toISOString(),
                          }))
                          setInlineLifeGoalIconGoalId(null)
                          if (!lifeGoalComposerOpen) {
                            setEditingLifeGoalId(null)
                          }
                        }
                      }}
                      className="theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {!showingEmojiPicker ? (
                <div className="border-b border-white/[0.05] px-2.5 py-2">
                  <input
                    value={lifeGoalIconPickerQuery}
                    onChange={(event) => setLifeGoalIconPickerQuery(event.target.value)}
                    placeholder="Search icons..."
                    spellCheck={false}
                    autoFocus
                    className="theme-input min-w-0 w-full rounded-2xl border px-4 py-2.5 text-sm outline-none"
                  />
                </div>
              ) : null}

              <div className="flex-1 overflow-y-auto px-2.5 py-2.5">
                {showingEmojiPicker ? (
                  <div className="overflow-hidden rounded-[16px] border border-white/[0.05] bg-white/[0.015]">
                    <EmojiPicker
                      theme={EmojiPickerTheme.DARK}
                      emojiStyle={EmojiStyle.NATIVE}
                      suggestedEmojisMode={SuggestionMode.RECENT}
                      lazyLoadEmojis
                      previewConfig={{ showPreview: false }}
                      width="100%"
                      height="100%"
                      searchPlaceholder="Search emojis..."
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        setLifeGoalDraft((current) => ({ ...current, icon: `emoji:${emojiData.emoji}` }))
                        setLifeGoalIconPickerOpen(false)
                        setLifeGoalIconPickerPosition(null)
                        if (inlineLifeGoalIconGoalId) {
                          onUpdateLifeGoal(inlineLifeGoalIconGoalId, (goal) => ({
                            ...goal,
                            icon: `emoji:${emojiData.emoji}`,
                            updatedAt: new Date().toISOString(),
                          }))
                          setInlineLifeGoalIconGoalId(null)
                          if (!lifeGoalComposerOpen) {
                            setEditingLifeGoalId(null)
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(30px,1fr))] gap-[2px]">
                      {iconResults.map(({ value, label, Icon }) => {
                        const active = lifeGoalDraft.icon === value
                        return (
                          <button
                            key={`life-goal-icon-${value}`}
                            type="button"
                            onClick={() => {
                              setLifeGoalDraft((current) => ({ ...current, icon: value }))
                              setLifeGoalIconPickerOpen(false)
                              setLifeGoalIconPickerPosition(null)
                              if (inlineLifeGoalIconGoalId) {
                                onUpdateLifeGoal(inlineLifeGoalIconGoalId, (goal) => ({
                                  ...goal,
                                  icon: value,
                                  updatedAt: new Date().toISOString(),
                                }))
                                setInlineLifeGoalIconGoalId(null)
                                if (!lifeGoalComposerOpen) {
                                  setEditingLifeGoalId(null)
                                }
                              }
                            }}
                            className={`inline-flex h-8 items-center justify-center rounded-[8px] transition ${
                              active ? 'bg-white/[0.085] text-white/88' : 'text-white/70 hover:bg-white/[0.045] hover:text-white/88'
                            }`}
                            aria-label={label}
                            title={label}
                          >
                            <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                          </button>
                        )
                      })}
                    </div>
                    {iconResults.length === 0 ? <p className="theme-text-muted px-2 py-4 text-sm">No matching icons.</p> : null}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null
  }

  const openLifeGoalCategoryMenu = () => {
    setLifeGoalCategoryQuery('')
    setLifeGoalCategoryMenuOpen(true)
  }

  const openLifeGoalDatePicker = (field: 'startDate' | 'targetDate') => {
    setLifeGoalActiveDateField(field)
    setLifeGoalDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(lifeGoalDraft[field])))
  }

  const openLifeGoalComposer = (opener?: HTMLElement | null) => {
    lifeGoalComposerTriggerRef.current = opener ?? null
    if (lifeGoalActionFeedbackTimeoutRef.current) {
      window.clearTimeout(lifeGoalActionFeedbackTimeoutRef.current)
      lifeGoalActionFeedbackTimeoutRef.current = null
    }
    setLifeGoalActionFeedback(null)
    setLifeGoalComposerMode('create')
    setLifeGoalCreateStep('define')
    setLifeGoalComposerExpanded(false)
    setEditingLifeGoalId(null)
    setLifeGoalRelatedGoalsQuery('')
    setLifeGoalRelationIntent('')
    setLifeGoalComposerOpen(true)
  }

  const openEditLifeGoalComposer = (goal: LifeGoal, opener?: HTMLElement | null) => {
    lifeGoalComposerTriggerRef.current = opener ?? null
    if (lifeGoalActionFeedbackTimeoutRef.current) {
      window.clearTimeout(lifeGoalActionFeedbackTimeoutRef.current)
      lifeGoalActionFeedbackTimeoutRef.current = null
    }
    setLifeGoalActionFeedback(null)
    setLifeGoalComposerMode('edit')
    setLifeGoalCreateStep('define')
    setLifeGoalComposerExpanded(true)
    setEditingLifeGoalId(goal.id)
    setLifeGoalRelatedGoalsQuery('')
    setLifeGoalRelationIntent('')
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal))
    setLifeGoalComposerOpen(true)
  }

  const primeInlineLifeGoalDraft = (goal: LifeGoal) => {
    setLifeGoalComposerMode('edit')
    setEditingLifeGoalId(goal.id)
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal))
  }

  const commitInlineLifeGoalField = (goal: LifeGoal, field: 'title' | 'whyItMatters') => {
    const nextValue = lifeGoalDraft[field].trim()
    const fallbackValue = field === 'title' ? goal.title : goal.whyItMatters
    const finalValue = nextValue || fallbackValue
    if (finalValue !== goal[field]) {
      onUpdateLifeGoal(goal.id, (current) => ({
        ...current,
        [field]: finalValue,
        updatedAt: new Date().toISOString(),
      }))
    }
    setLifeGoalDraft((current) => ({ ...current, [field]: finalValue }))
    setInlineLifeGoalEditingField(null)
    if (!lifeGoalComposerOpen) {
      setEditingLifeGoalId(null)
    }
  }

  const cancelInlineLifeGoalField = (goal: LifeGoal, field: 'title' | 'whyItMatters') => {
    setLifeGoalDraft((current) => ({ ...current, [field]: goal[field] }))
    setInlineLifeGoalEditingField(null)
    if (!lifeGoalComposerOpen) {
      setEditingLifeGoalId(null)
    }
  }

  const closeLifeGoalComposer = () => {
    setLifeGoalComposerOpen(false)
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalCategoryQuery('')
    setLifeGoalRelatedGoalsQuery('')
    setLifeGoalRelationIntent('')
    setLifeGoalActiveDateField(null)
    setLifeGoalDatePanelPosition(null)
    setLifeGoalIconPickerOpen(false)
    setLifeGoalIconPickerPosition(null)
    setLifeGoalStatusMenuOpen(false)
    setLifeGoalCategoryPanelPosition(null)
    setLifeGoalDatePanelPosition(null)
    setLifeGoalStatusPanelPosition(null)
    setEditingLifeGoalId(null)
    setLifeGoalCreateStep('define')
    setLifeGoalComposerExpanded(false)
    setEditGoalActionsMenuOpen(false)

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
    setLifeGoalActiveDateField(null)
    setLifeGoalDatePanelPosition(null)
  }

  const renderLifeGoalComposer = () => {
    const isCreateMode = lifeGoalComposerMode === 'create'
    const isEditMode = lifeGoalComposerMode === 'edit'
    const isDirectionalDraftGoal = selectedDraftGoalType === 'directional'
    const editPanelLabelClassName = GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME
    const editPanelSelectClassName = GOALS_UTILITY_PANEL_SELECT_CLASSNAME
    const editPanelRowClassName = 'flex items-center justify-between gap-3'
    const showSecondaryFields =
      lifeGoalComposerMode === 'edit' ||
      lifeGoalComposerExpanded ||
      Boolean(
        lifeGoalDraft.title.trim() ||
          lifeGoalDraft.whyItMatters.trim() ||
          lifeGoalDraft.category.trim() ||
          lifeGoalDraft.startDate ||
          lifeGoalDraft.targetDate ||
          lifeGoalDraft.goalType === 'directional',
      )
    const canSubmitLightweightCreate = Boolean(lifeGoalDraft.title.trim())
    const titleField = (
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          {renderLifeGoalIconPicker()}
          <input
            ref={lifeGoalTitleInputRef}
            value={lifeGoalDraft.title}
            onFocus={() => {
              if (isCreateMode) setLifeGoalComposerExpanded(true)
            }}
            onChange={(event) => {
              const nextValue = event.target.value
              setLifeGoalDraft((current) => ({ ...current, title: nextValue }))
              if (isCreateMode && nextValue.trim()) {
                setLifeGoalComposerExpanded(true)
              }
            }}
            placeholder="Type a goal worth pursuing..."
            spellCheck={true}
            className="theme-input min-w-0 w-full rounded-2xl border border-white/[0.045] px-4 py-3 text-sm outline-none focus:border-white/[0.1]"
          />
        </div>

        {isCreateMode && !showSecondaryFields ? (
          <button
            type="button"
            onClick={() => setLifeGoalComposerExpanded(true)}
            className="theme-text-muted px-1 text-[12px] transition hover:text-white/72"
          >
            Add details
          </button>
        ) : null}
      </div>
    )
    const whyField = (
      <label className="space-y-2">
        <span className="theme-label">Why it matters</span>
        <textarea
          value={lifeGoalDraft.whyItMatters}
          onChange={(event) => setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))}
          placeholder="This matters because..."
          spellCheck={true}
          className="theme-input min-h-[64px] w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none"
        />
      </label>
    )
    const goalTypeField = (
      isEditMode ? (
        <div className={editPanelRowClassName}>
          <label className={editPanelLabelClassName}>Goal Type</label>
          <div className="relative">
            {renderLifeGoalTypeSelector('edit-change')}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="theme-label">Goal type</span>
          {renderLifeGoalTypeSelector('create')}
        </div>
      )
    )
    const categoryField = (
      <div className={isEditMode ? editPanelRowClassName : 'space-y-2'}>
        <span className={isEditMode ? editPanelLabelClassName : 'theme-label'}>Category</span>
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
            className={isEditMode ? `${editPanelSelectClassName} flex items-center justify-between gap-3 text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.category ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.category || 'Select category'}
            </span>
            <span className="pointer-events-none flex items-center text-white/26">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
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
                        spellCheck={true}
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
                          <span className="theme-text-faint text-[11px]">
                            {usedLifeGoalCategories.includes(category) ? 'Used' : 'Suggested'}
                          </span>
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
              )
            : null}
        </div>
      </div>
    )
    const startDateField = (
      <div className={isEditMode ? editPanelRowClassName : 'space-y-2'}>
        <span className={isEditMode ? editPanelLabelClassName : 'theme-label'}>Start Date</span>
        <div ref={lifeGoalStartDateFieldRef} className="relative">
          <button
            type="button"
            onClick={() => {
              if (lifeGoalActiveDateField === 'startDate') {
                setLifeGoalActiveDateField(null)
                setLifeGoalDatePanelPosition(null)
                return
              }
              openLifeGoalDatePicker('startDate')
            }}
            className={isEditMode ? `${editPanelSelectClassName} flex items-center justify-between gap-3 text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.startDate ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.startDate ? formatDate(lifeGoalDraft.startDate) : 'Start today'}
            </span>
            <span className="pointer-events-none flex items-center text-white/26">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    )
    const targetDateField = (
      <div className={isEditMode ? editPanelRowClassName : 'space-y-2'}>
        <span className={isEditMode ? editPanelLabelClassName : 'theme-label'}>Target Date</span>
        <div ref={lifeGoalDateFieldRef} className="relative">
          <button
            type="button"
            onClick={() => {
              if (lifeGoalActiveDateField === 'targetDate') {
                setLifeGoalActiveDateField(null)
                setLifeGoalDatePanelPosition(null)
                return
              }
              openLifeGoalDatePicker('targetDate')
            }}
            className={isEditMode ? `${editPanelSelectClassName} flex items-center justify-between gap-3 text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.targetDate ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.targetDate
                ? formatDate(lifeGoalDraft.targetDate)
                : isCreateMode && isDirectionalDraftGoal
                  ? 'Optional horizon'
                  : 'Optional deadline'}
            </span>
            <span className="pointer-events-none flex items-center text-white/26">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    )
    const statusField = !isCreateMode ? (
      <div className={isEditMode ? editPanelRowClassName : 'space-y-2'}>
        <span className={isEditMode ? editPanelLabelClassName : 'theme-label'}>Status</span>
        <div className="relative">
          <select
            value={lifeGoalDraft.status}
            onChange={(event) => applyLifeGoalStatus(event.target.value as LifeGoalStatus)}
            className={isEditMode ? editPanelSelectClassName : 'theme-input h-11 w-full appearance-none rounded-2xl border px-3 pr-9 text-sm outline-none transition'}
          >
            <option value="not-started">Not Started</option>
            <option value="in-motion">In Progress</option>
            <option value="paused">Paused</option>
            <option value="complete">Completed</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    ) : null

    if (isEditMode) {
      return (
        <div className="space-y-3.5">
          <section className="grid gap-2.5">
            {goalTypeField}
            {categoryField}
            {startDateField}
            {targetDateField}
            {statusField}
            {lifeGoalActiveDateField && lifeGoalDatePanelPosition && typeof document !== 'undefined'
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
                    <p className="theme-text-faint mb-2 text-[11px] uppercase tracking-[0.14em]">
                      {lifeGoalActiveDateField === 'startDate' ? 'Start Date' : 'Target Date'}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                        className="theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                      >
                        Prev
                      </button>
                      <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(lifeGoalDateViewMonth)}</p>
                      <button
                        type="button"
                        onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, 1))}
                        className="theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
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
                        <button
                          type="button"
                          onClick={() => applyLifeGoalDate('')}
                          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLifeGoalActiveDateField(null)
                            setLifeGoalDatePanelPosition(null)
                          }}
                          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
            {selectedDraftGoalType === 'outcome' ? (
              <div className="border-t border-white/[0.05] pt-3">
                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                  <div>
                    <p className={editPanelLabelClassName}>Milestones</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLifeGoalDraft((current) => ({ ...current, milestonesEnabled: !current.milestonesEnabled }))}
                    className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                      lifeGoalDraft.milestonesEnabled
                        ? 'border-white/[0.12] bg-transparent'
                        : 'border-white/[0.06] bg-transparent'
                    }`}
                    aria-label={`${lifeGoalDraft.milestonesEnabled ? 'Disable' : 'Enable'} milestones`}
                    aria-pressed={lifeGoalDraft.milestonesEnabled}
                  >
                    <span
                      className={`h-full w-4 rounded-full transition ${
                        lifeGoalDraft.milestonesEnabled ? 'translate-x-[14px] bg-[rgb(var(--theme-accent-rgb)/0.88)]' : 'bg-white/70'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
              <div>
                <p className={editPanelLabelClassName}>Vision board</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedLifeGoal) return
                  const nextVisible = !selectedGoalDetailContentVisibility.vision
                  setGoalDetailContentVisibilityByGoal((current) => ({
                    ...current,
                    [selectedLifeGoal.id]: {
                      ...(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY),
                      vision: nextVisible,
                    },
                  }))
                  if (!nextVisible) {
                    setSelectedLifeGoalVisionEditorOpen(false)
                  }
                }}
                className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                  selectedGoalDetailContentVisibility.vision
                    ? 'border-white/[0.12] bg-transparent'
                    : 'border-white/[0.06] bg-transparent'
                }`}
                aria-label={`${selectedGoalDetailContentVisibility.vision ? 'Hide' : 'Show'} vision board`}
                aria-pressed={selectedGoalDetailContentVisibility.vision}
              >
                <span
                  className={`h-full w-4 rounded-full transition ${
                    selectedGoalDetailContentVisibility.vision ? 'translate-x-[14px] bg-[rgb(var(--theme-accent-rgb)/0.88)]' : 'bg-white/70'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
              <div>
                <p className={editPanelLabelClassName}>Metrics</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedLifeGoal) return
                  const nextVisible = !selectedGoalDetailContentVisibility.metrics
                  setGoalDetailContentVisibilityByGoal((current) => ({
                    ...current,
                    [selectedLifeGoal.id]: {
                      ...(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY),
                      metrics: nextVisible,
                    },
                  }))
                }}
                className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                  selectedGoalDetailContentVisibility.metrics
                    ? 'border-white/[0.12] bg-transparent'
                    : 'border-white/[0.06] bg-transparent'
                }`}
                aria-label={`${selectedGoalDetailContentVisibility.metrics ? 'Hide' : 'Show'} metrics`}
                aria-pressed={selectedGoalDetailContentVisibility.metrics}
              >
                <span
                  className={`h-full w-4 rounded-full transition ${
                    selectedGoalDetailContentVisibility.metrics ? 'translate-x-[14px] bg-[rgb(var(--theme-accent-rgb)/0.88)]' : 'bg-white/70'
                  }`}
                />
              </button>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={editPanelLabelClassName}>Goal content</p>
              </div>
              <div className="grid gap-1">
                {([
                  ['icon', 'Icon'],
                  ['category', 'Category'],
                  ['status', 'Status'],
                  ['why', 'Why description'],
                ] as Array<[GoalDetailContentKey, string]>).map(([contentKey, label]) => {
                  const isVisible = selectedGoalDetailContentVisibility[contentKey]

                  return (
                    <div
                      key={contentKey}
                      className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${
                        isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedLifeGoal) return
                          setGoalDetailContentVisibilityByGoal((current) => ({
                            ...current,
                            [selectedLifeGoal.id]: {
                              ...(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY),
                              [contentKey]: !(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY)[contentKey],
                            },
                          }))
                        }}
                        className={`text-left text-[12px] transition ${GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}
                      >
                        {label}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedLifeGoal) return
                          setGoalDetailContentVisibilityByGoal((current) => ({
                            ...current,
                            [selectedLifeGoal.id]: {
                              ...(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY),
                              [contentKey]: !(current[selectedLifeGoal.id] ?? DEFAULT_GOAL_DETAIL_CONTENT_VISIBILITY)[contentKey],
                            },
                          }))
                        }}
                        className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                          isVisible ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'
                        }`}
                        aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                      >
                        <span className={`h-full w-4 rounded-full bg-white/70 transition ${isVisible ? 'translate-x-[14px]' : ''}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          </section>
        </div>
      )
    }

    return (
      <div className={isCreateMode ? 'space-y-4' : 'space-y-3'}>
        {isCreateMode && showSecondaryFields ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_280px] lg:items-start">
            <div className="space-y-0.5">
              {titleField}
              {whyField}
              <div className="-mt-4">{goalTypeField}</div>
            </div>
            <div className="space-y-3">
              {categoryField}
              {startDateField}
              {targetDateField}
            </div>
          </div>
        ) : isCreateMode ? (
          titleField
        ) : null
        }

        {showSecondaryFields && !(isCreateMode && showSecondaryFields) ? (
          <div className={isEditMode ? 'space-y-2.5' : 'space-y-3'}>
            <div className={isEditMode ? 'space-y-3' : `grid gap-5 ${isCreateMode ? 'md:grid-cols-4' : ''}`}>
              {goalTypeField}
              {categoryField}
              {startDateField}
              {targetDateField}
            </div>

            {lifeGoalActiveDateField && lifeGoalDatePanelPosition && typeof document !== 'undefined'
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
                    <p className="theme-text-faint mb-2 text-[11px] uppercase tracking-[0.14em]">
                      {lifeGoalActiveDateField === 'startDate' ? 'Start Date' : 'Target Date'}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                        className="theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                      >
                        Prev
                      </button>
                      <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(lifeGoalDateViewMonth)}</p>
                      <button
                        type="button"
                        onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, 1))}
                        className="theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
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
                        <button
                          type="button"
                          onClick={() => applyLifeGoalDate('')}
                          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLifeGoalActiveDateField(null)
                            setLifeGoalDatePanelPosition(null)
                          }}
                          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>,
                  document.body,
                )
              : null}

            {statusField}
          </div>
        ) : null}

        <div className="pt-2">
          <div className={`flex flex-wrap items-center justify-between gap-3 ${isCreateMode ? 'justify-end' : ''}`}>
            {isCreateMode ? (
              <div className="flex w-full flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={closeLifeGoalComposer}>
                  Cancel
                </Button>
                <motion.div
                  className="rounded-2xl"
                  animate={
                    createGoalVisualState === 'starting'
                      ? {
                          scale: 0.97,
                          boxShadow: '0 0 0 1px rgb(var(--theme-accent-rgb) / 0.14), 0 0 18px rgb(var(--theme-accent-rgb) / 0.18)',
                        }
                      : {
                          scale: 1,
                          boxShadow: '0 0 0 0 rgb(var(--theme-accent-rgb) / 0)',
                        }
                  }
                  transition={{
                    scale: { duration: 0.12, ease: 'easeOut' },
                    boxShadow: { duration: 0.25, ease: 'easeOut' },
                  }}
                >
                  <Button variant="soft" onClick={handleStartGoalClick} disabled={!canSubmitLightweightCreate}>
                    {createGoalVisualState === 'starting'
                      ? 'Starting...'
                      : isDirectionalDraftGoal
                        ? 'Save direction'
                        : 'Create goal'}
                  </Button>
                </motion.div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

const renderLifeGoalOverviewPage = () => {
    const allOverviewGoals = safeLifeGoals.filter((goal) => !goal.archivedAt)
    const pinnedGoalIds = new Set(goalOverviewRowActions.pinnedGoalIds)
    const pinnedGoalIndexById = new Map(goalOverviewRowActions.pinnedGoalIds.map((goalId, index) => [goalId, index]))
    const importantGoalIds = new Set(goalOverviewRowActions.highlightedGoalIds)
    const baseManualOverviewGoals = [...allOverviewGoals].sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order
      return 0
    })
    const previewIndexByGoalId = new Map(
      (goalOverviewDragPreviewOrder ?? baseManualOverviewGoals.map((goal) => goal.id)).map((goalId, index) => [goalId, index]),
    )
    const activeOverviewGoals = allOverviewGoals.filter((goal) => goal.status !== 'complete')
    const completedOverviewGoals = allOverviewGoals.filter((goal) => goal.status === 'complete')
    const hasPrimaryContent =
      goalOverviewViewControls.view === 'board'
        ? activeOverviewGoals.length > 0 || (goalOverviewViewControls.showCompleted && completedOverviewGoals.length > 0)
        : activeOverviewGoals.length > 0

    const getGoalBelongsTo = (goal: LifeGoal) => {
      const parentDirections = safeLifeGoals.filter(
        (candidate) =>
          !candidate.archivedAt &&
          candidate.id !== goal.id &&
          (candidate.goalType ?? 'outcome') === 'directional' &&
          (candidate.relatedGoalIds ?? []).includes(goal.id),
      )

      if (parentDirections.length === 0) return null
      if (parentDirections.length === 1) return parentDirections[0].title
      return `${parentDirections[0].title} +${parentDirections.length - 1}`
    }

    const getGoalPriorityValue = (goal: LifeGoal) =>
      goal.tasks.reduce((highest, task) => Math.max(highest, getPriorityScore(task)), 0)

    const getGoalPriorityLabel = (goal: LifeGoal) => {
      const priority = getGoalPriorityValue(goal)
      const priorityMeta = getLifeGoalTaskPriorityMeta(
        priority >= 3 ? 'high' : priority === 2 ? 'medium' : priority === 1 ? 'low' : 'none',
      )
      return priorityMeta?.label ?? 'None'
    }

    const manualReorderEnabled =
      goalOverviewViewControls.view === 'list' &&
      goalOverviewViewControls.groupBy === 'none' &&
      goalOverviewViewControls.sortBy === 'manual'

    const moveGoalIdInOrder = (goalIds: string[], draggedGoalId: string, targetGoalId: string) => {
      const fromIndex = goalIds.indexOf(draggedGoalId)
      const toIndex = goalIds.indexOf(targetGoalId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return goalIds
      const nextIds = [...goalIds]
      const [movedGoalId] = nextIds.splice(fromIndex, 1)
      nextIds.splice(toIndex, 0, movedGoalId)
      return nextIds
    }

    const previewOverviewGoalMove = (draggedGoalId: string, targetGoalId: string) => {
      if (draggedGoalId === targetGoalId) return

      const manualOrderedGoals = (goalOverviewDragPreviewOrder ?? baseManualOverviewGoals.map((goal) => goal.id))
        .map((goalId) => allOverviewGoals.find((goal) => goal.id === goalId) ?? null)
        .filter((goal): goal is LifeGoal => goal !== null)

      const draggedGoal = manualOrderedGoals.find((goal) => goal.id === draggedGoalId)
      const targetGoal = manualOrderedGoals.find((goal) => goal.id === targetGoalId)
      if (!draggedGoal || !targetGoal) return

      const draggedIsCompleted = draggedGoal.status === 'complete'
      const targetIsCompleted = targetGoal.status === 'complete'
      const draggedIsPinned = pinnedGoalIds.has(draggedGoalId)
      const targetIsPinned = pinnedGoalIds.has(targetGoalId)
      if (draggedIsCompleted !== targetIsCompleted || draggedIsPinned !== targetIsPinned) return

      const reorderableGoalIds = manualOrderedGoals
        .filter((goal) => (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned)
        .map((goal) => goal.id)
      const reorderedSubsetIds = moveGoalIdInOrder(reorderableGoalIds, draggedGoalId, targetGoalId)
      if (reorderedSubsetIds === reorderableGoalIds) return

      let subsetCursor = 0
      const nextOrderedGoalIds = manualOrderedGoals.map((goal) =>
        (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned
          ? reorderedSubsetIds[subsetCursor++]
          : goal.id,
      )
      setGoalOverviewDragPreviewOrder(nextOrderedGoalIds)
    }

    const reorderOverviewGoals = (draggedGoalId: string, targetGoalId: string) => {
      if (draggedGoalId === targetGoalId) return

      const manualOrderedGoals = [...baseManualOverviewGoals]

      const draggedGoal = manualOrderedGoals.find((goal) => goal.id === draggedGoalId)
      const targetGoal = manualOrderedGoals.find((goal) => goal.id === targetGoalId)
      if (!draggedGoal || !targetGoal) return

      const draggedIsCompleted = draggedGoal.status === 'complete'
      const targetIsCompleted = targetGoal.status === 'complete'
      const draggedIsPinned = pinnedGoalIds.has(draggedGoalId)
      const targetIsPinned = pinnedGoalIds.has(targetGoalId)

      if (draggedIsCompleted !== targetIsCompleted || draggedIsPinned !== targetIsPinned) return

      const reorderableGoals = manualOrderedGoals.filter(
        (goal) => (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned,
      )
      const fromIndex = reorderableGoals.findIndex((goal) => goal.id === draggedGoalId)
      const toIndex = reorderableGoals.findIndex((goal) => goal.id === targetGoalId)
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

      const reorderedSubsetIds = moveGoalIdInOrder(
        reorderableGoals.map((goal) => goal.id),
        draggedGoalId,
        targetGoalId,
      )
      const reorderedSubset = reorderedSubsetIds
        .map((goalId) => reorderableGoals.find((goal) => goal.id === goalId) ?? null)
        .filter((goal): goal is LifeGoal => goal !== null)

      let subsetCursor = 0
      const nextOrderedGoals = manualOrderedGoals.map((goal) =>
        (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned
          ? reorderedSubset[subsetCursor++]
          : goal,
      )

      nextOrderedGoals.forEach((goal, index) => {
        if (goal.order === index) return
        onUpdateLifeGoal(goal.id, (current) => ({
          ...current,
          order: index,
        }))
      })
    }

    const isGoalOverviewInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      return Boolean(
        target.closest(
          'button, a, input, select, textarea, summary, [data-goal-row-interactive="true"], [contenteditable="true"]',
        ),
      )
    }

    const updateGoalOverviewPointerDragTarget = (clientX: number, clientY: number) => {
      const elementUnderPointer = document.elementFromPoint(clientX, clientY)
      const rowElement = elementUnderPointer instanceof Element
        ? elementUnderPointer.closest<HTMLElement>('[data-goal-overview-row-id]')
        : null
      const targetGoalId = rowElement?.dataset.goalOverviewRowId ?? null
      const activeDrag = goalOverviewActivePointerDragRef.current
      if (!activeDrag || !targetGoalId || targetGoalId === activeDrag.goalId) return

      const draggedPinned = pinnedGoalIds.has(activeDrag.goalId)
      const targetPinned = pinnedGoalIds.has(targetGoalId)
      const draggedGoal = safeLifeGoals.find((item) => item.id === activeDrag.goalId)
      const targetGoal = safeLifeGoals.find((item) => item.id === targetGoalId)
      if (!draggedGoal || !targetGoal) return
      if ((draggedGoal.status === 'complete') !== (targetGoal.status === 'complete')) return
      if (draggedPinned !== targetPinned) return

      if (goalOverviewActivePointerDragRef.current?.targetGoalId !== targetGoalId) {
        goalOverviewActivePointerDragRef.current = {
          ...activeDrag,
          targetGoalId,
        }
        setDragOverLifeGoalId(targetGoalId)
      }
      previewOverviewGoalMove(activeDrag.goalId, targetGoalId)
    }

    const finishGoalOverviewPointerDrag = (commit: boolean) => {
      const activeDrag = goalOverviewActivePointerDragRef.current

      goalOverviewPointerDragCleanupRef.current?.()
      goalOverviewPointerDragCleanupRef.current = null
      goalOverviewPendingPointerDragRef.current = null
      goalOverviewActivePointerDragRef.current = null

      if (
        commit &&
        activeDrag?.goalId &&
        activeDrag.targetGoalId &&
        activeDrag.goalId !== activeDrag.targetGoalId
      ) {
        reorderOverviewGoals(activeDrag.goalId, activeDrag.targetGoalId)
      }

      setDraggedLifeGoalId(null)
      setDragOverLifeGoalId(null)
      setGoalOverviewDragPreviewOrder(null)
      setGoalOverviewDraggingCursor(false)
      window.setTimeout(() => {
        suppressGoalOverviewRowClickRef.current = false
      }, 0)
    }

    const beginGoalOverviewPointerDrag = (goalId: string) => {
      suppressGoalOverviewRowClickRef.current = true
      setGoalOverviewDraggingCursor(true)
      setDraggedLifeGoalId(goalId)
      setDragOverLifeGoalId(goalId)
      setGoalOverviewDragPreviewOrder(baseManualOverviewGoals.map((item) => item.id))
      goalOverviewActivePointerDragRef.current = {
        goalId,
        targetGoalId: goalId,
      }
    }

    const startGoalOverviewPointerTracking = (goalId: string, event: React.PointerEvent<HTMLDivElement>) => {
      if (!manualReorderEnabled || event.button !== 0 || isGoalOverviewInteractiveTarget(event.target)) {
        return
      }

      const movementThreshold = 6
      document.body.style.userSelect = 'none'
      ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
      goalOverviewPendingPointerDragRef.current = {
        goalId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const pendingDrag = goalOverviewPendingPointerDragRef.current
        if (!pendingDrag || moveEvent.pointerId !== pendingDrag.pointerId) return

        const deltaX = moveEvent.clientX - pendingDrag.startX
        const deltaY = moveEvent.clientY - pendingDrag.startY
        if (!goalOverviewActivePointerDragRef.current) {
          if (Math.hypot(deltaX, deltaY) < movementThreshold) return
          beginGoalOverviewPointerDrag(pendingDrag.goalId)
        }

        moveEvent.preventDefault()
        updateGoalOverviewPointerDragTarget(moveEvent.clientX, moveEvent.clientY)
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        const pendingDrag = goalOverviewPendingPointerDragRef.current
        if (!pendingDrag || upEvent.pointerId !== pendingDrag.pointerId) return
        finishGoalOverviewPointerDrag(Boolean(goalOverviewActivePointerDragRef.current))
      }

      goalOverviewPointerDragCleanupRef.current?.()
      goalOverviewPointerDragCleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('pointercancel', handlePointerUp)
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('pointercancel', handlePointerUp)
    }

    const sortOverviewGoals = (goals: LifeGoal[]) => {
      const applyPinnedPriority = (sortedGoals: LifeGoal[]) => {
        if (goalOverviewViewControls.sortBy !== 'manual' || goalOverviewViewControls.groupBy !== 'none') {
          return sortedGoals
        }

        return [...sortedGoals].sort((left, right) => {
          const leftPinned = pinnedGoalIds.has(left.id) ? 1 : 0
          const rightPinned = pinnedGoalIds.has(right.id) ? 1 : 0
          if (leftPinned !== rightPinned) return rightPinned - leftPinned
          if (leftPinned === 1 && rightPinned === 1) {
            return (pinnedGoalIndexById.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (pinnedGoalIndexById.get(right.id) ?? Number.MAX_SAFE_INTEGER)
          }
          return (previewIndexByGoalId.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (previewIndexByGoalId.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        })
      }

      switch (goalOverviewViewControls.sortBy) {
        case 'due':
          return sortLifeGoalsByDue(goals)
        case 'priority':
          return [...goals].sort((left, right) => {
            const priorityDiff = getGoalPriorityValue(right) - getGoalPriorityValue(left)
            if (priorityDiff !== 0) return priorityDiff
            return right.updatedAt.localeCompare(left.updatedAt)
          })
        case 'updated':
          return [...goals].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        case 'manual':
        default:
          return applyPinnedPriority(
            [...goals].sort(
              (left, right) =>
                (previewIndexByGoalId.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
                (previewIndexByGoalId.get(right.id) ?? Number.MAX_SAFE_INTEGER),
            ),
          )
      }
    }

    const getGroupLabel = (goal: LifeGoal) => {
      switch (goalOverviewViewControls.groupBy) {
        case 'status':
          return getLifeGoalStatusMeta(goal.status, goal.startDate).label
        case 'category':
          return goal.category.trim() || 'Uncategorized'
        case 'life-direction':
          return (goal.goalType ?? 'outcome') === 'directional' ? 'Life directions' : getGoalBelongsTo(goal) ?? 'Unlinked goals'
        case 'none':
        default:
          return ''
      }
    }

    const buildGroupedGoals = (goals: LifeGoal[]) => {
      const sorted = sortOverviewGoals(goals)
      if (goalOverviewViewControls.groupBy === 'none') {
        return [{ label: null, goals: sorted }]
      }

      const grouped = new Map<string, LifeGoal[]>()
      sorted.forEach((goal) => {
        const label = getGroupLabel(goal)
        if (!grouped.has(label)) grouped.set(label, [])
        grouped.get(label)!.push(goal)
      })

      return Array.from(grouped.entries()).map(([label, groupedGoals]) => ({
        label,
        goals: groupedGoals,
      }))
    }

    const activeGroupedGoals = buildGroupedGoals(activeOverviewGoals)
    const completedGroupedGoals = buildGroupedGoals(completedOverviewGoals)

    const updateViewControls = (updater: (current: GoalOverviewViewControls) => GoalOverviewViewControls) =>
      setGoalOverviewViewControls((current) => normalizeGoalOverviewViewControls(updater(current)))

    const togglePinnedGoal = (goalId: string) =>
      setGoalOverviewRowActions((current) =>
        normalizeGoalOverviewRowActions({
          ...current,
          pinnedGoalIds: current.pinnedGoalIds.includes(goalId)
            ? current.pinnedGoalIds.filter((id) => id !== goalId)
            : [...current.pinnedGoalIds, goalId],
        }),
      )

    const toggleImportantGoal = (goalId: string) =>
      setGoalOverviewRowActions((current) =>
        normalizeGoalOverviewRowActions({
          ...current,
          highlightedGoalIds: current.highlightedGoalIds.includes(goalId)
            ? current.highlightedGoalIds.filter((id) => id !== goalId)
            : [...current.highlightedGoalIds, goalId],
        }),
      )

    const reorderColumnBefore = (
      sourceColumn: Exclude<GoalOverviewColumnKey, 'milestones'>,
      targetColumn: Exclude<GoalOverviewColumnKey, 'milestones'>,
    ) =>
      updateViewControls((current) => {
        const movableColumns = current.columnOrder.filter(
          (item): item is Exclude<GoalOverviewColumnKey, 'milestones'> => item !== 'milestones',
        )
        const sourceIndex = movableColumns.indexOf(sourceColumn)
        const targetIndex = movableColumns.indexOf(targetColumn)
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current

        const reordered = [...movableColumns]
        const [removed] = reordered.splice(sourceIndex, 1)
        reordered.splice(targetIndex, 0, removed)

        return {
          ...current,
          columnOrder: reordered,
        }
      })

    const renderPriorityIndicator = (goal: LifeGoal) => {
      const priority = getGoalPriorityValue(goal)
      if (priority <= 0) return null

      const activeBars = Math.min(priority, 3)

      return (
        <span className="inline-flex h-4 translate-x-[11px] items-end gap-[2px]" aria-label={`${getGoalPriorityLabel(goal)} priority`} title={`${getGoalPriorityLabel(goal)} priority`}>
          {[0, 1, 2].map((index) => (
            <span
              key={`priority-bar-${index}`}
              className={`w-[3px] rounded-full transition ${
                index < activeBars ? 'bg-white/50' : 'bg-white/14'
              }`}
              style={{ height: `${6 + index * 3}px` }}
            />
          ))}
        </span>
      )
    }

    const renderCompletionIndicator = (goal: LifeGoal) => {
      const progress = getLifeGoalProgress(goal)
      const segmentCount = 10
      const filledSegments = Math.round((progress.percent / 100) * segmentCount)
      const segmentStep = (Math.PI * 2) / segmentCount
      const innerRadius = 5.6
      const outerRadius = 8.4

      return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="relative inline-flex h-[22px] w-[22px] items-center justify-center shrink-0" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
              {Array.from({ length: segmentCount }, (_, index) => {
                const angle = -(Math.PI / 2) + segmentStep * index
                const isFilled = index < filledSegments
                const x1 = 10 + Math.cos(angle) * innerRadius
                const y1 = 10 + Math.sin(angle) * innerRadius
                const x2 = 10 + Math.cos(angle) * outerRadius
                const y2 = 10 + Math.sin(angle) * outerRadius
                return (
                  <line
                    key={`goal-completion-segment-${goal.id}-${index}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isFilled ? 'rgb(var(--theme-accent-rgb) / 0.9)' : 'rgba(255,255,255,0.14)'}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>
          </span>
          <span className="shrink-0 text-[11px] font-medium text-[rgba(255,255,255,0.78)]">{progress.percent}%</span>
        </span>
      )
    }

    const getCompletedGoalTimelineLabel = (goal: LifeGoal) => {
      if (goal.status !== 'complete') return null

      const startedLabel = isValidIsoDate(goal.startDate) ? formatDateShortYear(goal.startDate) : 'No start set'
      const completedSource = goal.updatedAt?.slice(0, 10)
      const completedLabel = isValidIsoDate(completedSource ?? '') ? formatDateShortYear(completedSource!) : 'Completed date unavailable'

      return `Started ${startedLabel} · Completed ${completedLabel}`
    }

    const getGoalOverviewDueDisplay = (goal: LifeGoal) => {
      if (goal.status === 'complete' || !isValidIsoDate(goal.targetDate)) return null

      const daysUntilDue = Math.round(
        (new Date(`${goal.targetDate}T00:00:00Z`).getTime() - new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()) / 86400000,
      )

      return {
        label:
          daysUntilDue < 0
            ? `Overdue ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}`
            : `${daysUntilDue}d`,
        className:
          daysUntilDue < 0
            ? 'text-[rgb(var(--theme-negative-rgb)/0.92)]'
            : daysUntilDue < 7
              ? 'text-[rgb(var(--theme-warning-rgb)/0.9)]'
              : 'text-[rgba(255,255,255,0.56)]',
      }
    }

    const orderedVisibleColumnKeys = goalOverviewViewControls.columnOrder.filter(
      (column) =>
        column !== 'milestones' &&
        column !== 'due' &&
        column !== 'startDate' &&
        column !== 'targetDate' &&
        goalOverviewViewControls.columns[column],
    )

    const columnMeta: Record<
      GoalOverviewColumnKey,
      {
        label: string
        width: string
        render: (goal: LifeGoal) => React.ReactNode
      }
    > = {
      priority: {
        label: 'Priority',
        width: '112px',
        render: (goal) => renderPriorityIndicator(goal),
      },
      category: {
        label: 'Category',
        width: '112px',
        render: (goal) => {
          const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
          return goal.category ? (
            <span
              className="inline-flex max-w-full items-center truncate rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase leading-none tracking-[0.08em]"
              style={{ ...getLifeGoalCategoryChipStyle(categoryColor), ...getLifeGoalCategoryChipTextStyle(categoryColor) }}
            >
              <span className="truncate">{goal.category}</span>
            </span>
          ) : (
            null
          )
        },
      },
      belongsTo: {
        label: 'Supports',
        width: '112px',
        render: (goal) => {
          const belongsTo = getGoalBelongsTo(goal)
          return belongsTo ? (
            <span className="relative block overflow-hidden whitespace-nowrap pr-2 text-[12px] text-[rgba(255,255,255,0.62)]">
              <span className="block truncate">{belongsTo}</span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-6"
                style={{ background: 'linear-gradient(to right, rgba(0,0,0,0), rgb(var(--theme-surface-rgb)))' }}
              />
            </span>
          ) : null
        },
      },
      due: {
        label: 'Due',
        width: '112px',
        render: (goal) => {
          if (goal.status === 'complete') {
            return goal.targetDate ? (
              <span className="block truncate text-[12px] text-[rgba(255,255,255,0.62)]">{formatDateShortYear(goal.targetDate)}</span>
            ) : null
          }
          const daysUntilDue =
            isValidIsoDate(goal.targetDate)
              ? Math.round(
                  (new Date(`${goal.targetDate}T00:00:00Z`).getTime() - new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()) / 86400000,
                )
              : null
          const dueToneClassName =
            daysUntilDue !== null
              ? daysUntilDue < 0
                ? 'text-[rgb(var(--theme-negative-rgb)/0.92)]'
                : daysUntilDue < 7
                  ? 'text-[rgb(var(--theme-warning-rgb)/0.9)]'
                  : 'text-[rgba(255,255,255,0.62)]'
              : 'text-[rgba(255,255,255,0.62)]'
          const dueLabel =
            daysUntilDue !== null
              ? daysUntilDue < 0
                ? `Overdue ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}`
                : `${daysUntilDue}d`
              : goal.targetDate
                ? formatDate(goal.targetDate)
                : null
          return dueLabel ? (
            <span className={`block truncate text-[12px] ${dueToneClassName}`}>
              {dueLabel}
            </span>
          ) : (
            null
          )
        },
      },
      startDate: {
        label: 'Start date',
        width: '112px',
        render: (goal) => (
          <button
            type="button"
            ref={(node) => {
              goalOverviewStartDateFieldRefs.current[goal.id] = node
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            className="block w-full truncate rounded-[10px] px-1.5 py-1 text-left text-[12px] text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
            aria-label={goal.startDate ? `Edit start date, currently ${formatDateContextual(goal.startDate)}` : 'Set start date'}
          >
            {goal.startDate ? (
              formatDateContextual(goal.startDate)
            ) : (
              <span className="inline-flex items-center text-white/46">
                <svg width="19" height="19" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M8 7.75V11.25M6.25 9.5H9.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
            )}
          </button>
        ),
      },
      targetDate: {
        label: 'Target date',
        width: '112px',
        render: (goal) =>
          (
            <button
              type="button"
              ref={(node) => {
                goalOverviewTargetDateFieldRefs.current[goal.id] = node
              }}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
              }}
              onMouseDown={(event) => {
                event.stopPropagation()
              }}
              className="block w-full truncate rounded-[10px] px-1.5 py-1 text-left text-[12px] text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
              aria-label={goal.targetDate ? `Edit target date, currently ${formatDateContextual(goal.targetDate)}` : 'Set target date'}
            >
              {goal.targetDate ? (
                formatDateContextual(goal.targetDate)
              ) : (
                <span className="inline-flex items-center text-white/46">
                  <svg width="19" height="19" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M8 7.75V11.25M6.25 9.5H9.75" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </span>
              )}
            </button>
          ),
      },
      milestones: {
        label: 'Milestones',
        width: '92px',
        render: (goal) => {
          const milestoneCount = getOrderedGoalMilestones(goal).length
          return milestoneCount > 0 ? <span className="truncate text-[12px] text-white/48">{milestoneCount}</span> : null
        },
      },
      status: {
        label: 'Status',
        width: '112px',
        render: (goal) => {
          const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
          const statusLabel = statusMeta.label === 'Active' ? 'In progress' : statusMeta.label
          const isStatusMenuOpen = goalOverviewStatusMenuGoalId === goal.id
          const statusDotClassName =
            statusMeta.label === 'Active'
              ? 'bg-emerald-400'
              : statusMeta.label === 'Scheduled'
                ? 'bg-blue-400'
                : statusMeta.label === 'Completed'
                  ? 'bg-emerald-500/70'
                  : 'bg-white/30'
          const statusOptions: Array<{
            id: 'in-progress' | 'not-started' | 'scheduled'
            label: string
            dotClassName: string
            active: boolean
            onSelect: () => void
          }> = [
            {
              id: 'in-progress',
              label: 'In progress',
              dotClassName: 'bg-emerald-400',
              active: statusMeta.label === 'Active',
              onSelect: () => updateLifeGoalStatus(goal.id, 'in-motion'),
            },
            {
              id: 'not-started',
              label: 'Not Started',
              dotClassName: 'bg-white/30',
              active: goal.status === 'not-started' && !isLifeGoalScheduled(goal.status, goal.startDate),
              onSelect: () => updateLifeGoalStatus(goal.id, 'not-started'),
            },
            {
              id: 'scheduled',
              label: 'Scheduled',
              dotClassName: 'bg-blue-400',
              active: isLifeGoalScheduled(goal.status, goal.startDate),
              onSelect: () => scheduleLifeGoalFromList(goal.id),
            },
          ]
          return (
            <div className="relative flex max-w-full items-center">
              <button
                type="button"
                data-goal-status-trigger="true"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setGoalOverviewStatusMenuGoalId((current) => (current === goal.id ? null : goal.id))
                }}
                onMouseDown={(event) => {
                  event.stopPropagation()
                }}
                className="flex cursor-pointer items-center rounded-[10px] px-1.5 py-1 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
              >
                <span className="flex items-center gap-[4px] whitespace-nowrap text-[12px] font-medium leading-[1.2] text-[rgba(255,255,255,0.62)]">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClassName}`} />
                  <span className="leading-[1.2]">{statusLabel}</span>
                </span>
              </button>
              {isStatusMenuOpen ? (
                <div
                  ref={goalOverviewStatusMenuRef}
                  className="absolute left-0 top-[calc(100%+6px)] z-[60] min-w-[148px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb))] p-1.5 shadow-[0_14px_28px_rgba(15,23,42,0.24)]"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                >
                  <div className="space-y-0.5">
                    {statusOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                        }}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          option.onSelect()
                          setGoalOverviewStatusMenuGoalId(null)
                        }}
                        className={`flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-[12px] leading-[1.2] transition ${
                          option.active ? 'bg-white/[0.06] text-white/86' : 'text-white/68 hover:bg-white/[0.035] hover:text-white/84'
                        }`}
                      >
                        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${option.dotClassName}`} />
                        <span className="truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        },
      },
      completion: {
        label: 'Completion',
        width: '92px',
        render: (goal) => (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {renderCompletionIndicator(goal)}
          </div>
        ),
      },
    }

    const visibleColumnDefs = orderedVisibleColumnKeys.map((column) => ({
      key: column,
      ...columnMeta[column],
    }))

    const listGridTemplateColumns = ['minmax(320px,1.9fr)', ...visibleColumnDefs.map((column) => column.width)].join(' ')
    const goalOverviewFadeTruncateStyle = {
      WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 14px), transparent 100%)',
      maskImage: 'linear-gradient(90deg, #000 0%, #000 calc(100% - 14px), transparent 100%)',
    } as const

    const renderGoalListHeaders = () =>
      goalOverviewViewControls.view === 'list' ? (
        <div className="grid items-center gap-x-3 px-4 pb-2 [&>*]:min-w-0" style={{ gridTemplateColumns: listGridTemplateColumns }}>
          <div className="text-[12px] font-medium uppercase" style={{ color: 'rgba(255,255,255,0.82)', letterSpacing: '0.06em' }}>
            GOAL
          </div>
          {visibleColumnDefs.map((column) => (
            <div
              key={`goal-header-${column.key}`}
              className="overflow-hidden truncate whitespace-nowrap text-[12px] font-medium uppercase"
              style={{ color: 'rgba(255,255,255,0.82)', letterSpacing: '0.06em' }}
            >
              {column.key === 'priority' ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>{column.label.toUpperCase()}</span>
                  <span aria-hidden="true" className="text-white/46">↑</span>
                </span>
              ) : column.key === 'due' ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-white/50">
                    <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <span>{column.label.toUpperCase()}</span>
                </span>
              ) : (
                column.label.toUpperCase()
              )}
            </div>
          ))}
        </div>
      ) : null

    const renderListRow = (goal: LifeGoal, rowIndex: number) => {
      const progress = getLifeGoalProgress(goal)
      const isPinned = pinnedGoalIds.has(goal.id)
      const isImportant = importantGoalIds.has(goal.id)
      const milestoneCount = getOrderedGoalMilestones(goal).length
      const isDirectionalGoal = (goal.goalType ?? 'outcome') === 'directional'
      const showMilestoneChip = goalOverviewViewControls.rowContent.milestones && milestoneCount > 0
      const showDirectionalChip = goalOverviewViewControls.rowContent.directional && isDirectionalGoal
      const completedTimelineLabel = getCompletedGoalTimelineLabel(goal)
      const dueDisplay = getGoalOverviewDueDisplay(goal)
      const hasStartDate = isValidIsoDate(goal.startDate)
      const hasTargetDate = isValidIsoDate(goal.targetDate)
      const startDateLabel = hasStartDate ? formatDateContextual(goal.startDate!) : ''
      const targetDateLabel = hasTargetDate ? formatDateContextual(goal.targetDate!) : ''
      const showWhy = goalOverviewViewControls.rowContent.why
      const showIcons = goalOverviewViewControls.rowContent.icons
      const showTimelineStart = goalOverviewViewControls.rowContent.startDate
      const showTimelineTarget = goalOverviewViewControls.rowContent.targetDate
      const showTimelineDue = goalOverviewViewControls.rowContent.dueAmount
      const renderedGoalTitle = GOAL_OVERVIEW_USE_TITLE_CASE ? toTitleCase(formatGoalCardTitle(goal.title)) : formatGoalCardTitle(goal.title)
      const startOnlyLabel = hasStartDate && goal.startDate! < getTodayIsoDate() ? 'Started' : 'Start'
      const titleContentOffsetClassName = goal.icon && showIcons ? 'ml-[23px]' : ''
      const isCompletedGoal = goal.status === 'complete'
      const showNextTaskCallout = goalOverviewViewControls.showNextTask && !isCompletedGoal && Boolean(progress.nextTask?.text?.trim())
      const targetDatePickerOpenForGoal =
        goalOverviewActiveDateField?.goalId === goal.id && goalOverviewActiveDateField.field === 'targetDate'
      const timelineDueDisplay = showTimelineTarget && showTimelineDue
        ? dueDisplay
        : !showTimelineStart && !showTimelineTarget && showTimelineDue
          ? dueDisplay
          : null
      const shouldShowTimelineRow = !isCompletedGoal && (
        (showTimelineStart && hasStartDate) ||
        (showTimelineTarget && hasTargetDate) ||
        (showTimelineStart && !hasStartDate) ||
        (showTimelineTarget && !hasTargetDate) ||
        (!showTimelineStart && !showTimelineTarget && showTimelineDue && Boolean(dueDisplay))
      )

      return (
        <div
          key={goal.id}
          role="button"
          tabIndex={0}
          onPointerDown={
            manualReorderEnabled
              ? (event) => {
                  startGoalOverviewPointerTracking(goal.id, event)
                }
              : undefined
          }
          onKeyDown={
            (event) => {
              if (
                suppressGoalOverviewRowClickRef.current ||
                draggedLifeGoalId !== null ||
                goalOverviewControlsPanelOpen ||
                goalOverviewStatusMenuGoalId !== null ||
                goalOverviewActiveDateField !== null ||
                Date.now() < goalOverviewControlsDismissUntilRef.current ||
                Date.now() < goalOverviewStatusDismissUntilRef.current ||
                Date.now() < goalOverviewDateDismissUntilRef.current
              ) {
                return
              }

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectLifeGoal(goal.id)
                setLifeGoalComposerOpen(false)
                setLifeGoalActionFeedback(null)
                onChangeGoalsView('life-detail')
              }
            }
          }
          onClick={() => {
            if (
              suppressGoalOverviewRowClickRef.current ||
              draggedLifeGoalId !== null ||
              goalOverviewControlsPanelOpen ||
              goalOverviewStatusMenuGoalId !== null ||
              goalOverviewActiveDateField !== null ||
              Date.now() < goalOverviewControlsDismissUntilRef.current ||
              Date.now() < goalOverviewStatusDismissUntilRef.current ||
              Date.now() < goalOverviewDateDismissUntilRef.current
            ) {
              suppressGoalOverviewRowClickRef.current = false
              return
            }
            onSelectLifeGoal(goal.id)
            setLifeGoalComposerOpen(false)
            setLifeGoalActionFeedback(null)
            onChangeGoalsView('life-detail')
          }}
          className={`group relative grid w-full select-none items-center gap-x-3 border-b border-white/[0.04] px-4 py-2 text-left transition duration-150 last:border-b-0 [&>*]:min-w-0 ${
            draggedLifeGoalId === goal.id
              ? 'z-10 border-white/[0.08] bg-white/[0.034] shadow-[0_10px_24px_rgba(0,0,0,0.18)]'
              : dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id
                ? 'shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(255,255,255,0.12)]'
                : rowIndex % 2 === 1
                  ? 'bg-white/[0.012] hover:bg-white/[0.018]'
                  : 'bg-transparent hover:bg-white/[0.01]'
          }`}
          style={{ gridTemplateColumns: listGridTemplateColumns }}
        >
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
              <div className="flex min-w-0 items-start gap-2">
                {showIcons ? renderLifeGoalIcon(goal.icon, 'mt-[3px] shrink-0 text-white/48', 15) : null}
                <p className="truncate text-[15px] font-medium text-white/84" style={{ letterSpacing: '0.012em' }}>{renderedGoalTitle}</p>
                {showMilestoneChip ? (
                  <span className="shrink-0 flex flex-col items-start gap-1">
                    <span className="rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-[3px] text-[10px] leading-none text-white/38">
                      {milestoneCount} milestone{milestoneCount === 1 ? '' : 's'}
                    </span>
                    {showDirectionalChip ? (
                      <span className="rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-[3px] text-[10px] leading-none text-white/34">
                        Directional
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {!showMilestoneChip && showDirectionalChip ? (
                  <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-[3px] text-[10px] leading-none text-white/34">
                    Directional
                  </span>
                ) : null}
                <div className="flex shrink-0 items-center gap-[3px] pl-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      togglePinnedGoal(goal.id)
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    className={`inline-flex items-center justify-center rounded-[6px] p-[3px] transition ${
                      isPinned
                        ? 'bg-transparent text-white/60 opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white/74'
                        : 'bg-transparent text-[rgba(255,255,255,0.3)] opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white/56'
                    }`}
                    aria-label={isPinned ? 'Unpin goal' : 'Pin goal'}
                    title={isPinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={12} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      toggleImportantGoal(goal.id)
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                    }}
                    className={`inline-flex items-center justify-center rounded-[6px] p-[3px] transition ${
                      isImportant
                        ? 'bg-transparent text-white/54 opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white/68'
                        : 'bg-transparent text-[rgba(255,255,255,0.3)] opacity-0 group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white/56'
                    }`}
                    aria-label={isImportant ? 'Remove important mark from goal' : 'Mark goal as important'}
                    title={isImportant ? 'Unmark important' : 'Mark important'}
                  >
                    <Flag size={12} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="ml-auto shrink-0" />
            </div>
            {showWhy ? (
              <p className={`mt-px truncate text-[12px] text-[rgba(255,255,255,0.45)] ${titleContentOffsetClassName}`}>
                {getLifeGoalAnchorText(goal.whyItMatters) || (progress.nextTask?.text ?? 'No next step planned yet.')}
              </p>
            ) : null}
            {shouldShowTimelineRow ? (
              <div className={`mt-1 inline-flex max-w-full items-center gap-1.5 overflow-visible whitespace-nowrap text-[12px] leading-[1.2] text-[rgba(255,255,255,0.62)] ${titleContentOffsetClassName}`}>
                {showTimelineStart && showTimelineTarget ? (
                  <>
                    {hasStartDate && hasTargetDate ? (
                      <>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewStartDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label={`Edit start date, currently ${startDateLabel}`}
                        >
                          {startDateLabel}
                        </button>
                        <span aria-hidden="true" className="shrink-0 text-white/44">
                          →
                        </span>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewTargetDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label={`Edit target date, currently ${targetDateLabel}`}
                        >
                          {targetDateLabel}
                        </button>
                      </>
                    ) : hasStartDate ? (
                      <>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewStartDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label={`Edit start date, currently ${startDateLabel}`}
                        >
                          {startDateLabel}
                        </button>
                        <span aria-hidden="true" className="shrink-0 text-white/44">
                          →
                        </span>
                        <span className="group/targetdatehelper relative inline-flex shrink-0">
                          <button
                            type="button"
                            ref={(node) => {
                              goalOverviewTargetDateFieldRefs.current[goal.id] = node
                            }}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                            }}
                            onMouseDown={(event) => {
                              event.stopPropagation()
                            }}
                            className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                            aria-label="Set target date"
                          >
                            {renderCalendarAddIcon()}
                          </button>
                          {!targetDatePickerOpenForGoal ? (
                            <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-[90] hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[rgb(var(--theme-surface-elevated-rgb))] px-2.5 py-1 text-[11px] font-medium text-white/72 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/targetdatehelper:block group-hover/targetdatehelper:opacity-100">
                              Set target date
                            </span>
                          ) : null}
                        </span>
                      </>
                    ) : hasTargetDate ? (
                      <>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewStartDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label="Set start date"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                        <span aria-hidden="true" className="shrink-0 text-white/44">
                          →
                        </span>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewTargetDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label={`Edit target date, currently ${targetDateLabel}`}
                        >
                          {targetDateLabel}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          ref={(node) => {
                            goalOverviewStartDateFieldRefs.current[goal.id] = node
                          }}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                          }}
                          onMouseDown={(event) => {
                            event.stopPropagation()
                          }}
                          className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                          aria-label="Set start date"
                        >
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </button>
                        <span aria-hidden="true" className="shrink-0 text-white/44">
                          →
                        </span>
                        <span className="group/targetdatehelper relative inline-flex shrink-0">
                          <button
                            type="button"
                            ref={(node) => {
                              goalOverviewTargetDateFieldRefs.current[goal.id] = node
                            }}
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                            }}
                            onMouseDown={(event) => {
                              event.stopPropagation()
                            }}
                            className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                            aria-label="Set target date"
                          >
                            {renderCalendarAddIcon()}
                          </button>
                          {!targetDatePickerOpenForGoal ? (
                            <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-[90] hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[rgb(var(--theme-surface-elevated-rgb))] px-2.5 py-1 text-[11px] font-medium text-white/72 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/targetdatehelper:block group-hover/targetdatehelper:opacity-100">
                              Set target date
                            </span>
                          ) : null}
                        </span>
                      </>
                    )}
                    {timelineDueDisplay ? (
                      <>
                        {hasTargetDate ? (
                          <span aria-hidden="true" className="shrink-0 text-white/32">
                            •
                          </span>
                        ) : null}
                        <span className={`shrink-0 ${timelineDueDisplay.className}`}>{timelineDueDisplay.label}</span>
                      </>
                    ) : null}
                  </>
                ) : showTimelineStart ? (
                  hasStartDate ? (
                    <>
                      <span className="shrink-0 text-white/42">{startOnlyLabel}</span>
                      <button
                        type="button"
                        ref={(node) => {
                          goalOverviewStartDateFieldRefs.current[goal.id] = node
                        }}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation()
                        }}
                        className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                        aria-label={`Edit start date, currently ${startDateLabel}`}
                      >
                        {startDateLabel}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      ref={(node) => {
                        goalOverviewStartDateFieldRefs.current[goal.id] = node
                      }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        openGoalOverviewDatePicker(goal.id, 'startDate', event.currentTarget)
                      }}
                      onMouseDown={(event) => {
                        event.stopPropagation()
                      }}
                      className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                      aria-label="Set start date"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2.25" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M5 2.5V4.5M11 2.5V4.5M2.5 6.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )
                ) : showTimelineTarget ? (
                  hasTargetDate ? (
                    <>
                      <span className="shrink-0 text-white/42">Target</span>
                      <button
                        type="button"
                        ref={(node) => {
                          goalOverviewTargetDateFieldRefs.current[goal.id] = node
                        }}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation()
                        }}
                        className="min-w-0 truncate rounded-[8px] px-1 py-0.5 text-left text-[rgba(255,255,255,0.62)] transition hover:bg-white/[0.025] hover:text-[rgba(255,255,255,0.74)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                        aria-label={`Edit target date, currently ${targetDateLabel}`}
                      >
                        {targetDateLabel}
                      </button>
                      {timelineDueDisplay ? (
                        <>
                          <span aria-hidden="true" className="shrink-0 text-white/32">
                            •
                          </span>
                          <span className={`shrink-0 ${timelineDueDisplay.className}`}>{timelineDueDisplay.label}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="group/targetdatehelper relative inline-flex shrink-0">
                      <button
                        type="button"
                        ref={(node) => {
                          goalOverviewTargetDateFieldRefs.current[goal.id] = node
                        }}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          openGoalOverviewDatePicker(goal.id, 'targetDate', event.currentTarget)
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation()
                        }}
                        className="inline-flex items-center rounded-[8px] px-0.5 py-0.5 text-white/38 transition hover:bg-white/[0.025] hover:text-white/52 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
                        aria-label="Set target date"
                      >
                        {renderCalendarAddIcon()}
                      </button>
                      {!targetDatePickerOpenForGoal ? (
                        <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-[90] hidden -translate-x-1/2 whitespace-nowrap rounded-xl border border-white/10 bg-[rgb(var(--theme-surface-elevated-rgb))] px-2.5 py-1 text-[11px] font-medium text-white/72 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/targetdatehelper:block group-hover/targetdatehelper:opacity-100">
                          Set target date
                        </span>
                      ) : null}
                    </span>
                  )
                ) : timelineDueDisplay ? (
                  <span className={`shrink-0 ${timelineDueDisplay.className}`}>{timelineDueDisplay.label}</span>
                ) : null}
              </div>
            ) : null}
            {completedTimelineLabel ? (
              <div className="mt-1 inline-flex max-w-full flex-col items-start">
                <span aria-hidden="true" className="mb-1 h-px w-full max-w-[220px] bg-white/[0.06]" />
                <p className="truncate text-[11px] text-white/34">{completedTimelineLabel}</p>
              </div>
            ) : null}
            {showNextTaskCallout ? (
              <div className={`mt-2 flex max-w-full items-start gap-2 ${titleContentOffsetClassName}`}>
                <span className="mt-[1px] h-[26px] w-px shrink-0 bg-[rgb(var(--theme-info-rgb)/0.58)]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/[0.44]">Next task</p>
                  <p className="mt-[2px] truncate text-[12px] text-white/[0.7]">
                    {progress.nextTask!.text.trim()}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {visibleColumnDefs.map((column) => (
            <div
              key={`${goal.id}-${column.key}`}
              className={`min-w-0 whitespace-nowrap ${column.key === 'status' ? 'relative overflow-visible flex items-center' : 'overflow-hidden'}`}
            >
              <div
                className={`min-w-0 ${column.key === 'status' ? 'overflow-visible flex items-center' : 'overflow-hidden'}`}
                style={column.key === 'belongsTo' ? goalOverviewFadeTruncateStyle : undefined}
              >
                {column.render(goal)}
              </div>
            </div>
          ))}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute left-[2px] top-3 bottom-3 rounded-full transition-all ${
              isImportant
                ? 'z-[3] w-[2px] bg-[rgb(var(--theme-accent-rgb)/0.84)] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08),0_0_8px_rgb(var(--theme-accent-rgb)/0.08)]'
                : 'z-[1] w-[2px] bg-transparent group-hover:bg-white/[0.14]'
            }`}
          />
        </div>
      )
    }

    const renderGroupedList = (groups: Array<{ label: string | null; goals: LifeGoal[] }>) => (
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.label ?? 'default'} className="space-y-2">
            {group.label ? <p className="px-4 text-[12px] font-medium tracking-[-0.01em] text-mist/48">{group.label}</p> : null}
            <div>{group.goals.map((goal, rowIndex) => renderListRow(goal, rowIndex))}</div>
          </section>
        ))}
      </div>
    )

    const renderBoardCard = (goal: LifeGoal) => {
      const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
      const milestoneCount = getOrderedGoalMilestones(goal).length
      return (
        <button
          key={goal.id}
          type="button"
          onClick={() => {
            onSelectLifeGoal(goal.id)
            setLifeGoalComposerOpen(false)
            setLifeGoalActionFeedback(null)
            onChangeGoalsView('life-detail')
          }}
          className="group relative rounded-[18px] border border-white/[0.04] bg-white/[0.014] px-4 py-3 text-left transition hover:bg-white/[0.02]"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-[rgb(var(--goal-rail-rgb)/0.24)]"
            style={getLifeGoalAccentBarStyle(categoryColor)}
          />
          <div className="space-y-2 pl-2">
            <div className="flex min-w-0 items-center gap-2">
              {renderLifeGoalIcon(goal.icon, 'shrink-0 text-white/46', 14)}
              <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-white/88">{formatGoalCardTitle(goal.title)}</p>
              {milestoneCount > 0 ? (
                <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-[3px] text-[10px] text-white/36">
                  {milestoneCount}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {goal.category ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium leading-none text-white/44"
                  style={getLifeGoalCategoryChipStyle(categoryColor)}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                  <span>{goal.category}</span>
                </span>
              ) : null}
              <span className={`${goalStatusChipClassName} h-[22px] px-2 py-0 text-[9px] opacity-85 ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
              </span>
            </div>
            <p className="truncate text-[12px] text-white/48">{getLifeGoalAnchorText(goal.whyItMatters) || 'No context yet.'}</p>
          </div>
        </button>
      )
    }

    const renderBoardView = () => {
      const columns = [
        { id: 'not-started', label: 'Not Started', goals: sortOverviewGoals(activeOverviewGoals.filter((goal) => goal.status === 'not-started' || goal.status === 'paused')) },
        { id: 'active', label: 'Active', goals: sortOverviewGoals(activeOverviewGoals.filter((goal) => goal.status === 'in-motion')) },
        ...(goalOverviewViewControls.showCompleted
          ? [{ id: 'completed', label: 'Completed', goals: sortOverviewGoals(completedOverviewGoals) }]
          : []),
      ]

      return (
        <div className={`grid gap-4 ${columns.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          {columns.map((column) => (
            <section key={column.id} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[12px] font-medium tracking-[-0.01em] text-mist/46">{column.label}</p>
                <span className="text-[11px] text-mist/36">{column.goals.length}</span>
              </div>
              <div className="space-y-2">
                {column.goals.length > 0 ? column.goals.map((goal) => renderBoardCard(goal)) : <div className="px-1 py-3 text-[12px] text-mist/38">No goals</div>}
              </div>
            </section>
          ))}
        </div>
      )
    }

    const renderTimelinePlaceholder = () => (
      <div className="px-4 py-6 text-[13px] text-mist/52">
        Timeline view is reserved here next, using the same goal collection and control state.
      </div>
    )

    const renderCompletedSection = () => {
      if (!goalOverviewViewControls.showCompleted || completedOverviewGoals.length === 0 || goalOverviewViewControls.view === 'board') return null

      return (
        <section className="border-t border-white/[0.05] pt-4">
          <button
            type="button"
            onClick={() => setGoalOverviewCompletedOpen((current) => !current)}
            className="flex w-full items-center justify-between px-4 pb-2 text-left"
          >
            <span className="text-[12px] font-medium tracking-[-0.01em] text-white/70">Completed</span>
            <span className="text-[12px] text-mist/42">{goalOverviewCompletedOpen ? 'Hide' : completedOverviewGoals.length}</span>
          </button>
          {goalOverviewCompletedOpen ? renderGroupedList(completedGroupedGoals) : null}
        </section>
      )
    }

    const renderOverviewContent = () => {
      if (goalOverviewViewControls.view === 'board') return renderBoardView()
      if (goalOverviewViewControls.view === 'timeline') return renderTimelinePlaceholder()
      return (
        <div className="space-y-4">
          <div className="border-b border-[rgba(255,255,255,0.08)] pb-2">{renderGoalListHeaders()}</div>
          {renderGroupedList(activeGroupedGoals)}
        </div>
      )
    }

    const panelPrimaryLabelClassName = GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME
    const panelSecondaryLabelClassName = GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME
    const panelSelectClassName = GOALS_UTILITY_PANEL_SELECT_CLASSNAME

    const renderControlsPanel = () => (
      <AnimatePresence>
        {goalOverviewControlsPanelOpen ? (
          <motion.aside
            ref={goalOverviewControlsPanelRef}
            className={`absolute right-0 top-[calc(100%+10px)] z-[80] flex max-h-[calc(100vh-32px)] w-[344px] max-w-[calc(100vw-32px)] min-h-0 flex-col ${GOALS_UTILITY_PANEL_SHELL_CLASSNAME}`}
            initial={{ opacity: 0, x: 12, y: -6 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 12, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1" onWheel={containScrollWithinElement}>
              <section className="space-y-1.5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['list', 'List', 'list'],
                    ['board', 'Board', 'board'],
                    ['timeline', 'Timeline', 'timeline'],
                  ].map(([value, label, icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateViewControls((current) => ({ ...current, view: value as GoalOverviewViewMode }))}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-[14px] border px-2.5 py-1.5 text-[12px] font-medium transition ${
                        goalOverviewViewControls.view === value
                          ? 'border-white/[0.1] bg-white/[0.06] text-white/88'
                          : 'border-white/[0.05] bg-white/[0.018] text-white/46 hover:border-white/[0.08] hover:text-white/76'
                      }`}
                    >
                      {icon === 'list' ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 4H13M3 8H13M3 12H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      ) : null}
                      {icon === 'board' ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                          <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      ) : null}
                      {icon === 'timeline' ? (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M4 3.5V12.5M8 5.5V10.5M12 2.5V13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <circle cx="4" cy="8" r="1" fill="currentColor" />
                          <circle cx="8" cy="3.5" r="1" fill="currentColor" />
                          <circle cx="12" cy="11.5" r="1" fill="currentColor" />
                        </svg>
                      ) : null}
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="grid gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <label className={panelPrimaryLabelClassName}>Group</label>
                  <div className="relative">
                    <select
                      value={goalOverviewViewControls.groupBy}
                      onChange={(event) => updateViewControls((current) => ({ ...current, groupBy: event.target.value as GoalOverviewGroupBy }))}
                      className={panelSelectClassName}
                    >
                      <option value="none">None</option>
                      <option value="status">Status</option>
                      <option value="category">Category</option>
                      <option value="life-direction">Life Direction</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className={panelPrimaryLabelClassName}>Sort</label>
                  <div className="relative">
                    <select
                      value={goalOverviewViewControls.sortBy}
                      onChange={(event) => updateViewControls((current) => ({ ...current, sortBy: event.target.value as GoalOverviewSortBy }))}
                      className={panelSelectClassName}
                    >
                      <option value="manual">Manual (drag to reorder)</option>
                      <option value="due">Due date</option>
                      <option value="priority">Priority</option>
                      <option value="updated">Recently updated</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                  <div>
                    <p className={panelPrimaryLabelClassName}>Show next task</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateViewControls((current) => ({ ...current, showNextTask: !current.showNextTask }))}
                    className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                      goalOverviewViewControls.showNextTask
                        ? 'border-white/[0.12] bg-white/[0.08]'
                        : 'border-white/[0.06] bg-transparent'
                    }`}
                  >
                    <span
                      className={`h-full w-4 rounded-full bg-white/70 transition ${
                        goalOverviewViewControls.showNextTask ? 'translate-x-[14px]' : ''
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                  <div>
                    <p className={panelPrimaryLabelClassName}>Show completed</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateViewControls((current) => ({ ...current, showCompleted: !current.showCompleted }))}
                    className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                      goalOverviewViewControls.showCompleted
                        ? 'border-white/[0.12] bg-white/[0.08]'
                        : 'border-white/[0.06] bg-transparent'
                    }`}
                  >
                    <span
                      className={`h-full w-4 rounded-full bg-white/70 transition ${
                        goalOverviewViewControls.showCompleted ? 'translate-x-[14px]' : ''
                      }`}
                    />
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={panelPrimaryLabelClassName}>Columns</p>
                  <p className={panelSecondaryLabelClassName}>Visible in list view</p>
                </div>
                <div className="grid gap-1">
                  {goalOverviewViewControls.columnOrder
                    .filter((columnKey) => columnKey !== 'milestones' && columnKey !== 'due' && columnKey !== 'startDate' && columnKey !== 'targetDate')
                    .map((columnKey) => {
                    const label = columnMeta[columnKey].label
                    const isVisible = goalOverviewViewControls.columns[columnKey]
                    return (
                      <div
                        key={columnKey}
                        onDragOver={(event) => {
                          if (!goalOverviewDraggedColumn || goalOverviewDraggedColumn === columnKey) return
                          event.preventDefault()
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          if (!goalOverviewDraggedColumn || goalOverviewDraggedColumn === columnKey) return
                          reorderColumnBefore(goalOverviewDraggedColumn, columnKey)
                          setGoalOverviewDraggedColumn(null)
                        }}
                        className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${
                          isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'
                        } ${goalOverviewDraggedColumn === columnKey ? 'bg-white/[0.03]' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation()
                              setGoalOverviewDraggedColumn(columnKey)
                            }}
                            onDragEnd={() => setGoalOverviewDraggedColumn(null)}
                            className={`inline-flex h-5 w-5 cursor-grab items-center justify-center rounded-[8px] text-[13px] leading-none transition hover:bg-white/[0.03] hover:text-white/62 active:cursor-grabbing ${
                              isVisible ? 'text-white/45' : 'text-white/28'
                            }`}
                            aria-label={`Reorder ${label} column`}
                          >
                            ⋮⋮
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateViewControls((current) => ({
                                ...current,
                                columns: {
                                  ...current.columns,
                                  [columnKey]: !current.columns[columnKey],
                                },
                              }))
                            }
                            className={`text-left text-[12px] transition ${panelSecondaryLabelClassName} hover:text-[rgba(255,255,255,0.7)]`}
                          >
                            {label}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateViewControls((current) => ({
                                ...current,
                                columns: {
                                  ...current.columns,
                                  [columnKey]: !current.columns[columnKey],
                                },
                              }))
                            }
                            className={`inline-flex h-4 w-7 rounded-full border p-[2px] ${
                              isVisible ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'
                            }`}
                          >
                            <span className={`h-full w-3 rounded-full bg-white/70 transition ${isVisible ? 'translate-x-[11px]' : ''}`} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={panelPrimaryLabelClassName}>Row content</p>
                </div>
                <div className="grid gap-1">
                  {[
                    ['icons', 'Icons'],
                    ['why', 'Why'],
                    ['startDate', 'Start date'],
                    ['targetDate', 'Target date'],
                    ['dueAmount', 'Due (days)'],
                    ['milestones', 'Milestones'],
                    ['directional', 'Directional'],
                  ].map(([key, label]) => {
                    const rowContentKey = key as GoalOverviewRowContentKey
                    const isVisible = goalOverviewViewControls.rowContent[rowContentKey]

                    return (
                      <div
                        key={rowContentKey}
                        className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${
                          isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateViewControls((current) => ({
                              ...current,
                              rowContent: {
                                ...current.rowContent,
                                [rowContentKey]: !current.rowContent[rowContentKey],
                              },
                            }))
                          }
                          className={`text-left text-[12px] transition ${panelSecondaryLabelClassName} hover:text-[rgba(255,255,255,0.7)]`}
                        >
                          {label}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateViewControls((current) => ({
                              ...current,
                              rowContent: {
                                ...current.rowContent,
                                [rowContentKey]: !current.rowContent[rowContentKey],
                              },
                            }))
                          }
                          className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${
                            isVisible ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'
                          }`}
                          aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                        >
                          <span className={`h-full w-4 rounded-full bg-white/70 transition ${isVisible ? 'translate-x-[14px]' : ''}`} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </section>

              <div className="border-t border-white/[0.05] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setGoalOverviewViewControls(DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS)
                    setGoalOverviewCompletedOpen(false)
                  }}
                  className={`${panelPrimaryLabelClassName} transition hover:text-white/82`}
                >
                  Reset
                </button>
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    )

    const goalsHeaderControlsSlot =
      typeof document !== 'undefined' ? document.getElementById('goals-header-controls-slot') : null
    const goalsHeaderControlsPortalTarget =
      goalOverviewHeaderControlsSticky && typeof document !== 'undefined' ? document.body : goalsHeaderControlsSlot

    return (
      <div ref={goalOverviewPageRef} className="relative mx-auto max-w-[1280px] space-y-3">
        {goalsHeaderControlsPortalTarget
          ? createPortal(
              <div
                ref={goalOverviewHeaderControlsRef}
                className={`inline-flex items-center gap-2 ${goalOverviewHeaderControlsSticky ? 'fixed z-[120]' : 'relative'}`}
                style={
                  goalOverviewHeaderControlsSticky
                    ? {
                        top: `${goalOverviewHeaderControlsTop}px`,
                        right: `${goalOverviewHeaderControlsRight}px`,
                      }
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={(event) => {
                    if (lifeGoalComposerOpen && lifeGoalComposerMode === 'create') {
                      closeLifeGoalComposer()
                      return
                    }
                    setLifeGoalDraft(createEmptyLifeGoalDraft())
                    openLifeGoalComposer(event.currentTarget)
                  }}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[18px] text-white/48 transition hover:border-white/[0.07] hover:text-white/74 ${
                    goalOverviewHeaderControlsSticky
                      ? 'border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)]'
                      : 'border-white/[0.045] bg-[rgb(var(--theme-surface-elevated-rgb)/0.44)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.56)]'
                  }`}
                  aria-label="Create goal"
                >
                  +
                </button>

                <button
                  ref={goalOverviewControlsTriggerRef}
                  type="button"
                  onClick={() => setGoalOverviewControlsPanelOpen((current) => !current)}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white/50 transition hover:border-white/[0.07] hover:text-white/76 ${
                    goalOverviewHeaderControlsSticky
                      ? 'border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)]'
                      : 'border-white/[0.045] bg-[rgb(var(--theme-surface-elevated-rgb)/0.44)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.56)]'
                  }`}
                  aria-label="Open view controls"
                  aria-expanded={goalOverviewControlsPanelOpen}
                >
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <circle cx="5.5" cy="4.5" r="1.4" fill="currentColor" />
                    <circle cx="10.5" cy="8" r="1.4" fill="currentColor" />
                    <circle cx="7" cy="11.5" r="1.4" fill="currentColor" />
                  </svg>
                </button>

                {renderControlsPanel()}
              </div>,
              goalsHeaderControlsPortalTarget,
            )
          : null}

        {lifeGoalComposerOpen && lifeGoalComposerMode === 'create' ? (
          <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.42)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {renderLifeGoalComposer()}
          </div>
        ) : null}

        {goalOverviewActiveDateField && goalOverviewDatePanelPosition && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={goalOverviewDatePanelRef}
                className="theme-popover fixed z-[80] overflow-hidden rounded-[22px] border p-2.5 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
                style={{
                  top: `${goalOverviewDatePanelPosition.top}px`,
                  left: `${goalOverviewDatePanelPosition.left}px`,
                  width: `${goalOverviewDatePanelPosition.width}px`,
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              >
                <p className="theme-text-faint mb-2 text-[10px] uppercase tracking-[0.14em]">
                  {goalOverviewActiveDateField.field === 'startDate' ? 'Start Date' : 'Target Date'}
                </p>
                <div className="mb-3 flex flex-nowrap justify-center gap-1">
                  {[
                    { label: 'Today', value: getTodayIsoDate() },
                    { label: '1W', value: shiftIsoDate(getTodayIsoDate(), 7) },
                    { label: '1M', value: shiftIsoDate(getTodayIsoDate(), 30) },
                    { label: '3M', value: shiftIsoDate(getTodayIsoDate(), 90) },
                    { label: '6M', value: shiftIsoDate(getTodayIsoDate(), 180) },
                    { label: '1Y', value: shiftIsoDate(getTodayIsoDate(), 365) },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyGoalOverviewDate(goalOverviewActiveDateField.goalId, goalOverviewActiveDateField.field, preset.value)}
                      className="theme-text-muted min-w-0 rounded-full border border-[rgb(var(--theme-border-subtle-rgb)/0.65)] px-2 py-1.5 text-center text-[10px] transition hover:border-[rgb(var(--theme-border-strong-rgb)/0.7)] hover:text-[rgb(var(--theme-text-primary-rgb))] hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.7)]"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                    className="theme-text-muted rounded-full px-2.25 py-1.25 text-[11px] transition hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.45)] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                  >
                    Prev
                  </button>
                  <p className="theme-text-primary text-[13px] font-medium">{formatCalendarMonthLabel(lifeGoalDateViewMonth)}</p>
                  <button
                    type="button"
                    onClick={() => setLifeGoalDateViewMonth((current) => shiftCalendarMonth(current, 1))}
                    className="theme-text-muted rounded-full px-2.25 py-1.25 text-[11px] transition hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.45)] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                  >
                    Next
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-7 gap-1.25">
                  {LIFE_GOAL_WEEKDAY_LABELS.map((day) => (
                    <div key={day} className="theme-text-faint px-1 py-0.5 text-center text-[10px] uppercase tracking-[0.12em]">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1.25">
                  {getCalendarDays(lifeGoalDateViewMonth).map((day) => {
                    const dayValue = formatCalendarDayValue(day)
                    const inCurrentMonth = day.getUTCMonth() === lifeGoalDateViewMonth.getUTCMonth()
                    const activeGoal = safeLifeGoals.find((item) => item.id === goalOverviewActiveDateField.goalId)
                    const activeDateValue = activeGoal ? activeGoal[goalOverviewActiveDateField.field] : ''
                    const isSelected = dayValue === activeDateValue
                    const isToday = dayValue === getTodayIsoDate()

                    return (
                      <button
                        key={dayValue}
                        type="button"
                        onClick={() => applyGoalOverviewDate(goalOverviewActiveDateField.goalId, goalOverviewActiveDateField.field, dayValue)}
                        className={`rounded-[18px] border px-0 py-1.5 text-center text-[13px] transition ${
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

                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] pt-2.5">
                  <button
                    type="button"
                    onClick={() => applyGoalOverviewDate(goalOverviewActiveDateField.goalId, goalOverviewActiveDateField.field, getTodayIsoDate())}
                    className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                  >
                    Today
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyGoalOverviewDate(goalOverviewActiveDateField.goalId, goalOverviewActiveDateField.field, '')}
                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        goalOverviewActiveDateTriggerRef.current = null
                        setGoalOverviewActiveDateField(null)
                        setGoalOverviewDatePanelPosition(null)
                      }}
                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {allOverviewGoals.length === 0 && !lifeGoalComposerOpen ? (
          <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.46)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <p className="text-[15px] text-white/80">No goals yet</p>
            <p className="mt-1.5 text-[13px] text-white/48">Create one meaningful direction to start using the workspace.</p>
          </div>
        ) : null}

        {hasPrimaryContent ? (
          <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.54)] px-0 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            {renderOverviewContent()}
            {renderCompletedSection()}
          </div>
        ) : allOverviewGoals.length > 0 ? (
          <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.46)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <p className="text-[15px] text-white/80">No active goals visible</p>
            <p className="mt-1.5 text-[13px] text-white/48">Turn on completed goals in View Controls to show archived progress here.</p>
          </div>
        ) : null}
      </div>
    )
}

  const renderLifeGoalDetailPage = () => {
    if (!selectedLifeGoal || !selectedLifeGoalProgress) {
      return renderLifeGoalOverviewPage()
    }

    const selectedGoalCategory = selectedLifeGoal.category.trim()
    const selectedGoalCategoryColor = selectedGoalCategory
      ? getLifeGoalCategoryColor(selectedGoalCategory, lifeGoalCategories)
      : 'neutral'
    const anchorText = getLifeGoalAnchorText(selectedLifeGoal.whyItMatters)
    const selectedGoalType = selectedLifeGoal.goalType ?? 'outcome'
    const showDetailIcon = selectedGoalDetailContentVisibility.icon
    const showDetailCategory = selectedGoalDetailContentVisibility.category
    const showDetailStatus = selectedGoalDetailContentVisibility.status
    const showDetailWhy = selectedGoalDetailContentVisibility.why
    const showDetailVision = selectedGoalDetailContentVisibility.vision
    const showDetailMetrics = selectedGoalDetailContentVisibility.metrics
    const isOutcomeGoal = selectedGoalType === 'outcome'
    const isDirectionalGoal = selectedGoalType === 'directional'
    const milestonesEnabled = isOutcomeGoal && Boolean(selectedLifeGoal.milestonesEnabled)
    const goalMilestones = getOrderedGoalMilestones(selectedLifeGoal)
    const currentMilestone = getCurrentGoalMilestone(goalMilestones)
    const completedMilestoneCount = goalMilestones.filter((milestone) => milestone.completed).length
    const roadmapPanelView = roadmapPanelViewByGoal[selectedLifeGoal.id] ?? 'tasks'
    const showMilestoneProgressView = isOutcomeGoal && milestonesEnabled
    const milestoneOptions = milestonesEnabled ? getMilestoneSelectOptions(goalMilestones, currentMilestone?.id ?? null) : []
    const milestoneDateTarget = milestoneDatePickerMilestoneId
      ? goalMilestones.find((milestone) => milestone.id === milestoneDatePickerMilestoneId) ?? null
      : null
    const isRoadmapMode = !isDirectionalGoal && (lifeGoalDetailTab === 'tasks' || lifeGoalDetailTab === 'roadmap')
    const roadmapSections = selectedRoadmapSections
    const roadmapRemainingCount = roadmapSections.current ? roadmapSections.upcoming.length + 1 : 0
    const roadmapHasHighPriorityTasks =
      (roadmapSections.current ? getPriorityScore(roadmapSections.current) === 3 : false) ||
      roadmapSections.upcoming.some((task) => getPriorityScore(task) === 3)
    const roadmapHasTaggedTasks = selectedLifeGoal.tasks.some((task) => normalizeTaskTags(task.tags).length > 0)
    const sortedUpcomingTasks = sortTasksForDisplay(roadmapSections.upcoming, taskListSortMode)
    const sortedCompletedTasks = sortTasksForDisplay(roadmapSections.completed, taskListSortMode)
    const sortedPlannedTasks = roadmapSections.current ? [roadmapSections.current, ...sortedUpcomingTasks] : sortedUpcomingTasks
    const explicitlyAssignedTasksByMilestone = new Map(
      goalMilestones.map((milestone) => [
        milestone.id,
        selectedLifeGoal.tasks.filter((task) => task.milestoneId === milestone.id),
      ]),
    )
    const roadmapTasksGroupedByMilestone =
      isOutcomeGoal && milestonesEnabled
        ? getRoadmapTasksGroupedByMilestone(goalMilestones, sortedPlannedTasks, currentMilestone?.id ?? null)
        : []
    const goalReadyToComplete =
      selectedLifeGoalProgress.totalTasks > 0 &&
      selectedLifeGoalProgress.completedTasks === selectedLifeGoalProgress.totalTasks &&
      selectedLifeGoal.status !== 'complete'
    const todayIsoDate = getTodayIsoDate()
    const relatedGoals = (() => {
      const seen = new Set<string>()
      return (selectedLifeGoal.relatedGoalIds ?? [])
        .map((goalId) => safeLifeGoals.find((goal) => goal.id === goalId && goal.id !== selectedLifeGoal.id && !goal.archivedAt))
        .filter((goal): goal is LifeGoal => Boolean(goal))
        .filter((goal) => {
          if (seen.has(goal.id)) return false
          seen.add(goal.id)
          return true
        })
    })()
    const linkedDirectionalTasks = safeTasks
      .filter((task) => task.linkedDirectionId === selectedLifeGoal.id)
      .filter((task, index, taskItems) => taskItems.findIndex((candidate) => candidate.id === task.id) === index)
      .slice()
      .sort((left, right) => {
        if (left.completed !== right.completed) return left.completed ? 1 : -1
        if (left.important !== right.important) return left.important ? -1 : 1
        if (left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate)
        return left.text.localeCompare(right.text)
      })
    const supportingHabits = safeHabitTrackers
      .filter((tracker) => (tracker.linkedGoalIds ?? []).includes(selectedLifeGoal.id))
      .filter((tracker, index, trackers) => trackers.findIndex((candidate) => candidate.id === tracker.id) === index)
    const parentGoals = safeLifeGoals
      .filter((goal) => !goal.archivedAt && goal.id !== selectedLifeGoal.id)
      .filter((goal) => (goal.relatedGoalIds ?? []).includes(selectedLifeGoal.id))
      .filter((goal, index, goals) => goals.findIndex((candidate) => candidate.id === goal.id) === index)
    const activeRelatedGoalsCount = relatedGoals.filter((goal) => goal.status === 'in-motion').length
    const pausedRelatedGoalsCount = relatedGoals.filter((goal) => goal.status === 'paused').length
    const maxVisibleLinkedGoals = 4
    const visibleRelatedGoals = relatedGoals.slice(0, maxVisibleLinkedGoals)
    const hiddenRelatedGoalsCount = Math.max(0, relatedGoals.length - visibleRelatedGoals.length)
    const visibleParentGoals = parentGoals.slice(0, 2)
    const hiddenParentGoalsCount = Math.max(0, parentGoals.length - visibleParentGoals.length)
    const visibleDirectionalTasks = linkedDirectionalTasks.slice(0, 6)
    const hiddenDirectionalTasksCount = Math.max(0, linkedDirectionalTasks.length - visibleDirectionalTasks.length)
    const visibleSupportingHabits = supportingHabits.slice(0, 4)
    const hiddenSupportingHabitsCount = Math.max(0, supportingHabits.length - visibleSupportingHabits.length)
    const goalHeaderChipClassName =
      'inline-flex h-6 shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] uppercase tracking-[0.14em] leading-none border-white/[0.06]'
    const startInlineTitleEdit = () => {
      primeInlineLifeGoalDraft(selectedLifeGoal)
      setInlineLifeGoalEditingField('title')
    }
    const startInlineWhyEdit = () => {
      primeInlineLifeGoalDraft(selectedLifeGoal)
      setInlineLifeGoalEditingField('why')
    }
    const startInlineIconEdit = (trigger: HTMLButtonElement) => {
      primeInlineLifeGoalDraft(selectedLifeGoal)
      lifeGoalIconFieldRef.current = trigger
      setLifeGoalIconPickerQuery('')
      setLifeGoalIconPickerTab(selectedLifeGoal.icon?.startsWith('emoji:') ? 'emojis' : 'icons')
      setInlineLifeGoalIconGoalId(selectedLifeGoal.id)
      setLifeGoalIconPickerOpen(true)
    }
    const handleInlineIconMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      startInlineIconEdit(event.currentTarget)
    }
    const handleInlineIconKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        startInlineIconEdit(event.currentTarget)
      }
    }
    const inlineEditableIconControl = !showDetailIcon ? null : selectedLifeGoal.icon?.startsWith('emoji:') ? (
      <button
        type="button"
        onMouseDown={handleInlineIconMouseDown}
        onKeyDown={handleInlineIconKeyDown}
        className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none"
      >
        {selectedLifeGoal.icon.slice(6)}
      </button>
    ) : selectedLifeGoal.icon && LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon] ? (
      <button
        type="button"
        onMouseDown={handleInlineIconMouseDown}
        onKeyDown={handleInlineIconKeyDown}
        className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-white/52"
      >
        {(() => {
          const Icon = LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon].Icon
          return <Icon size={16} className="text-white/52" />
        })()}
      </button>
    ) : (
      <button
        type="button"
        onMouseDown={handleInlineIconMouseDown}
        onKeyDown={handleInlineIconKeyDown}
        className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] text-white/26 transition hover:text-white/52"
        aria-label="Select icon"
      >
        +
      </button>
    )
    const inlineEditableTitle = (
      <div className="flex min-w-0 items-center gap-2">
        {inlineEditableIconControl}
        <input
          ref={lifeGoalTitleInputRef}
          value={lifeGoalDraft.title}
          onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
          onBlur={() => commitInlineLifeGoalField(selectedLifeGoal, 'title')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitInlineLifeGoalField(selectedLifeGoal, 'title')
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelInlineLifeGoalField(selectedLifeGoal, 'title')
            }
          }}
          placeholder="Goal title"
          spellCheck={true}
          className="min-w-0 w-full bg-transparent px-0 py-0 text-[20px] font-semibold leading-tight text-white outline-none placeholder:text-white/30"
        />
      </div>
    )
    const inlineEditableWhy = (
      <textarea
        ref={lifeGoalWhyTextareaRef}
        value={lifeGoalDraft.whyItMatters}
        onChange={(event) => {
          setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))
          event.currentTarget.style.height = 'auto'
          event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
        }}
        onBlur={() => commitInlineLifeGoalField(selectedLifeGoal, 'whyItMatters')}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelInlineLifeGoalField(selectedLifeGoal, 'whyItMatters')
          }
        }}
        placeholder="Why it matters..."
        spellCheck={true}
        className="min-h-[72px] w-full resize-none bg-transparent px-0 py-0 text-[13px] leading-6 text-white/70 outline-none placeholder:text-white/28"
      />
    )
    const inlineTitleDisplay = (
      <div className="inline-flex min-w-0 items-center gap-2">
        {showDetailIcon && selectedLifeGoal.icon?.startsWith('emoji:') ? (
          <button
            type="button"
            onMouseDown={handleInlineIconMouseDown}
            onKeyDown={handleInlineIconKeyDown}
            className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none"
          >
            {selectedLifeGoal.icon.slice(6)}
          </button>
        ) : showDetailIcon && selectedLifeGoal.icon && LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon] ? (
          <button
            type="button"
            onMouseDown={handleInlineIconMouseDown}
            onKeyDown={handleInlineIconKeyDown}
            className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-white/52"
          >
            {(() => {
              const Icon = LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon].Icon
              return <Icon size={16} className="text-white/52" />
            })()}
          </button>
        ) : showDetailIcon ? (
          <button
            type="button"
            onMouseDown={handleInlineIconMouseDown}
            onKeyDown={handleInlineIconKeyDown}
            className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] text-white/26 transition hover:text-white/52"
            aria-label="Select icon"
          >
            +
          </button>
        ) : null}
        <button type="button" onClick={startInlineTitleEdit} className="min-w-0 truncate text-left">
          {selectedLifeGoal.title}
        </button>
      </div>
    )
    const inlineWhyDisplay = (
      <button type="button" onClick={startInlineWhyEdit} className="w-full text-left">
        <div className="min-h-[72px] text-[13px] leading-6 text-white/70">
          {selectedLifeGoal.whyItMatters.trim() || <span className="text-white/30">Why it matters...</span>}
        </div>
      </button>
    )
    const renderGoalTypeInfoChip = (label: string, tooltip: string, chipClassName: string) => (
      <span className={`group/typeinfo relative ${goalHeaderChipClassName} ${chipClassName}`}>
        <span>{label}</span>
        <span className="theme-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[240px] -translate-x-1/2 whitespace-normal rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium leading-4 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/typeinfo:block group-hover/typeinfo:translate-y-0 group-hover/typeinfo:opacity-100">
          {tooltip}
        </span>
      </span>
    )
    const renderRoadmapTaskGroups = (
      tasks: LifeGoalTask[],
      keyPrefix: string,
      options: { groupedByTag?: boolean } | undefined,
      renderTask: (task: LifeGoalTask, meta: { groupIndex: number; taskIndex: number }) => any,
    ) => {
      const groups = options?.groupedByTag ? getRoadmapTagGroups(tasks) : [{ label: null, tasks }]

      return groups.map((group, groupIndex) => {
        const shouldShowGroupHeader = Boolean(options?.groupedByTag && group.tasks.length > 0)

        return (
          <div key={`${keyPrefix}-${groupIndex}-${group.label ?? 'default'}`} className={groupIndex > 0 ? (shouldShowGroupHeader ? 'pt-4' : 'pt-1') : ''}>
            {shouldShowGroupHeader ? (
              <div className="flex items-center justify-between gap-3 pb-2" style={roadmapContentInsetStyle}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-mist/42">{group.label ?? 'untagged'}</p>
                <p className="text-[10px] tracking-[0.08em] text-mist/30">
                  {group.tasks.filter((task) => task.completed).length}/{group.tasks.length}
                </p>
              </div>
            ) : null}
            {group.tasks.map((task, taskIndex) => renderTask(task, { groupIndex, taskIndex }))}
          </div>
        )
      })
    }
    const renderPriorityChip = (task: LifeGoalTask) => {
      const priorityMeta = getLifeGoalTaskPriorityMeta(task.priority)
      if (!priorityMeta) return null

      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] leading-none ${priorityMeta.chipClassName}`}>
          {priorityMeta.label}
        </span>
      )
    }
    const roadmapHeaderControlBaseClass =
      'inline-flex items-center rounded-full border border-white/[0.045] bg-white/[0.018] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-white/50 transition hover:border-white/[0.08] hover:text-white/70'
    const roadmapHeaderControlActiveClass =
      'inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-white/76 transition hover:border-white/[0.1] hover:text-white/84'
    const renderTaskTags = (task: LifeGoalTask) => {
      const tags = normalizeTaskTags(task.tags)
      if (tags.length === 0) return null

      const visibleTags = tags.slice(0, 3)
      const overflowCount = tags.length - visibleTags.length

      return (
        <>
          {visibleTags.map((tag) => (
            <span
              key={`${task.id}-${tag}`}
              className="inline-flex items-center rounded-full border border-white/[0.055] bg-white/[0.022] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-white/50"
            >
              {tag}
            </span>
          ))}
          {overflowCount > 0 ? (
            <span
              title={tags.join(' · ')}
              className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-white/42"
            >
              +{overflowCount}
            </span>
          ) : null}
        </>
      )
    }
    const renderRoadmapPanelTaskRow = (task: LifeGoalTask, section: 'current' | 'upcoming') => {
      const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
      const visualState = getRoadmapTaskVisualState(task, section, roadmapHighPriorityFocus)
      const isCompressed = section === 'upcoming' && roadmapHighPriorityFocus && getPriorityScore(task) !== 3

      if (section === 'current') {
        return (
          <button
            key={task.id}
            ref={(element) => {
              roadmapTaskRowRefs.current[task.id] = element
            }}
            data-goal-task-id={task.id}
            type="button"
            onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
            onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
            draggable
            onDragStart={() => setDraggedTaskId(task.id)}
            onDragOver={(event) => {
              event.preventDefault()
              if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
              setDraggedTaskId(null)
              setDragOverTaskId(null)
            }}
            onDragEnd={() => {
              setDraggedTaskId(null)
              setDragOverTaskId(null)
            }}
            className={`group relative grid w-full items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.1)] bg-white/[0.012] py-[14px] text-left transition duration-200 ease-out hover:bg-white/[0.02] hover:border-[rgb(var(--theme-accent-rgb)/0.14)] ${
              dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
            } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
              roadmapArrivalCueActive ? 'goal-current-arrival' : ''
            } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
              taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
            }`}
            style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
          >
            <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
              {renderRoadmapNodeCutout(roadmapCurrentNodeDiameter)}
              <span className="roadmap-current-node-pulse absolute h-[20px] w-[20px] rounded-full bg-[rgb(var(--theme-accent-rgb)/0.18)] blur-[6px]" />
              <span
                className={`relative flex items-center justify-center rounded-full border transition-transform duration-200 ease-out group-hover:scale-110 ${
                  getPriorityScore(task) === 3
                    ? 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.9)] shadow-[0_0_8px_rgb(var(--theme-accent-rgb)/0.08)]'
                    : 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.8)] shadow-[0_0_6px_rgb(var(--theme-accent-rgb)/0.06)]'
                }`}
              >
                <span
                  className={`rounded-full border ${
                    getPriorityScore(task) === 3
                      ? 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.94)]'
                      : 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.86)]'
                  }`}
                />
              </span>
            </span>
            <div className="min-w-0 px-1 pb-3 pr-10 pt-0.5">
              <div className="min-w-0">
                <AnimatePresence initial={false}>
                  {roadmapArrivalCueActive ? (
                    <motion.p
                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/56"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      Start here
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {taskMomentumTransition?.nextTaskId === task.id ? (
                    <motion.p
                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      Next step ready
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  {visibleGoalStartCueTaskId === task.id ? (
                    <motion.p
                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      Goal started • 1 step ready
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                  <div className="min-w-0 text-left pb-[2px]">
                    <div className="flex flex-wrap items-center gap-2">
                      {task.dueDate ? (
                        <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                          {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                        </p>
                      ) : null}
                      {renderPriorityChip(task)}
                      {renderTaskTags(task)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {task.subtasks.length > 0 ? (
              <div className="pointer-events-none absolute bottom-4 right-3.5 flex items-center justify-end">
                {renderSubtaskProgressDots(task.subtasks)}
              </div>
            ) : null}
          </button>
        )
      }

      return (
        <button
          key={task.id}
          ref={(element) => {
            roadmapTaskRowRefs.current[task.id] = element
          }}
          data-goal-task-id={task.id}
          type="button"
          onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
          onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
          draggable
          onDragStart={() => setDraggedTaskId(task.id)}
          onDragOver={(event) => {
            event.preventDefault()
            if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
            setDraggedTaskId(null)
            setDragOverTaskId(null)
          }}
          onDragEnd={() => {
            setDraggedTaskId(null)
            setDragOverTaskId(null)
          }}
          className={`group relative grid w-full items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
            isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
          } ${
            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
          } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
            taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
          } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
          style={{
            ...visualState.rowStyle,
            gridTemplateColumns: roadmapNodeGridTemplate,
            opacity:
              visualState.opacity *
              (roadmapArrivalCueActive ? 0.78 : 1) *
              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
          }}
        >
          <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
            {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
            <span className={`h-2 w-2 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
          </span>
          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
            <div className="min-w-0">
              <AnimatePresence initial={false}>
                {taskMomentumTransition?.nextTaskId === task.id ? (
                  <motion.p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    Next step ready
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {visibleGoalStartCueTaskId === task.id ? (
                  <motion.p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    Goal started • 1 step ready
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
              <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                <div className="min-w-0 text-left pb-[2px]">
                  <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                    {task.dueDate ? (
                      <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                        {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                      </p>
                    ) : null}
                    {!isCompressed ? renderPriorityChip(task) : null}
                    {!isCompressed ? renderTaskTags(task) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {task.subtasks.length > 0 ? (
            <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
              {renderSubtaskProgressDots(task.subtasks)}
            </div>
          ) : null}
        </button>
      )
    }
    const renderTaskSortControl = () => (
      <div className="inline-flex min-w-[132px] items-center justify-between gap-3 rounded-full border border-white/[0.045] bg-white/[0.018] px-2.5 py-[5px]">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/38">Sort</span>
        <div className="relative">
          <select
            value={taskListSortMode}
            onChange={(event) => setTaskListSortMode(event.target.value as LifeGoalTaskListSort)}
            className="appearance-none bg-transparent pr-4 text-right text-[10px] uppercase tracking-[0.14em] text-white/60 outline-none"
          >
            <option value="default" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
              Default
            </option>
            <option value="due" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
              Due
            </option>
            <option value="priority" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
              Priority
            </option>
          </select>
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-white/26">▾</span>
        </div>
      </div>
    )
    const roadmapGeometry = {
      timelineX: 12,
      nodeColumnWidth: 24,
      contentInset: 36,
      lineWidth: 1,
      lineOpacity: 0.36,
      smallNodeDiameter: 8,
      currentNodeDiameter: 14,
      connectorReach: 24,
      currentMilestoneTickReach: 24,
    } as const
    const roadmapLineOpacity = roadmapGeometry.lineOpacity
    const roadmapLineColor = `rgb(var(--theme-accent-rgb) / ${roadmapLineOpacity})`
    const roadmapLineWidth = roadmapGeometry.lineWidth
    const roadmapSmallNodeDiameter = roadmapGeometry.smallNodeDiameter
    const roadmapCurrentNodeDiameter = roadmapGeometry.currentNodeDiameter
    const roadmapNodeGridTemplate = `${roadmapGeometry.nodeColumnWidth}px minmax(0, 1fr)`
    const roadmapContentInsetStyle = { paddingLeft: `${roadmapGeometry.contentInset}px` }
    const roadmapRailLeftStyle = { left: `${roadmapGeometry.timelineX}px` }
    const roadmapConnectorLeft = roadmapGeometry.timelineX - roadmapGeometry.contentInset
    const roadmapConnectorWidth = roadmapGeometry.contentInset - roadmapGeometry.timelineX
    const roadmapConnectorCurveOffset = Math.max(8, Math.round(roadmapConnectorWidth * 0.46))
    const roadmapMilestoneConnectorPath = (() => {
      const x = roadmapLineWidth / 2
      const centerY = 50
      const curveStartY = centerY - roadmapConnectorCurveOffset
      const curveEndY = centerY + roadmapConnectorCurveOffset
      return `M ${x} 0 L ${x} ${curveStartY} Q ${x} ${centerY} ${roadmapConnectorWidth} ${centerY} Q ${x} ${centerY} ${x} ${curveEndY} L ${x} 100`
    })()
    const renderRoadmapNodeCutout = (diameter: number, surfaceRgb = 'var(--theme-surface-elevated-rgb)') => (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[-1] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: `${roadmapLineWidth + 1}px`,
          height: `${diameter}px`,
          background: `rgb(${surfaceRgb} / 0.98)`,
        }}
      />
    )
    const roadmapMilestoneStructuredContent =
      roadmapTasksGroupedByMilestone.length > 0 ? (
        <div className="pb-4">
          {(() => {
            let upcomingMilestoneVisualIndex = 0
            return roadmapTasksGroupedByMilestone.map(({ milestone, tasks }, groupIndex) => {
            const isCurrentGroup = milestone.id === currentMilestone?.id
            const isUpcomingGroup = !isCurrentGroup
            const isNextUpcomingGroup = isUpcomingGroup && upcomingMilestoneVisualIndex === 0
            const incompleteGroupTasks = tasks.filter((task) => !task.completed)
            if (incompleteGroupTasks.length === 0) return null
            if (isUpcomingGroup) {
              upcomingMilestoneVisualIndex += 1
            }

            return (
              <div key={`roadmap-milestone-group-${milestone.id}`} className={groupIndex > 0 ? 'pt-5' : ''}>
                <div className="relative" style={roadmapContentInsetStyle}>
                  {isCurrentGroup ? (
                    <p className="pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.88)] [text-shadow:0_0_8px_rgb(var(--theme-accent-rgb)/0.24)]">
                      You are here
                    </p>
                  ) : null}
                </div>
                <div className="relative pb-3" style={roadmapContentInsetStyle}>
                  <div className="relative flex flex-wrap items-center gap-2">
                    {isUpcomingGroup ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute bottom-0 top-0 z-[2]"
                          style={{
                            left: `${roadmapConnectorLeft}px`,
                            width: `${roadmapLineWidth + 1}px`,
                            background: 'rgb(var(--theme-surface-rgb) / 1)',
                          }}
                        />
                        <svg
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 z-[3] h-full"
                          style={{
                            left: `${roadmapConnectorLeft}px`,
                            width: `${roadmapConnectorWidth}px`,
                          }}
                          viewBox={`0 0 ${roadmapConnectorWidth} 100`}
                          preserveAspectRatio="none"
                        >
                          <path
                            d={roadmapMilestoneConnectorPath}
                            fill="none"
                            stroke={roadmapLineColor}
                            strokeWidth={roadmapLineWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            shapeRendering="geometricPrecision"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      </>
                    ) : null}
                    {isCurrentGroup ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2"
                        style={{
                          left: `${roadmapConnectorLeft}px`,
                          width: `${roadmapGeometry.currentMilestoneTickReach}px`,
                          background: roadmapLineColor,
                          height: `${roadmapLineWidth}px`,
                        }}
                      />
                    ) : null}
                    {isUpcomingGroup ? (
                      <button
                        type="button"
                        onClick={() => openMilestonePeek(milestone.id)}
                        className={`flex w-full flex-wrap items-center gap-2 rounded-[14px] border px-[14px] py-[10px] text-left transition ${
                          isNextUpcomingGroup
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.25)] bg-white/[0.02] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)] hover:border-[rgb(var(--theme-accent-rgb)/0.32)]'
                            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.024]'
                        }`}
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/88">
                          {milestone.title}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                            isNextUpcomingGroup
                              ? 'border-white/[0.06] bg-white/[0.02] text-white/48 opacity-70'
                              : 'border-white/[0.05] bg-white/[0.016] text-white/42 opacity-70'
                          }`}
                        >
                          {isNextUpcomingGroup ? 'Next milestone' : 'Upcoming milestone'}
                        </span>
                        {milestone.targetDate ? (
                          <span className={`text-[12px] ${getRelativeDueMeta(milestone.targetDate)?.toneClassName ?? 'text-mist/50'}`}>
                            {getRelativeDueMeta(milestone.targetDate)?.label ?? formatDate(milestone.targetDate)}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <div
                        className={`flex w-full flex-wrap items-center gap-2 ${
                        isUpcomingGroup
                          ? `rounded-[14px] border px-[14px] py-[10px] ${
                              isNextUpcomingGroup
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.25)] bg-white/[0.02] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]'
                                : 'border-white/[0.07] bg-white/[0.02]'
                            }`
                          : ''
                        }`}
                      >
                        <p className={`text-[11px] uppercase tracking-[0.18em] ${isCurrentGroup ? 'text-white/78' : 'font-medium text-white/88'}`}>
                          {milestone.title}
                        </p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                            isCurrentGroup
                              ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.05)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                              : isNextUpcomingGroup
                                ? 'border-white/[0.06] bg-white/[0.02] text-white/48 opacity-70'
                                : 'border-white/[0.05] bg-white/[0.016] text-white/42 opacity-70'
                          }`}
                        >
                          {isCurrentGroup ? 'Current milestone' : isNextUpcomingGroup ? 'Next milestone' : 'Upcoming milestone'}
                        </span>
                        {milestone.targetDate ? (
                          <span className={`text-[12px] ${getRelativeDueMeta(milestone.targetDate)?.toneClassName ?? 'text-mist/50'}`}>
                            {getRelativeDueMeta(milestone.targetDate)?.label ?? formatDate(milestone.targetDate)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className={`space-y-0.5 ${isUpcomingGroup ? 'mt-2' : ''}`}>
                  {incompleteGroupTasks.map((task) =>
                    renderRoadmapPanelTaskRow(task, task.id === roadmapSections.current?.id ? 'current' : 'upcoming'),
                  )}
                </div>
              </div>
            )
          })
          })()}
        </div>
      ) : null
    const renderParentGoalChips = () => (
      <>
        {visibleParentGoals.map((goal) => (
          <button
            key={`parent-chip-${goal.id}`}
            type="button"
            onClick={() => onSelectLifeGoal(goal.id)}
            className={`${goalHeaderChipClassName} border-white/[0.05] bg-white/[0.02] text-white/52 transition hover:border-white/[0.08] hover:text-white/74`}
            title={goal.title}
          >
            <span className="text-white/28">Belongs to:</span>
            <span className="text-white/48">{goal.title}</span>
          </button>
        ))}
        {hiddenParentGoalsCount > 0 ? (
          <span className={`${goalHeaderChipClassName} border-white/[0.05] bg-white/[0.018] text-white/40`}>
            +{hiddenParentGoalsCount}
          </span>
        ) : null}
      </>
    )
    const detailHeaderRelationshipChips = (
      <>
        {isDirectionalGoal
          ? renderGoalTypeInfoChip(
              'Direction',
              'Long-term life direction. Not something to complete.',
              'border-white/[0.08] bg-white/[0.04] text-white/76',
            )
          : renderGoalTypeInfoChip(
              'Outcome',
              'An outcome goal is a destination with a clear finish. Use tasks for the execution steps to reach it.',
              'border-white/[0.08] bg-white/[0.03] text-white/75',
            )}
        {renderParentGoalChips()}
      </>
    )
    const linkedGoalsSection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Related goals</p>
          <p className="mt-1 text-sm text-mist">Goals linked with this goal.</p>
        </div>

        <div className="mt-4 space-y-2">
          {relatedGoals.length > 0 ? (
            <>
              {visibleRelatedGoals.map((goal) => {
                const dueMeta = goal.targetDate && isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
                return (
                  <button
                    key={`linked-goal-${goal.id}`}
                    type="button"
                    onClick={() => onSelectLifeGoal(goal.id)}
                    className="flex w-full items-center justify-between rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white/84">{goal.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {goal.category ? <p className="text-[12px] text-mist/56">{goal.category}</p> : null}
                        {goal.targetDate ? (
                          <p className={`text-[12px] ${dueMeta?.toneClassName ?? 'text-mist/56'}`}>
                            {dueMeta ? `${dueMeta.label} · ${formatDate(goal.targetDate)}` : formatDate(goal.targetDate)}
                          </p>
                        ) : null}
                        <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                          {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-white/36">Open</span>
                  </button>
                )
              })}
              {hiddenRelatedGoalsCount > 0 ? (
                <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                  +{hiddenRelatedGoalsCount} more
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    )
    const directionalAnchorCard = (
      <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="theme-page-title min-w-0 flex-1">
                  {inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
                </h3>
                <span className={`${goalHeaderChipClassName} border-white/[0.08] bg-white/[0.04] text-white/76`}>
                  Directional
                </span>
                <span className="group relative inline-flex">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-white/42 transition group-hover:text-white/64">
                    i
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[240px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#141414] px-3 py-2 text-left text-xs leading-5 text-mist shadow-[0_16px_34px_rgba(0,0,0,0.36)] group-hover:block">
                    This is a long-term direction, not something to complete. It is moved forward by the goals connected to it.
                  </span>
                </span>
                {selectedGoalCategory ? (
                  <span
                    className={`${goalHeaderChipClassName} gap-1.5 text-white/70`}
                    style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                    {selectedGoalCategory}
                  </span>
                ) : null}
                {renderParentGoalChips()}
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-mist/56">Long-term direction</p>
            </div>
            <span
              className={`${goalHeaderChipClassName} ${
                getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).badgeClassName
              }`}
            >
              {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate)
                ? 'Scheduled'
                : getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).label}
            </span>
          </div>
          <div className="mt-2 h-px bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.72)_0%,rgb(var(--theme-border-subtle-rgb)/0.22)_82%,transparent_100%)]" />
        </div>

        <div className="mt-3 space-y-3">
          {anchorText || inlineLifeGoalEditingField === 'why' ? (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Why it matters</p>
              {inlineLifeGoalEditingField === 'why' ? (
                <div className="max-w-[44rem]">{inlineEditableWhy}</div>
              ) : (
                <div className="max-w-[44rem]">{inlineWhyDisplay}</div>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] text-white/68">
              {relatedGoals.length} active paths
            </span>
            <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/62">
              {activeRelatedGoalsCount} in motion
            </span>
            {pausedRelatedGoalsCount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/58">
                {pausedRelatedGoalsCount} paused
              </span>
            ) : null}
          </div>

          <p className="text-[12px] leading-5 text-mist/58">No fixed finish line. Let the goals connected to this direction carry it forward.</p>
        </div>
      </div>
    )
    const visionEditImagesContent =
      selectedLifeGoal.visionImages.length > 0
        ? renderVisionImageLayout(selectedLifeGoal.visionImages, {
            draggableState: {
              enabled: true,
              draggedIndex: draggedVisionImageIndex,
              dragOverIndex: dragOverVisionImageIndex,
              onDragStart: (index) => {
                setDraggedVisionImageIndex(index)
                setDragOverVisionImageIndex(null)
              },
              onDragOver: (event, index) => {
                event.preventDefault()
                if (dragOverVisionImageIndex !== index) {
                  setDragOverVisionImageIndex(index)
                }
              },
              onDrop: (event, index) => {
                event.preventDefault()
                if (draggedVisionImageIndex !== null) {
                  reorderSelectedLifeGoalVisionImages(draggedVisionImageIndex, index)
                }
                setDraggedVisionImageIndex(null)
                setDragOverVisionImageIndex(null)
              },
              onDragEnd: () => {
                setDraggedVisionImageIndex(null)
                setDragOverVisionImageIndex(null)
              },
            },
            fitMode: 'contain',
            removable: true,
            onRemove: removeSelectedLifeGoalVisionImage,
            interactive: visionImageInteractiveOptions,
          })
        : null
    const visionDisplayContent = (
      <div
        className={`mt-2 w-full ${
          selectedLifeGoalVisionShowsStatementInDisplay && !selectedLifeGoalVisionShowsImagesInDisplay
            ? 'flex min-h-[280px] flex-1 flex-col'
            : ''
        }`}
      >
        {selectedLifeGoalVisionShowsImagesInDisplay && selectedLifeGoal.visionImages.length > 0 ? (
          <div className="space-y-3">
            {renderVisionImageLayout(selectedLifeGoal.visionImages, {
              displayStyle: 'minimal',
              fitMode: 'contain',
              onOpenPreview: setVisionPreviewImage,
              interactive: visionImageInteractiveOptions,
            })}

            {selectedLifeGoalVisionMode === 'images-statement' && selectedLifeGoal.visionStatement.trim() ? (
              <div className="space-y-2 px-2 pb-1 pt-0.5 text-center sm:space-y-2.5">
                <div className="mx-auto h-px w-[34%] max-w-[220px] min-w-[120px] bg-white/[0.08]" />
                <p
                  className="mx-auto max-w-[34rem] text-[18px] font-medium leading-[1.58] tracking-[0.012em] text-white/86 [text-shadow:0_0_18px_rgba(var(--theme-accent-rgb),0.08)] sm:text-[19px]"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {selectedLifeGoal.visionStatement.trim()}
                </p>
              </div>
            ) : null}
          </div>
        ) : selectedLifeGoalVisionShowsStatementInDisplay ? (
          <div className="flex h-full w-full flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(255,255,255,0.016)_34%,rgba(255,255,255,0)_72%)] px-6 py-8 text-center sm:px-10 sm:py-10">
            <div className="w-full max-w-[46rem]">
              <p className="mx-auto max-w-[30rem] text-center text-[28px] leading-[1.45] tracking-[-0.02em] text-white/88 sm:text-[34px]">
                {selectedLifeGoal.visionStatement.trim()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    )
    const roadmapNotesContent = (
      <LifeGoalNotesEditor value={selectedLifeGoal.notes ?? ''} onChange={updateSelectedLifeGoalNotes} />
    )
    const relatedGoalsSection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Active paths</p>
            <span className="group relative inline-flex">
              <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[10px] text-white/38 transition group-hover:text-white/60">
                i
              </span>
              <span className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[220px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#141414] px-3 py-2 text-left text-xs leading-5 text-mist shadow-[0_16px_34px_rgba(0,0,0,0.36)] group-hover:block">
                These are goals that move this direction forward. They are connected goals, not sub-tasks.
              </span>
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-mist/68">Related goals</p>
          <p className="mt-1 text-sm text-mist">Goals linked to this direction and moving it forward.</p>
        </div>

        <div className="mt-4 space-y-2">
          {relatedGoals.length > 0 ? (
            <>
              {visibleRelatedGoals.map((goal) => {
              const dueMeta = goal.targetDate && isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onSelectLifeGoal(goal.id)}
                  className="flex w-full items-center justify-between rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white/84">{goal.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {goal.category ? <p className="text-[12px] text-mist/56">{goal.category}</p> : null}
                      {goal.targetDate ? (
                        <p className={`text-[12px] ${dueMeta?.toneClassName ?? 'text-mist/56'}`}>
                          {dueMeta ? `${dueMeta.label} · ${formatDate(goal.targetDate)}` : formatDate(goal.targetDate)}
                        </p>
                      ) : null}
                      <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                        {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/36">Open</span>
                </button>
              )
            })}
              {hiddenRelatedGoalsCount > 0 ? (
                <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                  +{hiddenRelatedGoalsCount} more
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <p className="text-sm text-white/78">No active paths yet</p>
              <p className="mt-1 text-sm text-mist">Add goals that move this direction forward.</p>
              <button
                type="button"
                onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
                className="mt-3 inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
              >
                Link a goal
              </button>
            </div>
          )}
        </div>
      </div>
    )
    const directionalReflectionsSection = (
      <div className="px-1 py-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Reflections</p>
        <p className="mt-2 text-sm text-white/58">No reflections yet</p>
        <p className="mt-1 text-sm text-mist/56">Capture thoughts and check-ins as this direction evolves.</p>
      </div>
    )
    const supportingHabitsSection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Supporting habits</p>
          <p className="mt-1 text-sm text-mist">Simple repeatable behaviors linked to this goal.</p>
        </div>

        <div className="mt-4 space-y-2.5">
          {visibleSupportingHabits.length > 0 ? (
            <>
              {visibleSupportingHabits.map((tracker) => {
                const streak = getLiveTrackerStreak(tracker, year)
                const progress = tracker.goal ? getTrackerGoalProgress(tracker, year) : null

                return (
                  <button
                    key={`supporting-habit-${tracker.id}`}
                    type="button"
                    onClick={() => onOpenHabitTracker(tracker.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.026]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-white/78">{tracker.title}</p>
                      <p className="mt-1 text-[12px] text-mist/54">
                        {progress?.progressText ?? (streak > 0 ? `${streak} day streak` : 'No goal set')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/46">
                      Habit
                    </span>
                  </button>
                )
              })}
              {hiddenSupportingHabitsCount > 0 ? (
                <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                  +{hiddenSupportingHabitsCount} more
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <p className="text-sm text-white/68">No supporting habits yet</p>
              <p className="mt-1 text-sm text-mist">Linked habits will appear here when they support this goal.</p>
            </div>
          )}
        </div>
      </div>
    )
    const outcomeMilestoneContent =
      isOutcomeGoal && milestonesEnabled ? (
        goalMilestones.length > 0 ? (
          <div className="space-y-2">
            {goalMilestones.length > 1 ? (
              <div className="mb-1 flex items-center gap-2 px-1 pb-2">
                {goalMilestones.map((milestone, index) => {
                  const isCurrentMilestone = currentMilestone?.id === milestone.id && !milestone.completed
                  return (
                    <span
                      key={`milestone-progress-${milestone.id}`}
                      title={milestone.title.trim() || `Milestone ${index + 1}`}
                      className={`inline-flex h-2.5 w-2.5 rounded-full border transition ${
                        milestone.completed
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.36)] bg-[rgb(var(--theme-accent-rgb)/0.74)]'
                          : isCurrentMilestone
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.34)] bg-[rgb(var(--theme-accent-rgb)/0.18)] shadow-[0_0_0_2px_rgb(var(--theme-accent-rgb)/0.06)]'
                            : 'border-white/[0.18] bg-transparent'
                      }`}
                    />
                  )
                })}
              </div>
            ) : null}
            {goalMilestones.map((milestone, milestoneIndex) => {
              const isCurrentMilestone = currentMilestone?.id === milestone.id && !milestone.completed
              const milestoneDueMeta = milestone.targetDate ? getRelativeDueMeta(milestone.targetDate) : null
              const milestoneDescriptionPreview = milestone.description.trim()
              const milestoneTasks = explicitlyAssignedTasksByMilestone.get(milestone.id) ?? []
              const milestoneTaskProgress = getMilestoneTaskProgress(milestoneTasks)
              return (
                <div
                  key={milestone.id}
                  onClick={() => openMilestonePeek(milestone.id)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openMilestonePeek(milestone.id)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full cursor-pointer rounded-[20px] border px-4 py-3.5 text-left transition ${
                    isCurrentMilestone
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.08)] bg-[rgb(var(--theme-accent-rgb)/0.022)] hover:border-[rgb(var(--theme-accent-rgb)/0.12)]'
                      : 'border-white/[0.05] bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.026]'
                  }`}
                >
                  <div className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3.5">
                    <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 items-center justify-center">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium transition ${
                          milestone.completed
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                            : isCurrentMilestone
                              ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.04)] text-white/84'
                              : 'border-white/[0.12] bg-white/[0.02] text-white/46'
                        }`}
                      >
                        {milestone.completed ? '✓' : milestoneIndex + 1}
                      </span>
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`min-w-0 flex-1 text-[15px] font-medium leading-6 ${milestone.completed ? 'text-white/54 line-through' : 'text-white/88'}`}>
                          {milestone.title.trim() || `Milestone ${milestoneIndex + 1}`}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                              milestone.completed
                                ? 'border-white/[0.06] bg-white/[0.025] text-white/44'
                                : isCurrentMilestone
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.06)] text-[rgb(var(--theme-accent-rgb)/0.74)]'
                                  : 'border-white/[0.06] bg-white/[0.018] text-white/42'
                            }`}
                          >
                            {milestone.completed ? 'Completed' : isCurrentMilestone ? 'Current' : 'Upcoming'}
                          </span>
                          {milestone.targetDate ? (
                            <span className={`text-[12px] ${milestoneDueMeta?.toneClassName ?? 'text-mist/56'}`}>
                              {milestoneDueMeta ? `${milestoneDueMeta.compactLabel} · ` : ''}
                              {formatDate(milestone.targetDate)}
                            </span>
                          ) : null}
                          {milestoneTaskProgress.percent != null ? (
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                                milestoneTaskProgress.percent === 100
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                                  : milestoneTaskProgress.percent > 0
                                    ? 'border-white/[0.08] bg-white/[0.03] text-white/56'
                                    : 'border-white/[0.05] bg-white/[0.016] text-white/40'
                              }`}
                            >
                              {milestoneTaskProgress.percent}% complete
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {milestoneDescriptionPreview ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/58">{milestoneDescriptionPreview}</p>
                      ) : null}
                      {milestoneTaskProgress.percent != null ? (
                        <p className="mt-1 text-[12px] text-mist/56">
                          {milestoneTaskProgress.completed}/{milestoneTaskProgress.total} tasks complete
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={addSelectedLifeGoalMilestone}
              className="group flex w-full items-center gap-3 rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.012] px-4 py-3.5 text-left transition hover:border-white/[0.14] hover:bg-white/[0.02]"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-[15px] text-white/44 transition group-hover:text-white/64">
                +
              </span>
              <span className="text-[15px] font-medium text-white/54 transition group-hover:text-white/74">Add milestone</span>
            </button>
          </div>
        ) : (
          <div className="pt-1" style={roadmapContentInsetStyle}>
            <p className="text-sm text-white/68">No milestones yet</p>
            <button
              type="button"
              onClick={addSelectedLifeGoalMilestone}
              className="mt-2 inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/56 transition hover:border-white/[0.1] hover:text-white/78"
            >
              + Add first milestone
            </button>
          </div>
        )
      ) : null
    const milestoneDatePicker =
      milestoneDatePickerMilestoneId && milestoneDatePanelPosition && milestoneDateTarget && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={milestoneDatePanelRef}
              className="theme-popover fixed z-[80] overflow-hidden rounded-[24px] border p-3 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
              style={{
                top: `${milestoneDatePanelPosition.top}px`,
                left: `${milestoneDatePanelPosition.left}px`,
                width: `${milestoneDatePanelPosition.width}px`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMilestoneDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                  className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                >
                  Prev
                </button>
                <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(milestoneDateViewMonth)}</p>
                <button
                  type="button"
                  onClick={() => setMilestoneDateViewMonth((current) => shiftCalendarMonth(current, 1))}
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
                {getCalendarDays(milestoneDateViewMonth).map((day) => {
                  const dayValue = formatCalendarDayValue(day)
                  const inCurrentMonth = day.getUTCMonth() === milestoneDateViewMonth.getUTCMonth()
                  const activeDateValue = milestoneDateTarget.targetDate ?? ''
                  const isSelected = dayValue === activeDateValue
                  const isToday = dayValue === getTodayIsoDate()

                  return (
                    <button
                      key={dayValue}
                      type="button"
                      onClick={() => applySelectedMilestoneDate(dayValue)}
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
                  onClick={() => applySelectedMilestoneDate(getTodayIsoDate())}
                  className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                >
                  Today
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => applySelectedMilestoneDate('')}
                    className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMilestoneDatePickerMilestoneId(null)
                      setMilestoneDatePanelPosition(null)
                    }}
                    className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null
    const directionalActivitySection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Activity</p>
            <p className="mt-1 text-sm text-mist">Linked global tasks supporting this direction.</p>
            <p className="mt-1 text-[12px] text-mist/52">Linked tasks are managed from the Dashboard task list.</p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {visibleDirectionalTasks.length > 0 ? (
            <>
              {visibleDirectionalTasks.map((task) => (
                (() => {
                  const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                  return (
                    <button
                      key={`direction-task-${task.id}`}
                      type="button"
                      onClick={onOpenGlobalTasks}
                      className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.026]"
                      title="Open in global tasks"
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm leading-6 ${task.completed ? 'text-white/52 line-through' : 'text-white/78'}`}>
                          {task.text}
                        </p>
                        {task.dueDate ? (
                          <p className="mt-1 text-[12px] text-mist/54">
                            {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        {task.important ? (
                          <span className="inline-flex items-center rounded-full border border-[#A94D45]/28 bg-[#2A1615]/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#D58A82]">
                            Important
                          </span>
                        ) : null}
                      </div>
                    </button>
                  )
                })()
              ))}
              {hiddenDirectionalTasksCount > 0 ? (
                <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                  +{hiddenDirectionalTasksCount} more
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
              <p className="text-sm text-white/68">No linked tasks yet</p>
              <p className="mt-1 text-sm text-mist">Linked tasks will appear here when they support this direction.</p>
              <p className="mt-1 text-[12px] text-mist/52">Create and edit linked tasks from the Dashboard.</p>
            </div>
          )}
        </div>
      </div>
    )
    const tasksTabContent = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Tasks</p>
            <p className="mt-1 text-sm text-mist">Keep the next steps visible and mark them honestly.</p>
          </div>
          {renderTaskSortControl()}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Upcoming tasks</p>
            {sortedPlannedTasks.length > 0 ? (
              sortedPlannedTasks.map((task, index) => {
                const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                const visualState = getRoadmapTaskVisualState(task, index === 0 ? 'current' : 'upcoming', false)
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border px-3.5 py-2.5 ${
                      index === 0
                        ? 'border-white/[0.16] bg-white/[0.045]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                    }`}
                    style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                  >
                    <button
                      type="button"
                      onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                      className="flex w-full items-start justify-between gap-3 text-left transition"
                    >
                      <div className="min-w-0">
                        {index === 0 ? (
                          <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
                            Next
                          </span>
                        ) : null}
                        <span className={`mt-1 block leading-6 ${index === 0 ? 'text-[15px] font-medium' : 'text-sm'} ${visualState.titleClassName}`}>{task.text}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">{renderTaskTags(task)}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pl-2">
                        {renderSubtaskProgressDots(task.subtasks)}
                        <div className="flex items-center gap-2">
                          {task.dueDate ? (
                            <span className={`text-xs ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                              {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                            </span>
                          ) : null}
                          {renderPriorityChip(task)}
                        </div>
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
                        spellCheck={true}
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
                )
              })
            ) : (
              <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
                No upcoming tasks yet. Add the next concrete step.
              </p>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={(event) => openNewTaskPeek(event.currentTarget)}
                className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/62 transition hover:border-white/[0.12] hover:text-white/82"
              >
                + Add task
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Completed tasks</p>
            {sortedCompletedTasks.length > 0 ? (
              sortedCompletedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                      className="text-left"
                    >
                      <span className="text-sm leading-6 text-white/62 line-through">{task.text}</span>
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">{renderTaskTags(task)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {task.subtasks.length > 0 ? <div className="mb-1 flex justify-end">{renderSubtaskProgressDots(task.subtasks, 'completed')}</div> : null}
                    {task.dueDate ? (
                      <p className={`text-xs ${getRelativeDueMeta(task.dueDate)?.toneClassName ?? 'text-mist/62'}`}>
                        {(() => {
                          const dueMeta = getRelativeDueMeta(task.dueDate)
                          return dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)
                        })()}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-mist/72">
                      {task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : 'Done'}
                    </p>
                    <button
                      type="button"
                      onClick={() => restoreTask(selectedLifeGoal.id, task.id)}
                      className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.66)] transition hover:text-[rgb(var(--theme-info-rgb)/0.9)]"
                    >
                      Restore
                    </button>
                  </div>
                </div>
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
      <div
        className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-5 py-5"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault()
            openNewTaskPeek(event.currentTarget as HTMLElement)
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Roadmap</p>
            <p className="mt-1 text-sm text-mist">A clean view of the path from the current task to the goal.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {renderTaskSortControl()}
            {roadmapHasTaggedTasks ? (
              <button
                type="button"
                onClick={() => setRoadmapOrganizationMode((current) => (current === 'default' ? 'tag' : 'default'))}
                className={`${
                  roadmapOrganizationMode === 'tag'
                    ? roadmapHeaderControlActiveClass
                    : roadmapHeaderControlBaseClass
                }`}
              >
                {roadmapOrganizationMode === 'tag' ? 'View · By tag' : 'View · Default'}
              </button>
            ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
            {roadmapHasHighPriorityTasks ? (
              <button
                type="button"
                onClick={() => setRoadmapHighPriorityFocus((current) => !current)}
                className={`${
                  roadmapHighPriorityFocus
                    ? 'inline-flex items-center rounded-full border border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.06)] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-[rgb(var(--theme-accent-rgb)/0.72)] transition hover:border-[rgb(var(--theme-accent-rgb)/0.16)] hover:text-[rgb(var(--theme-accent-rgb)/0.82)]'
                    : roadmapHeaderControlBaseClass
                }`}
              >
                Focus · High priority
              </button>
            ) : null}
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mist/54">
              {selectedLifeGoalProgress.completedTaskItems.length} completed
              <span className="px-1.5 text-white/24">·</span>
              {roadmapRemainingCount} remaining
            </p>
          </div>
        </div>

        {selectedLifeGoal.tasks.length > 0 ? (
          <div className="relative mt-5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px"
              style={{
                ...roadmapRailLeftStyle,
                backgroundColor:
                  roadmapSections.current
                    ? roadmapLineColor
                    : 'rgb(var(--theme-border-subtle-rgb) / 0.16)',
                width: `${roadmapLineWidth}px`,
              }}
            />

            <div className="space-y-7">
              {roadmapSections.completed.length > 0 ? (
                <section>
                  <button
                    type="button"
                    onClick={() => setRoadmapCompletedOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 pb-3 text-left text-[11px] uppercase tracking-[0.18em] text-mist/52 transition hover:text-white/66"
                    style={roadmapContentInsetStyle}
                  >
                    <span>Completed ({roadmapSections.completed.length})</span>
                    <span className="text-white/34">{roadmapCompletedOpen ? '−' : '+'}</span>
                  </button>
                  {roadmapCompletedOpen ? renderRoadmapTaskGroups(sortedCompletedTasks, 'completed', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const visualState = getRoadmapTaskVisualState(task, 'completed', roadmapHighPriorityFocus)
                    const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                    return (
                      <div
                        key={task.id}
                        className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-white/[0.035] transition-all duration-200 ease-out last:border-b-0 ${
                          isCompressed ? 'gap-y-0 py-1.5' : 'gap-y-1 py-2.5'
                        } ${
                          selectedRoadmapTaskId === task.id ? 'bg-white/[0.012]' : ''
                        }`}
                        style={{ opacity: visualState.opacity }}
                      >
                        <span aria-hidden="true" className={`pt-0.5 text-[16px] leading-none ${visualState.markerClassName}`}>
                          ●
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            setSelectedRoadmapTaskId(task.id)
                            openTaskPeek(task.id, event.currentTarget)
                          }}
                          className="relative min-w-0 text-left"
                        >
                          <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                            <div className={`flex items-end justify-between gap-3 pr-8 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                              <div className="min-w-0 text-left pb-[2px]">
                                <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                                  <p className={`text-[12px] ${task.dueDate ? dueMeta?.toneClassName ?? visualState.metaClassName : visualState.metaClassName}`}>
                                    {task.dueDate ? (dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)) : 'Completed'}
                                  </p>
                                  {!isCompressed ? renderPriorityChip(task) : null}
                                  {!isCompressed ? renderTaskTags(task) : null}
                                </div>
                              </div>
                              {task.completedAt ? (
                                <span className="shrink-0 text-[12px] text-mist/56">{formatDate(task.completedAt.slice(0, 10))}</span>
                              ) : null}
                            </div>
                          {task.subtasks.length > 0 ? (
                            <div className="pointer-events-none absolute bottom-[8px] right-2.5 flex items-center justify-end">
                              {renderSubtaskProgressDots(task.subtasks, 'completed')}
                            </div>
                          ) : null}
                        </button>
                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            onClick={() => restoreTask(selectedLifeGoal.id, task.id)}
                            className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.66)] transition hover:text-[rgb(var(--theme-info-rgb)/0.9)]"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    )
                  }) : null}
                </section>
              ) : null}

              {roadmapSections.current ? (
                <section>
                  <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Current</p>
                  {renderRoadmapTaskGroups([roadmapSections.current], 'current', undefined, (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const isSelected = selectedRoadmapTaskId === task.id
                    const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
                    return (
                      <div key={task.id}>
                        <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.74)]" style={roadmapContentInsetStyle}>
                          You are here
                        </p>
                        <button
                          type="button"
                          onClick={(event) => {
                            setSelectedRoadmapTaskId(task.id)
                            openTaskPeek(task.id, event.currentTarget)
                          }}
                          onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragOver={(event) => {
                            event.preventDefault()
                            if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            if (draggedTaskId) {
                              reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                            }
                            setDraggedTaskId(null)
                            setDragOverTaskId(null)
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null)
                            setDragOverTaskId(null)
                          }}
                          className={`relative grid w-full items-start gap-x-3 gap-y-1 border-b border-white/[0.04] py-[18px] text-left transition hover:border-white/[0.07] ${
                            isSelected ? 'bg-white/[0.018]' : 'bg-white/[0.012]'
                          } ${
                            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                          }`}
                          style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                        >
                          <span aria-hidden="true" className={`pt-0.5 text-[18px] leading-none ${visualState.markerClassName}`}>
                            ◎
                          </span>
                          <div className="min-w-0 pr-8">
                            <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                            <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                              <div className="min-w-0 text-left pb-[2px]">
                                <div className="flex flex-wrap items-center gap-2">
                                  {task.dueDate ? (
                                    <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                      {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                    </p>
                                  ) : null}
                                  {renderPriorityChip(task)}
                                  {renderTaskTags(task)}
                                </div>
                              </div>
                            </div>
                          </div>
                          {task.subtasks.length > 0 ? (
                            <div className="pointer-events-none absolute bottom-3 right-2.5 flex items-center justify-end">
                              {renderSubtaskProgressDots(task.subtasks)}
                            </div>
                          ) : null}
                        </button>
                      </div>
                    )
                  })}
                </section>
              ) : null}

              {roadmapSections.upcoming.length > 0 ? (
                <section>
                  <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Upcoming</p>
                  {renderRoadmapTaskGroups(sortedUpcomingTasks, 'upcoming', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const isSelected = selectedRoadmapTaskId === task.id
                    const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
                    const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={(event) => {
                          setSelectedRoadmapTaskId(task.id)
                          openTaskPeek(task.id, event.currentTarget)
                        }}
                        onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onDragOver={(event) => {
                          event.preventDefault()
                          if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          if (draggedTaskId) {
                            reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                          }
                          setDraggedTaskId(null)
                          setDragOverTaskId(null)
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null)
                          setDragOverTaskId(null)
                        }}
                        className={`relative grid w-full items-start gap-x-3 border-b border-white/[0.035] text-left transition-all duration-200 ease-out last:border-b-0 hover:border-white/[0.07] ${
                          isCompressed ? 'gap-y-0 py-1.5' : 'gap-y-1 py-3'
                        } ${
                          isSelected ? 'bg-white/[0.012]' : ''
                        } ${
                          dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                        }`}
                        style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                      >
                        <span aria-hidden="true" className={`pt-0.5 text-[16px] leading-none ${visualState.markerClassName}`}>
                          ○
                        </span>
                        <div className="min-w-0 pr-8">
                          <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                          <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                            <div className="min-w-0 text-left pb-[2px]">
                              <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                                {task.dueDate ? (
                                  <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                    {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                  </p>
                                ) : null}
                                {!isCompressed ? renderPriorityChip(task) : null}
                                {!isCompressed ? renderTaskTags(task) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                        {task.subtasks.length > 0 ? (
                          <div className="pointer-events-none absolute bottom-[17px] right-4 flex items-center justify-end">
                            {renderSubtaskProgressDots(task.subtasks)}
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </section>
              ) : null}

              <section>
                <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Goal</p>
                <div className="grid items-start gap-x-3 border-b border-white/[0.035] py-3" style={{ gridTemplateColumns: roadmapNodeGridTemplate }}>
                  <span aria-hidden="true" className="pt-0.5 text-[16px] leading-none text-white/84">
                    ◉
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-white/88">Goal</p>
                    <p className="mt-1 text-[12px] text-mist/58">Completion point</p>
                  </div>
                </div>
              </section>
            </div>

            <div className="border-t border-white/[0.05] pt-3">
              <button
                type="button"
                onClick={(event) => openNewTaskPeek(event.currentTarget)}
                className="text-sm text-white/62 transition hover:text-white/84"
              >
                + Add task
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-mist">No tasks yet. Add the first concrete step to build the roadmap.</p>
        )}
      </div>
    )

    if (isRoadmapMode) {
      return (
        <motion.div
          key={`${selectedLifeGoal.id}-${lifeGoalDetailTab}`}
          className="w-full space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setLifeGoalDetailTab('focus')}
              className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
            >
              ← Back to Goal
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {detailHeaderRelationshipChips}
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
                  <h3 className="theme-page-title min-w-0 flex-1">
                    {inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
                  </h3>
                  {showDetailCategory && selectedGoalCategory ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none text-white/70"
                      style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                      {selectedGoalCategory}
                    </span>
                  ) : null}
                  {renderParentGoalChips()}
                </div>
                {showDetailWhy && inlineLifeGoalEditingField === 'why' ? (
                  <div className="mt-3 max-w-[44rem]">{inlineEditableWhy}</div>
                ) : showDetailWhy ? (
                  <div className="mt-3 max-w-[44rem]">{inlineWhyDisplay}</div>
                ) : null}
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
        </motion.div>
      )
    }

    return (
      <motion.div
        key={selectedLifeGoal.id}
        className="w-full space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChangeGoalsView('life-overview')}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to Life Goals
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {detailHeaderRelationshipChips}
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,1fr)]">
            <div
              className={`space-y-3 self-start xl:flex xl:flex-col xl:space-y-0 xl:gap-3 ${
                selectedLifeGoalVisionEditorOpen ? '' : 'xl:h-[78vh]'
              }`}
            >
              {isDirectionalGoal ? (
                directionalAnchorCard
              ) : (
                <LifeGoalFocusCard
                  title={inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
                  categoryChip={
                    <>
                      {showDetailCategory && selectedGoalCategory ? (
                        <span
                          className={`${goalHeaderChipClassName} gap-1.5 text-white/70`}
                          style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                          {selectedGoalCategory}
                        </span>
                      ) : null}
                    </>
                  }
                  primaryChip={null}
                  statusChip={
                    showDetailStatus ? (
                      <span
                        className={`${goalHeaderChipClassName} ${
                          getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).badgeClassName
                        }`}
                      >
                        {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate)
                          ? 'Scheduled'
                          : getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).label}
                      </span>
                    ) : null
                  }
                  whyContent={showDetailWhy ? (inlineLifeGoalEditingField === 'why' ? inlineEditableWhy : inlineWhyDisplay) : null}
                  nextTaskText={
                    selectedLifeGoal.status === 'complete'
                      ? 'You finished every step in this goal.'
                      : goalReadyToComplete
                        ? 'Everything is complete. Mark the goal finished when you are ready.'
                        : selectedLifeGoalProgress.nextTask?.text ?? 'No next task currently planned.'
                  }
                  actionFeedback={lifeGoalActionFeedback}
                  primaryActionLabel={goalReadyToComplete ? 'Complete goal' : selectedLifeGoalProgress.nextTask ? 'Done — continue' : undefined}
                  completeNextVisualState={completeNextVisualState}
                  nextTaskVisualState={nextTaskVisualState}
                  onPrimaryAction={goalReadyToComplete ? () => completeLifeGoal(selectedLifeGoal.id) : selectedLifeGoalProgress.nextTask ? handleCompleteNextWithFeedback : undefined}
                  onFocusToday={() => {
                    onSetLifeGoalAsTodayTask(selectedLifeGoal)
                    setLifeGoalActionFeedback('Focused for today.')
                  }}
                  showExecutionSection={!isDirectionalGoal}
                />
              )}

              {showDetailVision ? (
                <LifeGoalVisionCard
                  isCollapsed={selectedLifeGoalVisionCollapsed}
                  isEditing={selectedLifeGoalShowVisionEditUI}
                  isEditorOpen={selectedLifeGoalVisionEditorOpen}
                  editMode={selectedLifeGoalVisionEditMode}
                  canUploadImages={selectedLifeGoalCanUploadVisionImages}
                  visionDropActive={visionDropActive}
                  visionStatementLength={selectedLifeGoal.visionStatement.length}
                  uploadInputRef={visionUploadInputRef}
                  onOpenEditor={openSelectedLifeGoalVisionEditor}
                  onSelectEditMode={setSelectedLifeGoalVisionEditMode}
                  onVisionFilesSelected={appendSelectedLifeGoalVisionImages}
                  onUploadClick={() => {
                    if (!selectedLifeGoalCanUploadVisionImages) return
                    visionUploadInputRef.current?.click()
                  }}
                  onDropActiveChange={setVisionDropActive}
                  onDropFiles={appendSelectedLifeGoalVisionImages}
                  onVisionStatementChange={updateSelectedLifeGoalVisionStatement}
                  onApplyEditMode={applySelectedLifeGoalVisionEditMode}
                  editImagesContent={visionEditImagesContent}
                  displayContent={visionDisplayContent}
                  showEditImages={selectedLifeGoalVisionEditShowsImages}
                  showEditStatement={selectedLifeGoalVisionEditShowsStatement}
                  visionStatement={selectedLifeGoal.visionStatement}
                />
              ) : null}

            </div>

            {!isDirectionalGoal ? <LifeGoalRoadmapPanel
              data={{
                plannedTaskCount: selectedLifeGoalProgress.plannedTasks.length,
                completedCount: selectedLifeGoalProgress.completedTaskItems.length,
                remainingCount: roadmapRemainingCount,
                lastCompletedText: selectedLifeGoalProgress.lastCompletedTask?.text ?? null,
                roadmapLineColor,
                roadmapLineWidth,
                roadmapTimelineX: roadmapGeometry.timelineX,
                roadmapContentInset: roadmapGeometry.contentInset,
                milestoneSummaryText:
                  goalMilestones.length > 0
                    ? `${completedMilestoneCount}/${goalMilestones.length} milestones complete`
                    : 'Milestones enabled',
                notesContent: roadmapNotesContent,
                sortControl: renderTaskSortControl(),
                emptyMessage: roadmapSections.completed.length > 0 ? 'All roadmap tasks are complete.' : 'No upcoming tasks yet. Add the next concrete step.',
                milestoneContent: outcomeMilestoneContent,
                completedContent: roadmapSections.completed.length > 0 ? (
                  <div className="pb-4">
                    {renderRoadmapTaskGroups(sortedCompletedTasks, 'completed', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                      const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                      const visualState = getRoadmapTaskVisualState(task, 'completed', roadmapHighPriorityFocus)
                      const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                      return (
                        <button
                          key={task.id}
                          ref={(element) => {
                            roadmapTaskRowRefs.current[task.id] = element
                          }}
                          data-goal-task-id={task.id}
                          type="button"
                          onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                          onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                          className={`group grid w-full items-start gap-x-3 rounded-[12px] text-left transition-all duration-200 ease-out hover:bg-white/[0.014] ${
                            isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
                          } ${
                            visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''
                          } ${
                            taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                          }`}
                          style={{
                            gridTemplateColumns: roadmapNodeGridTemplate,
                            opacity:
                              visualState.opacity *
                              (roadmapArrivalCueActive ? 0.78 : 1) *
                              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                          }}
                        >
                          <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
                            {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
                            <span className="h-2 w-2 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.5)] transition-transform duration-200 ease-out group-hover:scale-110" />
                          </span>
                          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
                            <AnimatePresence initial={false}>
                              {visibleGoalStartCueTaskId === task.id ? (
                                <motion.p
                                  className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                >
                                  Goal started • 1 step ready
                                </motion.p>
                              ) : null}
                            </AnimatePresence>
                            <p className={`${isCompressed ? 'text-[13px] leading-5' : 'text-[14px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                            <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                              <div className="min-w-0 text-left pb-[2px]">
                                <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                                  {task.dueDate ? (
                                    <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                      {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                    </p>
                                  ) : null}
                                  {!isCompressed ? renderPriorityChip(task) : null}
                                  {!isCompressed ? renderTaskTags(task) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                          {task.subtasks.length > 0 ? (
                            <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
                              {renderSubtaskProgressDots(task.subtasks, 'completed')}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null,
                currentContent: roadmapMilestoneStructuredContent ? (
                  roadmapMilestoneStructuredContent
                ) : roadmapSections.current ? (
                  <div className="pb-4">
                    {renderRoadmapTaskGroups([roadmapSections.current], 'panel-current', undefined, (task) => {
                      const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                      const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
                      return (
                        <div key={task.id}>
                          <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.96)] [text-shadow:0_0_10px_rgb(var(--theme-accent-rgb)/0.42),0_0_18px_rgb(var(--theme-accent-rgb)/0.18)]" style={roadmapContentInsetStyle}>
                            You are here
                          </p>
                          <button
                            ref={(element) => {
                              roadmapTaskRowRefs.current[task.id] = element
                            }}
                            data-goal-task-id={task.id}
                            type="button"
                            onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                            onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                            draggable
                            onDragStart={() => setDraggedTaskId(task.id)}
                            onDragOver={(event) => {
                              event.preventDefault()
                              if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                            }}
                            onDrop={(event) => {
                              event.preventDefault()
                              if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                              setDraggedTaskId(null)
                              setDragOverTaskId(null)
                            }}
                            onDragEnd={() => {
                              setDraggedTaskId(null)
                              setDragOverTaskId(null)
                            }}
                            className={`group relative grid w-full items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.14)] bg-white/[0.014] py-[18px] text-left transition duration-200 ease-out hover:bg-white/[0.022] hover:border-[rgb(var(--theme-accent-rgb)/0.18)] ${
                              dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id
                                ? 'bg-white/[0.03]'
                                : ''
                            } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                              roadmapArrivalCueActive ? 'goal-current-arrival' : ''
                            } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
                              taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                            }`}
                            style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                          >
                            <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
                              {renderRoadmapNodeCutout(roadmapCurrentNodeDiameter)}
                              <span className="roadmap-current-node-pulse absolute h-[20px] w-[20px] rounded-full bg-[rgb(var(--theme-accent-rgb)/0.22)] blur-[6px]" />
                              <span
                                className={`relative flex items-center justify-center rounded-full border transition-transform duration-200 ease-out group-hover:scale-110 ${
                                  getPriorityScore(task) === 3
                                    ? 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.92)] shadow-[0_0_8px_rgb(var(--theme-accent-rgb)/0.1)]'
                                    : 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.84)] shadow-[0_0_6px_rgb(var(--theme-accent-rgb)/0.08)]'
                                }`}
                              >
                                <span
                                  className={`rounded-full border ${
                                    getPriorityScore(task) === 3
                                      ? 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.96)]'
                                      : 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.88)]'
                                  }`}
                                />
                              </span>
                            </span>
                            <div className="min-w-0 px-1 pb-4 pr-10 pt-0.5">
                              <div className="min-w-0">
                                <AnimatePresence initial={false}>
                                  {roadmapArrivalCueActive ? (
                                    <motion.p
                                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/56"
                                      initial={{ opacity: 0, y: 3 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -3 }}
                                      transition={{ duration: 0.18, ease: 'easeOut' }}
                                    >
                                      Start here
                                    </motion.p>
                                  ) : null}
                                </AnimatePresence>
                                <AnimatePresence initial={false}>
                                  {taskMomentumTransition?.nextTaskId === task.id ? (
                                    <motion.p
                                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -4 }}
                                      transition={{ duration: 0.2, ease: 'easeOut' }}
                                    >
                                      Next step ready
                                    </motion.p>
                                  ) : null}
                                </AnimatePresence>
                                <AnimatePresence initial={false}>
                                  {visibleGoalStartCueTaskId === task.id ? (
                                    <motion.p
                                      className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -4 }}
                                      transition={{ duration: 0.18, ease: 'easeOut' }}
                                    >
                                      Goal started • 1 step ready
                                    </motion.p>
                                  ) : null}
                                </AnimatePresence>
                                <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                                <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                                  <div className="min-w-0 text-left pb-[2px]">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {task.dueDate ? (
                                        <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                          {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                        </p>
                                      ) : null}
                                      {renderPriorityChip(task)}
                                      {renderTaskTags(task)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {task.subtasks.length > 0 ? (
                              <div className="pointer-events-none absolute bottom-4 right-3.5 flex items-center justify-end">
                                {renderSubtaskProgressDots(task.subtasks)}
                              </div>
                            ) : null}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null,
                upcomingContent: roadmapMilestoneStructuredContent ? null : roadmapSections.upcoming.length > 0 ? (
                  <div>
                    <p className="pb-2 text-[11px] uppercase tracking-[0.16em] text-mist/56" style={roadmapContentInsetStyle}>Next · {roadmapSections.upcoming.length}</p>
                    {renderRoadmapTaskGroups(sortedUpcomingTasks, 'panel-upcoming', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                      const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                      const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
                      const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                      return (
                        <button
                          key={task.id}
                          ref={(element) => {
                            roadmapTaskRowRefs.current[task.id] = element
                          }}
                          data-goal-task-id={task.id}
                          type="button"
                          onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                          onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                          draggable
                          onDragStart={() => setDraggedTaskId(task.id)}
                          onDragOver={(event) => {
                            event.preventDefault()
                            if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                            setDraggedTaskId(null)
                            setDragOverTaskId(null)
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null)
                            setDragOverTaskId(null)
                          }}
                          className={`group relative grid w-full items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
                            isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
                          } ${
                            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
                          } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                            taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
                          } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
                          style={{
                            ...visualState.rowStyle,
                            gridTemplateColumns: roadmapNodeGridTemplate,
                            opacity:
                              visualState.opacity *
                              (roadmapArrivalCueActive ? 0.78 : 1) *
                              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                          }}
                        >
                          <span aria-hidden="true" className="relative z-[3] justify-self-center mt-[2px] flex h-4 w-4 items-center justify-center">
                            {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
                            <span className={`h-2 w-2 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
                          </span>
                          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
                            <div className="min-w-0">
                              <AnimatePresence initial={false}>
                                {taskMomentumTransition?.nextTaskId === task.id ? (
                                  <motion.p
                                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                  >
                                    Next step ready
                                  </motion.p>
                                ) : null}
                              </AnimatePresence>
                              <AnimatePresence initial={false}>
                                {visibleGoalStartCueTaskId === task.id ? (
                                  <motion.p
                                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.18, ease: 'easeOut' }}
                                  >
                                    Goal started • 1 step ready
                                  </motion.p>
                                ) : null}
                              </AnimatePresence>
                              <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                              <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                                <div className="min-w-0 text-left pb-[2px]">
                                  <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                                    {task.dueDate ? (
                                      <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                        {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                      </p>
                                    ) : null}
                                    {!isCompressed ? renderPriorityChip(task) : null}
                                    {!isCompressed ? renderTaskTags(task) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          {task.subtasks.length > 0 ? (
                            <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
                              {renderSubtaskProgressDots(task.subtasks)}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null,
              }}
              actions={{
                onToggleHighPriorityFocus: () => setRoadmapHighPriorityFocus((current) => !current),
                onToggleOrganizationMode: () =>
                  setRoadmapOrganizationMode((current) => (current === 'default' ? 'tag' : 'default')),
                onSetProgressView: (view) =>
                  setRoadmapPanelViewByGoal((current) => ({
                    ...current,
                    [selectedLifeGoal.id]: view,
                  })),
                onOpenRoadmap: () => setLifeGoalDetailTab('roadmap'),
                onRoadmapKeyDown: (event) => {
                  if (event.key === 'Enter' && event.shiftKey) {
                    event.preventDefault()
                    openNewTaskPeek(event.currentTarget)
                  }
                },
                onAddTask: (trigger) => openNewTaskPeek(trigger),
                onToggleCompleted: () => setRoadmapCompletedOpen((current) => !current),
              }}
              uiState={{
                roadmapHighPriorityFocus,
                completedOpen: roadmapCompletedOpen,
                showHighPriorityFocus: roadmapHasHighPriorityTasks,
                progressView: showMilestoneProgressView ? roadmapPanelView : roadmapPanelView === 'notes' ? 'notes' : 'tasks',
                showMilestonesView: showMilestoneProgressView,
                showNotesView: true,
                organizationMode: roadmapOrganizationMode,
                showTagGrouping: roadmapHasTaggedTasks,
              }}
            /> : isDirectionalGoal ? (
              <div className="space-y-4">
                {relatedGoalsSection}
                {directionalActivitySection}
                {directionalReflectionsSection}
              </div>
            ) : relatedGoals.length > 0 ? (
              linkedGoalsSection
            ) : null}
          </div>

          {!isDirectionalGoal && supportingHabits.length > 0 ? supportingHabitsSection : null}

          {isOutcomeGoal && showDetailMetrics ? <GoalProgressTimelineChart
            tasks={selectedLifeGoal.tasks}
            goalStartDate={selectedLifeGoal.startDate}
            goalCreatedAt={selectedLifeGoal.createdAt}
            goalTargetDate={selectedLifeGoal.targetDate}
            showExpectedProgressDefault={selectedLifeGoal.showExpectedProgressLine !== false}
            onShowExpectedProgressChange={(value) =>
              onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                ...goal,
                showExpectedProgressLine: value,
                updatedAt: new Date().toISOString(),
              }))
            }
          /> : null}

        </div>
        {milestoneDatePicker}
      </motion.div>
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

  const renderEditGoalSidePanel = () => (
    <AnimatePresence>
      {lifeGoalComposerOpen && lifeGoalComposerMode === 'edit' ? (
        <>
          <motion.div
            className="fixed inset-0 z-20 bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              closeLifeGoalComposer()
            }}
          />
          <motion.aside
            ref={lifeGoalComposerBodyRef}
            className={`fixed right-4 top-4 z-30 flex max-h-[calc(100vh-32px)] w-[344px] max-w-[calc(100vw-32px)] min-h-0 flex-col ${GOALS_UTILITY_PANEL_SHELL_CLASSNAME}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 flex-col space-y-3.5">
              <section className="shrink-0 space-y-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-mist/48">Edit goal</p>
                </div>
              </section>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1" onWheel={containScrollWithinElement}>
                {renderLifeGoalComposer()}
              </div>

              {editingLifeGoalId ? (
                <div className="relative shrink-0 border-t border-white/[0.05] pt-3">
                  <div className="flex justify-end">
                    <button
                      ref={editGoalActionsButtonRef}
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={editGoalActionsMenuOpen}
                      onClick={() => setEditGoalActionsMenuOpen((current) => !current)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.018] text-sm text-white/58 transition hover:border-white/[0.08] hover:text-white/82"
                    >
                      •••
                    </button>
                  </div>
                  {editGoalActionsMenuOpen ? (
                    <div
                      ref={editGoalActionsMenuRef}
                      className="theme-popover absolute bottom-[calc(100%+8px)] right-0 z-40 min-w-[176px] overflow-hidden rounded-[18px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setEditGoalActionsMenuOpen(false)
                          if (!window.confirm('Archive this goal? It will be removed from the active Life Goals workspace.')) return
                          onArchiveLifeGoal(editingLifeGoalId)
                          if (selectedLifeGoalId === editingLifeGoalId) {
                            onChangeGoalsView('life-overview')
                          }
                          closeLifeGoalComposer()
                        }}
                        className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-white/76 transition hover:bg-white/[0.05] hover:text-white/92"
                      >
                        Archive Goal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditGoalActionsMenuOpen(false)
                          requestDeleteLifeGoal(editingLifeGoalId, 'edit')
                        }}
                        className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-[rgb(var(--theme-negative-rgb)/0.88)] transition hover:bg-[rgb(var(--theme-negative-rgb)/0.12)] hover:text-[rgb(var(--theme-negative-rgb)/0.98)]"
                      >
                        Delete Goal
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )

  return (
    <div className="space-y-4">
      {goalsView === 'habit-goals'
        ? renderHabitGoalsTab()
        : goalsView === 'life-detail'
          ? renderLifeGoalDetailPage()
          : renderLifeGoalOverviewPage()}

      {renderLifeGoalIconPickerPanel()}

      {renderEditGoalSidePanel()}

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

      <DetailDrawer
        open={Boolean(selectedLifeGoal && selectedMilestone)}
        onClose={() => {
          if (!selectedLifeGoal) return
          setSelectedMilestoneIdByGoal((current) => ({
            ...current,
            [selectedLifeGoal.id]: null,
          }))
        }}
        size="md"
        subtitle="Milestone"
        title={selectedMilestone?.title.trim() || (selectedMilestoneIndex >= 0 ? `Milestone ${selectedMilestoneIndex + 1}` : 'Milestone')}
        description="Refine one checkpoint at a time without losing the roadmap context."
      >
        {selectedLifeGoal && selectedMilestone && selectedMilestoneIndex >= 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Title</span>
                <input
                  value={selectedMilestone.title}
                  onChange={(event) =>
                    updateSelectedLifeGoalMilestone(selectedMilestone.id, (current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  autoFocus
                  placeholder={`Milestone ${selectedMilestoneIndex + 1}`}
                  spellCheck={true}
                  className="theme-input w-full rounded-xl border px-3 py-2 text-sm outline-none"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Target date</span>
                <div
                  ref={(element) => {
                    milestoneDateFieldRefs.current[selectedMilestone.id] = element
                  }}
                  className="relative"
                >
                  <button
                    type="button"
                    onClick={() => openMilestoneDatePicker(selectedMilestone.id, selectedMilestone.targetDate)}
                    className="theme-input flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition"
                  >
                    <span className={selectedMilestone.targetDate ? 'theme-text-primary' : 'theme-text-muted'}>
                      {selectedMilestone.targetDate ? formatDate(selectedMilestone.targetDate) : 'Optional date'}
                    </span>
                    <span className="theme-text-faint text-xs">▾</span>
                  </button>
                </div>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Description</span>
              <textarea
                value={selectedMilestone.description}
                onChange={(event) =>
                  updateSelectedLifeGoalMilestone(selectedMilestone.id, (current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Why this checkpoint matters or what it represents"
                spellCheck={true}
                className="theme-input min-h-[88px] w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
              />
            </label>

            <button
              type="button"
              onClick={(event) =>
                openNewTaskPeek(event.currentTarget, {
                  milestoneId: selectedMilestone.id,
                  milestoneTitle: selectedMilestone.title.trim() || `Milestone ${selectedMilestoneIndex + 1}`,
                })
              }
              className="inline-flex items-center text-[13px] text-mist/58 transition hover:text-white/78"
            >
              + Add task to this milestone
            </button>

            {selectedMilestoneTaskProgress ? (
              <p className="text-[12px] text-mist/56">
                {selectedMilestoneTaskProgress.completed}/{selectedMilestoneTaskProgress.total} tasks complete
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateSelectedLifeGoalMilestone(selectedMilestone.id, (current) => ({
                    ...current,
                    completed: !current.completed,
                    completedAt: !current.completed ? new Date().toISOString() : null,
                  }))
                }
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                  selectedMilestone.completed
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.76)]'
                    : 'border-white/[0.06] bg-white/[0.018] text-white/54 hover:border-white/[0.1] hover:text-white/74'
                }`}
              >
                {selectedMilestone.completed ? 'Mark incomplete' : 'Mark complete'}
              </button>
              <button
                type="button"
                onClick={() => reorderSelectedLifeGoalMilestone(selectedMilestone.id, 'up')}
                disabled={selectedMilestoneIndex === 0}
                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.018] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74 disabled:opacity-30"
              >
                Move up
              </button>
              <button
                type="button"
                onClick={() => reorderSelectedLifeGoalMilestone(selectedMilestone.id, 'down')}
                disabled={selectedMilestoneIndex === selectedLifeGoalMilestones.length - 1}
                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.018] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74 disabled:opacity-30"
              >
                Move down
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSelectedLifeGoalMilestone(selectedMilestone.id)
                  closeMilestonePeek()
                }}
                className="inline-flex items-center rounded-full border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.06)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-negative-rgb)/0.76)] transition hover:border-[rgb(var(--theme-negative-rgb)/0.24)] hover:text-[rgb(var(--theme-negative-rgb)/0.86)]"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </DetailDrawer>

      <LifeGoalTaskPeek
        data={{
          task: selectedTaskPeek,
          activeSubtasks: selectedTaskPeekActiveSubtasks,
          completedSubtasks: selectedTaskPeekCompletedSubtasks,
          datePanelPosition: taskPeekDatePanelPosition,
          dateViewMonth: taskPeekDateViewMonth,
          priorityOptions: taskPriorityOptions,
          milestoneOptions:
            selectedLifeGoal?.goalType === 'outcome' && selectedLifeGoal.milestonesEnabled
              ? [
                  { value: '', label: 'No milestone' },
                  ...(selectedLifeGoal.milestones ?? [])
                    .slice()
                    .sort((left, right) => left.order - right.order)
                    .map((milestone, index) => ({
                      value: milestone.id,
                      label: `${index + 1}. ${milestone.title.trim() || `Milestone ${index + 1}`}${
                        ((selectedLifeGoal.milestones ?? [])
                          .slice()
                          .sort((left, right) => left.order - right.order)
                          .find((candidate) => !candidate.completed) ??
                          (() => {
                            const orderedMilestones = (selectedLifeGoal.milestones ?? [])
                              .slice()
                              .sort((left, right) => left.order - right.order)
                            return orderedMilestones.length > 0 ? orderedMilestones[orderedMilestones.length - 1] : null
                          })())?.id === milestone.id
                          ? ' — Current'
                          : ''
                      }`,
                    })),
                ]
              : [],
          showMilestoneField: Boolean(selectedLifeGoal?.goalType === 'outcome' && selectedLifeGoal?.milestonesEnabled),
          lockedMilestoneLabel: taskPeekLockedMilestoneContext?.title ?? null,
          relativeDueMeta: selectedTaskPeek?.dueDate ? getRelativeDueMeta(selectedTaskPeek.dueDate) : null,
          weekdayLabels: LIFE_GOAL_WEEKDAY_LABELS,
          todayIsoDate: getTodayIsoDate(),
        }}
        uiState={{
          open: Boolean(selectedTaskPeek),
          completedSubtasksOpen: taskPeekCompletedSubtasksOpen,
          subtaskEntryOpen: taskPeekSubtaskEntryOpen,
          subtaskDraft: taskPeekSubtaskDraft,
          notesOpen: taskPeekNotesOpen,
          datePickerOpen: taskPeekDatePickerOpen,
          deleteConfirmation: taskPeekDeleteConfirmation,
          canMarkAsNext: Boolean(
            !selectedTaskPeek?.completed && selectedLifeGoal && selectedLifeGoalProgress && selectedLifeGoalProgress.nextTask?.id !== selectedTaskPeek?.id,
          ),
          draggedSubtaskId,
          dragOverSubtaskId,
        }}
        refs={{
          panelRef: taskPeekPanelRef,
          titleRef: taskPeekTitleRef,
          dateFieldRef: taskPeekDateFieldRef,
          datePanelRef: taskPeekDatePanelRef,
          subtaskDraftRef: taskPeekSubtaskDraftRef,
          deleteDialogRef: taskPeekDeleteDialogRef,
        }}
        actions={{
          setCompletedSubtasksOpen: setTaskPeekCompletedSubtasksOpen,
          setSubtaskEntryOpen: setTaskPeekSubtaskEntryOpen,
          setSubtaskDraft: setTaskPeekSubtaskDraft,
          setNotesOpen: setTaskPeekNotesOpen,
          setTaskDeleteConfirmation: setTaskPeekDeleteConfirmation,
          onClose: closeTaskPeek,
          onTitleChange: (value) => updateSelectedTaskPeek((task) => ({ ...task, text: value })),
          onDescriptionChange: (value) => updateSelectedTaskPeek((task) => ({ ...task, description: value })),
          onNotesChange: (value) => updateSelectedTaskPeek((task) => ({ ...task, notes: value })),
          onMilestoneChange: (value) => updateSelectedTaskPeek((task) => ({ ...task, milestoneId: value })),
          onPriorityChange: (value) => updateSelectedTaskPeek((task) => ({ ...task, priority: value })),
          tagDraft: taskPeekTagDraft,
          setTagDraft: setTaskPeekTagDraft,
          onTagKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
              event.preventDefault()
              addTagToSelectedTaskPeek()
            }
          },
          onAddTag: addTagToSelectedTaskPeek,
          onRemoveTag: removeTagFromSelectedTaskPeek,
          onOpenDatePicker: () => {
            if (taskPeekDatePickerOpen) {
              setTaskPeekDatePickerOpen(false)
              setTaskPeekDatePanelPosition(null)
              return
            }
            openTaskPeekDatePicker()
          },
          onCloseDatePicker: () => {
            setTaskPeekDatePickerOpen(false)
            setTaskPeekDatePanelPosition(null)
          },
          onApplyDate: applyTaskPeekDate,
          onShiftDateMonth: (delta) => setTaskPeekDateViewMonth((current) => shiftCalendarMonth(current, delta)),
          getCalendarDays,
          formatCalendarDayValue,
          formatCalendarMonthLabel,
          formatDate,
          formatTaskDueDate,
          formatTaskCompletedDate,
          setSubtaskInputRef: (id, element) => {
            taskPeekSubtaskInputRefs.current[id] = element
          },
          onSubtaskTextChange: (id, value) =>
            updateSelectedTaskPeek((task) => ({
              ...task,
              subtasks: task.subtasks.map((item) => (item.id === id ? { ...item, text: value } : item)),
            })),
          onSubtaskKeyDown: (event, id) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              const currentIndex = selectedTaskPeekActiveSubtasks.findIndex((candidate) => candidate.id === id)
              const nextSubtask = currentIndex >= 0 ? selectedTaskPeekActiveSubtasks[currentIndex + 1] ?? null : null
              if (nextSubtask) {
                setPendingSubtaskFocusId(nextSubtask.id)
              } else {
                setTaskPeekSubtaskEntryOpen(true)
              }
            }
          },
          onSubtaskToggle: toggleSelectedTaskPeekSubtaskCompletion,
          onSubtaskRemoveRequest: (subtaskId, subtaskText) =>
            setTaskPeekDeleteConfirmation({
              kind: 'subtask',
              taskId: selectedTaskPeek!.id,
              subtaskId,
              subtaskText,
            }),
          onSubtaskReorderStart: setDraggedSubtaskId,
          onSubtaskReorderOver: (event, id) => {
            event.preventDefault()
            if (dragOverSubtaskId !== id) setDragOverSubtaskId(id)
          },
          onSubtaskReorderDrop: (event, id) => {
            event.preventDefault()
            if (draggedSubtaskId) reorderSelectedTaskPeekSubtasks(draggedSubtaskId, id)
            setDraggedSubtaskId(null)
            setDragOverSubtaskId(null)
          },
          onSubtaskReorderEnd: () => {
            setDraggedSubtaskId(null)
            setDragOverSubtaskId(null)
          },
          onAddSubtask: addSelectedTaskPeekSubtask,
          onToggleDeleteConfirmation: () =>
            setTaskPeekDeleteConfirmation({
              kind: 'task',
              taskId: selectedTaskPeek!.id,
            }),
          onSetAsNext: () => setTaskAsNext(selectedLifeGoal!.id, selectedTaskPeek!.id),
          onRestoreTask: (source) => toggleSelectedTaskPeekCompletion(source),
          onCompleteNext: (source) => completeTaskFromPeek('next', source),
          onCompleteTask: (source) => completeTaskFromPeek('close', source),
          onConfirmDelete: confirmTaskPeekDelete,
        }}
      />

      <AnimatePresence>
        {completionUndo ? (
          <motion.div
            className="fixed bottom-5 right-5 z-[95] max-w-[min(320px,calc(100vw-2rem))] rounded-[18px] border border-white/[0.07] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] px-3.5 py-2.5 shadow-[0_16px_34px_rgba(0,0,0,0.24)] backdrop-blur-[10px]"
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/78">{completionUndo.message}</p>
              <button
                type="button"
                onClick={undoCompletion}
                className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.76)] transition hover:text-[rgb(var(--theme-info-rgb)/0.96)]"
              >
                Undo
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <OverlayRoot open={Boolean(visionPreviewImage)}>
        {visionPreviewImage ? (
          <>
            <OverlayBackdrop
              zIndexClassName="z-[120]"
              className="bg-black/78 backdrop-blur-[6px]"
              onClick={() => setVisionPreviewImage(null)}
            />
            <ModalSurface
              zIndexClassName="z-[121]"
              containerClassName="fixed inset-0 grid place-items-center px-4 py-6 sm:px-8 sm:py-8"
              panelClassName="w-full max-w-[min(1100px,calc(100vw-2rem))] bg-transparent"
              onBackdropClick={() => setVisionPreviewImage(null)}
            >
              <div
                ref={visionPreviewSurfaceRef}
                className="flex max-h-[calc(100vh-3rem)] w-full items-center justify-center outline-none"
                tabIndex={-1}
              >
                <img
                  src={visionPreviewImage}
                  alt=""
                  className="max-h-[calc(100vh-3rem)] w-auto max-w-full rounded-[22px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
                />
              </div>
            </ModalSurface>
          </>
        ) : null}
      </OverlayRoot>

      <AnimatePresence>
        {completionPulse ? (
          <motion.div
            key={completionPulse.id}
            className="pointer-events-none fixed z-[1090] -translate-x-1/2 text-[12px] font-medium text-[rgb(var(--theme-accent-rgb)/0.82)]"
            style={{
              top: `${completionPulse.top}px`,
              left: `${completionPulse.left}px`,
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: -2 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.68, ease: 'easeOut' }}
          >
            +1 completed
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
