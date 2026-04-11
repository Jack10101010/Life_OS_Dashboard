import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { LifeGoalDetailPage } from './components/LifeGoalDetailPage'
import { LifeGoalOverviewPanel } from './LifeGoalOverviewPanel'
import { GoalDatePicker } from './GoalDatePicker'
import {
  canGoalTypeLinkToGoalType,
  formatCalendarDayValue,
  formatCalendarMonthLabel,
  formatDate,
  formatDateContextual,
  formatDateShortYear,
  formatGoalCardTitle,
  formatTaskCompletedDate,
  formatTaskDueDate,
  getCalendarDays,
  getCalendarMonthDate,
  getLifeGoalAccentBarStyle,
  getLifeGoalAnchorText,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryChipTextStyle,
  getLifeGoalCategoryColor,
  getLifeGoalCategoryDotStyle,
  getLifeGoalCategoryOptions,
  getLifeGoalEditSnapshot,
  getLifeGoalProgress,
  getLifeGoalRuntimeTasks,
  getLifeGoalStatusMeta,
  getLifeSignalBucket,
  getMilestoneTaskProgress,
  normalizeTaskRecordToLifeGoalTask,
  getSubtaskProgressDots,
  getSubtaskProgressSummary,
  getTaskPriorityOptions,
  getTodayIsoDate,
  isLifeGoalScheduled,
  isValidIsoDate,
  normalizeCategoryValue,
  shiftCalendarMonth,
  shiftIsoDate,
  sortLifeGoals,
  sortLifeGoalsByDue,
  sortLifeGoalsByName,
  sortLifeGoalsByRecentlyAdded,
  sortLifeGoalsByStatus,
  startOfCalendarMonth,
  toTitleCase,
} from './goalUtils'

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

type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'
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

type OutcomeGoalTaskRecord = Task & {
  dueDate: string | null
  description?: string
  notes?: string
  priority?: LifeGoalTaskPriority
  tags?: string[]
  subtasks?: LifeGoalTask['subtasks']
  milestoneId?: string | null
  phase?: string | null
  createdAt?: string
  updatedAt?: string | null
}

function normalizeOutcomeGoalTaskRecord(task: Task): LifeGoalTask {
  return normalizeTaskRecordToLifeGoalTask(task as OutcomeGoalTaskRecord)
}

function isDirectionalTaskRecordForGoal(task: Task, goalId: string) {
  return task.linkedDirectionId === goalId || (task.linkedDirectionId == null && task.linkedGoalId === goalId)
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

function createLifeGoalDraftFromGoal(goal: LifeGoal, runtimeTasks: LifeGoalTask[]): LifeGoalDraft {
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
      runtimeTasks.length > 0
        ? runtimeTasks.map((task) => ({
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
    linkedHabitIds: [],
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function createLifeGoalUpdateFromDraft(goal: LifeGoal, draft: LifeGoalDraft, relatedGoalIds: string[]): LifeGoal {
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
  }
}

function getOverviewGoalsViewForGoal(goal: Pick<LifeGoal, 'goalType'> | null | undefined): GoalsView {
  return (goal?.goalType ?? 'outcome') === 'directional' ? 'directional-overview' : 'life-overview'
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
  outcomeGoalCategoryFilter,
  directionalGoalCategoryFilter,
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
  onUpdateTasks,
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
  outcomeGoalCategoryFilter: string | null
  directionalGoalCategoryFilter: string | null
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
  onSetLifeGoalAsTodayTask: (goal: LifeGoal, tasksOverride?: LifeGoalTask[]) => void
  onUpdateTasks: (updater: (tasks: Task[]) => Task[]) => void
  onOpenGlobalTasks: () => void
  onOpenHabitTracker: (trackerId: string) => void
}) {
  const safeHabitTrackers = habitTrackers ?? []
  const safeLifeGoals = lifeGoals ?? []
  const safeLifeGoalCategories = lifeGoalCategories ?? []
  const safeTasks = tasks ?? []
  const goalRuntimeTaskMap = useMemo(
    () =>
      new Map(
        safeLifeGoals.map((goal) => [goal.id, getLifeGoalRuntimeTasks(goal, safeTasks)]),
      ),
    [safeLifeGoals, safeTasks],
  )
  const getRuntimeTasksForGoal = useCallback(
    (goal: LifeGoal) => goalRuntimeTaskMap.get(goal.id) ?? [],
    [goalRuntimeTaskMap],
  )
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
  const [goalOverviewFloatingOpacity, setGoalOverviewFloatingOpacity] = useState(0)
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
  const goalOverviewFloatingControlsTriggerRef = useRef<HTMLButtonElement | null>(null)
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
  const overviewLifeGoals = useMemo(
    () =>
      safeLifeGoals.filter((goal) => {
        if (goal.archivedAt) return false
        const normalizedCategory = goal.category.trim().toLowerCase()
        if (goalsView === 'directional-overview') {
          if ((goal.goalType ?? 'outcome') !== 'directional') return false
          if (!directionalGoalCategoryFilter) return true
          return normalizedCategory === directionalGoalCategoryFilter.trim().toLowerCase()
        }
        if (goalsView === 'life-overview') {
          if ((goal.goalType ?? 'outcome') !== 'outcome') return false
          if (!outcomeGoalCategoryFilter) return true
          return normalizedCategory === outcomeGoalCategoryFilter.trim().toLowerCase()
        }
        return true
      }),
    [directionalGoalCategoryFilter, goalsView, outcomeGoalCategoryFilter, safeLifeGoals],
  )

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
  const safeTasksForGoal = useMemo(
    () => (selectedLifeGoal ? safeTasks.filter((task) => task.linkedGoalId === selectedLifeGoal.id) : []),
    [safeTasks, selectedLifeGoal],
  )
  const selectedOutcomeGoalTasks = useMemo(
    () =>
      !selectedLifeGoal || selectedLifeGoal.goalType !== 'outcome'
        ? []
        : goalRuntimeTaskMap.get(selectedLifeGoal.id) ?? [],
    [goalRuntimeTaskMap, selectedLifeGoal],
  )
  const selectedDirectionalGoalTasks = useMemo(
    () =>
      !selectedLifeGoal || selectedLifeGoal.goalType !== 'directional'
        ? []
        : goalRuntimeTaskMap.get(selectedLifeGoal.id) ?? [],
    [goalRuntimeTaskMap, selectedLifeGoal],
  )
  const safeDraftRelatedGoalIds = lifeGoalDraft.relatedGoalIds ?? []
  const safeSelectedLifeGoalLinkedHabitIds = selectedLifeGoal?.linkedHabitIds ?? []

  const replaceOutcomeGoalTaskStore = useCallback(
    (goalId: string, nextTasks: LifeGoalTask[]) => {
      onUpdateTasks((current) => {
        const currentGoalRecords = current
          .filter((task) => task.linkedGoalId === goalId)
          .slice()
          .sort((left, right) => left.order - right.order) as OutcomeGoalTaskRecord[]
        const currentRecordById = new Map(currentGoalRecords.map((task) => [task.id, task]))
        const otherTasks = current.filter((task) => task.linkedGoalId !== goalId)
        const timestamp = new Date().toISOString()
        const nextRecords = nextTasks.map((task, index) => {
          const existing = currentRecordById.get(task.id)
          return {
            ...(existing ?? {}),
            id: task.id,
            text: task.text,
            order: index,
            dueDate: task.dueDate ?? null,
            starred: existing?.starred ?? false,
            important: existing?.important ?? false,
            linkedGoalId: goalId,
            linkedDirectionId: existing?.linkedDirectionId ?? null,
            completed: task.completed,
            completedAt: task.completed ? task.completedAt ?? existing?.completedAt ?? timestamp : null,
            description: task.description,
            notes: task.notes,
            priority: task.priority,
            tags: normalizeTaskTags(task.tags),
            subtasks: task.subtasks.map((subtask) => ({
              id: subtask.id,
              text: subtask.text,
              completed: subtask.completed,
            })),
            milestoneId: task.milestoneId ?? null,
            phase: normalizeLifeGoalPhaseValue(task.phase),
            createdAt: existing?.createdAt ?? task.completedAt ?? new Date(0).toISOString(),
            updatedAt: timestamp,
          } as Task
        })
        return [...otherTasks, ...nextRecords]
      })
    },
    [onUpdateTasks],
  )

  const replaceDirectionalGoalTaskStore = useCallback(
    (goalId: string, nextTasks: LifeGoalTask[]) => {
      onUpdateTasks((current) => {
        const currentGoalRecords = current
          .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
          .slice()
          .sort((left, right) => left.order - right.order) as OutcomeGoalTaskRecord[]
        const currentRecordById = new Map(currentGoalRecords.map((task) => [task.id, task]))
        const otherTasks = current.filter((task) => !isDirectionalTaskRecordForGoal(task, goalId))
        const timestamp = new Date().toISOString()
        const nextRecords = nextTasks.map((task, index) => {
          const existing = currentRecordById.get(task.id)
          return {
            ...(existing ?? {}),
            id: task.id,
            text: task.text,
            order: index,
            dueDate: task.dueDate ?? null,
            starred: existing?.starred ?? false,
            important: existing?.important ?? false,
            linkedGoalId: null,
            linkedDirectionId: goalId,
            completed: task.completed,
            completedAt: task.completed ? task.completedAt ?? existing?.completedAt ?? timestamp : null,
            description: task.description,
            notes: task.notes,
            priority: task.priority,
            tags: normalizeTaskTags(task.tags),
            subtasks: task.subtasks.map((subtask) => ({
              id: subtask.id,
              text: subtask.text,
              completed: subtask.completed,
            })),
            milestoneId: task.milestoneId ?? null,
            phase: normalizeLifeGoalPhaseValue(task.phase),
            createdAt: existing?.createdAt ?? task.completedAt ?? new Date(0).toISOString(),
            updatedAt: timestamp,
          } as Task
        })
        return [...otherTasks, ...nextRecords]
      })
    },
    [onUpdateTasks],
  )

  const updateOutcomeGoalTask = useCallback(
    (taskId: string, updater: (task: LifeGoalTask) => LifeGoalTask) => {
      const goalId =
        selectedLifeGoal?.goalType === 'outcome'
          ? selectedLifeGoal.id
          : (safeTasks.find((task) => task.id === taskId)?.linkedGoalId ?? null)
      if (!goalId) return
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const nextTasks = currentTasks.map((task) => (task.id === taskId ? updater(task) : task))
      replaceOutcomeGoalTaskStore(goalId, nextTasks)
    },
    [replaceOutcomeGoalTaskStore, safeTasks, selectedLifeGoal, selectedOutcomeGoalTasks],
  )

  const createOutcomeGoalTask = useCallback(
    (goalId: string, seed?: Partial<LifeGoalTask>) => {
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const baseTask = createEmptyLifeGoalTask()
      const nextTask: LifeGoalTask = {
        ...baseTask,
        ...seed,
        id: seed?.id ?? baseTask.id,
        text: seed?.text ?? '',
        milestoneId: seed?.milestoneId ?? null,
        phase: normalizeLifeGoalPhaseValue(seed?.phase),
        description: seed?.description ?? '',
        notes: seed?.notes ?? '',
        dueDate: seed?.dueDate ?? null,
        priority: seed?.priority ?? 'none',
        tags: normalizeTaskTags(seed?.tags ?? []),
        subtasks: seed?.subtasks ?? [],
        completed: seed?.completed ?? false,
        completedAt: seed?.completed ? seed.completedAt ?? new Date().toISOString() : null,
      }
      const nextTasks = [...currentTasks, nextTask]
      replaceOutcomeGoalTaskStore(goalId, nextTasks)
      return nextTask
    },
    [replaceOutcomeGoalTaskStore, safeTasks, selectedLifeGoal, selectedOutcomeGoalTasks],
  )

  const deleteOutcomeGoalTask = useCallback(
    (taskId: string) => {
      const goalId =
        selectedLifeGoal?.goalType === 'outcome'
          ? selectedLifeGoal.id
          : (safeTasks.find((task) => task.id === taskId)?.linkedGoalId ?? null)
      if (!goalId) return
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const nextTasks = currentTasks.filter((task) => task.id !== taskId)
      replaceOutcomeGoalTaskStore(goalId, nextTasks)
    },
    [replaceOutcomeGoalTaskStore, safeTasks, selectedLifeGoal, selectedOutcomeGoalTasks],
  )

  const reorderOutcomeGoalTask = useCallback(
    (goalId: string, sourceTaskId: string, targetTaskId: string) => {
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const sourceIndex = currentTasks.findIndex((task) => task.id === sourceTaskId)
      const targetIndex = currentTasks.findIndex((task) => task.id === targetTaskId)
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return

      const reordered = currentTasks.slice()
      const [movedTask] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, movedTask)
      replaceOutcomeGoalTaskStore(goalId, reordered)
    },
    [replaceOutcomeGoalTaskStore, safeTasks, selectedLifeGoal, selectedOutcomeGoalTasks],
  )

  const toggleOutcomeGoalTaskCompletion = useCallback(
    (taskId: string) => {
      updateOutcomeGoalTask(taskId, (task) => {
        const nextCompleted = !task.completed
        return {
          ...task,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : null,
        }
      })
    },
    [updateOutcomeGoalTask],
  )

  const restoreOutcomeGoalTask = useCallback(
    (taskId: string) => {
      updateOutcomeGoalTask(taskId, (task) => ({
        ...task,
        completed: false,
        completedAt: null,
      }))
    },
    [updateOutcomeGoalTask],
  )

  const updateDirectionalGoalTask = useCallback(
    (taskId: string, updater: (task: LifeGoalTask) => LifeGoalTask) => {
      const selectedGoalId = selectedLifeGoal?.goalType === 'directional' ? selectedLifeGoal.id : null
      const sourceRecord = safeTasks.find((task) => task.id === taskId) ?? null
      const goalId =
        selectedGoalId ??
        sourceRecord?.linkedDirectionId ??
        (sourceRecord?.linkedGoalId && sortedLifeGoals.some((goal) => goal.id === sourceRecord.linkedGoalId && (goal.goalType ?? 'outcome') === 'directional')
          ? sourceRecord.linkedGoalId
          : null)
      if (!goalId) return
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
          ? selectedDirectionalGoalTasks
          : safeTasks
              .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const nextTasks = currentTasks.map((task) => (task.id === taskId ? updater(task) : task))
      replaceDirectionalGoalTaskStore(goalId, nextTasks)
    },
    [replaceDirectionalGoalTaskStore, safeTasks, selectedDirectionalGoalTasks, selectedLifeGoal, sortedLifeGoals],
  )

  const createDirectionalGoalTask = useCallback(
    (goalId: string, seed?: Partial<LifeGoalTask>) => {
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
          ? selectedDirectionalGoalTasks
          : safeTasks
              .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const baseTask = createEmptyLifeGoalTask()
      const nextTask: LifeGoalTask = {
        ...baseTask,
        ...seed,
        id: seed?.id ?? baseTask.id,
        text: seed?.text ?? '',
        milestoneId: seed?.milestoneId ?? null,
        phase: normalizeLifeGoalPhaseValue(seed?.phase),
        description: seed?.description ?? '',
        notes: seed?.notes ?? '',
        dueDate: seed?.dueDate ?? null,
        priority: seed?.priority ?? 'none',
        tags: normalizeTaskTags(seed?.tags ?? []),
        subtasks: seed?.subtasks ?? [],
        completed: seed?.completed ?? false,
        completedAt: seed?.completed ? seed.completedAt ?? new Date().toISOString() : null,
      }
      replaceDirectionalGoalTaskStore(goalId, [...currentTasks, nextTask])
      return nextTask
    },
    [replaceDirectionalGoalTaskStore, safeTasks, selectedDirectionalGoalTasks, selectedLifeGoal],
  )

  const deleteDirectionalGoalTask = useCallback(
    (taskId: string) => {
      const selectedGoalId = selectedLifeGoal?.goalType === 'directional' ? selectedLifeGoal.id : null
      const sourceRecord = safeTasks.find((task) => task.id === taskId) ?? null
      const goalId =
        selectedGoalId ??
        sourceRecord?.linkedDirectionId ??
        (sourceRecord?.linkedGoalId && sortedLifeGoals.some((goal) => goal.id === sourceRecord.linkedGoalId && (goal.goalType ?? 'outcome') === 'directional')
          ? sourceRecord.linkedGoalId
          : null)
      if (!goalId) return
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
          ? selectedDirectionalGoalTasks
          : safeTasks
              .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      replaceDirectionalGoalTaskStore(goalId, currentTasks.filter((task) => task.id !== taskId))
    },
    [replaceDirectionalGoalTaskStore, safeTasks, selectedDirectionalGoalTasks, selectedLifeGoal, sortedLifeGoals],
  )

  const restoreDirectionalGoalTask = useCallback(
    (taskId: string) => {
      updateDirectionalGoalTask(taskId, (task) => ({
        ...task,
        completed: false,
        completedAt: null,
      }))
    },
    [updateDirectionalGoalTask],
  )
  const selectedGoalTaskSource = useMemo(
    () =>
      !selectedLifeGoal
        ? []
        : selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : selectedDirectionalGoalTasks,
    [selectedDirectionalGoalTasks, selectedLifeGoal, selectedOutcomeGoalTasks],
  )
  const selectedLifeGoalProgress = useMemo(
    () => (selectedLifeGoal ? getLifeGoalProgress(selectedLifeGoal, selectedGoalTaskSource) : null),
    [selectedGoalTaskSource, selectedLifeGoal],
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
    () => (selectedLifeGoal && selectedMilestone ? selectedGoalTaskSource.filter((task) => task.milestoneId === selectedMilestone.id) : []),
    [selectedGoalTaskSource, selectedLifeGoal, selectedMilestone],
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
  const selectedRoadmapSections = useRoadmapSections(selectedGoalTaskSource)
  const selectedTaskPeek = useMemo(
    () => (selectedLifeGoal && selectedTaskPeekId ? selectedGoalTaskSource.find((task) => task.id === selectedTaskPeekId) ?? null : null),
    [selectedGoalTaskSource, selectedLifeGoal, selectedTaskPeekId],
  )
  const selectedTaskPeekActiveSubtasks = useMemo(
    () => (selectedTaskPeek ? selectedTaskPeek.subtasks.filter((subtask) => !subtask.completed) : []),
    [selectedTaskPeek],
  )
  const selectedTaskPeekCompletedSubtasks = useMemo(
    () => (selectedTaskPeek ? selectedTaskPeek.subtasks.filter((subtask) => subtask.completed) : []),
    [selectedTaskPeek],
  )
  const selectedTaskPeekMilestoneOptions = useMemo(() => {
    if (!(selectedLifeGoal?.goalType === 'outcome' && selectedLifeGoal.milestonesEnabled)) return []
    const orderedMilestones = (selectedLifeGoal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
    const currentMilestone =
      orderedMilestones.find((candidate) => !candidate.completed) ??
      (orderedMilestones.length > 0 ? orderedMilestones[orderedMilestones.length - 1] : null)
    return [
      { value: '', label: 'No milestone' },
      ...orderedMilestones.map((milestone, index) => ({
        value: milestone.id,
        label: `${index + 1}. ${milestone.title.trim() || `Milestone ${index + 1}`}${
          currentMilestone?.id === milestone.id ? ' — Current' : ''
        }`,
      })),
    ]
  }, [selectedLifeGoal?.goalType, selectedLifeGoal?.milestones, selectedLifeGoal?.milestonesEnabled])
  const selectedTaskPeekRelativeDueMeta = useMemo(
    () => (selectedTaskPeek?.dueDate ? getRelativeDueMeta(selectedTaskPeek.dueDate) : null),
    [selectedTaskPeek?.dueDate],
  )
  const selectedGoalCategory = useMemo(() => selectedLifeGoal?.category.trim() ?? '', [selectedLifeGoal])
  const selectedGoalCategoryColor = useMemo(
    () => (selectedGoalCategory ? getLifeGoalCategoryColor(selectedGoalCategory, lifeGoalCategories) : 'neutral'),
    [lifeGoalCategories, selectedGoalCategory],
  )
  const selectedGoalAnchorText = useMemo(
    () => getLifeGoalAnchorText(selectedLifeGoal?.whyItMatters ?? ''),
    [selectedLifeGoal?.whyItMatters],
  )
  const selectedGoalType = selectedLifeGoal?.goalType ?? 'outcome'
  const selectedGoalIsOutcome = selectedGoalType === 'outcome'
  const selectedGoalIsDirectional = selectedGoalType === 'directional'
  const selectedGoalMilestonesEnabled = selectedGoalIsOutcome && Boolean(selectedLifeGoal?.milestonesEnabled)
  const selectedCurrentMilestone = useMemo(
    () => getCurrentGoalMilestone(selectedLifeGoalMilestones),
    [selectedLifeGoalMilestones],
  )
  const selectedCompletedMilestoneCount = useMemo(
    () => selectedLifeGoalMilestones.filter((milestone) => milestone.completed).length,
    [selectedLifeGoalMilestones],
  )
  const selectedMilestoneOptions = useMemo(
    () =>
      selectedGoalMilestonesEnabled
        ? getMilestoneSelectOptions(selectedLifeGoalMilestones, selectedCurrentMilestone?.id ?? null)
        : [],
    [selectedCurrentMilestone?.id, selectedGoalMilestonesEnabled, selectedLifeGoalMilestones],
  )
  const selectedMilestoneDateTarget = useMemo(
    () =>
      milestoneDatePickerMilestoneId
        ? selectedLifeGoalMilestones.find((milestone) => milestone.id === milestoneDatePickerMilestoneId) ?? null
        : null,
    [milestoneDatePickerMilestoneId, selectedLifeGoalMilestones],
  )
  const selectedGoalRelatedGoals = useMemo(() => {
    if (!selectedLifeGoal) return []
    const seen = new Set<string>()
    return (selectedLifeGoal.relatedGoalIds ?? [])
      .map((goalId) => safeLifeGoals.find((goal) => goal.id === goalId && goal.id !== selectedLifeGoal.id && !goal.archivedAt))
      .filter((goal): goal is LifeGoal => Boolean(goal))
      .filter((goal) => {
        if (seen.has(goal.id)) return false
        seen.add(goal.id)
        return true
      })
  }, [safeLifeGoals, selectedLifeGoal])
  const selectedGoalLinkedDirectionalTasks = useMemo(
    () =>
      selectedLifeGoal?.goalType === 'directional'
        ? selectedDirectionalGoalTasks
        : [],
    [selectedDirectionalGoalTasks, selectedLifeGoal],
  )
  const selectedGoalSupportingHabits = useMemo(
    () =>
      selectedLifeGoal
        ? safeHabitTrackers
            .filter((tracker) => (tracker.linkedGoalIds ?? []).includes(selectedLifeGoal.id))
            .filter((tracker, index, trackers) => trackers.findIndex((candidate) => candidate.id === tracker.id) === index)
        : [],
    [safeHabitTrackers, selectedLifeGoal],
  )
  const selectedGoalParentGoals = useMemo(
    () =>
      selectedLifeGoal
        ? safeLifeGoals
            .filter((goal) => !goal.archivedAt && goal.id !== selectedLifeGoal.id)
            .filter((goal) => (goal.relatedGoalIds ?? []).includes(selectedLifeGoal.id))
            .filter((goal, index, goals) => goals.findIndex((candidate) => candidate.id === goal.id) === index)
        : [],
    [safeLifeGoals, selectedLifeGoal],
  )
  const selectedGoalDirectionalMetrics = useMemo(() => {
    const relatedGoals = selectedGoalRelatedGoals
    const linkedDirectionalTasks = selectedGoalLinkedDirectionalTasks
    const activeRelatedGoalsCount = relatedGoals.filter((goal) => goal.status !== 'complete').length
    const completedRelatedGoalsCount = relatedGoals.filter((goal) => goal.status === 'complete').length
    const pausedRelatedGoalsCount = relatedGoals.filter((goal) => goal.status === 'paused').length
    const maxVisibleLinkedGoals = 4
    const visibleRelatedGoals = relatedGoals.slice(0, maxVisibleLinkedGoals)
    const hiddenRelatedGoalsCount = Math.max(0, relatedGoals.length - visibleRelatedGoals.length)
    const visibleParentGoals = selectedGoalParentGoals.slice(0, 2)
    const hiddenParentGoalsCount = Math.max(0, selectedGoalParentGoals.length - visibleParentGoals.length)
    const recentCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
    const uniqueTasks = linkedDirectionalTasks
    const recentDirectionalActionCount = uniqueTasks.filter((task) => task.completedAt && Date.parse(task.completedAt) >= recentCutoff).length
    const incompleteDirectionalTasks = uniqueTasks
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const ad = a.dueDate ?? ''
        const bd = b.dueDate ?? ''
        if (ad !== bd) return ad.localeCompare(bd)
        return a.text.localeCompare(b.text)
      })
    const visibleDirectionalTasks = incompleteDirectionalTasks.slice(0, 6)
    const hiddenDirectionalTasksCount = Math.max(0, incompleteDirectionalTasks.length - visibleDirectionalTasks.length)
    const visibleSupportingHabits = selectedGoalSupportingHabits.slice(0, 4)
    const hiddenSupportingHabitsCount = Math.max(0, selectedGoalSupportingHabits.length - visibleSupportingHabits.length)
    return {
      activeRelatedGoalsCount,
      completedRelatedGoalsCount,
      pausedRelatedGoalsCount,
      visibleRelatedGoals,
      hiddenRelatedGoalsCount,
      visibleParentGoals,
      hiddenParentGoalsCount,
      visibleDirectionalTasks,
      hiddenDirectionalTasksCount,
      recentDirectionalActionCount,
      visibleSupportingHabits,
      hiddenSupportingHabitsCount,
    }
  }, [selectedGoalLinkedDirectionalTasks, selectedGoalParentGoals, selectedGoalRelatedGoals, selectedGoalSupportingHabits])
  const selectedGoalRoadmapDerived = useMemo(() => {
    const currentMilestone = selectedCurrentMilestone
    const roadmapSections = selectedRoadmapSections
    const sortedUpcomingTasks = sortTasksForDisplay(roadmapSections.upcoming, taskListSortMode)
    const sortedCompletedTasks = sortTasksForDisplay(roadmapSections.completed, taskListSortMode)
    const sortedPlannedTasks = roadmapSections.current ? [roadmapSections.current, ...sortedUpcomingTasks] : sortedUpcomingTasks
    const explicitlyAssignedTasksByMilestone = new Map(
      selectedLifeGoalMilestones.map((milestone) => [
        milestone.id,
        selectedGoalTaskSource.filter((task) => task.milestoneId === milestone.id),
      ]),
    )
    const roadmapTasksGroupedByMilestone =
      selectedGoalIsOutcome && selectedGoalMilestonesEnabled
        ? getRoadmapTasksGroupedByMilestone(selectedLifeGoalMilestones, sortedPlannedTasks, currentMilestone?.id ?? null)
        : []
    const roadmapRemainingCount = roadmapSections.current ? roadmapSections.upcoming.length + 1 : 0
    const roadmapHasHighPriorityTasks =
      (roadmapSections.current ? getPriorityScore(roadmapSections.current) === 3 : false) ||
      roadmapSections.upcoming.some((task) => getPriorityScore(task) === 3)
    const roadmapHasTaggedTasks = selectedGoalTaskSource.some((task) => normalizeTaskTags(task.tags).length > 0)
    const goalProgress = selectedLifeGoalProgress
    const goalReadyToComplete = goalProgress
      ? goalProgress.totalTasks > 0 &&
        goalProgress.completedTasks === goalProgress.totalTasks &&
        selectedLifeGoal?.status !== 'complete'
      : false
    return {
      currentMilestone,
      sortedUpcomingTasks,
      sortedCompletedTasks,
      sortedPlannedTasks,
      explicitlyAssignedTasksByMilestone,
      roadmapTasksGroupedByMilestone,
      roadmapRemainingCount,
      roadmapHasHighPriorityTasks,
      roadmapHasTaggedTasks,
      goalReadyToComplete,
    }
  }, [
    selectedCurrentMilestone,
    selectedGoalIsOutcome,
    selectedGoalMilestonesEnabled,
    selectedGoalTaskSource,
    selectedLifeGoal?.status,
    selectedLifeGoalMilestones,
    selectedLifeGoalProgress,
    selectedRoadmapSections,
    taskListSortMode,
  ])
  const selectedRoadmapPanelView = selectedLifeGoal ? roadmapPanelViewByGoal[selectedLifeGoal.id] ?? 'tasks' : 'tasks'
  const selectedShowMilestoneProgressView = selectedGoalIsOutcome && selectedGoalMilestonesEnabled
  const selectedRoadmapProgressView =
    selectedShowMilestoneProgressView
      ? selectedRoadmapPanelView
      : selectedRoadmapPanelView === 'notes'
        ? 'notes'
        : 'tasks'
  const taskPeekRefs = useMemo(
    () => ({
      panelRef: taskPeekPanelRef,
      titleRef: taskPeekTitleRef,
      dateFieldRef: taskPeekDateFieldRef,
      datePanelRef: taskPeekDatePanelRef,
      subtaskDraftRef: taskPeekSubtaskDraftRef,
      deleteDialogRef: taskPeekDeleteDialogRef,
    }),
    [],
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

  const updateSelectedLifeGoalNotes = useCallback((value: string) => {
    if (!selectedLifeGoal) return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      notes: value,
      updatedAt: new Date().toISOString(),
    }))
  }, [onUpdateLifeGoal, selectedLifeGoal])

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
      selectedGoalTaskSource.find((task) => !task.completed)?.id ??
      selectedGoalTaskSource[selectedGoalTaskSource.length - 1]?.id ??
      null
    setSelectedRoadmapTaskId(nextSelectedTaskId)
  }, [selectedGoalTaskSource, selectedLifeGoal])

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

    if (!selectedGoalTaskSource.some((task) => task.id === selectedTaskPeekId)) {
      setCreatingTaskPeekId(null)
      setSelectedTaskPeekId(null)
      setTaskPeekSubtaskDraft('')
      setTaskPeekTagDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
    }
  }, [selectedGoalTaskSource, selectedLifeGoal, selectedTaskPeekId])

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
        ? createLifeGoalUpdateFromDraft(selectedLifeGoal, lifeGoalDraft, allowedDraftRelatedGoalIds)
        : null,
    [allowedDraftRelatedGoalIds, draftTasks, lifeGoalComposerMode, lifeGoalDraft, selectedLifeGoal],
  )
  const editDraftGoalSnapshot = useMemo(
    () => (editDraftGoalPayload ? getLifeGoalEditSnapshot(editDraftGoalPayload, draftTasks) : null),
    [draftTasks, editDraftGoalPayload],
  )
  const selectedLifeGoalEditSnapshot = useMemo(
    () =>
      lifeGoalComposerMode === 'edit' && selectedLifeGoal
        ? getLifeGoalEditSnapshot(selectedLifeGoal, getRuntimeTasksForGoal(selectedLifeGoal))
        : null,
    [getRuntimeTasksForGoal, lifeGoalComposerMode, selectedLifeGoal],
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
      if (selectedLifeGoal.goalType === 'outcome') {
        replaceOutcomeGoalTaskStore(editingLifeGoalId, draftTasks)
      } else {
        replaceDirectionalGoalTaskStore(editingLifeGoalId, draftTasks)
      }
    }

  }, [
    draftTasks,
    editDraftGoalPayload,
    editDraftGoalSnapshot,
    editingLifeGoalId,
    lifeGoalComposerMode,
    lifeGoalComposerOpen,
    lifeGoalDraft.title,
    lifeGoalDraft.whyItMatters,
    onUpdateLifeGoal,
    replaceDirectionalGoalTaskStore,
    replaceOutcomeGoalTaskStore,
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
    if (nextGoal.goalType === 'outcome') {
      replaceOutcomeGoalTaskStore(nextGoal.id, createTasks)
    } else {
      replaceDirectionalGoalTaskStore(nextGoal.id, createTasks)
    }
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
    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if (!goal) return
    if ((goal.goalType ?? 'outcome') === 'outcome') {
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const fromIndex = currentTasks.findIndex((task) => task.id === taskId)
      if (fromIndex === -1) return
      const targetTask = currentTasks[fromIndex]
      if (targetTask.completed) return
      const firstIncompleteIndex = currentTasks.findIndex((task) => !task.completed)
      if (firstIncompleteIndex === -1 || fromIndex === firstIncompleteIndex) return

      const nextTasks = currentTasks.slice()
      const [movedTask] = nextTasks.splice(fromIndex, 1)
      nextTasks.splice(firstIncompleteIndex, 0, movedTask)
      replaceOutcomeGoalTaskStore(goalId, nextTasks)
      setSelectedRoadmapTaskId(taskId)
      return
    }

    const currentTasks =
      selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
        ? selectedDirectionalGoalTasks
        : safeTasks
            .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((task) => normalizeOutcomeGoalTaskRecord(task))
    const fromIndex = currentTasks.findIndex((task) => task.id === taskId)
    if (fromIndex === -1) return
    const targetTask = currentTasks[fromIndex]
    if (targetTask.completed) return
    const firstIncompleteIndex = currentTasks.findIndex((task) => !task.completed)
    if (firstIncompleteIndex === -1 || fromIndex === firstIncompleteIndex) return

    const nextTasks = currentTasks.slice()
    const [movedTask] = nextTasks.splice(fromIndex, 1)
    nextTasks.splice(firstIncompleteIndex, 0, movedTask)
    replaceDirectionalGoalTaskStore(goalId, nextTasks)
    setSelectedRoadmapTaskId(taskId)
  }

  const reorderGoalTask = (goalId: string, draggedTaskId: string, targetTaskId: string) => {
    if (draggedTaskId === targetTaskId) return

    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if ((goal?.goalType ?? 'outcome') === 'outcome') {
      const currentTasks =
        selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
          ? selectedOutcomeGoalTasks
          : safeTasks
              .filter((task) => task.linkedGoalId === goalId)
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const upcomingTasks = currentTasks.filter((task) => !task.completed)
      const visibleUpcomingIds = upcomingTasks.map((task) => task.id)
      const fromIndex = visibleUpcomingIds.indexOf(draggedTaskId)
      const toIndex = visibleUpcomingIds.indexOf(targetTaskId)
      if (fromIndex === -1 || toIndex === -1) return

      const reorderedUpcoming = [...upcomingTasks]
      const [movedTask] = reorderedUpcoming.splice(fromIndex, 1)
      reorderedUpcoming.splice(toIndex, 0, movedTask)
      let upcomingCursor = 0
      const nextTasks = currentTasks.map((task) => {
        if (task.completed) return task
        const nextTask = reorderedUpcoming[upcomingCursor]
        upcomingCursor += 1
        return nextTask
      })
      replaceOutcomeGoalTaskStore(goalId, nextTasks)
      setSelectedRoadmapTaskId(draggedTaskId)
      return
    }

    const currentTasks =
      selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
        ? selectedDirectionalGoalTasks
        : safeTasks
            .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((task) => normalizeOutcomeGoalTaskRecord(task))
    const upcomingTasks = currentTasks.filter((task) => !task.completed)
    const visibleUpcomingIds = upcomingTasks.map((task) => task.id)
    const fromIndex = visibleUpcomingIds.indexOf(draggedTaskId)
    const toIndex = visibleUpcomingIds.indexOf(targetTaskId)
    if (fromIndex === -1 || toIndex === -1) return

    const reorderedUpcoming = [...upcomingTasks]
    const [movedTask] = reorderedUpcoming.splice(fromIndex, 1)
    reorderedUpcoming.splice(toIndex, 0, movedTask)
    let upcomingCursor = 0
    const nextTasks = currentTasks.map((task) => {
      if (task.completed) return task
      const nextTask = reorderedUpcoming[upcomingCursor]
      upcomingCursor += 1
      return nextTask
    })
    replaceDirectionalGoalTaskStore(goalId, nextTasks)
    setSelectedRoadmapTaskId(draggedTaskId)
  }

  const toggleTaskCompletion = (goalId: string, taskId: string, sourceElement?: HTMLElement | null) => {
    const sourceGoal = sortedLifeGoals.find((goal) => goal.id === goalId)
    const sourceGoalType = sourceGoal?.goalType ?? 'outcome'
    const isTopLevelGoal = sourceGoalType === 'outcome' || sourceGoalType === 'directional'

    if (sourceGoal && isTopLevelGoal) {
      const sourceTasks =
        selectedLifeGoal?.id === goalId
          ? selectedLifeGoal.goalType === 'outcome'
            ? selectedOutcomeGoalTasks
            : selectedDirectionalGoalTasks
          : safeTasks
              .filter((task) =>
                sourceGoalType === 'outcome' ? task.linkedGoalId === goalId : isDirectionalTaskRecordForGoal(task, goalId),
              )
              .slice()
              .sort((left, right) => left.order - right.order)
              .map((task) => normalizeOutcomeGoalTaskRecord(task))
      const currentTask = sourceTasks.find((task) => task.id === taskId)
      if (!currentTask) return

      const updatedTasks = sourceTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date().toISOString() : null,
            }
          : task,
      )
      const nextTaskId = updatedTasks.find((task) => !task.completed)?.id ?? null
      if (!currentTask.completed) {
        setSelectedRoadmapTaskId(nextTaskId)
        if (selectedTaskPeekId === taskId) {
          setSelectedTaskPeekId(nextTaskId)
          setTaskPeekSubtaskDraft('')
        }
      } else if (selectedRoadmapTaskId === taskId) {
        setSelectedRoadmapTaskId(taskId)
      }
      if (sourceGoalType === 'outcome') {
        replaceOutcomeGoalTaskStore(goalId, updatedTasks)
      } else {
        replaceDirectionalGoalTaskStore(goalId, updatedTasks)
      }

      if (!currentTask.completed) {
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
      return
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

  const updateLifeGoalTask = useCallback((goalId: string, taskId: string, updater: (task: LifeGoalTask) => LifeGoalTask) => {
    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if ((goal?.goalType ?? 'outcome') === 'outcome') {
      updateOutcomeGoalTask(taskId, updater)
      return
    }
    updateDirectionalGoalTask(taskId, updater)
  }, [sortedLifeGoals, updateDirectionalGoalTask, updateOutcomeGoalTask])

  const openTaskPeek = useCallback((taskId: string, trigger?: HTMLElement | null) => {
    taskPeekTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setCreatingTaskPeekId(null)
    setTaskPeekLockedMilestoneContext(null)
    setSelectedTaskPeekId(taskId)
    setSelectedRoadmapTaskId(taskId)
    setTaskPeekSubtaskDraft('')
  }, [])

  const openNewTaskPeek = useCallback((
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
    if (selectedLifeGoal.goalType === 'outcome') {
      createOutcomeGoalTask(selectedLifeGoal.id, nextTask)
    } else {
      createDirectionalGoalTask(selectedLifeGoal.id, nextTask)
    }
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
  }, [createDirectionalGoalTask, createOutcomeGoalTask, selectedLifeGoal])

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

  const closeTaskPeek = useCallback(() => {
    if (selectedLifeGoal && selectedTaskPeek && creatingTaskPeekId === selectedTaskPeek.id && isLifeGoalTaskDraftEmpty(selectedTaskPeek)) {
      if (selectedLifeGoal.goalType === 'outcome') {
        deleteOutcomeGoalTask(selectedTaskPeek.id)
      } else {
        deleteDirectionalGoalTask(selectedTaskPeek.id)
      }
      if (selectedRoadmapTaskId === selectedTaskPeek.id) {
        setSelectedRoadmapTaskId(null)
      }
    }
    setCreatingTaskPeekId(null)
    setTaskPeekLockedMilestoneContext(null)
    setSelectedTaskPeekId(null)
    setTaskPeekSubtaskDraft('')
  }, [creatingTaskPeekId, deleteDirectionalGoalTask, deleteOutcomeGoalTask, selectedLifeGoal, selectedRoadmapTaskId, selectedTaskPeek])

  const updateSelectedTaskPeek = useCallback((updater: (task: LifeGoalTask) => LifeGoalTask) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    updateLifeGoalTask(selectedLifeGoal.id, selectedTaskPeekId, updater)
  }, [selectedLifeGoal, selectedTaskPeekId, updateLifeGoalTask])

  const addTagToSelectedTaskPeek = useCallback(() => {
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
  }, [taskPeekTagDraft, updateSelectedTaskPeek])

  const removeTagFromSelectedTaskPeek = useCallback((tagToRemove: string) => {
    const normalizedTag = normalizeTaskTag(tagToRemove)
    updateSelectedTaskPeek((task) => ({
      ...task,
      tags: normalizeTaskTags(task.tags).filter((tag) => tag !== normalizedTag),
    }))
  }, [updateSelectedTaskPeek])

  const completeTaskById = useCallback((goalId: string, taskId: string, mode: 'close' | 'next' = 'close', sourceElement?: HTMLElement | null) => {
    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if (!goal) return

    const goalTasks =
      (goal.goalType ?? 'outcome') === 'outcome'
        ? (
            selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'outcome'
              ? selectedOutcomeGoalTasks
              : safeTasks
                  .filter((task) => task.linkedGoalId === goalId)
                  .slice()
                  .sort((left, right) => left.order - right.order)
                  .map((task) => normalizeOutcomeGoalTaskRecord(task))
          )
        : (
            selectedLifeGoal?.id === goalId && selectedLifeGoal.goalType === 'directional'
              ? selectedDirectionalGoalTasks
              : safeTasks
                  .filter((task) => isDirectionalTaskRecordForGoal(task, goalId))
                  .slice()
                  .sort((left, right) => left.order - right.order)
                  .map((task) => normalizeOutcomeGoalTaskRecord(task))
          )

    const currentTaskIndex = goalTasks.findIndex((task) => task.id === taskId)
    if (currentTaskIndex === -1) return

    const currentTask = goalTasks[currentTaskIndex]
    const updatedTasks = goalTasks.map((task) =>
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
  }, [closeTaskPeek, safeTasks, selectedDirectionalGoalTasks, selectedLifeGoal, selectedOutcomeGoalTasks, sortedLifeGoals, toggleTaskCompletion])

  const completeTaskFromPeek = useCallback((mode: 'close' | 'next', sourceElement?: HTMLElement | null) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    completeTaskById(selectedLifeGoal.id, selectedTaskPeekId, mode, sourceElement)
  }, [completeTaskById, selectedLifeGoal, selectedTaskPeekId])

  const toggleSelectedTaskPeekCompletion = useCallback((sourceElement?: HTMLElement | null) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    toggleTaskCompletion(selectedLifeGoal.id, selectedTaskPeekId, sourceElement)
  }, [selectedLifeGoal, selectedTaskPeekId, toggleTaskCompletion])

  const addSelectedTaskPeekSubtask = useCallback(() => {
    const text = taskPeekSubtaskDraft.trim()
    if (!text) return
    const nextSubtaskId = `life-goal-subtask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    updateSelectedTaskPeek((task) => ({
      ...task,
      subtasks: [...task.subtasks, { id: nextSubtaskId, text, completed: false }],
    }))
    setTaskPeekSubtaskDraft('')
    setTaskPeekSubtaskEntryOpen(false)
  }, [taskPeekSubtaskDraft, updateSelectedTaskPeek])

  const focusNextIncompleteSubtask = useCallback((subtasks: LifeGoalTask['subtasks'], fromSubtaskId: string) => {
    const currentIndex = subtasks.findIndex((subtask) => subtask.id === fromSubtaskId)
    if (currentIndex === -1) return
    const nextIncomplete =
      subtasks.find((subtask, index) => index > currentIndex && !subtask.completed) ??
      subtasks.find((subtask) => !subtask.completed && subtask.id !== fromSubtaskId)
    if (nextIncomplete) {
      setPendingSubtaskFocusId(nextIncomplete.id)
    }
  }, [])

  const toggleSelectedTaskPeekSubtaskCompletion = useCallback((subtaskId: string, sourceElement?: HTMLElement | null) => {
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
  }, [clearCompletionUndo, completionUndo, focusNextIncompleteSubtask, selectedLifeGoal, selectedTaskPeek, showCompletionPulse, showCompletionUndo, updateSelectedTaskPeek])

  const reorderSelectedTaskPeekSubtasks = useCallback((draggedId: string, targetId: string) => {
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
  }, [updateSelectedTaskPeek])

  const deleteSelectedTaskPeek = useCallback(() => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    const currentTasks = selectedLifeGoal.goalType === 'outcome' ? selectedOutcomeGoalTasks : selectedDirectionalGoalTasks
    const fallbackTaskId =
      currentTasks.find((task) => task.id !== selectedTaskPeekId && !task.completed)?.id ??
      currentTasks.find((task) => task.id !== selectedTaskPeekId)?.id ??
      null

    if (selectedLifeGoal.goalType === 'outcome') {
      deleteOutcomeGoalTask(selectedTaskPeekId)
    } else {
      deleteDirectionalGoalTask(selectedTaskPeekId)
    }

    setTaskPeekDeleteConfirmation(null)
    if (creatingTaskPeekId === selectedTaskPeekId) {
      setCreatingTaskPeekId(null)
    }
    setSelectedTaskPeekId(fallbackTaskId)
    setSelectedRoadmapTaskId(fallbackTaskId)
    if (!fallbackTaskId) {
      closeTaskPeek()
    }
  }, [closeTaskPeek, creatingTaskPeekId, deleteDirectionalGoalTask, deleteOutcomeGoalTask, selectedDirectionalGoalTasks, selectedLifeGoal, selectedOutcomeGoalTasks, selectedTaskPeekId])

  const deleteSelectedTaskPeekSubtask = useCallback((subtaskId: string) => {
    updateSelectedTaskPeek((task) => ({
      ...task,
      subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }))
    setTaskPeekDeleteConfirmation(null)
  }, [updateSelectedTaskPeek])

  const confirmTaskPeekDelete = useCallback(() => {
    if (!taskPeekDeleteConfirmation) return
    if (taskPeekDeleteConfirmation.kind === 'task') {
      deleteSelectedTaskPeek()
      return
    }
    deleteSelectedTaskPeekSubtask(taskPeekDeleteConfirmation.subtaskId)
  }, [deleteSelectedTaskPeek, deleteSelectedTaskPeekSubtask, taskPeekDeleteConfirmation])

  const closeTaskPeekDeleteConfirmation = useCallback(() => {
    setTaskPeekDeleteConfirmation(null)
  }, [])

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
    const goal = sortedLifeGoals.find((item) => item.id === goalId)
    if ((goal?.goalType ?? 'outcome') === 'outcome') {
      restoreOutcomeGoalTask(taskId)
    } else {
      restoreDirectionalGoalTask(taskId)
    }
    setSelectedRoadmapTaskId(taskId)
  }

  const undoCompletion = () => {
    if (!completionUndo) return

    if (completionUndo.kind === 'task') {
      const goal = sortedLifeGoals.find((item) => item.id === completionUndo.goalId)
      if ((goal?.goalType ?? 'outcome') === 'outcome') {
        restoreOutcomeGoalTask(completionUndo.taskId)
      } else {
        restoreDirectionalGoalTask(completionUndo.taskId)
      }
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

  const openTaskPeekDatePicker = useCallback(() => {
    setTaskPeekDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(selectedTaskPeek?.dueDate ?? undefined)))
    setTaskPeekDatePickerOpen(true)
  }, [selectedTaskPeek?.dueDate])

  const applyTaskPeekDate = useCallback((date: string) => {
    updateSelectedTaskPeek((task) => ({
      ...task,
      dueDate: date || null,
    }))
    if (date && isValidIsoDate(date)) {
      setTaskPeekDateViewMonth(startOfCalendarMonth(getCalendarMonthDate(date)))
    }
    setTaskPeekDatePickerOpen(false)
    setTaskPeekDatePanelPosition(null)
  }, [updateSelectedTaskPeek])

  const taskPeekData = useMemo(
    () => ({
      task: selectedTaskPeek,
      activeSubtasks: selectedTaskPeekActiveSubtasks,
      completedSubtasks: selectedTaskPeekCompletedSubtasks,
      datePanelPosition: taskPeekDatePanelPosition,
      dateViewMonth: taskPeekDateViewMonth,
      priorityOptions: taskPriorityOptions,
      milestoneOptions: selectedTaskPeekMilestoneOptions,
      showMilestoneField: Boolean(selectedLifeGoal?.goalType === 'outcome' && selectedLifeGoal?.milestonesEnabled),
      lockedMilestoneLabel: taskPeekLockedMilestoneContext?.title ?? null,
      relativeDueMeta: selectedTaskPeekRelativeDueMeta,
      weekdayLabels: LIFE_GOAL_WEEKDAY_LABELS,
      todayIsoDate: getTodayIsoDate(),
    }),
    [
      selectedLifeGoal?.goalType,
      selectedLifeGoal?.milestonesEnabled,
      selectedTaskPeek,
      selectedTaskPeekActiveSubtasks,
      selectedTaskPeekCompletedSubtasks,
      taskPeekDatePanelPosition,
      taskPeekDateViewMonth,
      taskPeekLockedMilestoneContext?.title,
      taskPriorityOptions,
      selectedTaskPeekMilestoneOptions,
      selectedTaskPeekRelativeDueMeta,
    ],
  )
  const taskPeekUiState = useMemo(
    () => ({
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
    }),
    [
      dragOverSubtaskId,
      draggedSubtaskId,
      selectedLifeGoal,
      selectedLifeGoalProgress,
      selectedTaskPeek,
      taskPeekCompletedSubtasksOpen,
      taskPeekDatePickerOpen,
      taskPeekDeleteConfirmation,
      taskPeekNotesOpen,
      taskPeekSubtaskDraft,
      taskPeekSubtaskEntryOpen,
    ],
  )
  const taskPeekActions = useMemo(
    () => ({
      setCompletedSubtasksOpen: setTaskPeekCompletedSubtasksOpen,
      setSubtaskEntryOpen: setTaskPeekSubtaskEntryOpen,
      setSubtaskDraft: setTaskPeekSubtaskDraft,
      setNotesOpen: setTaskPeekNotesOpen,
      setTaskDeleteConfirmation: setTaskPeekDeleteConfirmation,
      onClose: closeTaskPeek,
      onTitleChange: (value: string) => updateSelectedTaskPeek((task) => ({ ...task, text: value })),
      onDescriptionChange: (value: string) => updateSelectedTaskPeek((task) => ({ ...task, description: value })),
      onNotesChange: (value: string) => updateSelectedTaskPeek((task) => ({ ...task, notes: value })),
      onMilestoneChange: (value: string | null) => updateSelectedTaskPeek((task) => ({ ...task, milestoneId: value })),
      onPriorityChange: (value: LifeGoalTaskPriority) => updateSelectedTaskPeek((task) => ({ ...task, priority: value })),
      tagDraft: taskPeekTagDraft,
      setTagDraft: setTaskPeekTagDraft,
      onTagKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
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
      onShiftDateMonth: (delta: number) => setTaskPeekDateViewMonth((current) => shiftCalendarMonth(current, delta)),
      getCalendarDays,
      formatCalendarDayValue,
      formatCalendarMonthLabel,
      formatDate,
      formatTaskDueDate,
      formatTaskCompletedDate,
      setSubtaskInputRef: (id: string, element: HTMLInputElement | null) => {
        taskPeekSubtaskInputRefs.current[id] = element
      },
      onSubtaskTextChange: (id: string, value: string) =>
        updateSelectedTaskPeek((task) => ({
          ...task,
          subtasks: task.subtasks.map((item) => (item.id === id ? { ...item, text: value } : item)),
        })),
      onSubtaskKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
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
      onSubtaskRemoveRequest: (subtaskId: string, subtaskText: string) =>
        setTaskPeekDeleteConfirmation({
          kind: 'subtask',
          taskId: selectedTaskPeek?.id ?? '',
          subtaskId,
          subtaskText,
        }),
      onSubtaskReorderStart: (id: string) => setDraggedSubtaskId(id),
      onSubtaskReorderOver: (event: React.DragEvent<HTMLDivElement>, id: string) => {
        event.preventDefault()
        if (dragOverSubtaskId !== id) setDragOverSubtaskId(id)
      },
      onSubtaskReorderDrop: (event: React.DragEvent<HTMLDivElement>, id: string) => {
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
      onToggleDeleteConfirmation: (kind: 'task') => {
        taskPeekDeleteTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : taskPeekTriggerRef.current
        setTaskPeekDeleteConfirmation({ kind, taskId: selectedTaskPeek?.id ?? '' })
      },
      onSetAsNext: () => {
        if (!selectedLifeGoal || !selectedTaskPeek) return
        setTaskAsNext(selectedLifeGoal.id, selectedTaskPeek.id)
      },
      onRestoreTask: (source: HTMLElement) => {
        if (!selectedLifeGoal || !selectedTaskPeek) return
        restoreTask(selectedLifeGoal.id, selectedTaskPeek.id)
        showCompletionPulse(source)
      },
      onCompleteNext: (source: HTMLElement) => completeTaskFromPeek('next', source),
      onCompleteTask: (source: HTMLElement) => completeTaskFromPeek('close', source),
      onConfirmDelete: confirmTaskPeekDelete,
    }),
    [
      addSelectedTaskPeekSubtask,
      addTagToSelectedTaskPeek,
      applyTaskPeekDate,
      closeTaskPeek,
      completeTaskFromPeek,
      confirmTaskPeekDelete,
      dragOverSubtaskId,
      draggedSubtaskId,
      openTaskPeekDatePicker,
      removeTagFromSelectedTaskPeek,
      reorderSelectedTaskPeekSubtasks,
      setTaskAsNext,
      selectedLifeGoal,
      selectedTaskPeek,
      selectedTaskPeekActiveSubtasks,
      taskPeekDatePickerOpen,
      taskPeekTagDraft,
      toggleSelectedTaskPeekSubtaskCompletion,
      updateSelectedTaskPeek,
    ],
  )
  const toggleRoadmapHighPriorityFocus = useCallback(() => {
    setRoadmapHighPriorityFocus((current) => !current)
  }, [])
  const toggleRoadmapOrganizationMode = useCallback(() => {
    setRoadmapOrganizationMode((current) => (current === 'default' ? 'tag' : 'default'))
  }, [])
  const setSelectedRoadmapProgressView = useCallback(
    (view: LifeGoalRoadmapPanelView) => {
      if (!selectedLifeGoal) return
      setRoadmapPanelViewByGoal((current) => ({
        ...current,
        [selectedLifeGoal.id]: view,
      }))
    },
    [selectedLifeGoal],
  )
  const openSelectedGoalRoadmapTab = useCallback(() => {
    setLifeGoalDetailTab('roadmap')
  }, [])
  const handleRoadmapPanelKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault()
        openNewTaskPeek(event.currentTarget)
      }
    },
    [openNewTaskPeek],
  )
  const handleRoadmapPanelAddTask = useCallback((trigger?: HTMLElement | null) => {
    openNewTaskPeek(trigger)
  }, [openNewTaskPeek])
  const toggleRoadmapCompleted = useCallback(() => {
    setRoadmapCompletedOpen((current) => !current)
  }, [])
  const selectedRoadmapPanelUiState = useMemo(
    () => ({
      roadmapHighPriorityFocus,
      completedOpen: roadmapCompletedOpen,
      showHighPriorityFocus: selectedGoalRoadmapDerived.roadmapHasHighPriorityTasks,
      progressView: selectedRoadmapProgressView,
      showMilestonesView: selectedShowMilestoneProgressView,
      showNotesView: true,
      organizationMode: roadmapOrganizationMode,
      showTagGrouping: selectedGoalRoadmapDerived.roadmapHasTaggedTasks,
    }),
    [
      roadmapCompletedOpen,
      roadmapHighPriorityFocus,
      roadmapOrganizationMode,
      selectedGoalRoadmapDerived.roadmapHasHighPriorityTasks,
      selectedGoalRoadmapDerived.roadmapHasTaggedTasks,
      selectedRoadmapProgressView,
      selectedShowMilestoneProgressView,
    ],
  )
  const selectedRoadmapPanelActions = useMemo(
    () => ({
      onToggleHighPriorityFocus: toggleRoadmapHighPriorityFocus,
      onToggleOrganizationMode: toggleRoadmapOrganizationMode,
      onSetProgressView: setSelectedRoadmapProgressView,
      onOpenRoadmap: openSelectedGoalRoadmapTab,
      onRoadmapKeyDown: handleRoadmapPanelKeyDown,
      onAddTask: handleRoadmapPanelAddTask,
      onToggleCompleted: toggleRoadmapCompleted,
    }),
    [
      handleRoadmapPanelAddTask,
      handleRoadmapPanelKeyDown,
      openSelectedGoalRoadmapTab,
      setSelectedRoadmapProgressView,
      toggleRoadmapCompleted,
      toggleRoadmapHighPriorityFocus,
      toggleRoadmapOrganizationMode,
    ],
  )

  const openMilestoneDatePicker = (milestoneId: string, date?: string | null) => {
    setMilestoneDatePickerMilestoneId((current) => (current === milestoneId ? null : milestoneId))
  }

  const applySelectedMilestoneDate = (date: string) => {
    if (!milestoneDatePickerMilestoneId) return
    updateSelectedLifeGoalMilestone(milestoneDatePickerMilestoneId, (milestone) => ({
      ...milestone,
      targetDate: date || null,
    }))
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
        goalOverviewControlsTriggerRef.current?.contains(target) ||
        goalOverviewFloatingControlsTriggerRef.current?.contains(target)
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
      const nextRightOffset = Math.round(Math.max(12, window.innerWidth - rect.right))
      const slotBottom = rect.bottom
      // Fade in as the slot scrolls from 48px above viewport top down to fully off-screen
      const fadeRange = 48
      const opacity = Math.max(0, Math.min(1, (fadeRange - slotBottom) / fadeRange))

      setGoalOverviewHeaderControlsRight(nextRightOffset)
      setGoalOverviewFloatingOpacity(opacity)
      setGoalOverviewHeaderControlsSticky(opacity >= 1)
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
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal, getRuntimeTasksForGoal(goal)))
    setLifeGoalComposerOpen(true)
  }

  const primeInlineLifeGoalDraft = (goal: LifeGoal) => {
    setLifeGoalComposerMode('edit')
    setEditingLifeGoalId(goal.id)
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal, getRuntimeTasksForGoal(goal)))
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
    const deletedGoal = safeLifeGoals.find((goal) => goal.id === goalId) ?? null
    onDeleteLifeGoal(goalId)
    if (selectedLifeGoalId === goalId) {
      onChangeGoalsView(getOverviewGoalsViewForGoal(deletedGoal))
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
            className={isEditMode ? `${editPanelSelectClassName} relative text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.category ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.category || 'Select category'}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
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
            className={isEditMode ? `${editPanelSelectClassName} relative text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.startDate ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.startDate ? formatDate(lifeGoalDraft.startDate) : 'Start today'}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
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
            className={isEditMode ? `${editPanelSelectClassName} relative text-left` : 'theme-input flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left text-sm transition'}
          >
            <span className={lifeGoalDraft.targetDate ? 'theme-text-primary' : 'theme-text-muted'}>
              {lifeGoalDraft.targetDate
                ? formatDate(lifeGoalDraft.targetDate)
                : isCreateMode && isDirectionalDraftGoal
                  ? 'Optional horizon'
                  : 'Optional deadline'}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
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
            {categoryField}
            {startDateField}
            {targetDateField}
            {statusField}
            {lifeGoalActiveDateField ? (
              <GoalDatePicker
                ref={lifeGoalDatePanelRef}
                value={lifeGoalDraft[lifeGoalActiveDateField]}
                anchorPosition={lifeGoalDatePanelPosition}
                label={lifeGoalActiveDateField === 'startDate' ? 'Start Date' : 'Target Date'}
                onChange={applyLifeGoalDate}
                onClose={() => {
                  setLifeGoalActiveDateField(null)
                  setLifeGoalDatePanelPosition(null)
                }}
              />
            ) : null}
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

            {lifeGoalActiveDateField ? (
              <GoalDatePicker
                ref={lifeGoalDatePanelRef}
                value={lifeGoalDraft[lifeGoalActiveDateField]}
                anchorPosition={lifeGoalDatePanelPosition}
                label={lifeGoalActiveDateField === 'startDate' ? 'Start Date' : 'Target Date'}
                onChange={applyLifeGoalDate}
                onClose={() => {
                  setLifeGoalActiveDateField(null)
                  setLifeGoalDatePanelPosition(null)
                }}
              />
            ) : null}

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
      return (
        <LifeGoalOverviewPanel
        lifeGoals={overviewLifeGoals}
        categories={safeLifeGoalCategories}
        tasks={safeTasks}
        selectedGoalId={selectedLifeGoalId}
        viewControls={goalOverviewViewControls}
        onUpdateViewControls={(updater) =>
          setGoalOverviewViewControls((current) => normalizeGoalOverviewViewControls(updater(current)))
        }
        onResetViewControls={() => setGoalOverviewViewControls(DEFAULT_GOAL_OVERVIEW_VIEW_CONTROLS)}
        rowActions={goalOverviewRowActions}
        onUpdateRowActions={(updater) =>
          setGoalOverviewRowActions((current) => normalizeGoalOverviewRowActions(updater(current)))
        }
        onSelectGoal={(goalId) => {
          onSelectLifeGoal(goalId)
          setLifeGoalComposerOpen(false)
          setLifeGoalActionFeedback(null)
          onChangeGoalsView('life-detail')
        }}
        onUpdateLifeGoal={onUpdateLifeGoal}
        onReorderLifeGoals={(updates) => {
          updates.forEach(({ goalId, order }) => {
            onUpdateLifeGoal(goalId, (current) => ({ ...current, order }))
          })
        }}
        onArchiveLifeGoal={onArchiveLifeGoal}
        onSetLifeGoalAsTodayTask={onSetLifeGoalAsTodayTask}
        onOpenComposer={(trigger) => openLifeGoalComposer(trigger ?? undefined)}
        onCloseComposer={closeLifeGoalComposer}
        onResetComposerDraft={() => setLifeGoalDraft(createEmptyLifeGoalDraft())}
        onOpenTaskPeek={(taskId, trigger) => openTaskPeek(taskId, trigger ?? undefined)}
        onOpenNewTaskPeek={(trigger) => openNewTaskPeek(trigger ?? undefined)}
        onOpenIconPicker={(goalId, trigger) => {
          setInlineLifeGoalIconGoalId(goalId)
          lifeGoalIconFieldRef.current = trigger as HTMLButtonElement | null
          setLifeGoalIconPickerOpen(true)
        }}
        onRequestDeleteGoal={(goalId) => setDeleteGoalConfirmationTarget({ goalId, context: 'detail' })}
        composerSlot={renderLifeGoalComposer()}
        composerOpen={lifeGoalComposerOpen}
        composerMode={lifeGoalComposerMode}
        containScrollWithinElement={containScrollWithinElement}
        renderLifeGoalIcon={renderLifeGoalIcon}
      />
    )
  }

  const renderLifeGoalDetailPage = () => (
    <LifeGoalDetailPage
      selectedLifeGoal={selectedLifeGoal}
      lifeGoalCategories={lifeGoalCategories}
      selectedLifeGoalProgress={selectedLifeGoalProgress}
      selectedGoalAnchorText={selectedGoalAnchorText}
      selectedGoalDetailContentVisibility={selectedGoalDetailContentVisibility}
      selectedGoalIsOutcome={selectedGoalIsOutcome}
      selectedGoalIsDirectional={selectedGoalIsDirectional}
      selectedGoalMilestonesEnabled={selectedGoalMilestonesEnabled}
      selectedLifeGoalMilestones={selectedLifeGoalMilestones}
      selectedCurrentMilestone={selectedCurrentMilestone}
      selectedCompletedMilestoneCount={selectedCompletedMilestoneCount}
      selectedRoadmapPanelView={selectedRoadmapPanelView}
      selectedShowMilestoneProgressView={selectedShowMilestoneProgressView}
      selectedMilestoneOptions={selectedMilestoneOptions}
      selectedMilestoneDateTarget={selectedMilestoneDateTarget}
      selectedRoadmapSections={selectedRoadmapSections}
      selectedGoalRoadmapDerived={selectedGoalRoadmapDerived}
      selectedGoalRelatedGoals={selectedGoalRelatedGoals}
      selectedGoalLinkedDirectionalTasks={selectedGoalLinkedDirectionalTasks}
      selectedGoalSupportingHabits={selectedGoalSupportingHabits}
      selectedGoalParentGoals={selectedGoalParentGoals}
      selectedGoalDirectionalMetrics={selectedGoalDirectionalMetrics}
      selectedGoalCategory={selectedGoalCategory}
      selectedGoalCategoryColor={selectedGoalCategoryColor}
      selectedGoalRuntimeTasks={selectedGoalTaskSource}
      goalRuntimeTaskMap={goalRuntimeTaskMap}
      year={year}
      selectedRoadmapPanelActions={selectedRoadmapPanelActions}
      selectedRoadmapPanelUiState={selectedRoadmapPanelUiState}
      selectedRoadmapTaskId={selectedRoadmapTaskId}
      inlineLifeGoalEditingField={inlineLifeGoalEditingField}
      lifeGoalDetailTab={lifeGoalDetailTab}
      lifeGoalDraft={lifeGoalDraft}
      lifeGoalIconFieldRef={lifeGoalIconFieldRef}
      lifeGoalTitleInputRef={lifeGoalTitleInputRef}
      lifeGoalWhyTextareaRef={lifeGoalWhyTextareaRef}
      milestoneDatePanelPosition={milestoneDatePanelPosition}
      milestoneDatePanelRef={milestoneDatePanelRef}
      milestoneDatePickerMilestoneId={milestoneDatePickerMilestoneId}
      completeNextVisualState={completeNextVisualState}
      dragOverTaskId={dragOverTaskId}
      draggedTaskId={draggedTaskId}
      dragOverVisionImageIndex={dragOverVisionImageIndex}
      draggedVisionImageIndex={draggedVisionImageIndex}
      editGoalActionsButtonRef={editGoalActionsButtonRef}
      editGoalActionsMenuOpen={editGoalActionsMenuOpen}
      editGoalActionsMenuRef={editGoalActionsMenuRef}
      habitDraftByTaskId={habitDraftByTaskId}
      lifeGoalActionFeedback={lifeGoalActionFeedback}
      nextTaskVisualState={nextTaskVisualState}
      prefersReducedMotion={prefersReducedMotion}
      roadmapArrivalCueActive={roadmapArrivalCueActive}
      roadmapCompletedOpen={roadmapCompletedOpen}
      roadmapHighPriorityFocus={roadmapHighPriorityFocus}
      roadmapOrganizationMode={roadmapOrganizationMode}
      roadmapTaskRowRefs={roadmapTaskRowRefs}
      selectedLifeGoalCanUploadVisionImages={selectedLifeGoalCanUploadVisionImages}
      selectedLifeGoalShowVisionEditUI={selectedLifeGoalShowVisionEditUI}
      selectedLifeGoalVisionCollapsed={selectedLifeGoalVisionCollapsed}
      selectedLifeGoalVisionEditMode={selectedLifeGoalVisionEditMode}
      selectedLifeGoalVisionEditShowsImages={selectedLifeGoalVisionEditShowsImages}
      selectedLifeGoalVisionEditShowsStatement={selectedLifeGoalVisionEditShowsStatement}
      selectedLifeGoalVisionEditorOpen={selectedLifeGoalVisionEditorOpen}
      selectedLifeGoalVisionMode={selectedLifeGoalVisionMode}
      selectedLifeGoalVisionShowsImagesInDisplay={selectedLifeGoalVisionShowsImagesInDisplay}
      selectedLifeGoalVisionShowsStatementInDisplay={selectedLifeGoalVisionShowsStatementInDisplay}
      taskListSortMode={taskListSortMode}
      taskMomentumTransition={taskMomentumTransition}
      visibleGoalStartCueTaskId={visibleGoalStartCueTaskId}
      visionDropActive={visionDropActive}
      visionImageInteractiveOptions={visionImageInteractiveOptions}
      visionUploadInputRef={visionUploadInputRef}
      goalStatusChipClassName={goalStatusChipClassName}
      LIFE_GOAL_ICON_MAP={LIFE_GOAL_ICON_MAP}
      renderLifeGoalOverviewPage={renderLifeGoalOverviewPage}
      onUpdateLifeGoal={onUpdateLifeGoal}
      onArchiveLifeGoal={onArchiveLifeGoal}
      onChangeGoalsView={onChangeGoalsView}
      onSelectLifeGoal={onSelectLifeGoal}
      onSetLifeGoalAsTodayTask={onSetLifeGoalAsTodayTask}
      openEditLifeGoalComposer={openEditLifeGoalComposer}
      openMilestonePeek={openMilestonePeek}
      openNewTaskPeek={openNewTaskPeek}
      openSelectedLifeGoalVisionEditor={openSelectedLifeGoalVisionEditor}
      openTaskPeek={openTaskPeek}
      requestDeleteLifeGoal={requestDeleteLifeGoal}
      restoreTask={restoreTask}
      updateSelectedLifeGoalNotes={updateSelectedLifeGoalNotes}
      updateSelectedLifeGoalVisionStatement={updateSelectedLifeGoalVisionStatement}
      commitInlineLifeGoalField={commitInlineLifeGoalField}
      cancelInlineLifeGoalField={cancelInlineLifeGoalField}
      primeInlineLifeGoalDraft={primeInlineLifeGoalDraft}
      handleCompleteNextWithFeedback={handleCompleteNextWithFeedback}
      handleTaskRowKeyDown={handleTaskRowKeyDown}
      completeLifeGoal={completeLifeGoal}
      createHabitFromTask={createHabitFromTask}
      onOpenGlobalTasks={onOpenGlobalTasks}
      onOpenHabitTracker={onOpenHabitTracker}
      addSelectedLifeGoalMilestone={addSelectedLifeGoalMilestone}
      applySelectedLifeGoalVisionEditMode={applySelectedLifeGoalVisionEditMode}
      applySelectedMilestoneDate={applySelectedMilestoneDate}
      appendSelectedLifeGoalVisionImages={appendSelectedLifeGoalVisionImages}
      removeSelectedLifeGoalVisionImage={removeSelectedLifeGoalVisionImage}
      renderSubtaskProgressDots={renderSubtaskProgressDots}
      renderVisionImageLayout={renderVisionImageLayout}
      reorderGoalTask={reorderGoalTask}
      reorderSelectedLifeGoalVisionImages={reorderSelectedLifeGoalVisionImages}
      setDragOverTaskId={setDragOverTaskId}
      setDraggedTaskId={setDraggedTaskId}
      setDragOverVisionImageIndex={setDragOverVisionImageIndex}
      setDraggedVisionImageIndex={setDraggedVisionImageIndex}
      setEditGoalActionsMenuOpen={setEditGoalActionsMenuOpen}
      setHabitDraftByTaskId={setHabitDraftByTaskId}
      setInlineLifeGoalEditingField={setInlineLifeGoalEditingField}
      setInlineLifeGoalIconGoalId={setInlineLifeGoalIconGoalId}
      setLifeGoalActionFeedback={setLifeGoalActionFeedback}
      setLifeGoalDetailTab={setLifeGoalDetailTab}
      setLifeGoalDraft={setLifeGoalDraft}
      setLifeGoalIconPickerOpen={setLifeGoalIconPickerOpen}
      setLifeGoalIconPickerQuery={setLifeGoalIconPickerQuery}
      setLifeGoalIconPickerTab={setLifeGoalIconPickerTab}
      setMilestoneDatePanelPosition={setMilestoneDatePanelPosition}
      setMilestoneDatePickerMilestoneId={setMilestoneDatePickerMilestoneId}
      setRoadmapCompletedOpen={setRoadmapCompletedOpen}
      setRoadmapHighPriorityFocus={setRoadmapHighPriorityFocus}
      setRoadmapOrganizationMode={setRoadmapOrganizationMode}
      setSelectedLifeGoalVisionEditMode={setSelectedLifeGoalVisionEditMode}
      setSelectedRoadmapTaskId={setSelectedRoadmapTaskId}
      setTaskListSortMode={setTaskListSortMode}
      setVisionDropActive={setVisionDropActive}
      setVisionPreviewImage={setVisionPreviewImage}
    />
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
                          const editingGoal = safeLifeGoals.find((goal) => goal.id === editingLifeGoalId) ?? null
                          onArchiveLifeGoal(editingLifeGoalId)
                          if (selectedLifeGoalId === editingLifeGoalId) {
                            onChangeGoalsView(getOverviewGoalsViewForGoal(editingGoal))
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

      <LifeGoalTaskPeek data={taskPeekData} uiState={taskPeekUiState} refs={taskPeekRefs} actions={taskPeekActions} />

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
