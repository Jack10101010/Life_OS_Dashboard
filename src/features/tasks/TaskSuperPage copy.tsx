import { CSSProperties, FocusEvent, FormEvent, KeyboardEvent, MouseEvent, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronRight, ExternalLink, Link2 } from 'lucide-react'
import { ControlsPanelShell, SectionCard } from '../../components/layout/LayoutPrimitives'
import { Card } from '../../components/ui/Card'
import { Button, IconButton } from '../../components/ui/Button'
import FocusStrip from '../../components/ui/FocusStrip'
import SectionHeader from '../../components/ui/SectionHeader'
import Toggle from '../../components/ui/Toggle'
import TaskPeek, {
  type TaskLinkOption,
  type TaskData as TaskPeekTaskData,
} from '../../components/tasks/TaskPeek'
import { taskPeekDataToTask, taskToTaskPeekData } from '../../lib/taskAdapters'
import {
  formatDateContextual,
  formatTaskCompletedDate,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryChipTextStyle,
  getLifeGoalCategoryColor,
  getLifeGoalCategoryColorTokenVariable,
  getLifeGoalCategoryDotStyle,
  getLifeGoalRowHighlightStyle,
  getTodayIsoDate,
  sortLifeGoals,
  shiftIsoDate,
} from '../goals/goalUtils'
import type { LifeGoal, LifeGoalCategoryDefinition, LifeGoalTaskPriority, Task } from '../../types'

type TaskSuperScope = 'today' | 'upcoming' | 'all-active'
type GoalsColumnViewOptions = {
  next: boolean
  highPriority: boolean
  dueSoon: boolean
  allTasks: boolean
  completed: boolean
}
type DirectionalPreviewMode = 'follow-scope' | 'all-active'
type DirectionalFocusMode = 'off' | 'focus-only'
type DirectionalSortMode = 'default' | 'most-active' | 'recently-updated'
type GeneralSortMode = 'manual' | 'due' | 'priority' | 'recent'
type GeneralGroupMode = 'none' | 'tag' | 'due' | 'priority'
type GoalsColumnCategoryFilter = string[]
type TasksPageLayoutMode = 'columns' | 'stacked'
type CollapsedStacksState = {
  general: boolean
  outcome: boolean
  directional: boolean
}
type GeneralViewFilters = {
  highPriority: boolean
  dueToday: boolean
  withNotes: boolean
  withSubtasks: boolean
  includeCompleted: boolean
}
type GeneralTaskGroup = {
  id: string
  label: string
  tasks: Task[]
  accentStyle?: CSSProperties
  accentTextStyle?: CSSProperties
  accentDividerStyle?: CSSProperties
  normalizedTag?: string | null
}
type CaptureScope =
  | { type: 'goal'; id: string; title: string }
  | { type: 'direction'; id: string; title: string }
  | null
type LinkDescriptor = {
  type: 'goal' | 'direction' | 'none'
  label: string | null
  quiet: boolean
  chipStyle?: CSSProperties
  chipTextStyle?: CSSProperties
  dotStyle?: CSSProperties
  rowStyle?: CSSProperties
}

const DEFAULT_TASK_TAG_OPTIONS = [
  'admin',
  'book',
  'buy',
  'call',
  'health',
  'mindset',
  'build',
  'plan',
  'research',
  'reminder',
  'someday',
] as const
const GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY = 'goals-overview-row-actions-v1'
const TASK_SUPER_GENERAL_PANEL_STORAGE_KEY = 'task-super-general-panel-v1'
const TASK_SUPER_GOALS_PANEL_STORAGE_KEY = 'task-super-goals-panel-v1'
const TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY = 'task-super-directions-panel-v1'
const TASKS_VIEW_MODE_STORAGE_KEY = 'tasks:viewMode'
const TASKS_COLLAPSED_STACKS_STORAGE_KEY = 'tasks:collapsedSections'
const LEGACY_TASKS_COLLAPSED_STACKS_STORAGE_KEY = 'tasks:collapsedStacks'
const SCOPE_OPTIONS: Array<{ id: TaskSuperScope; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all-active', label: 'All Tasks' },
]
const PRIORITY_OPTIONS: LifeGoalTaskPriority[] = ['none', 'low', 'medium', 'high']
const FOCUS_COMPLETION_FEEDBACK_MS = 1800
const TASK_PEEK_EMPTY_DRAFT_TITLE_SEEDS = new Set(['new task', 'test task', 'task'])
const TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME = 'text-[12px] text-[rgba(255,255,255,0.85)]'
const TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME = 'text-[11px] text-[rgba(255,255,255,0.55)]'
const TASK_GOALS_PANEL_SELECT_CLASSNAME =
  'h-9 w-full appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]'
const TASK_PANEL_PILL_CLASSNAME =
  'rounded-full border px-3 py-1.5 text-[12px] transition'
const TASK_PANEL_PILL_ACTIVE_CLASSNAME =
  'border-white/[0.12] bg-white/[0.08] text-white/88'
const TASK_PANEL_PILL_INACTIVE_CLASSNAME =
  'border-white/[0.06] bg-transparent text-white/52 hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white/76'
const DEFAULT_GOALS_COLUMN_VIEW_OPTIONS: GoalsColumnViewOptions = {
  next: false,
  highPriority: false,
  dueSoon: false,
  allTasks: true,
  completed: true,
}
const DEFAULT_GENERAL_VIEW_FILTERS: GeneralViewFilters = {
  highPriority: false,
  dueToday: false,
  withNotes: false,
  withSubtasks: false,
  includeCompleted: false,
}

type CaptureDraft = {
  text: string
  dueDate: string
  dueTime: string
  priority: LifeGoalTaskPriority
  linkedGoalId: string
  linkedDirectionId: string
  taskTag: string
}

type TaskDeleteUndoState = {
  task: Task
  message: string
}

function normalizeSomedayTagState(tag: string | null | undefined) {
  const normalizedTaskTag = normalizeTaskTag(tag)
  return {
    isSomeday: normalizedTaskTag === 'someday',
    taskTag: normalizedTaskTag === 'someday' ? null : normalizedTaskTag,
  }
}

export function TaskSuperPage({
  tasks,
  lifeGoals,
  lifeGoalCategories,
  taskPeekRightOffset = 0,
  onUpdateTasks,
  onUpdateLifeGoal,
  onAddCurrentFocusToTodayLog,
  onOpenLifeGoal,
}: {
  tasks: Task[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  taskPeekRightOffset?: number
  onUpdateTasks: (updater: (current: Task[]) => Task[]) => void
  onUpdateLifeGoal?: (goalId: string, updater: (goal: LifeGoal) => LifeGoal) => void
  onAddCurrentFocusToTodayLog?: (task: Task) => void
  onOpenDashboard?: () => void
  onOpenLifeGoal?: (goalId: string) => void
}) {
  const safeTasks = tasks ?? []
  const safeLifeGoals = lifeGoals ?? []
  const todayIso = getTodayIsoDate()
  const quickCaptureInputRef = useRef<HTMLInputElement | null>(null)
  const quickCaptureDueDateRef = useRef<HTMLInputElement | null>(null)
  const selectedTaskRowRef = useRef<HTMLDivElement | null>(null)
  const latestTaskPeekDraftRef = useRef<TaskPeekTaskData | null>(null)
  const pageControlsPanelTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pageControlsPanelRef = useRef<HTMLElement | null>(null)
  const suppressNextPageControlsPanelOutsideClickRef = useRef(false)
  const generalPanelTriggerRef = useRef<HTMLButtonElement | null>(null)
  const generalPanelRef = useRef<HTMLElement | null>(null)
  const suppressNextGeneralPanelOutsideClickRef = useRef(false)
  const goalsPanelTriggerRef = useRef<HTMLButtonElement | null>(null)
  const goalsPanelRef = useRef<HTMLElement | null>(null)
  const suppressNextGoalsPanelOutsideClickRef = useRef(false)
  const directionsPanelTriggerRef = useRef<HTMLButtonElement | null>(null)
  const directionsPanelRef = useRef<HTMLElement | null>(null)
  const suppressNextDirectionsPanelOutsideClickRef = useRef(false)
  const [scope, setScope] = useState<TaskSuperScope>('today')
  const [pageLayoutMode, setPageLayoutMode] = useState<TasksPageLayoutMode>(() => readTasksPageLayoutMode())
  const [collapsedStacks, setCollapsedStacks] = useState<CollapsedStacksState>(() => readCollapsedStacksState())
  const [completedTodayOpen, setCompletedTodayOpen] = useState(false)
  const [captureExpanded, setCaptureExpanded] = useState(false)
  const [captureScope, setCaptureScope] = useState<CaptureScope>(null)
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft>(createEmptyCaptureDraft())
  const [focusPromptDraft, setFocusPromptDraft] = useState('')
  const [selectedTask, setSelectedTask] = useState<TaskPeekTaskData | null>(null)
  const [isTaskPeekOpen, setIsTaskPeekOpen] = useState(false)
  const [taskPeekAutoSelectTitle, setTaskPeekAutoSelectTitle] = useState(false)
  const [creatingTaskPeekDraft, setCreatingTaskPeekDraft] = useState<{
    id: string
    seedTitle: string
    seedLinkedGoalId?: string | null
    seedLinkedDirectionId?: string | null
  } | null>(null)
  const [pageControlsPanelOpen, setPageControlsPanelOpen] = useState(false)
  const [showCurrentFocusStrip, setShowCurrentFocusStrip] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY).showCurrentFocusStrip ?? true,
  )
  const [generalPanelOpen, setGeneralPanelOpen] = useState(false)
  const [generalShowSomeday, setGeneralShowSomeday] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY).generalShowSomeday ?? true,
  )
  const [generalLaterCollapsed, setGeneralLaterCollapsed] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY).generalLaterCollapsed ?? true,
  )
  const [generalCompletedCollapsed, setGeneralCompletedCollapsed] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY).generalCompletedCollapsed ?? true,
  )
  const [generalShowTags, setGeneralShowTags] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY).generalShowTags ?? true,
  )
  const [generalQuickTagFilter, setGeneralQuickTagFilter] = useState<string | null>(null)
  const [comingUpLinkTooltip, setComingUpLinkTooltip] = useState<{ text: string; left: number; top: number } | null>(null)
  const [generalTagDragTooltip, setGeneralTagDragTooltip] = useState<{ text: string; left: number; top: number } | null>(null)
  const [outcomeAddTaskTooltip, setOutcomeAddTaskTooltip] = useState<{ text: string; left: number; top: number } | null>(null)
  const [generalTagGroupOrder, setGeneralTagGroupOrder] = useState<string[]>(() =>
    readGeneralTagGroupOrder(readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY)),
  )
  const [generalDraggedTagGroupId, setGeneralDraggedTagGroupId] = useState<string | null>(null)
  const [generalDragOverTagGroupId, setGeneralDragOverTagGroupId] = useState<string | null>(null)
  const [generalSortMode, setGeneralSortMode] = useState<GeneralSortMode>(() =>
    readGeneralSortMode(readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY)),
  )
  const [generalGroupMode, setGeneralGroupMode] = useState<GeneralGroupMode>(() =>
    readGeneralGroupMode(readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY)),
  )
  const [generalViewFilters, setGeneralViewFilters] = useState<GeneralViewFilters>(() =>
    readGeneralViewFilters(readTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY)),
  )
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false)
  const [directionsPanelOpen, setDirectionsPanelOpen] = useState(false)
  const [directionalPreviewMode, setDirectionalPreviewMode] = useState<DirectionalPreviewMode>(() =>
    readTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY).directionalPreviewMode ?? 'all-active',
  )
  const [directionalFocusMode, setDirectionalFocusMode] = useState<DirectionalFocusMode>(() =>
    readTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY).directionalFocusMode ?? 'off',
  )
  const [directionalSortMode, setDirectionalSortMode] = useState<DirectionalSortMode>(() =>
    readTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY).directionalSortMode ?? 'default',
  )
  const [directionalHideEmpty, setDirectionalHideEmpty] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY).directionalHideEmpty ?? false,
  )
  const [showDirectionalColumn, setShowDirectionalColumn] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY).showDirectionalColumn !== false,
  )
  const [goalsColumnCategoryFilter, setGoalsColumnCategoryFilter] = useState<GoalsColumnCategoryFilter>(() =>
    readGoalsColumnCategoryFilter(readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY)),
  )
  const [goalsColumnGoalFilter, setGoalsColumnGoalFilter] = useState<string>(() =>
    readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY).goalsColumnGoalFilter ?? 'all',
  )
  const [goalsColumnViewOptions, setGoalsColumnViewOptions] = useState<GoalsColumnViewOptions>(() =>
    readGoalsColumnViewOptions(readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY)),
  )
  const [goalsColumnHideEmpty, setGoalsColumnHideEmpty] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY).goalsColumnHideEmpty ?? false,
  )
  const [goalsColumnShowCompletedGoals, setGoalsColumnShowCompletedGoals] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY).goalsColumnShowCompletedGoals ?? false,
  )
  const [goalsColumnShowTaskTags, setGoalsColumnShowTaskTags] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY).goalsColumnShowTaskTags ?? false,
  )
  const [goalsCompletedSectionCollapsed, setGoalsCompletedSectionCollapsed] = useState<boolean>(() =>
    readTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY).goalsCompletedSectionCollapsed ?? true,
  )
  const [goalsColumnCompletedOpen, setGoalsColumnCompletedOpen] = useState(false)
  const [expandedOutcomeGoalId, setExpandedOutcomeGoalId] = useState<string | null>(null)
  const [focusCompletionFeedback, setFocusCompletionFeedback] = useState<{
    taskId: string
    taskText: string
    contextLabel: string | null
  } | null>(null)
  const [taskDeleteUndo, setTaskDeleteUndo] = useState<TaskDeleteUndoState | null>(null)

  const goalById = useMemo(() => new Map(safeLifeGoals.map((goal) => [goal.id, goal])), [safeLifeGoals])
  const pinnedGoalIds = useMemo(() => {
    if (typeof window === 'undefined') return [] as string[]

    try {
      const rawValue = window.localStorage.getItem(GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY)
      if (!rawValue) return [] as string[]
      const parsed = JSON.parse(rawValue) as { pinnedGoalIds?: unknown }
      return Array.isArray(parsed?.pinnedGoalIds)
        ? parsed.pinnedGoalIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []
    } catch {
      return [] as string[]
    }
  }, [])
  const outcomeGoals = useMemo(
    () => safeLifeGoals.filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === 'outcome'),
    [safeLifeGoals],
  )
  const orderedOutcomeGoals = useMemo(
    () => {
      const manualOrderGoals = outcomeGoals.slice().sort((left, right) => left.order - right.order)
      if (pinnedGoalIds.length === 0) return manualOrderGoals

      const pinnedGoalIdSet = new Set(pinnedGoalIds)
      const goalById = new Map(manualOrderGoals.map((goal) => [goal.id, goal]))
      const pinnedGoals = pinnedGoalIds
        .map((goalId) => goalById.get(goalId) ?? null)
        .filter((goal): goal is LifeGoal => Boolean(goal))
      const remainingGoals = manualOrderGoals.filter((goal) => !pinnedGoalIdSet.has(goal.id))
      return [...pinnedGoals, ...remainingGoals]
    },
    [outcomeGoals, pinnedGoalIds],
  )
  const directionalGoals = useMemo(
    () => safeLifeGoals.filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === 'directional'),
    [safeLifeGoals],
  )

  const focusedTask = useMemo(
    () =>
      safeTasks
        .filter((task) => task.starred && !task.completed && !isSomedayTask(task))
        .slice()
        .sort(compareExecutionTasks(todayIso))[0] ?? null,
    [safeTasks, todayIso],
  )

  const todayExecutionTasks = useMemo(() => {
    const tasksForToday = safeTasks
      .filter((task) => !task.completed)
      .filter((task) => !isSomedayTask(task))
      .filter((task) => task.starred || task.dueDate === todayIso)
      .slice()
      .sort(compareExecutionTasks(todayIso))
    return focusedTask ? tasksForToday.filter((task) => task.id !== focusedTask.id) : tasksForToday
  }, [focusedTask, safeTasks, todayIso])

  const comingUpStripTasks = useMemo(
    () =>
      safeTasks
        .filter((task) => !task.completed && !isSomedayTask(task))
        .filter((task) => Boolean(task.dueDate && task.dueDate >= todayIso))
        .slice()
        .sort(compareComingUpStripTasks(todayIso)),
    [safeTasks, todayIso],
  )

  const completedTodayTasks = useMemo(
    () =>
      safeTasks
        .filter((task) => task.completed && typeof task.completedAt === 'string' && task.completedAt.startsWith(todayIso))
        .slice()
        .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? '')),
    [safeTasks, todayIso],
  )

  const filteredTasks = useMemo(
    () =>
      safeTasks.filter((task) => !task.completed),
    [safeTasks],
  )

  const activeExecutionQueue = useMemo(
    () =>
      safeTasks
        .filter((task) => !task.completed && !isSomedayTask(task))
        .slice()
        .sort(compareExecutionTasks(todayIso)),
    [safeTasks, todayIso],
  )

  const taskTagOptions = useMemo(() => {
    const fromTasks = safeTasks
      .map((task) => normalizeTaskTag(task.taskTag))
      .filter((value): value is string => Boolean(value))
    return [...new Set([...DEFAULT_TASK_TAG_OPTIONS, ...fromTasks])].sort((left, right) => left.localeCompare(right))
  }, [safeTasks])

  const generalQuickTagFilterStyles = useMemo(() => {
    const accentRgb = getTaskTagAccentRgb(generalQuickTagFilter)
    if (!accentRgb) {
      return {
        borderColor: 'rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        color: 'rgb(228 228 231)',
        labelColor: 'rgb(161 161 170)',
      }
    }

    return {
      borderColor: `rgb(${accentRgb} / 0.22)`,
      backgroundColor: `rgb(${accentRgb} / 0.10)`,
      color: `rgb(${accentRgb} / 0.92)`,
      labelColor: `rgb(${accentRgb} / 0.76)`,
    }
  }, [generalQuickTagFilter])

  const goalTitleById = useMemo(() => new Map(safeLifeGoals.map((goal) => [goal.id, goal.title])), [safeLifeGoals])
  const orderedLinkableDirectionalGoals = useMemo(
    () =>
      sortLifeGoals(
        safeLifeGoals.filter(
          (goal) =>
            !goal.archivedAt
            && goal.status !== 'complete'
            && (goal.goalType ?? 'outcome') === 'directional',
        ),
      ),
    [safeLifeGoals],
  )
  const taskPeekGoalOptions = useMemo<TaskLinkOption[]>(
    () =>
      orderedOutcomeGoals
        .filter((goal) => goal.status !== 'complete')
        .map((goal) => ({ id: goal.id, label: goal.title })),
    [orderedOutcomeGoals],
  )
  const taskPeekDirectionOptions = useMemo<TaskLinkOption[]>(
    () =>
      orderedLinkableDirectionalGoals
        .map((goal) => ({ id: goal.id, label: goal.title })),
    [orderedLinkableDirectionalGoals],
  )
  const taskPeekLinkedContextById = useMemo(
    () =>
      Object.fromEntries(
        safeLifeGoals.map((goal) => [
          goal.id,
          {
            title: goal.title,
            goalType: goal.goalType,
          },
        ]),
      ),
    [safeLifeGoals],
  )
  const taskPeekMilestoneOptionsByGoalId = useMemo(
    () =>
      Object.fromEntries(
        outcomeGoals.map((goal) => {
          const orderedMilestones = (goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
          const currentMilestone =
            orderedMilestones.find((candidate) => !candidate.completed) ??
            (orderedMilestones.length > 0 ? orderedMilestones[orderedMilestones.length - 1] : null)

          return [
            goal.id,
            orderedMilestones.map((milestone, index) => ({
              id: milestone.id,
              label: `${index + 1}. ${milestone.title.trim() || `Milestone ${index + 1}`}${
                currentMilestone?.id === milestone.id ? ' — Current' : ''
              }`,
            })),
          ]
        }),
      ),
    [outcomeGoals],
  )
  const createMilestoneForTaskPeekGoal = useCallback(
    (goalId: string, title: string) => {
      if (!onUpdateLifeGoal) return null
      const nextTitle = title.trim()
      if (!nextTitle) return null

      const goal = safeLifeGoals.find((candidate) => candidate.id === goalId)
      if (!goal || goal.goalType !== 'outcome') return null

      const createdMilestone = {
        id: `life-goal-milestone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        title: nextTitle,
        description: '',
        targetDate: null,
        completed: false,
        completedAt: null,
        order: (goal.milestones ?? []).length,
      }

      onUpdateLifeGoal(goalId, (currentGoal) => {
        if (currentGoal.goalType !== 'outcome') return currentGoal

        return {
          ...currentGoal,
          milestonesEnabled: true,
          milestones: [...(currentGoal.milestones ?? []), createdMilestone],
          updatedAt: new Date().toISOString(),
        }
      })

      return {
        id: createdMilestone.id,
        label: `${createdMilestone.order + 1}. ${createdMilestone.title} — Current`,
      }
    },
    [onUpdateLifeGoal, safeLifeGoals],
  )
  const selectedTaskLinkedGoal = useMemo(
    () => (selectedTask?.linkedGoalId ? safeLifeGoals.find((goal) => goal.id === selectedTask.linkedGoalId) ?? null : null),
    [safeLifeGoals, selectedTask?.linkedGoalId],
  )
  const selectedTaskGoalContext = useMemo(
    () =>
      selectedTaskLinkedGoal
        ? {
            title: selectedTaskLinkedGoal.title,
            goalType: selectedTaskLinkedGoal.goalType,
          }
        : null,
    [selectedTaskLinkedGoal],
  )

  const mapTaskToTaskPeekData = useCallback(
    (task: Task): TaskPeekTaskData =>
      taskToTaskPeekData(task, {
        tagColor: resolveTaskTagColor(task.taskTag, task.tagColor),
        linkedGoal: task.linkedGoalId ? goalTitleById.get(task.linkedGoalId) ?? undefined : undefined,
        linkedDirection: task.linkedDirectionId ? goalTitleById.get(task.linkedDirectionId) ?? undefined : undefined,
      }),
    [goalTitleById],
  )

  const openTaskPeek = useCallback(
    (task: Task) => {
      setTaskPeekAutoSelectTitle(false)
      setCreatingTaskPeekDraft(null)
      const nextSelectedTask = mapTaskToTaskPeekData(task)
      latestTaskPeekDraftRef.current = nextSelectedTask
      setSelectedTask(nextSelectedTask)
      setIsTaskPeekOpen(true)
    },
    [mapTaskToTaskPeekData],
  )

  const isTaskPeekSelected = useCallback(
    (taskId: string) => isTaskPeekOpen && selectedTask?.id === taskId,
    [isTaskPeekOpen, selectedTask?.id],
  )

  const resetGeneralTasksView = useCallback(() => {
    setGeneralSortMode('due')
    setGeneralGroupMode('none')
    setGeneralViewFilters(DEFAULT_GENERAL_VIEW_FILTERS)
    setGeneralShowSomeday(true)
    setGeneralShowTags(true)
    setGeneralLaterCollapsed(true)
    setGeneralCompletedCollapsed(true)
    setGeneralTagGroupOrder([])
    setGeneralDraggedTagGroupId(null)
    setGeneralDragOverTagGroupId(null)
    setGeneralQuickTagFilter(null)
  }, [])

  const showComingUpLinkTooltip = useCallback((event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setComingUpLinkTooltip({
      text,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    })
  }, [])

  const hideComingUpLinkTooltip = useCallback(() => {
    setComingUpLinkTooltip(null)
  }, [])

  const showGeneralTagDragTooltip = useCallback((event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setGeneralTagDragTooltip({
      text,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    })
  }, [])

  const hideGeneralTagDragTooltip = useCallback(() => {
    setGeneralTagDragTooltip(null)
  }, [])

  const showOutcomeAddTaskTooltip = useCallback((event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setOutcomeAddTaskTooltip({
      text,
      left: rect.left + rect.width / 2,
      top: rect.top - 8,
    })
  }, [])

  const hideOutcomeAddTaskTooltip = useCallback(() => {
    setOutcomeAddTaskTooltip(null)
  }, [])

  useEffect(() => {
    if (!selectedTask || safeTasks.some((task) => task.id === selectedTask.id)) return
    setSelectedTask(null)
    setIsTaskPeekOpen(false)
  }, [safeTasks, selectedTask])

  const focusTask = useCallback(
    (taskId: string) => {
      onUpdateTasks((current) =>
        current.map((task) => ({
          ...task,
          starred: !task.completed && task.id === taskId,
          updatedAt: task.id === taskId ? new Date().toISOString() : task.updatedAt,
        })),
      )
    },
    [onUpdateTasks],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isTypingContext =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable

      if ((event.key === 'f' || event.key === 'F') && selectedTask?.id && !isTypingContext) {
        event.preventDefault()
        focusTask(selectedTask.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusTask, selectedTask?.id])

  useEffect(() => {
    if (!focusCompletionFeedback) return
    const timeoutId = window.setTimeout(() => setFocusCompletionFeedback(null), FOCUS_COMPLETION_FEEDBACK_MS)
    return () => window.clearTimeout(timeoutId)
  }, [focusCompletionFeedback])

  useEffect(() => {
    if (!taskDeleteUndo) return
    const timeoutId = window.setTimeout(() => setTaskDeleteUndo(null), 4500)
    return () => window.clearTimeout(timeoutId)
  }, [taskDeleteUndo])

  useEffect(() => {
    if (!isTaskPeekOpen) return
    selectedTaskRowRef.current?.focus()
  }, [isTaskPeekOpen])

  useEffect(() => {
    writeTaskSuperPanelState(TASK_SUPER_GENERAL_PANEL_STORAGE_KEY, {
      showCurrentFocusStrip,
      generalShowSomeday,
      generalShowTags,
      generalLaterCollapsed,
      generalCompletedCollapsed,
      generalTagGroupOrder,
      generalSortMode,
      generalGroupMode,
      generalViewFilters,
    })
  }, [
    generalCompletedCollapsed,
    generalGroupMode,
    generalLaterCollapsed,
    generalShowTags,
    generalShowSomeday,
    generalSortMode,
    generalTagGroupOrder,
    generalViewFilters,
    showCurrentFocusStrip,
  ])

  useEffect(() => {
    writeTaskSuperPanelState(TASK_SUPER_GOALS_PANEL_STORAGE_KEY, {
      goalsColumnCategoryFilter,
      goalsColumnGoalFilter,
      goalsColumnViewOptions,
      goalsColumnHideEmpty,
      goalsColumnShowTaskTags,
      goalsColumnShowCompletedGoals,
      goalsCompletedSectionCollapsed,
    })
  }, [
    goalsColumnCategoryFilter,
    goalsColumnGoalFilter,
    goalsColumnHideEmpty,
    goalsColumnShowTaskTags,
    goalsColumnShowCompletedGoals,
    goalsCompletedSectionCollapsed,
    goalsColumnViewOptions,
  ])

  useEffect(() => {
    writeTaskSuperPanelState(TASK_SUPER_DIRECTIONS_PANEL_STORAGE_KEY, {
      directionalPreviewMode,
      directionalFocusMode,
      directionalSortMode,
      directionalHideEmpty,
      showDirectionalColumn,
    })
  }, [directionalFocusMode, directionalHideEmpty, directionalPreviewMode, directionalSortMode, showDirectionalColumn])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TASKS_VIEW_MODE_STORAGE_KEY, pageLayoutMode)
  }, [pageLayoutMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TASKS_COLLAPSED_STACKS_STORAGE_KEY, JSON.stringify(collapsedStacks))
  }, [collapsedStacks])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      const isInsidePageControlsPanel = Boolean(
        pageControlsPanelRef.current && target && pageControlsPanelRef.current.contains(target),
      )
      const isInsidePageControlsTrigger = Boolean(
        pageControlsPanelTriggerRef.current && target && pageControlsPanelTriggerRef.current.contains(target),
      )
      const isInsideGeneralPanel = Boolean(generalPanelRef.current && target && generalPanelRef.current.contains(target))
      const isInsideGeneralTrigger = Boolean(generalPanelTriggerRef.current && target && generalPanelTriggerRef.current.contains(target))
      const isInsideGoalsPanel = Boolean(goalsPanelRef.current && target && goalsPanelRef.current.contains(target))
      const isInsideGoalsTrigger = Boolean(goalsPanelTriggerRef.current && target && goalsPanelTriggerRef.current.contains(target))
      const isInsideDirectionsPanel = Boolean(directionsPanelRef.current && target && directionsPanelRef.current.contains(target))
      const isInsideDirectionsTrigger = Boolean(
        directionsPanelTriggerRef.current && target && directionsPanelTriggerRef.current.contains(target),
      )

      if (pageControlsPanelOpen && target && !isInsidePageControlsPanel && !isInsidePageControlsTrigger) {
        suppressNextPageControlsPanelOutsideClickRef.current = true
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        setPageControlsPanelOpen(false)
        return
      }

      if (generalPanelOpen && target && !isInsideGeneralPanel && !isInsideGeneralTrigger) {
        suppressNextGeneralPanelOutsideClickRef.current = true
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        setGeneralPanelOpen(false)
        return
      }

      if (goalsPanelOpen && target && !isInsideGoalsPanel && !isInsideGoalsTrigger) {
        suppressNextGoalsPanelOutsideClickRef.current = true
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        setGoalsPanelOpen(false)
        return
      }

      if (directionsPanelOpen && target && !isInsideDirectionsPanel && !isInsideDirectionsTrigger) {
        suppressNextDirectionsPanelOutsideClickRef.current = true
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        setDirectionsPanelOpen(false)
        return
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [directionsPanelOpen, generalPanelOpen, goalsPanelOpen, pageControlsPanelOpen])

  useEffect(() => {
    if (!comingUpLinkTooltip) return
    const dismissTooltip = () => setComingUpLinkTooltip(null)
    window.addEventListener('scroll', dismissTooltip, true)
    window.addEventListener('resize', dismissTooltip)
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true)
      window.removeEventListener('resize', dismissTooltip)
    }
  }, [comingUpLinkTooltip])

  useEffect(() => {
    if (!generalTagDragTooltip) return
    const dismissTooltip = () => setGeneralTagDragTooltip(null)
    window.addEventListener('scroll', dismissTooltip, true)
    window.addEventListener('resize', dismissTooltip)
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true)
      window.removeEventListener('resize', dismissTooltip)
    }
  }, [generalTagDragTooltip])

  useEffect(() => {
    if (!outcomeAddTaskTooltip) return
    const dismissTooltip = () => setOutcomeAddTaskTooltip(null)
    window.addEventListener('scroll', dismissTooltip, true)
    window.addEventListener('resize', dismissTooltip)
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true)
      window.removeEventListener('resize', dismissTooltip)
    }
  }, [outcomeAddTaskTooltip])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!suppressNextPageControlsPanelOutsideClickRef.current
        && !suppressNextGeneralPanelOutsideClickRef.current
        && !suppressNextGoalsPanelOutsideClickRef.current
        && !suppressNextDirectionsPanelOutsideClickRef.current) {
        return
      }

      suppressNextPageControlsPanelOutsideClickRef.current = false
      suppressNextGeneralPanelOutsideClickRef.current = false
      suppressNextGoalsPanelOutsideClickRef.current = false
      suppressNextDirectionsPanelOutsideClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  const updateTask = useCallback(
    (taskId: string, updater: (task: Task) => Task) => {
      onUpdateTasks((current) => current.map((task) => (task.id === taskId ? withTaskTimestamp(updater(task)) : task)))
    },
    [onUpdateTasks],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      onUpdateTasks((current) => current.filter((task) => task.id !== taskId))
      if (selectedTask?.id === taskId) {
        setSelectedTask(null)
        setIsTaskPeekOpen(false)
      }
    },
    [onUpdateTasks, selectedTask?.id],
  )

  const toggleTaskCompletion = useCallback(
    (taskId: string) => {
      onUpdateTasks((current) => {
        const timestamp = new Date().toISOString()
        const taskToToggle = current.find((task) => task.id === taskId) ?? null
        if (!taskToToggle) return current
        const nextCompleted = !taskToToggle.completed
        const shouldAdvanceFocus = taskToToggle.starred && nextCompleted
        const nextFocusId = shouldAdvanceFocus ? getNextFocusCandidateId(current, taskId, todayIso) : null
        return current.map((task) => {
          if (task.id === taskId) {
            return {
              ...task,
              completed: nextCompleted,
              completedAt: nextCompleted ? timestamp : null,
              starred: nextCompleted ? false : task.starred,
              updatedAt: timestamp,
            }
          }
          if (shouldAdvanceFocus) {
            return {
              ...task,
              starred: !task.completed && task.id === nextFocusId,
              updatedAt: task.id === nextFocusId ? timestamp : task.updatedAt,
            }
          }
          return task
        })
      })

      const completedTask = safeTasks.find((task) => task.id === taskId)
      if (completedTask?.starred && !completedTask.completed) {
        const descriptor = getTaskLinkDescriptor(completedTask, goalById, lifeGoalCategories, safeTasks)
        setFocusCompletionFeedback({
          taskId,
          taskText: completedTask.text,
          contextLabel: descriptor.label,
        })
      }
    },
    [goalById, lifeGoalCategories, onUpdateTasks, safeTasks, todayIso],
  )

  const restoreTask = useCallback(
    (taskId: string) => {
      updateTask(taskId, (task) => ({
        ...task,
        completed: false,
        completedAt: null,
      }))
    },
    [updateTask],
  )

  const handleTaskPeekClose = useCallback(() => {
    const closingTask = latestTaskPeekDraftRef.current ?? selectedTask
    const createdDraft = creatingTaskPeekDraft

    if (
      closingTask &&
      createdDraft?.id === closingTask.id &&
      isTaskPeekDraftEmpty(closingTask, {
        seedTitle: createdDraft.seedTitle,
        seedLinkedGoalId: createdDraft.seedLinkedGoalId,
        seedLinkedDirectionId: createdDraft.seedLinkedDirectionId,
      })
    ) {
      deleteTask(closingTask.id)
    }

    setIsTaskPeekOpen(false)
    setSelectedTask(null)
    setTaskPeekAutoSelectTitle(false)
    setCreatingTaskPeekDraft(null)
    latestTaskPeekDraftRef.current = null
  }, [creatingTaskPeekDraft, deleteTask, selectedTask])

  const handleTaskPeekUpdate = useCallback(
    (updatedTask: TaskPeekTaskData) => {
      onUpdateTasks((current) =>
        current.map((task) => {
          if (task.id !== updatedTask.id) return task

          const somedayState = normalizeSomedayTagState(updatedTask.tag)
          const nextTagColor =
            somedayState.taskTag && typeof updatedTask.tagColor === 'string' && updatedTask.tagColor.trim().length > 0
              ? updatedTask.tagColor
              : somedayState.taskTag
                ? resolveTaskTagColor(somedayState.taskTag)
                : null
          const linkedGoalId = updatedTask.linkedGoalId || null
          const linkedDirectionId = updatedTask.linkedDirectionId || null

          return withTaskTimestamp(
            taskPeekDataToTask(task, updatedTask, {
              dueDate: withTaskDueDateFields(updatedTask.dueDate ?? null).dueDate,
              dueTime: normalizeDueTime(updatedTask.dueTime),
              isSomeday: updatedTask.isSomeday === true || somedayState.isSomeday,
              taskTag: somedayState.taskTag,
              tagColor: nextTagColor,
              linkedGoalId,
              linkedDirectionId,
              updatedAt: updatedTask.updatedAt ?? new Date().toISOString(),
            }),
          )
        }),
      )
      latestTaskPeekDraftRef.current = updatedTask
      setSelectedTask(updatedTask)
    },
    [onUpdateTasks],
  )

  const handleTaskPeekDelete = useCallback(
    (taskId: string) => {
      const deletedTask = safeTasks.find((task) => task.id === taskId) ?? null
      if (creatingTaskPeekDraft?.id === taskId) {
        setCreatingTaskPeekDraft(null)
      }
      deleteTask(taskId)
      if (deletedTask) {
        setTaskDeleteUndo({
          task: deletedTask,
          message: 'Task deleted',
        })
      }
    },
    [creatingTaskPeekDraft?.id, deleteTask, safeTasks],
  )

  const undoDeletedTask = useCallback(() => {
    if (!taskDeleteUndo) return
    onUpdateTasks((current) => [...current, taskDeleteUndo.task].slice().sort((left, right) => left.order - right.order))
    setTaskDeleteUndo(null)
  }, [onUpdateTasks, taskDeleteUndo])

  const handleTaskPeekComplete = useCallback(
    (taskId: string) => {
      toggleTaskCompletion(taskId)
      setIsTaskPeekOpen(false)
      setSelectedTask(null)
      if (creatingTaskPeekDraft?.id === taskId) {
        setCreatingTaskPeekDraft(null)
      }
    },
    [creatingTaskPeekDraft?.id, toggleTaskCompletion],
  )

  const rescheduleTask = useCallback(
    (taskId: string, deltaDays: number) => {
      updateTask(taskId, (task) => ({
        ...task,
        ...withTaskDueDateFields(shiftIsoDate(task.dueDate ?? todayIso, deltaDays)),
      }))
    },
    [todayIso, updateTask],
  )

  const createTask = useCallback(
    (draft: CaptureDraft, options: { focus?: boolean; scope?: CaptureScope; milestoneId?: string | null } = {}) => {
      const text = draft.text.trim()
      if (!text) return null

      const timestamp = new Date().toISOString()
      const taskScope = options.scope ?? captureScope
      const nextLinkedGoalId =
        draft.linkedGoalId || draft.linkedDirectionId
          ? draft.linkedGoalId || null
          : taskScope?.type === 'goal'
            ? taskScope.id
            : null
      const nextLinkedDirectionId =
        draft.linkedGoalId || draft.linkedDirectionId
          ? draft.linkedDirectionId || null
          : taskScope?.type === 'direction'
            ? taskScope.id
            : null
      const somedayState = normalizeSomedayTagState(draft.taskTag)
      const nextTask: Task = {
        id: createTaskId(),
        text,
        order: getNextTaskOrder(safeTasks),
        dueDate: draft.dueDate || null,
        dueTime: normalizeDueTime(draft.dueTime),
        isSomeday: somedayState.isSomeday,
        taskTag: somedayState.taskTag,
        tagColor: somedayState.taskTag ? resolveTaskTagColor(somedayState.taskTag) : null,
        starred: options.focus ?? false,
        linkedGoalId: nextLinkedGoalId,
        linkedDirectionId: nextLinkedDirectionId,
        completed: false,
        completedAt: null,
        notes: '',
        priority: draft.priority,
        subtasks: [],
        milestoneId: options.milestoneId ?? null,
        phase: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      onUpdateTasks((current) => {
        const withFocusCleared = nextTask.starred
          ? current.map((task) => ({ ...task, starred: false }))
          : current
        return [nextTask, ...withFocusCleared]
      })

      setCaptureDraft(createEmptyCaptureDraft())
      setCaptureExpanded(false)
      setCaptureScope(null)
      setTaskPeekAutoSelectTitle(true)
      setCreatingTaskPeekDraft({
        id: nextTask.id,
        seedTitle: nextTask.text,
        seedLinkedGoalId: nextTask.linkedGoalId,
        seedLinkedDirectionId: nextTask.linkedDirectionId,
      })
      const nextSelectedTask = {
        ...mapTaskToTaskPeekData(nextTask),
        title: '',
      }
      latestTaskPeekDraftRef.current = nextSelectedTask
      setSelectedTask(nextSelectedTask)
      setIsTaskPeekOpen(true)
      return nextTask
    },
    [captureScope, mapTaskToTaskPeekData, onUpdateTasks, safeTasks],
  )

  const submitQuickCapture = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault()
      createTask(captureDraft)
    },
    [captureDraft, createTask],
  )

  const submitFocusPrompt = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault()
      const text = focusPromptDraft.trim()
      if (!text) return
      const created = createTask(
        {
          ...createEmptyCaptureDraft(),
          text,
          dueDate: todayIso,
        },
        { focus: true, scope: null },
      )
      if (created) {
        setFocusPromptDraft('')
      }
    },
    [createTask, focusPromptDraft, todayIso],
  )

  const handleQuickCaptureKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && !captureExpanded) {
      event.preventDefault()
      setCaptureExpanded(true)
      window.setTimeout(() => {
        quickCaptureDueDateRef.current?.focus()
      }, 0)
    }
  }, [captureExpanded])

  const currentFocusLinkDescriptor = useMemo(
    () => (focusedTask ? getTaskLinkDescriptor(focusedTask, goalById, lifeGoalCategories, safeTasks) : null),
    [focusedTask, goalById, lifeGoalCategories, safeTasks],
  )

  const scopedActiveTasks = useMemo(() => {
    const activeTasks = filteredTasks
      .filter((task) => !task.completed)
      .filter((task) => !isSomedayTask(task))

    return activeTasks
      .filter((task) => matchesScope(task, scope, todayIso))
      .slice()
      .sort(compareExecutionTasks(todayIso))
  }, [filteredTasks, scope, todayIso])

  const scopedGeneralTasks = useMemo(
    () =>
      filteredTasks
        .filter((task) => !task.completed)
        .filter((task) => !isSomedayTask(task))
        .filter((task) => !task.linkedGoalId && !task.linkedDirectionId)
        .filter((task) => !generalQuickTagFilter || normalizeTaskTag(task.taskTag) === generalQuickTagFilter)
        .filter((task) => !generalViewFilters.highPriority || task.priority === 'high')
        .filter((task) => !generalViewFilters.dueToday || matchesGeneralDueTodayFilter(task, todayIso))
        .filter((task) => !generalViewFilters.withNotes || Boolean(task.notes.trim()))
        .filter((task) => !generalViewFilters.withSubtasks || (task.subtasks?.length ?? 0) > 0)
        .slice()
        .sort(compareGeneralTasks(generalSortMode, todayIso)),
    [filteredTasks, generalQuickTagFilter, generalSortMode, generalViewFilters, todayIso],
  )
  const collapsedGeneralColumnSummary = useMemo(() => {
    const dueToday = scopedGeneralTasks.filter((task) => task.dueDate === todayIso).length
    const overdue = scopedGeneralTasks.filter((task) => Boolean(task.dueDate) && task.dueDate! < todayIso).length
    const highPriority = scopedGeneralTasks.filter((task) => task.priority === 'high').length

    return [
      dueToday > 0 ? `${dueToday} due today` : null,
      overdue > 0 ? `${overdue} overdue` : null,
      highPriority > 0 ? `${highPriority} high priority` : null,
    ].filter(Boolean) as string[]
  }, [scopedGeneralTasks, todayIso])
  const generalTaskGroups = useMemo(
    () =>
      generalViewFilters.dueToday
        ? buildGeneralDueTodayTaskGroups(scopedGeneralTasks, todayIso)
        : buildGeneralTaskGroups(scopedGeneralTasks, generalGroupMode, todayIso, generalTagGroupOrder),
    [generalGroupMode, generalTagGroupOrder, generalViewFilters.dueToday, scopedGeneralTasks, todayIso],
  )
  const shouldShowGeneralTaskGroupHeaders = generalViewFilters.dueToday || generalGroupMode !== 'none'
  const scopedCompletedGeneralTasks = useMemo(
    () =>
      safeTasks
        .filter((task) => task.completed)
        .filter((task) => !isSomedayTask(task))
        .filter((task) => !task.linkedGoalId && !task.linkedDirectionId)
        .filter((task) => !generalQuickTagFilter || normalizeTaskTag(task.taskTag) === generalQuickTagFilter)
        .filter((task) => !generalViewFilters.highPriority || task.priority === 'high')
        .filter((task) => !generalViewFilters.dueToday || matchesGeneralDueTodayFilter(task, todayIso))
        .filter((task) => !generalViewFilters.withNotes || Boolean(task.notes.trim()))
        .filter((task) => !generalViewFilters.withSubtasks || (task.subtasks?.length ?? 0) > 0)
        .slice()
        .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? '')),
    [generalQuickTagFilter, generalViewFilters, safeTasks, todayIso],
  )
  const visibleCompletedGeneralTasks = useMemo(
    () => scopedCompletedGeneralTasks.slice(0, 10),
    [scopedCompletedGeneralTasks],
  )

  const isAllGoalsMode = goalsColumnGoalFilter === 'all'
  const outcomeGoalCategoryOptions = useMemo(
    () => Array.from(new Set(orderedOutcomeGoals.map((goal) => goal.category.trim()).filter(Boolean))),
    [orderedOutcomeGoals],
  )
  const filteredGoalSet = useMemo(
    () =>
      orderedOutcomeGoals.filter(
        (goal) =>
          (goalsColumnCategoryFilter.length === 0 || goalsColumnCategoryFilter.includes(goal.category.trim())) &&
          (goalsColumnGoalFilter === 'all' || goal.id === goalsColumnGoalFilter),
      ),
    [goalsColumnCategoryFilter, goalsColumnGoalFilter, orderedOutcomeGoals],
  )
  const categoryScopedOutcomeGoals = useMemo(
    () =>
      orderedOutcomeGoals.filter((goal) =>
        goalsColumnCategoryFilter.length === 0 ? true : goalsColumnCategoryFilter.includes(goal.category.trim()),
      ),
    [goalsColumnCategoryFilter, orderedOutcomeGoals],
  )
  const selectedGoalForColumn = useMemo(
    () => (!isAllGoalsMode ? orderedOutcomeGoals.find((goal) => goal.id === goalsColumnGoalFilter) ?? null : null),
    [goalsColumnGoalFilter, isAllGoalsMode, orderedOutcomeGoals],
  )

  useEffect(() => {
    if (goalsColumnGoalFilter !== 'all' && !filteredGoalSet.some((goal) => goal.id === goalsColumnGoalFilter)) {
      setGoalsColumnGoalFilter('all')
    }
  }, [filteredGoalSet, goalsColumnGoalFilter])

  useEffect(() => {
    setGoalsColumnCompletedOpen(false)
  }, [goalsColumnGoalFilter])

  useEffect(() => {
    if (expandedOutcomeGoalId && !filteredGoalSet.some((goal) => goal.id === expandedOutcomeGoalId)) {
      setExpandedOutcomeGoalId(null)
    }
  }, [expandedOutcomeGoalId, filteredGoalSet])

  const scopedGoalGroups = useMemo(
    () => {
      const goalOrderIndex = new Map(filteredGoalSet.map((goal, index) => [goal.id, index]))
      const tomorrowIso = shiftIsoDate(todayIso, 1)

      return filteredGoalSet
        .map((goal) => {
          const scopedTasks = scopedActiveTasks
            .filter((task) => task.linkedGoalId === goal.id)
            .slice()
            .sort((left, right) => left.order - right.order)
          const activeTasks = safeTasks
            .filter((task) => !task.completed)
            .filter((task) => !isSomedayTask(task))
            .filter((task) => task.linkedGoalId === goal.id)
            .slice()
            .sort((left, right) => left.order - right.order)
          const allDefinedTasks = safeTasks
            .filter((task) => task.linkedGoalId === goal.id)
            .slice()
            .sort((left, right) => left.order - right.order)
          const completedTasks = safeTasks
            .filter((task) => task.completed)
            .filter((task) => !isSomedayTask(task))
            .filter((task) => task.linkedGoalId === goal.id)
            .slice()
            .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))
          const nextTask = activeTasks[0] ?? scopedTasks[0] ?? null
          const dueSoonTask =
            activeTasks.find((task) => task.dueDate === todayIso) ??
            activeTasks.find((task) => task.dueDate === tomorrowIso) ??
            null
          const highPriorityTasks = activeTasks
            .filter((task) => task.priority === 'high')
          const highPriorityPreviewTasks = highPriorityTasks
            .slice(0, 2)

          return {
            goal,
            scopedTasks,
            activeTasks,
            allDefinedTasks,
            completedTasks,
            highPriorityTasks,
            highPriorityPreviewTasks,
            nextTask,
            dueSoonTask,
          }
        })
        .filter(({ allDefinedTasks }) => (goalsColumnHideEmpty ? allDefinedTasks.length > 0 : true))
        .map(({ goal, activeTasks, allDefinedTasks, completedTasks, highPriorityTasks, highPriorityPreviewTasks, nextTask, dueSoonTask }) => ({
          id: goal.id,
          goal,
          label: goal.title,
          sublabel: `${activeTasks.length} active tasks`,
          tasks: activeTasks,
          completedTasks,
          allDefinedTaskCount: allDefinedTasks.length,
          highPriorityTasks,
          highPriorityPreviewTasks,
          nextTask,
          dueSoonTask,
          isCompletedGoal: goal.status === 'complete',
          kind: 'goal' as const,
        }))
        .sort((left, right) => (goalOrderIndex.get(left.id) ?? 0) - (goalOrderIndex.get(right.id) ?? 0))
    },
    [filteredGoalSet, goalsColumnHideEmpty, safeTasks, scopedActiveTasks, todayIso],
  )
  const scopedActiveGoalGroups = useMemo(
    () => scopedGoalGroups.filter((group) => !group.isCompletedGoal),
    [scopedGoalGroups],
  )
  const collapsedOutcomeColumnSummary = useMemo(() => {
    const outcomeTasks = scopedActiveGoalGroups.flatMap((group) => group.tasks)
    const dueToday = outcomeTasks.filter((task) => task.dueDate === todayIso).length
    const overdue = outcomeTasks.filter((task) => Boolean(task.dueDate) && task.dueDate! < todayIso).length
    const highPriority = outcomeTasks.filter((task) => task.priority === 'high').length

    return [
      dueToday > 0 ? `${dueToday} due today` : null,
      overdue > 0 ? `${overdue} overdue` : null,
      highPriority > 0 ? `${highPriority} high priority` : null,
    ].filter(Boolean) as string[]
  }, [scopedActiveGoalGroups, todayIso])
  const scopedCompletedGoalGroups = useMemo(
    () => scopedGoalGroups.filter((group) => group.isCompletedGoal),
    [scopedGoalGroups],
  )

  const goalsColumnSummary = useMemo(() => {
    const segments: string[] = []
    const activeViewLabels = goalsColumnViewOptions.allTasks
      ? ['All tasks', ...(goalsColumnViewOptions.completed ? ['Completed'] : [])]
      : [
          goalsColumnViewOptions.next ? 'Next task' : null,
          goalsColumnViewOptions.dueSoon ? 'Due soon' : null,
          goalsColumnViewOptions.highPriority ? 'High priority' : null,
          goalsColumnViewOptions.completed ? 'Completed' : null,
        ].filter(Boolean) as string[]
    const modeLabel = activeViewLabels.length > 0 ? activeViewLabels.join(' + ') : 'None'

    if (isAllGoalsMode) {
      segments.push('All goals')
      segments.push(modeLabel)
    } else {
      if (selectedGoalForColumn) segments.push(selectedGoalForColumn.title)
      segments.push(modeLabel)
    }

    if (goalsColumnCategoryFilter.length > 0) {
      segments.push(`Category: ${goalsColumnCategoryFilter.join(', ')}`)
    }

    if (goalsColumnHideEmpty) {
      segments.push('Hide empty')
    }

    return segments.join(' · ')
  }, [goalsColumnCategoryFilter, goalsColumnHideEmpty, goalsColumnViewOptions, isAllGoalsMode, selectedGoalForColumn])

  const resetOutcomeGoalsView = useCallback(() => {
    setGoalsColumnCategoryFilter([])
    setGoalsColumnGoalFilter('all')
    setGoalsColumnViewOptions(DEFAULT_GOALS_COLUMN_VIEW_OPTIONS)
    setGoalsColumnHideEmpty(false)
    setGoalsColumnShowTaskTags(false)
    setGoalsColumnShowCompletedGoals(false)
    setGoalsCompletedSectionCollapsed(true)
  }, [])

  const toggleGoalsColumnViewOption = useCallback((key: keyof GoalsColumnViewOptions) => {
    setGoalsColumnViewOptions((current) => {
      const nextValue = !current[key]

      if (key === 'allTasks') {
        return {
          ...current,
          allTasks: nextValue,
          next: nextValue ? false : current.next,
          dueSoon: nextValue ? false : current.dueSoon,
          highPriority: nextValue ? false : current.highPriority,
        }
      }

      if (key === 'next') {
        return {
          ...current,
          next: nextValue,
          allTasks: nextValue ? false : current.allTasks,
        }
      }

      if (key === 'dueSoon' || key === 'highPriority') {
        return {
          ...current,
          [key]: nextValue,
          allTasks: nextValue ? false : current.allTasks,
        }
      }

      return {
        ...current,
        [key]: nextValue,
      }
    })
  }, [])

  const openGeneralQuickCapture = useCallback(() => {
    createTask(
      {
        ...createEmptyCaptureDraft(),
        text: 'New task',
      },
      {
        scope: null,
      },
    )
  }, [createTask])

  const addTaskForGoalFromOutcome = useCallback(
    (goalId: string, goalTitle: string) => {
      createTask(
        {
          ...createEmptyCaptureDraft(),
          text: 'New task',
        },
        {
          scope: { type: 'goal', id: goalId, title: goalTitle },
        },
      )
    },
    [createTask],
  )

  const addTaskForGoalMilestoneFromOutcome = useCallback(
    (goalId: string, goalTitle: string, milestoneId?: string | null) => {
      createTask(
        {
          ...createEmptyCaptureDraft(),
          text: 'New task',
        },
        {
          scope: { type: 'goal', id: goalId, title: goalTitle },
          milestoneId: milestoneId ?? null,
        },
      )
    },
    [createTask],
  )

  const scopedDirectionGroups = useMemo(
    () => {
      const baseGoalOrder = new Map(directionalGoals.map((goal, index) => [goal.id, index]))
      const sourceTasks = directionalPreviewMode === 'follow-scope' ? scopedActiveTasks : safeTasks

      return directionalGoals
        .map((goal) => {
          const directionTasks = sourceTasks
            .filter((task) => !task.completed)
            .filter((task) => !isSomedayTask(task))
            .filter((task) => task.linkedDirectionId === goal.id || (task.linkedDirectionId == null && task.linkedGoalId === goal.id))
            .slice()
            .sort((left, right) => left.order - right.order)

          const hasFocusedTask = directionTasks.some((task) => task.starred)
          const highestPriorityRank = directionTasks.reduce((highest, task) => Math.max(highest, getPriorityRank(task.priority)), 0)
          const recentSignal = directionTasks
            .map((task) => task.updatedAt ?? task.createdAt)
            .filter((value): value is string => typeof value === 'string' && value.length > 0)
            .sort((left, right) => right.localeCompare(left))[0] ?? null

          return {
            goal,
            tasks: directionTasks,
            preview: directionTasks.slice(0, 3),
            hasFocusedTask,
            highestPriorityRank,
            recentSignal,
          }
        })
        .filter((group) => {
          if (directionalFocusMode === 'off') return true
          return group.hasFocusedTask || group.highestPriorityRank > 0
        })
        .filter((group) => (directionalHideEmpty ? group.preview.length > 0 : true))
        .sort((left, right) => {
          if (directionalSortMode === 'most-active') return right.tasks.length - left.tasks.length
          if (directionalSortMode === 'recently-updated') return (right.recentSignal ?? '').localeCompare(left.recentSignal ?? '')
          return (baseGoalOrder.get(left.goal.id) ?? 0) - (baseGoalOrder.get(right.goal.id) ?? 0)
        })
    },
    [
      directionalFocusMode,
      directionalGoals,
      directionalHideEmpty,
      directionalPreviewMode,
      directionalSortMode,
      safeTasks,
      scopedActiveTasks,
    ],
  )
  const collapsedDirectionalColumnSummary = useMemo(() => {
    const directionTasks = scopedDirectionGroups.flatMap((group) => group.tasks)
    const dueToday = directionTasks.filter((task) => task.dueDate === todayIso).length
    const overdue = directionTasks.filter((task) => Boolean(task.dueDate) && task.dueDate! < todayIso).length
    const highPriority = directionTasks.filter((task) => task.priority === 'high').length

    return [
      dueToday > 0 ? `${dueToday} due today` : null,
      overdue > 0 ? `${overdue} overdue` : null,
      highPriority > 0 ? `${highPriority} high priority` : null,
    ].filter(Boolean) as string[]
  }, [scopedDirectionGroups, todayIso])
  const areAllColumnsCollapsed =
    collapsedStacks.general && collapsedStacks.outcome && (!showDirectionalColumn || collapsedStacks.directional)

  const scopedSomedayTasks = useMemo(
    () =>
      filteredTasks
        .filter((task) => !task.completed)
        .filter((task) => isSomedayTask(task))
        .slice()
        .sort(compareGeneralTasks(generalSortMode, todayIso)),
    [filteredTasks, generalSortMode, todayIso],
  )

  const pageHeaderDate = useMemo(() => new Date(), [])
  const pageGreeting = useMemo(() => getDashboardGreeting(pageHeaderDate, 'Jack'), [pageHeaderDate])
  const dueTodayCount = useMemo(
    () =>
      safeTasks.filter((task) => !task.completed && !isSomedayTask(task) && task.dueDate === todayIso).length,
    [safeTasks, todayIso],
  )
  const highPriorityCount = useMemo(
    () =>
      safeTasks.filter((task) => !task.completed && !isSomedayTask(task) && task.priority === 'high').length,
    [safeTasks],
  )
  const upcoming48HourCount = useMemo(
    () =>
      safeTasks.filter((task) => {
        if (task.completed || isSomedayTask(task)) return false
        const dueTimestamp = getTaskDueTimestamp(task)
        if (dueTimestamp === null) return false
        const now = pageHeaderDate.getTime()
        const horizon = now + 48 * 60 * 60 * 1000
        return dueTimestamp > now && dueTimestamp <= horizon
      }).length,
    [pageHeaderDate, safeTasks],
  )
  const upcomingWeekCount = useMemo(
    () =>
      safeTasks.filter((task) => {
        if (task.completed || isSomedayTask(task)) return false
        const dueTimestamp = getTaskDueTimestamp(task)
        if (dueTimestamp === null) return false
        const now = pageHeaderDate.getTime()
        const horizon = now + 7 * 24 * 60 * 60 * 1000
        return dueTimestamp > now && dueTimestamp <= horizon
      }).length,
    [pageHeaderDate, safeTasks],
  )
  const overdueTaskCount = useMemo(
    () =>
      safeTasks.filter((task) => !task.completed && !isSomedayTask(task) && Boolean(task.dueDate && task.dueDate < todayIso)).length,
    [safeTasks, todayIso],
  )
  const completedThisWeekCount = useMemo(() => {
    const weekStart = getStartOfWeek(pageHeaderDate)
    return safeTasks.filter((task) => {
      if (!task.completed || !task.completedAt) return false
      const completedAt = new Date(task.completedAt)
      return !Number.isNaN(completedAt.getTime()) && completedAt >= weekStart
    }).length
  }, [pageHeaderDate, safeTasks])
  const pageSummaryLine = useMemo(() => {
    const dateLabel = formatDashboardHeaderDate(pageHeaderDate)
    if (dueTodayCount > 0) {
      return `${dateLabel} — ${dueTodayCount} ${dueTodayCount === 1 ? 'task' : 'tasks'} due today`
    }
    if (upcoming48HourCount > 0) {
      return `${dateLabel} — ${upcoming48HourCount} ${upcoming48HourCount === 1 ? 'task' : 'tasks'} coming up`
    }
    if (upcomingWeekCount > 0) {
      return `${dateLabel} — ${upcomingWeekCount} ${upcomingWeekCount === 1 ? 'task' : 'tasks'} this week`
    }
    return `${dateLabel} — nothing scheduled`
  }, [dueTodayCount, pageHeaderDate, upcoming48HourCount, upcomingWeekCount])

  return (
    <div className="flex min-h-screen flex-col">
      <div
        className={`tasks-page-shell mx-auto flex min-h-0 w-full max-w-[1520px] flex-col gap-3.5 ${
          pageLayoutMode === 'columns' && areAllColumnsCollapsed ? '' : 'flex-1'
        }`}
      >
        <div className="flex flex-col gap-3 px-1 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">{pageGreeting}</h1>
            <p className="mt-1 text-[15px] text-zinc-500">{pageSummaryLine}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-zinc-500">
            <div className="inline-flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full bg-emerald-400/90" />
              <span>{completedThisWeekCount} completed this week</span>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="h-[7px] w-[7px] rounded-full bg-amber-400/90" />
              <span>{overdueTaskCount} overdue</span>
            </div>
            <div className="relative inline-flex items-center">
              <IconButton
                ref={pageControlsPanelTriggerRef}
                onClick={() => setPageControlsPanelOpen((current) => !current)}
                variant="muted"
                size="sm"
                ariaLabel={pageControlsPanelOpen ? 'Close page controls' : 'Open page controls'}
                icon={<GoalsControlIcon />}
              />
              <AnimatePresence>
                {pageControlsPanelOpen ? (
                  <motion.aside
                    ref={pageControlsPanelRef}
                    className="absolute right-0 top-[calc(100%+10px)] z-[50] w-[320px] max-w-[calc(100vw-32px)]"
                    initial={{ opacity: 0, x: 12, y: -6 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: 12, y: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    <ControlsPanelShell className="space-y-3">
                      <GoalsPanelSection title="View">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {SCOPE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setScope(option.id)}
                              className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                                scope === option.id
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.11)] text-white'
                                  : 'border-white/[0.08] bg-white/[0.03] text-white/66 hover:bg-white/[0.05] hover:text-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </GoalsPanelSection>

                      <GoalsPanelSection title="Layout">
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPageLayoutMode('columns')}
                              className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                                pageLayoutMode === 'columns'
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.11)] text-white'
                                  : 'border-white/[0.08] bg-white/[0.03] text-white/66 hover:bg-white/[0.05] hover:text-white'
                              }`}
                            >
                              Columns
                            </button>
                            <button
                              type="button"
                              onClick={() => setPageLayoutMode('stacked')}
                              className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                                pageLayoutMode === 'stacked'
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.11)] text-white'
                                  : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.05] hover:text-white/72'
                              }`}
                            >
                              Stacked
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                            <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Show Directional Goals</span>
                            <Toggle
                              checked={showDirectionalColumn}
                              onChange={() => {
                                if (showDirectionalColumn) setDirectionsPanelOpen(false)
                                setShowDirectionalColumn((current) => !current)
                              }}
                              role="switch"
                              aria-checked={showDirectionalColumn}
                              aria-label={showDirectionalColumn ? 'Hide Directional Goals column' : 'Show Directional Goals column'}
                            />
                          </div>
                        </div>
                      </GoalsPanelSection>

                      <GoalsPanelSection title="Actions">
                        <div className="space-y-2">
                          <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                            <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Show current focus</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={showCurrentFocusStrip}
                              onClick={() => setShowCurrentFocusStrip((current) => !current)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                                showCurrentFocusStrip
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.16)]'
                                  : 'border-white/[0.08] bg-white/[0.04]'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 rounded-full bg-white transition ${showCurrentFocusStrip ? 'translate-x-5' : 'translate-x-1'}`}
                              />
                            </button>
                          </label>
                        </div>
                      </GoalsPanelSection>
                    </ControlsPanelShell>
                  </motion.aside>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {showCurrentFocusStrip ? <FocusStrip /> : null}

        <SectionCard
          shell="task"
          compact
          className="mt-1 flex-shrink-0 px-0 pt-2 pb-0 sm:px-0 sm:pt-2 sm:pb-0"
        >
          <div className="mb-2 flex items-center justify-between gap-3 px-3.5 sm:px-4">
            <div className="flex items-center gap-2">
              <ClockGlyph />
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Coming Up</p>
            </div>
            <button
              type="button"
              onClick={() => setScope('upcoming')}
              className="inline-flex items-center gap-1 text-[12px] text-zinc-500 transition hover:text-zinc-400"
            >
              <span>View all</span>
              <ArrowRightGlyph />
            </button>
          </div>
          <div className="hover-scrollbars overflow-x-auto">
            {comingUpStripTasks.length > 0 ? (
              <div className="px-3.5 pb-4 sm:px-4">
                <div className="flex min-w-max gap-2">
                  {comingUpStripTasks.map((task) => {
                    const linkedEntity = goalById.get(task.linkedGoalId ?? task.linkedDirectionId ?? '') ?? null
                    const comingUpAccentStyles = linkedEntity
                      ? getComingUpGoalAccentStyles(getLifeGoalCategoryColor(linkedEntity.category, lifeGoalCategories))
                      : getComingUpTaskTagAccentStyles(task.taskTag, task.tagColor)
                    const timingLabel = task.dueDate ? formatComingUpTimingLabel(task.dueDate, task.dueTime, todayIso) : 'No date'
                    const linkedTooltip = task.linkedDirectionId
                      ? `Directional Goal · ${task.linkedDirection ?? linkedEntity?.title ?? 'Linked goal'}`
                      : task.linkedGoalId
                        ? `Outcome Goal · ${task.linkedGoal ?? linkedEntity?.title ?? 'Linked goal'}`
                        : null

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => openTaskPeek(task)}
                        className="flex min-w-[198px] items-center gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-left transition hover:bg-white/[0.05]"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: comingUpAccentStyles.dotColor }} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-400">{task.text}</span>
                        <span
                          className="shrink-0 rounded-full px-[5px] py-[1px] text-[10px] font-medium"
                          style={comingUpAccentStyles.chipStyle}
                        >
                          {timingLabel}
                        </span>
                        {task.priority === 'high' ? (
                          <span className="shrink-0 rounded-full border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-[6px] py-[1px] text-[10px] font-medium text-[rgb(var(--theme-negative-rgb)/0.9)]">
                            High
                          </span>
                        ) : null}
                        {linkedTooltip ? (
                          <span
                            className="flex shrink-0 items-center"
                            aria-label={linkedTooltip}
                            onMouseEnter={(event) => showComingUpLinkTooltip(event, linkedTooltip)}
                            onMouseLeave={hideComingUpLinkTooltip}
                            onFocus={(event) => showComingUpLinkTooltip(event, linkedTooltip)}
                            onBlur={hideComingUpLinkTooltip}
                            tabIndex={0}
                          >
                            <Link2 className="h-3.5 w-3.5 text-zinc-500 transition-colors hover:text-zinc-300" />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="px-3.5 text-sm text-white/42 sm:px-4">Nothing coming up</p>
            )}
          </div>
          {comingUpLinkTooltip ? (
            <div
              className="theme-tooltip pointer-events-none fixed left-0 top-0 z-[120] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
              style={{
                left: comingUpLinkTooltip.left,
                top: comingUpLinkTooltip.top,
              }}
            >
              {comingUpLinkTooltip.text}
            </div>
          ) : null}
        </SectionCard>

        <section
          className={`mt-1 ${
            pageLayoutMode === 'columns'
              ? `flex flex-col xl:flex-row w-full gap-4 overflow-visible ${areAllColumnsCollapsed ? '' : 'h-[520px] 2xl:h-[720px]'}`
              : 'flex w-full max-w-full flex-col gap-6'
          }`}
        >
            <SectionCard
              shell="task"
              compact
              className={`flex flex-col px-0 py-3.5 sm:px-0 sm:py-4 [--card-bg:#12141A] ${
                pageLayoutMode === 'columns'
                  ? `flex flex-col flex-1 min-h-0 min-w-0 ${collapsedStacks.general ? 'self-start' : ''}`
                  : 'w-full max-w-full'
              }`}
            >
              <div className="relative mb-3 px-3.5 sm:px-4">
                <SectionHeader
                  title="General Tasks"
                  count={scopedGeneralTasks.length}
                  actions={
                    !(pageLayoutMode === 'columns' && collapsedStacks.general) ? (
                      <>
                        <IconButton
                          onClick={(event) => {
                            event.stopPropagation()
                            openGeneralQuickCapture()
                          }}
                          variant="muted"
                          size="sm"
                          ariaLabel="Add general task"
                          icon={<PlusIcon />}
                        />
                        <IconButton
                          ref={generalPanelTriggerRef}
                          onClick={(event) => {
                            event.stopPropagation()
                            setGeneralPanelOpen((current) => !current)
                          }}
                          variant="muted"
                          size="sm"
                          ariaLabel={generalPanelOpen ? 'Close general task controls' : 'Open general task controls'}
                          icon={<GoalsControlIcon />}
                        />
                      </>
                    ) : null
                  }
                  isCollapsed={collapsedStacks.general}
                  onToggleCollapse={
                    pageLayoutMode === 'columns'
                      ? () => setCollapsedStacks((current) => ({ ...current, general: !current.general }))
                      : pageLayoutMode === 'stacked'
                        ? () => setCollapsedStacks((current) => ({ ...current, general: !current.general }))
                        : undefined
                  }
                  collapsedSummary={
                    ((pageLayoutMode === 'columns' && collapsedStacks.general) ||
                      (pageLayoutMode === 'stacked' && collapsedStacks.general)) &&
                    collapsedGeneralColumnSummary.length > 0 ? (
                      <p className="mt-1.5 text-[11px] text-zinc-500">
                        {collapsedGeneralColumnSummary.join(' · ')}
                      </p>
                    ) : null
                  }
                />
              <AnimatePresence>
                {generalPanelOpen ? (
                    <motion.aside
                      ref={generalPanelRef}
                      className="absolute right-0 top-[calc(100%+10px)] z-[40] w-[310px] max-w-[calc(100vw-32px)]"
                      initial={{ opacity: 0, x: 12, y: -6 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={{ opacity: 0, x: 12, y: -6 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    >
                      <ControlsPanelShell emphasis="strong" className="flex max-h-[calc(100vh-32px)] min-h-0 flex-col">
                        <div className="theme-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1">
                        <section className="grid gap-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <label className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Group</label>
                            <div className="relative">
                              <select
                                value={generalGroupMode}
                                onChange={(event) => setGeneralGroupMode(event.target.value as GeneralGroupMode)}
                                className={TASK_GOALS_PANEL_SELECT_CLASSNAME}
                              >
                                <option value="none">None</option>
                                <option value="tag">Tag</option>
                                <option value="due">Due date</option>
                                <option value="priority">Priority</option>
                              </select>
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center">
                                <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <label className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Sort</label>
                            <div className="relative">
                              <select
                                value={generalSortMode}
                                onChange={(event) => setGeneralSortMode(event.target.value as GeneralSortMode)}
                                className={TASK_GOALS_PANEL_SELECT_CLASSNAME}
                              >
                                <option value="due">Due date</option>
                                <option value="priority">Priority</option>
                              </select>
                              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center">
                                <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                            <div>
                              <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Include Later Tasks</p>
                            </div>
                            <Toggle
                              checked={generalShowSomeday}
                              onChange={() => setGeneralShowSomeday((current) => !current)}
                              role="switch"
                              aria-checked={generalShowSomeday}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                            <div>
                              <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Include Completed Tasks</p>
                            </div>
                            <Toggle
                              checked={generalViewFilters.includeCompleted}
                              onChange={() => setGeneralViewFilters((current) => ({ ...current, includeCompleted: !current.includeCompleted }))}
                              role="switch"
                              aria-checked={generalViewFilters.includeCompleted}
                            />
                          </div>
                        </section>

                        <section className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Filters</p>
                          </div>
                          <div className="grid gap-1">
                            {([
                              ['highPriority', 'High priority'],
                              ['dueToday', 'Due today'],
                              ['withNotes', 'With notes'],
                              ['withSubtasks', 'With subtasks'],
                            ] as Array<[keyof GeneralViewFilters, string]>).map(([key, label]) => {
                              const isVisible = generalViewFilters[key]
                              return (
                                <div key={key} className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'}`}>
                                  <button
                                    type="button"
                                    onClick={() => setGeneralViewFilters((current) => ({ ...current, [key]: !current[key] }))}
                                    className={`text-left text-[12px] transition ${TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}
                                  >
                                    {label}
                                  </button>
                                  <Toggle
                                    checked={isVisible}
                                    onChange={() => setGeneralViewFilters((current) => ({ ...current, [key]: !current[key] }))}
                                    aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                                  />
                                </div>
                              )
                            })}
                            <div className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${generalShowTags ? 'hover:bg-white/[0.03]' : 'opacity-70'}`}>
                              <button
                                type="button"
                                onClick={() => setGeneralShowTags((current) => !current)}
                                className={`text-left text-[12px] transition ${TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}
                              >
                                Show tags
                              </button>
                              <Toggle
                                checked={generalShowTags}
                                onChange={() => setGeneralShowTags((current) => !current)}
                                aria-label={`${generalShowTags ? 'Hide' : 'Show'} tags`}
                              />
                            </div>
                          </div>
                        </section>

                        <div className="border-t border-white/[0.05] pt-3">
                          <Button type="button" variant="panel-link" onClick={resetGeneralTasksView}>
                            Reset
                          </Button>
                        </div>
                        </div>
                      </ControlsPanelShell>
                    </motion.aside>
                  ) : null}
                </AnimatePresence>
              </div>
              {pageLayoutMode === 'columns' ? (
                !collapsedStacks.general && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="theme-scrollbar flex-1 min-h-0 overflow-y-auto">
                {generalQuickTagFilter ? (
                  <div className="px-3.5 sm:px-4">
                    <div
                      className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2"
                      style={{
                        borderColor: generalQuickTagFilterStyles.borderColor,
                        backgroundColor: generalQuickTagFilterStyles.backgroundColor,
                      }}
                    >
                      <span className="text-[11px]" style={{ color: generalQuickTagFilterStyles.labelColor }}>
                        Showing: <span className="font-medium" style={{ color: generalQuickTagFilterStyles.color }}>{formatTaskTagLabel(generalQuickTagFilter)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setGeneralQuickTagFilter(null)}
                        className="text-[10px] uppercase tracking-[0.08em] transition hover:text-zinc-100"
                        style={{ color: generalQuickTagFilterStyles.labelColor }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
                {scopedGeneralTasks.length > 0 ? (
                  <div className="px-3.5 pr-1 sm:px-4">
                    {generalTaskGroups.map((group, index) => (
                      <div key={group.id} className={index > 0 ? 'mt-4' : ''}>
                        {shouldShowGeneralTaskGroupHeaders ? (
                          <div
                            className={`mb-2 flex items-center gap-2 border-b border-white/[0.05] pb-2 ${generalGroupMode === 'tag' ? 'rounded-[12px] px-1.5 pt-1 transition-colors hover:bg-white/[0.02]' : ''} ${generalDraggedTagGroupId === group.id ? 'opacity-70' : ''}`}
                            style={
                              generalGroupMode === 'tag' && group.normalizedTag
                                ? {
                                    borderBottomColor: `rgb(${getTaskTagAccentRgb(group.normalizedTag) ?? '148 163 184'} / 0.22)`,
                                  }
                                : undefined
                            }
                            draggable={generalGroupMode === 'tag'}
                            onDragStart={generalGroupMode === 'tag' ? () => {
                              setGeneralDraggedTagGroupId(group.id)
                              setGeneralDragOverTagGroupId(group.id)
                            } : undefined}
                            onDragOver={generalGroupMode === 'tag' ? (event) => {
                              event.preventDefault()
                              if (generalDraggedTagGroupId && generalDraggedTagGroupId !== group.id) {
                                setGeneralDragOverTagGroupId(group.id)
                              }
                            } : undefined}
                            onDrop={generalGroupMode === 'tag' ? (event) => {
                              event.preventDefault()
                              if (!generalDraggedTagGroupId || generalDraggedTagGroupId === group.id) return
                              const orderedIds = generalTaskGroups
                                .filter((candidate) => candidate.normalizedTag)
                                .map((candidate) => candidate.normalizedTag as string)
                              const nextIds = [...orderedIds]
                              const fromIndex = nextIds.indexOf(generalDraggedTagGroupId.replace('tag-', ''))
                              const toIndex = nextIds.indexOf(group.id.replace('tag-', ''))
                              if (fromIndex !== -1 && toIndex !== -1) {
                                const [moved] = nextIds.splice(fromIndex, 1)
                                nextIds.splice(toIndex, 0, moved)
                                setGeneralTagGroupOrder(nextIds)
                              }
                              setGeneralDraggedTagGroupId(null)
                              setGeneralDragOverTagGroupId(null)
                            } : undefined}
                            onDragEnd={generalGroupMode === 'tag' ? () => {
                              setGeneralDraggedTagGroupId(null)
                              setGeneralDragOverTagGroupId(null)
                            } : undefined}
                          >
                            {generalGroupMode === 'tag' ? (
                              <span className="h-6 w-[2.4px] shrink-0 rounded-full" style={group.accentDividerStyle} />
                            ) : null}
                            <div
                              className={`flex min-w-0 flex-1 items-center gap-2 ${generalGroupMode === 'tag' ? 'px-0.5 py-1' : ''} ${generalGroupMode === 'tag' && generalDragOverTagGroupId === group.id && generalDraggedTagGroupId !== group.id ? 'opacity-100' : ''}`}
                            >
                              <p
                                className={`text-[10px] font-medium uppercase tracking-[0.18em] ${generalGroupMode === 'tag' ? '' : 'text-zinc-500'}`}
                                style={generalGroupMode === 'tag' ? group.accentTextStyle : undefined}
                              >
                                {group.label}
                              </p>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] ${generalGroupMode === 'tag' ? '' : 'bg-white/[0.03] text-zinc-500'}`}
                                style={
                                  generalGroupMode === 'tag'
                                    ? {
                                        borderColor: 'rgb(255 255 255 / 0.08)',
                                        backgroundColor: 'rgb(255 255 255 / 0.03)',
                                        color: group.accentTextStyle?.color ?? 'rgb(113 113 122)',
                                      }
                                    : undefined
                                }
                              >
                                {group.tasks.length}
                              </span>
                            </div>
                            {generalGroupMode === 'tag' ? (
                              <span
                                className="flex shrink-0 cursor-grab items-center text-[13px] leading-none text-white/28 transition-colors hover:text-white/46 focus:text-white/46 active:cursor-grabbing"
                                onMouseEnter={(event) => showGeneralTagDragTooltip(event, 'Drag to reorder')}
                                onMouseLeave={hideGeneralTagDragTooltip}
                                onFocus={(event) => showGeneralTagDragTooltip(event, 'Drag to reorder')}
                                onBlur={hideGeneralTagDragTooltip}
                                tabIndex={0}
                                aria-label="Drag to reorder"
                              >
                                ⋮⋮
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="divide-y divide-white/[0.05]">
                          {group.tasks.map((task) => (
                            <CompactTaskRow
                              key={task.id}
                              task={task}
                              lifeGoals={safeLifeGoals}
                              lifeGoalCategories={lifeGoalCategories}
                              allTasks={safeTasks}
                              selected={isTaskPeekOpen && selectedTask?.id === task.id}
                              rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                              onOpen={() => openTaskPeek(task)}
                              onToggleComplete={() => toggleTaskCompletion(task.id)}
                              onFocus={() => focusTask(task.id)}
                              activeQuickTag={generalQuickTagFilter}
                              onTagClick={(tag) => setGeneralQuickTagFilter((current) => current === tag ? null : tag)}
                              hideTagChip={!generalShowTags || generalGroupMode === 'tag'}
                              list
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="px-3.5 text-sm text-white/46 sm:px-4">No general tasks in this scope.</p>}
                {generalTagDragTooltip ? (
                  <div
                    className="theme-tooltip pointer-events-none fixed left-0 top-0 z-[120] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
                    style={{
                      left: generalTagDragTooltip.left,
                      top: generalTagDragTooltip.top,
                    }}
                  >
                    {generalTagDragTooltip.text}
                  </div>
                ) : null}
                {outcomeAddTaskTooltip ? (
                  <div
                    className="theme-tooltip pointer-events-none fixed left-0 top-0 z-[120] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
                    style={{
                      left: outcomeAddTaskTooltip.left,
                      top: outcomeAddTaskTooltip.top,
                    }}
                  >
                    {outcomeAddTaskTooltip.text}
                  </div>
                ) : null}

                {generalShowSomeday && !generalQuickTagFilter && scopedSomedayTasks.length > 0 ? (
                  <div className="px-3.5 pt-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setGeneralLaterCollapsed((current) => !current)}
                      aria-expanded={!generalLaterCollapsed}
                      className="mb-2 flex min-h-[34px] w-full items-center justify-between rounded-md border-t border-white/[0.06] px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-zinc-400">Later</p>
                        <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                          {scopedSomedayTasks.length}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${generalLaterCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                    {!generalLaterCollapsed ? (
                      <div className="divide-y divide-white/[0.05]">
                        {scopedSomedayTasks.map((task) => (
                          <CompactTaskRow
                            key={task.id}
                            task={task}
                            lifeGoals={safeLifeGoals}
                            lifeGoalCategories={lifeGoalCategories}
                            allTasks={safeTasks}
                            selected={isTaskPeekOpen && selectedTask?.id === task.id}
                            rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                            onOpen={() => openTaskPeek(task)}
                            onToggleComplete={() => toggleTaskCompletion(task.id)}
                            onFocus={() => focusTask(task.id)}
                            subdued
                            hideTagChip={!generalShowTags}
                            list
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {generalViewFilters.includeCompleted && !generalQuickTagFilter && scopedCompletedGeneralTasks.length > 0 ? (
                  <div className="px-3.5 pt-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setGeneralCompletedCollapsed((current) => !current)}
                      aria-expanded={!generalCompletedCollapsed}
                      className="mb-2 flex min-h-[34px] w-full items-center justify-between rounded-md border-t border-white/[0.06] px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-zinc-400">Completed</p>
                        <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                          {scopedCompletedGeneralTasks.length}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${generalCompletedCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                    {!generalCompletedCollapsed ? (
                      <div className="divide-y divide-white/[0.05]">
                        {visibleCompletedGeneralTasks.map((task) => (
                          <CompactTaskRow
                            key={task.id}
                            task={task}
                            lifeGoals={safeLifeGoals}
                            lifeGoalCategories={lifeGoalCategories}
                            allTasks={safeTasks}
                            selected={isTaskPeekOpen && selectedTask?.id === task.id}
                            rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                            onOpen={() => openTaskPeek(task)}
                            onToggleComplete={() => restoreTask(task.id)}
                            onFocus={() => focusTask(task.id)}
                            subdued
                            hideTagChip={!generalShowTags}
                            completed
                            completedMetadataOnly
                            list
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
                </div>
                )
              ) : (
                !collapsedStacks.general && (
                  <AnimatePresence initial={false}>
                    <motion.div
                      key="general-stack-content"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="w-full max-w-full overflow-visible"
                    >
              <div className="space-y-2">
                {generalQuickTagFilter ? (
                  <div className="px-3.5 sm:px-4">
                    <div
                      className="flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2"
                      style={{
                        borderColor: generalQuickTagFilterStyles.borderColor,
                        backgroundColor: generalQuickTagFilterStyles.backgroundColor,
                      }}
                    >
                      <span className="text-[11px]" style={{ color: generalQuickTagFilterStyles.labelColor }}>
                        Showing: <span className="font-medium" style={{ color: generalQuickTagFilterStyles.color }}>{formatTaskTagLabel(generalQuickTagFilter)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setGeneralQuickTagFilter(null)}
                        className="text-[10px] uppercase tracking-[0.08em] transition hover:text-zinc-100"
                        style={{ color: generalQuickTagFilterStyles.labelColor }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
                {scopedGeneralTasks.length > 0 ? (
                  <div className="px-3.5 pr-1 sm:px-4">
                    {generalTaskGroups.map((group, index) => (
                      <div key={group.id} className={index > 0 ? 'mt-4' : ''}>
                        {shouldShowGeneralTaskGroupHeaders ? (
                          <div
                            className={`mb-2 flex items-center gap-2 border-b border-white/[0.05] pb-2 ${generalGroupMode === 'tag' ? 'rounded-[12px] px-1.5 pt-1 transition-colors hover:bg-white/[0.02]' : ''} ${generalDraggedTagGroupId === group.id ? 'opacity-70' : ''}`}
                            style={
                              generalGroupMode === 'tag' && group.normalizedTag
                                ? {
                                    borderBottomColor: `rgb(${getTaskTagAccentRgb(group.normalizedTag) ?? '148 163 184'} / 0.22)`,
                                  }
                                : undefined
                            }
                            draggable={generalGroupMode === 'tag'}
                            onDragStart={generalGroupMode === 'tag' ? () => {
                              setGeneralDraggedTagGroupId(group.id)
                              setGeneralDragOverTagGroupId(group.id)
                            } : undefined}
                            onDragOver={generalGroupMode === 'tag' ? (event) => {
                              event.preventDefault()
                              if (generalDraggedTagGroupId && generalDraggedTagGroupId !== group.id) {
                                setGeneralDragOverTagGroupId(group.id)
                              }
                            } : undefined}
                            onDrop={generalGroupMode === 'tag' ? (event) => {
                              event.preventDefault()
                              if (!generalDraggedTagGroupId || generalDraggedTagGroupId === group.id) return
                              const orderedIds = generalTaskGroups
                                .filter((candidate) => candidate.normalizedTag)
                                .map((candidate) => candidate.normalizedTag as string)
                              const nextIds = [...orderedIds]
                              const fromIndex = nextIds.indexOf(generalDraggedTagGroupId.replace('tag-', ''))
                              const toIndex = nextIds.indexOf(group.id.replace('tag-', ''))
                              if (fromIndex !== -1 && toIndex !== -1) {
                                const [moved] = nextIds.splice(fromIndex, 1)
                                nextIds.splice(toIndex, 0, moved)
                                setGeneralTagGroupOrder(nextIds)
                              }
                              setGeneralDraggedTagGroupId(null)
                              setGeneralDragOverTagGroupId(null)
                            } : undefined}
                            onDragEnd={generalGroupMode === 'tag' ? () => {
                              setGeneralDraggedTagGroupId(null)
                              setGeneralDragOverTagGroupId(null)
                            } : undefined}
                          >
                            {generalGroupMode === 'tag' ? (
                              <span className="h-6 w-[2.4px] shrink-0 rounded-full" style={group.accentDividerStyle} />
                            ) : null}
                            <div
                              className={`flex min-w-0 flex-1 items-center gap-2 ${generalGroupMode === 'tag' ? 'px-0.5 py-1' : ''} ${generalGroupMode === 'tag' && generalDragOverTagGroupId === group.id && generalDraggedTagGroupId !== group.id ? 'opacity-100' : ''}`}
                            >
                              <p
                                className={`text-[10px] font-medium uppercase tracking-[0.18em] ${generalGroupMode === 'tag' ? '' : 'text-zinc-500'}`}
                                style={generalGroupMode === 'tag' ? group.accentTextStyle : undefined}
                              >
                                {group.label}
                              </p>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] ${generalGroupMode === 'tag' ? '' : 'bg-white/[0.03] text-zinc-500'}`}
                                style={
                                  generalGroupMode === 'tag'
                                    ? {
                                        borderColor: 'rgb(255 255 255 / 0.08)',
                                        backgroundColor: 'rgb(255 255 255 / 0.03)',
                                        color: group.accentTextStyle?.color ?? 'rgb(113 113 122)',
                                      }
                                    : undefined
                                }
                              >
                                {group.tasks.length}
                              </span>
                            </div>
                            {generalGroupMode === 'tag' ? (
                              <span
                                className="flex shrink-0 cursor-grab items-center text-[13px] leading-none text-white/28 transition-colors hover:text-white/46 focus:text-white/46 active:cursor-grabbing"
                                onMouseEnter={(event) => showGeneralTagDragTooltip(event, 'Drag to reorder')}
                                onMouseLeave={hideGeneralTagDragTooltip}
                                onFocus={(event) => showGeneralTagDragTooltip(event, 'Drag to reorder')}
                                onBlur={hideGeneralTagDragTooltip}
                                tabIndex={0}
                                aria-label="Drag to reorder"
                              >
                                ⋮⋮
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="divide-y divide-white/[0.05]">
                          {group.tasks.map((task) => (
                            <CompactTaskRow
                              key={task.id}
                              task={task}
                              lifeGoals={safeLifeGoals}
                              lifeGoalCategories={lifeGoalCategories}
                              allTasks={safeTasks}
                              selected={isTaskPeekOpen && selectedTask?.id === task.id}
                              rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                              onOpen={() => openTaskPeek(task)}
                              onToggleComplete={() => toggleTaskCompletion(task.id)}
                              onFocus={() => focusTask(task.id)}
                              activeQuickTag={generalQuickTagFilter}
                              onTagClick={(tag) => setGeneralQuickTagFilter((current) => current === tag ? null : tag)}
                              hideTagChip={!generalShowTags || generalGroupMode === 'tag'}
                              list
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="px-3.5 text-sm text-white/46 sm:px-4">No general tasks in this scope.</p>}
                {generalTagDragTooltip ? (
                  <div
                    className="theme-tooltip pointer-events-none fixed left-0 top-0 z-[120] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
                    style={{
                      left: generalTagDragTooltip.left,
                      top: generalTagDragTooltip.top,
                    }}
                  >
                    {generalTagDragTooltip.text}
                  </div>
                ) : null}
                {outcomeAddTaskTooltip ? (
                  <div
                    className="theme-tooltip pointer-events-none fixed left-0 top-0 z-[120] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border px-2.5 py-1 text-[11px] font-medium shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
                    style={{
                      left: outcomeAddTaskTooltip.left,
                      top: outcomeAddTaskTooltip.top,
                    }}
                  >
                    {outcomeAddTaskTooltip.text}
                  </div>
                ) : null}

                {generalShowSomeday && !generalQuickTagFilter && scopedSomedayTasks.length > 0 ? (
                  <div className="px-3.5 pt-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setGeneralLaterCollapsed((current) => !current)}
                      aria-expanded={!generalLaterCollapsed}
                      className="mb-2 flex min-h-[34px] w-full items-center justify-between rounded-md border-t border-white/[0.06] px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-zinc-400">Later</p>
                        <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                          {scopedSomedayTasks.length}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${generalLaterCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                    {!generalLaterCollapsed ? (
                      <div className="divide-y divide-white/[0.05]">
                        {scopedSomedayTasks.map((task) => (
                          <CompactTaskRow
                            key={task.id}
                            task={task}
                            lifeGoals={safeLifeGoals}
                            lifeGoalCategories={lifeGoalCategories}
                            allTasks={safeTasks}
                            selected={isTaskPeekOpen && selectedTask?.id === task.id}
                            rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                            onOpen={() => openTaskPeek(task)}
                            onToggleComplete={() => toggleTaskCompletion(task.id)}
                            onFocus={() => focusTask(task.id)}
                            subdued
                            hideTagChip={!generalShowTags}
                            list
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {generalViewFilters.includeCompleted && !generalQuickTagFilter && scopedCompletedGeneralTasks.length > 0 ? (
                  <div className="px-3.5 pt-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setGeneralCompletedCollapsed((current) => !current)}
                      aria-expanded={!generalCompletedCollapsed}
                      className="mb-2 flex min-h-[34px] w-full items-center justify-between rounded-md border-t border-white/[0.06] px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-zinc-400">Completed</p>
                        <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                          {scopedCompletedGeneralTasks.length}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${generalCompletedCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                    {!generalCompletedCollapsed ? (
                      <div className="divide-y divide-white/[0.05]">
                        {visibleCompletedGeneralTasks.map((task) => (
                          <CompactTaskRow
                            key={task.id}
                            task={task}
                            lifeGoals={safeLifeGoals}
                            lifeGoalCategories={lifeGoalCategories}
                            allTasks={safeTasks}
                            selected={isTaskPeekOpen && selectedTask?.id === task.id}
                            rowRef={isTaskPeekOpen && selectedTask?.id === task.id ? selectedTaskRowRef : undefined}
                            onOpen={() => openTaskPeek(task)}
                            onToggleComplete={() => restoreTask(task.id)}
                            onFocus={() => focusTask(task.id)}
                            subdued
                            hideTagChip={!generalShowTags}
                            completed
                            completedMetadataOnly
                            list
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
                    </motion.div>
                  </AnimatePresence>
                )
              )}
            </SectionCard>

            {showDirectionalColumn ? (
            <SectionCard
              shell="task"
              compact
              className={`flex flex-col px-0 py-3.5 sm:px-0 sm:py-4 [--card-bg:#12141A] ${
                pageLayoutMode === 'columns'
                  ? `flex flex-col flex-1 min-h-0 min-w-0 ${collapsedStacks.outcome ? 'self-start' : ''}`
                  : 'w-full max-w-full'
              }`}
            >
              <div className="relative mb-3 space-y-2 px-3.5 sm:px-4">
                <SectionHeader
                  title="Outcome Goals"
                  count={scopedActiveGoalGroups.length}
                  actions={
                    !(pageLayoutMode === 'columns' && collapsedStacks.outcome) ? (
                      <IconButton
                        ref={goalsPanelTriggerRef}
                        onClick={(event) => {
                          event.stopPropagation()
                          setGoalsPanelOpen((current) => !current)
                        }}
                        variant="muted"
                        size="sm"
                        ariaLabel={goalsPanelOpen ? 'Close goals controls' : 'Open goals controls'}
                        icon={<GoalsControlIcon />}
                      />
                    ) : null
                  }
                  isCollapsed={collapsedStacks.outcome}
                  onToggleCollapse={
                    pageLayoutMode === 'columns'
                      ? () => setCollapsedStacks((current) => ({ ...current, outcome: !current.outcome }))
                      : pageLayoutMode === 'stacked'
                        ? () => setCollapsedStacks((current) => ({ ...current, outcome: !current.outcome }))
                        : undefined
                  }
                  collapsedSummary={
                    ((pageLayoutMode === 'columns' && collapsedStacks.outcome) ||
                      (pageLayoutMode === 'stacked' && collapsedStacks.outcome)) &&
                    collapsedOutcomeColumnSummary.length > 0 ? (
                      <p className="text-[11px] text-zinc-500">
                        {collapsedOutcomeColumnSummary.join(' · ')}
                      </p>
                    ) : null
                  }
                />

                <AnimatePresence>
                  {goalsPanelOpen ? (
                    <motion.aside
                      ref={goalsPanelRef}
                      className="absolute right-0 top-[calc(100%+10px)] z-[40] w-[310px] max-w-[calc(100vw-32px)]"
                      initial={{ opacity: 0, x: 12, y: -6 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={{ opacity: 0, x: 12, y: -6 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    >
                      <ControlsPanelShell emphasis="strong" className="flex max-h-[calc(100vh-32px)] min-h-0 flex-col">
                        <div className="theme-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1">
                        <section className="space-y-2 border-t border-white/[0.05] pt-3 first:border-t-0 first:pt-0">
                          <div className="flex items-center justify-between">
                            <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Goal Category</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setGoalsColumnCategoryFilter([])}
                              className={`${TASK_PANEL_PILL_CLASSNAME} ${
                                goalsColumnCategoryFilter.length === 0 ? TASK_PANEL_PILL_ACTIVE_CLASSNAME : TASK_PANEL_PILL_INACTIVE_CLASSNAME
                              }`}
                            >
                              All categories
                            </button>
                            {outcomeGoalCategoryOptions.map((category) => (
                              (() => {
                                const categoryColor = resolveLifeGoalCategoryCssColor(
                                  getLifeGoalCategoryColor(category, lifeGoalCategories),
                                  0.9,
                                )
                                const categoryHoverBackground = resolveLifeGoalCategoryCssColor(
                                  getLifeGoalCategoryColor(category, lifeGoalCategories),
                                  0.14,
                                )
                                const categoryHoverBorder = resolveLifeGoalCategoryCssColor(
                                  getLifeGoalCategoryColor(category, lifeGoalCategories),
                                  0.26,
                                )

                                return (
                                  <button
                                    key={category}
                                    type="button"
                                    onClick={() =>
                                      setGoalsColumnCategoryFilter((current) =>
                                        current.includes(category)
                                          ? current.filter((value) => value !== category)
                                          : [...current, category],
                                      )
                                    }
                                    className={`${TASK_PANEL_PILL_CLASSNAME} ${
                                      goalsColumnCategoryFilter.includes(category) ? TASK_PANEL_PILL_ACTIVE_CLASSNAME : TASK_PANEL_PILL_INACTIVE_CLASSNAME
                                    } ${
                                      goalsColumnCategoryFilter.includes(category)
                                        ? ''
                                        : 'hover:[background-color:var(--goal-category-hover-bg)] hover:[border-color:var(--goal-category-hover-border)] hover:[color:var(--goal-category-hover-text)]'
                                    }`}
                                    style={
                                      goalsColumnCategoryFilter.includes(category)
                                        ? {
                                            backgroundColor: categoryHoverBackground,
                                            borderColor: categoryHoverBorder,
                                            color: categoryColor,
                                          }
                                        : ({
                                            '--goal-category-hover-bg': categoryHoverBackground,
                                            '--goal-category-hover-border': categoryHoverBorder,
                                            '--goal-category-hover-text': categoryColor,
                                          } as CSSProperties)
                                    }
                                  >
                                    {category}
                                  </button>
                                )
                              })()
                            ))}
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-white/[0.05] pt-3">
                          <div className="flex items-center justify-between">
                            <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Goal</p>
                          </div>
                          <div className="relative">
                            <select
                              value={goalsColumnGoalFilter}
                              onChange={(event) => {
                                setGoalsColumnGoalFilter(event.target.value)
                              }}
                              className={TASK_GOALS_PANEL_SELECT_CLASSNAME}
                            >
                              <option value="all">All goals</option>
                              {categoryScopedOutcomeGoals.map((goal) => (
                                <option key={goal.id} value={goal.id}>
                                  {goal.title}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center">
                              <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                            </span>
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-white/[0.05] pt-3">
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                            <div>
                              <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Show completed goals</p>
                            </div>
                            <Toggle
                              checked={goalsColumnShowCompletedGoals}
                              onChange={() => setGoalsColumnShowCompletedGoals((current) => !current)}
                              role="switch"
                              aria-checked={goalsColumnShowCompletedGoals}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                            <div>
                              <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Hide goals with no tasks</p>
                            </div>
                            <Toggle
                              checked={goalsColumnHideEmpty}
                              onChange={() => setGoalsColumnHideEmpty((current) => !current)}
                              role="switch"
                              aria-checked={goalsColumnHideEmpty}
                            />
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-white/[0.05] pt-3">
                          <div className="flex items-center justify-between">
                            <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Task List Views</p>
                          </div>
                          <div className="grid gap-1">
                            {([
                              ['allTasks', 'All tasks'],
                              ['next', 'Next task'],
                              ['dueSoon', 'Due soon'],
                              ['highPriority', 'High priority'],
                              ['completed', 'Completed'],
                            ] as const).map(([key, label]) => {
                              const isActive = goalsColumnViewOptions[key]
                              return (
                                <div key={key} className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${isActive ? 'hover:bg-white/[0.03]' : 'opacity-70'}`}>
                                  <button
                                    type="button"
                                    onClick={() => toggleGoalsColumnViewOption(key)}
                                    className={`text-left text-[12px] transition ${TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}
                                  >
                                    {label}
                                  </button>
                                  <Toggle
                                    checked={isActive}
                                    onChange={() => toggleGoalsColumnViewOption(key)}
                                    aria-label={`${isActive ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </section>

                        <section className="space-y-2 border-t border-white/[0.05] pt-3">
                          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                            <div>
                              <p className={TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME}>Show task tags</p>
                            </div>
                            <Toggle
                              checked={goalsColumnShowTaskTags}
                              onChange={() => setGoalsColumnShowTaskTags((current) => !current)}
                              role="switch"
                              aria-checked={goalsColumnShowTaskTags}
                            />
                          </div>
                        </section>

                        <div className="border-t border-white/[0.05] pt-3">
                          <Button
                            type="button"
                            variant="panel-link"
                            onClick={resetOutcomeGoalsView}
                          >
                            Reset
                          </Button>
                        </div>
                        </div>
                      </ControlsPanelShell>
                    </motion.aside>
                  ) : null}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {!collapsedStacks.outcome ? (
                  <div className={pageLayoutMode === 'columns' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'w-full max-w-full overflow-visible'}>
                    <div className={pageLayoutMode === 'columns' ? 'theme-scrollbar flex-1 min-h-0 overflow-y-auto' : 'space-y-1.5'}>
                      <div className="px-3.5 sm:px-4">
                        <div className="pr-1">
                {scopedActiveGoalGroups.length > 0 ? scopedActiveGoalGroups.map((group, index) => {
                  const isExpanded = expandedOutcomeGoalId === group.id
                  const isAllTasksView = goalsColumnViewOptions.allTasks
                  const nextTaskLabel = group.nextTask?.text ?? 'No open tasks'
                  const dueSoonLabel =
                    group.dueSoonTask?.dueDate === todayIso ? 'Due today' : group.dueSoonTask?.dueDate === shiftIsoDate(todayIso, 1) ? 'Tomorrow' : null
                  const collapsedDueSoonTask =
                    !isAllTasksView && goalsColumnViewOptions.dueSoon ? group.dueSoonTask : null
                  const collapsedHighPriorityPreviewTasks =
                    !isAllTasksView && goalsColumnViewOptions.highPriority
                      ? group.highPriorityPreviewTasks.filter((task) => task.id !== collapsedDueSoonTask?.id)
                      : []
                  const orderedVisibleTasks = buildGoalsColumnVisibleTasks(group.tasks, {
                    nextEnabled: goalsColumnViewOptions.next,
                    dueSoonEnabled: goalsColumnViewOptions.dueSoon,
                    highPriorityEnabled: goalsColumnViewOptions.highPriority,
                    allTasksEnabled: goalsColumnViewOptions.allTasks,
                    nextTask: group.nextTask,
                    dueSoonTask: group.dueSoonTask,
                    highPriorityTasks: group.highPriorityTasks,
                  })
                  const visibleTasks = orderedVisibleTasks
                  const goalColor = getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories)
                  const goalAccentColor = resolveLifeGoalCategoryCssColor(goalColor)
                  const goalHairlineColor = resolveLifeGoalCategoryCssColor(goalColor, 0.72)
                  const goalIcon = typeof group.goal.icon === 'string'
                    ? group.goal.icon.replace(/^emoji:\s*/i, '').trim()
                    : ''
                  const milestoneTitleById = new Map(
                    (group.goal.milestones ?? []).map((milestone) => [milestone.id, milestone.title.trim() || 'Untitled milestone']),
                  )
                  const orderedMilestones = (group.goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
                  const highPriorityVisibleTasks =
                    !isAllTasksView && goalsColumnViewOptions.highPriority ? group.highPriorityTasks : []
                  const allTaskMilestoneGroups =
                    isAllTasksView
                      ? orderedMilestones
                          .map((milestone) => ({
                            milestoneId: milestone.id,
                            label: milestone.title.trim() || 'Untitled milestone',
                            tasks: visibleTasks.filter((task) => task.milestoneId === milestone.id),
                          }))
                          .filter((milestoneGroup) => milestoneGroup.tasks.length > 0)
                      : []
                  const highPriorityMilestoneGroups =
                    !isAllTasksView && goalsColumnViewOptions.highPriority
                      ? orderedMilestones
                          .map((milestone) => ({
                            milestoneId: milestone.id,
                            label: milestone.title.trim() || 'Untitled milestone',
                            tasks: highPriorityVisibleTasks.filter((task) => task.milestoneId === milestone.id),
                          }))
                          .filter((milestoneGroup) => milestoneGroup.tasks.length > 0)
                      : []
                  const ungroupedVisibleTasks =
                    isAllTasksView
                      ? visibleTasks.filter((task) => !task.milestoneId || !milestoneTitleById.has(task.milestoneId))
                      : visibleTasks
                  const ungroupedHighPriorityTasks =
                    !isAllTasksView && goalsColumnViewOptions.highPriority
                      ? highPriorityVisibleTasks.filter((task) => !task.milestoneId || !milestoneTitleById.has(task.milestoneId))
                      : []

                  return (
                    <div
                      key={group.id}
                      className={`group rounded-[14px] border bg-white/[0.02] transition-all duration-200 ${
                        isExpanded
                          ? 'border-white/[0.12] bg-white/[0.00]'
                          : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
                      } ${index > 0 ? 'mt-2.5' : ''}`}
                      style={{
                        boxShadow: isExpanded
                          ? `inset 2px 0 0 ${goalAccentColor}, inset 0 0.5px 0 ${goalHairlineColor}, inset 0 -0.5px 0 ${goalHairlineColor}`
                          : `inset 2px 0 0 ${goalAccentColor}`,
                      }}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedOutcomeGoalId(isExpanded ? null : group.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setExpandedOutcomeGoalId(isExpanded ? null : group.id)
                          }
                        }}
                        className="w-full rounded-[14px] px-3 py-2.5 text-left transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-start gap-2">
	                            {goalIcon ? (
	                              <span
	                                className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[13px] leading-none"
	                                aria-hidden="true"
	                              >
	                                {goalIcon}
	                              </span>
	                            ) : (
	                              <span
	                                className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border"
	                                style={{ borderColor: goalAccentColor }}
	                                aria-hidden="true"
	                              >
	                                <span
	                                  className="h-1.5 w-1.5 rounded-full border"
	                                  style={{ borderColor: goalAccentColor }}
	                                />
	                              </span>
	                            )}
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="block truncate text-[14px] font-medium text-zinc-100">
                                  {group.label}
                                </span>
                                {isExpanded && onOpenLifeGoal ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onOpenLifeGoal(group.id)
                                    }}
                                    className="inline-flex shrink-0 items-center justify-center text-zinc-500/80 transition hover:text-zinc-300"
                                    aria-label={`Open ${group.label}`}
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                            <span className="rounded-full bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-600">
                              {group.tasks.length}
                            </span>
                            <ChevronRight className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {!isExpanded ? (
                          <div className="mt-1 space-y-0.5 pl-0.5">
                            {!isAllTasksView && goalsColumnViewOptions.next ? (
	                              <div className="flex items-center gap-1.5">
	                                {group.nextTask ? (
	                                  <ArrowRight className="h-3 w-3 shrink-0 text-emerald-400" />
	                                ) : null}
	                                <span className={`truncate text-[12px] font-medium ${group.nextTask ? 'text-emerald-400' : 'text-zinc-500'}`}>
	                                  {nextTaskLabel}
	                                </span>
	                              </div>
                            ) : null}
                            {!isAllTasksView && goalsColumnViewOptions.dueSoon && group.dueSoonTask && dueSoonLabel ? (
                              <div className="flex items-center gap-1.5">
                                <span className="shrink-0 text-[10px] text-zinc-400">
                                  {dueSoonLabel}:
                                </span>
                                <span className="truncate text-[10px] text-zinc-500">
                                  {group.dueSoonTask.text}
                                </span>
                              </div>
                            ) : null}
                            {!isAllTasksView && goalsColumnViewOptions.highPriority && collapsedHighPriorityPreviewTasks.length > 0 ? (
                              <div className="inline-block max-w-full border-t border-white/[0.03] pt-0.5 space-y-0.5">
                                {collapsedHighPriorityPreviewTasks.map((task) => (
                                  <div key={task.id} className="flex items-center gap-2">
                                    <span className="truncate text-[10px] text-zinc-500">{task.text}</span>
                                    <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                      High
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {isExpanded ? (
                        <>
                        <div className="space-y-0.5 px-3 pb-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          {visibleTasks.length > 0 ? (
                            <div>
                              {isAllTasksView ? (
                                <>
                                  {ungroupedVisibleTasks.length > 0 ? (
                                    <div className="pb-2">
                                      <div className="pb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-emerald-300/70">
                                            No milestone
                                          </span>
                                          <span className="h-px flex-1 bg-emerald-500/10" />
                                        </div>
                                      </div>
                                      {ungroupedVisibleTasks.map((task, index) => (
                                        <div
                                          key={task.id}
                                          ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                          onClick={() => openTaskPeek(task)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault()
                                              openTaskPeek(task)
                                            }
                                          }}
                                          role="button"
                                          tabIndex={0}
                                            className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] ${
                                            index < ungroupedVisibleTasks.length - 1 ? 'border-b border-white/[0.06]' : ''
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              toggleTaskCompletion(task.id)
                                            }}
                                            className={`group mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                                              task.completed
                                                ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                                                : 'border-white/[0.18] text-transparent hover:border-emerald-400/70 hover:text-emerald-400'
                                            }`}
                                            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                          >
                                            {task.completed ? '✓' : <span className="opacity-0 transition-opacity group-hover:opacity-70">✓</span>}
                                          </button>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="block min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                                                {task.text}
                                              </span>
                                              {task.priority === 'high' ? (
                                                <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                                  High
                                                </span>
                                              ) : null}
                                            </div>

                                            {task.dueDate ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                                <span className={getOutcomeTaskDueClassName(task.dueDate, todayIso)}>{formatOutcomeTaskDueLabel(task.dueDate, todayIso)}</span>
                                                {goalsColumnShowTaskTags ? <TaskTagMetaChip tag={task.taskTag} /> : null}
                                              </div>
                                            ) : goalsColumnShowTaskTags && task.taskTag ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation()
                                                    openTaskPeek(task)
                                                  }}
                                                  className="inline-flex items-center gap-1 text-[11px] text-zinc-600 transition hover:text-zinc-400"
                                                  aria-label={`Set due date for ${task.text}`}
                                                  title="Set due date"
                                                >
                                                  <CalendarGlyph className="text-zinc-700" />
                                                </button>
                                                <TaskTagMetaChip tag={task.taskTag} />
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  openTaskPeek(task)
                                                }}
                                                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-600 transition hover:text-zinc-400"
                                                aria-label={`Set due date for ${task.text}`}
                                                title="Set due date"
                                              >
                                                <CalendarGlyph className="text-zinc-700" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      <div className="flex justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            addTaskForGoalMilestoneFromOutcome(group.id, group.label, null)
                                          }}
                                          onMouseEnter={(event) => showOutcomeAddTaskTooltip(event, 'Add task to no milestone')}
                                          onMouseLeave={hideOutcomeAddTaskTooltip}
                                          onFocus={(event) => showOutcomeAddTaskTooltip(event, 'Add task to no milestone')}
                                          onBlur={hideOutcomeAddTaskTooltip}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300"
                                          aria-label={`Add task with no milestone for ${group.label}`}
                                        >
                                          <span className="text-[22px] leading-none">+</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  {allTaskMilestoneGroups.map((milestoneGroup, milestoneGroupIndex) => (
                                    <div key={`milestone-group-${group.id}-${milestoneGroup.milestoneId}`} className={milestoneGroupIndex > 0 || ungroupedVisibleTasks.length > 0 ? 'pt-2' : ''}>
                                      <div className="pb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-emerald-300/70">
                                            {milestoneGroup.label}
                                          </span>
                                          <span className="h-px flex-1 bg-emerald-500/10" />
                                        </div>
                                      </div>
                                      {milestoneGroup.tasks.map((task, index) => (
                                        <div
                                          key={task.id}
                                          ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                          onClick={() => openTaskPeek(task)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault()
                                              openTaskPeek(task)
                                            }
                                          }}
                                          role="button"
                                          tabIndex={0}
                                          className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/[0.04] ${
                                            index < milestoneGroup.tasks.length - 1 ? 'mb-2.5 border-b border-white/[0.06]' : ''
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              toggleTaskCompletion(task.id)
                                            }}
                                            className={`group mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                                              task.completed
                                                ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                                                : 'border-white/[0.18] text-transparent hover:border-emerald-400/70 hover:text-emerald-400'
                                            }`}
                                            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                          >
                                            {task.completed ? '✓' : <span className="opacity-0 transition-opacity group-hover:opacity-70">✓</span>}
                                          </button>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="block min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                                                {task.text}
                                              </span>
                                              {task.priority === 'high' ? (
                                                <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                                  High
                                                </span>
                                              ) : null}
                                            </div>

                                            {task.dueDate ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                                <span className={getOutcomeTaskDueClassName(task.dueDate, todayIso)}>{formatOutcomeTaskDueLabel(task.dueDate, todayIso)}</span>
                                                {goalsColumnShowTaskTags ? <TaskTagMetaChip tag={task.taskTag} /> : null}
                                              </div>
                                            ) : goalsColumnShowTaskTags && task.taskTag ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    event.stopPropagation()
                                                    openTaskPeek(task)
                                                  }}
                                                  className="inline-flex items-center gap-1 text-[11px] text-zinc-600 transition hover:text-zinc-400"
                                                  aria-label={`Set due date for ${task.text}`}
                                                  title="Set due date"
                                                >
                                                  <CalendarGlyph className="text-zinc-700" />
                                                </button>
                                                <TaskTagMetaChip tag={task.taskTag} />
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  openTaskPeek(task)
                                                }}
                                                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-600 transition hover:text-zinc-400"
                                                aria-label={`Set due date for ${task.text}`}
                                                title="Set due date"
                                              >
                                                <CalendarGlyph className="text-zinc-700" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                      <div className="flex justify-end pt-1">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation()
                                            addTaskForGoalMilestoneFromOutcome(group.id, group.label, milestoneGroup.milestoneId)
                                          }}
                                          onMouseEnter={(event) => showOutcomeAddTaskTooltip(event, `Add task to ${milestoneGroup.label}`)}
                                          onMouseLeave={hideOutcomeAddTaskTooltip}
                                          onFocus={(event) => showOutcomeAddTaskTooltip(event, `Add task to ${milestoneGroup.label}`)}
                                          onBlur={hideOutcomeAddTaskTooltip}
                                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300"
                                          aria-label={`Add task to ${milestoneGroup.label}`}
                                        >
                                          <span className="text-[22px] leading-none">+</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              ) : goalsColumnViewOptions.highPriority ? (
                                <>
                                  {ungroupedHighPriorityTasks.length > 0 ? (
                                    <div className="pb-2">
                                      <div className="pb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-emerald-300/70">
                                            No milestone
                                          </span>
                                          <span className="h-px flex-1 bg-emerald-500/10" />
                                        </div>
                                      </div>
                                      {ungroupedHighPriorityTasks.map((task, index) => (
                                        <div
                                          key={task.id}
                                          ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                          onClick={() => openTaskPeek(task)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault()
                                              openTaskPeek(task)
                                            }
                                          }}
                                          role="button"
                                          tabIndex={0}
                                          className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] ${
                                            index < ungroupedHighPriorityTasks.length - 1 ? 'border-b border-white/[0.06]' : ''
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              toggleTaskCompletion(task.id)
                                            }}
                                            className={`group mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                                              task.completed
                                                ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                                                : 'border-white/[0.18] text-transparent hover:border-emerald-400/70 hover:text-emerald-400'
                                            }`}
                                            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                          >
                                            {task.completed ? '✓' : <span className="opacity-0 transition-opacity group-hover:opacity-70">✓</span>}
                                          </button>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="block min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                                                {task.text}
                                              </span>
                                              <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                                High
                                              </span>
                                            </div>

                                            {task.dueDate || (goalsColumnShowTaskTags && task.taskTag) ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                                {task.dueDate ? <span className={getOutcomeTaskDueClassName(task.dueDate, todayIso)}>{formatOutcomeTaskDueLabel(task.dueDate, todayIso)}</span> : null}
                                                {goalsColumnShowTaskTags ? <TaskTagMetaChip tag={task.taskTag} /> : null}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {highPriorityMilestoneGroups.map((milestoneGroup, milestoneGroupIndex) => (
                                    <div key={`high-priority-milestone-group-${group.id}-${milestoneGroup.milestoneId}`} className={milestoneGroupIndex > 0 || ungroupedHighPriorityTasks.length > 0 ? 'pt-2' : ''}>
                                      <div className="pb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="shrink-0 text-[8px] uppercase tracking-[0.12em] text-emerald-300/70">
                                            {milestoneGroup.label}
                                          </span>
                                          <span className="h-px flex-1 bg-emerald-500/10" />
                                        </div>
                                      </div>
                                      {milestoneGroup.tasks.map((task, index) => (
                                        <div
                                          key={task.id}
                                          ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                          onClick={() => openTaskPeek(task)}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                              event.preventDefault()
                                              openTaskPeek(task)
                                            }
                                          }}
                                          role="button"
                                          tabIndex={0}
                                          className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] ${
                                            index < milestoneGroup.tasks.length - 1 ? 'border-b border-white/[0.06]' : ''
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              toggleTaskCompletion(task.id)
                                            }}
                                            className={`group mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                                              task.completed
                                                ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                                                : 'border-white/[0.18] text-transparent hover:border-emerald-400/70 hover:text-emerald-400'
                                            }`}
                                            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                          >
                                            {task.completed ? '✓' : <span className="opacity-0 transition-opacity group-hover:opacity-70">✓</span>}
                                          </button>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="block min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                                                {task.text}
                                              </span>
                                              <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                                High
                                              </span>
                                            </div>

                                            {task.dueDate || (goalsColumnShowTaskTags && task.taskTag) ? (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                                {task.dueDate ? <span className={getOutcomeTaskDueClassName(task.dueDate, todayIso)}>{formatOutcomeTaskDueLabel(task.dueDate, todayIso)}</span> : null}
                                                {goalsColumnShowTaskTags ? <TaskTagMetaChip tag={task.taskTag} /> : null}
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </>
                              ) : (
                                visibleTasks.map((task, index) => (
                                  <div
                                    key={task.id}
                                    ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                    onClick={() => openTaskPeek(task)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        openTaskPeek(task)
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] ${
                                      index < visibleTasks.length - 1 ? 'border-b border-white/[0.06]' : ''
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        toggleTaskCompletion(task.id)
                                      }}
                                      className={`group mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] transition-colors ${
                                        task.completed
                                          ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                                          : 'border-white/[0.18] text-transparent hover:border-emerald-400/70 hover:text-emerald-400'
                                      }`}
                                      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                      title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                                    >
                                      {task.completed ? '✓' : <span className="opacity-0 transition-opacity group-hover:opacity-70">✓</span>}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`block min-w-0 flex-1 truncate ${
                                            task.completed
                                              ? 'text-[12px] text-zinc-600 line-through'
                                              : task.priority === 'high'
                                                ? 'text-[12px] text-zinc-200'
                                                : 'text-[13px] text-zinc-200'
                                          }`}
                                        >
                                          {task.text}
                                        </span>
                                        {task.priority === 'high' ? (
                                          <span className="rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]">
                                            High
                                          </span>
                                        ) : null}
                                      </div>

                                      {task.dueDate || (goalsColumnShowTaskTags && task.taskTag) ? (
                                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                          {task.dueDate ? <span className={getOutcomeTaskDueClassName(task.dueDate, todayIso)}>{formatOutcomeTaskDueLabel(task.dueDate, todayIso)}</span> : null}
                                          {goalsColumnShowTaskTags ? <TaskTagMetaChip tag={task.taskTag} /> : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : (
                            <p className="px-2 py-2 text-sm text-zinc-500">No active tasks for this goal.</p>
                          )}

                          {goalsColumnViewOptions.completed && group.completedTasks.length > 0 ? (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => setGoalsColumnCompletedOpen((current) => !current)}
                                className="flex w-full items-center justify-between py-1 text-left"
                              >
                                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Completed</span>
                                <span className="text-[10px] text-zinc-500">{goalsColumnCompletedOpen ? 'Hide' : group.completedTasks.length}</span>
                              </button>
                              {goalsColumnCompletedOpen ? (
                                <div className="mt-1">
                                  {group.completedTasks.map((task, index) => (
                                    <div
                                      key={task.id}
                                      ref={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                                      onClick={() => openTaskPeek(task)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault()
                                          openTaskPeek(task)
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/30 ${
                                        index < group.completedTasks.length - 1 ? 'border-b border-white/[0.06]' : ''
                                      }`}
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="mt-0.5 flex h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400/80"
                                      />

                                      <div className="min-w-0 flex-1">
                                        <span className="block truncate text-[12px] text-zinc-600 line-through">
                                          {task.text}
                                        </span>
                                        {task.completedAt ? (
                                          <span className="mt-0.5 block text-[11px] text-zinc-500">
                                            Completed {formatTaskCompletedDate(task.completedAt)}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        </>
                      ) : null}
                    </div>
                  )
                }) : (
                  goalsColumnShowCompletedGoals && scopedCompletedGoalGroups.length > 0
                    ? <p className="text-sm text-white/46">No active goal-linked tasks in this scope.</p>
                    : <p className="text-sm text-white/46">No goal-linked tasks in this scope.</p>
                )}

                {goalsColumnShowCompletedGoals && scopedCompletedGoalGroups.length > 0 ? (
                  <div className="px-3.5 pt-3 sm:px-4">
                    <button
                      type="button"
                      onClick={() => setGoalsCompletedSectionCollapsed((current) => !current)}
                      aria-expanded={!goalsCompletedSectionCollapsed}
                      className="mb-2 flex min-h-[34px] w-full items-center justify-between rounded-md border-t border-white/[0.06] px-1 py-2 text-left transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.24em] text-zinc-400">Completed Goals</p>
                        <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                          {scopedCompletedGoalGroups.length}
                        </span>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${goalsCompletedSectionCollapsed ? '' : 'rotate-90'}`}
                      />
                    </button>
                    {!goalsCompletedSectionCollapsed ? (
                      <div className="space-y-2">
                        {scopedCompletedGoalGroups.map((group) => (
                          <div
                            key={`completed-goal-${group.id}`}
                            className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.03]"
                            style={{ boxShadow: `inset 2px 0 0 ${resolveLifeGoalCategoryCssColor(getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories))}` }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {onOpenLifeGoal ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenLifeGoal(group.id)}
                                  className="min-w-0 flex-1 text-left"
                                >
                                  <p className="truncate text-[13px] text-zinc-200">{group.label}</p>
                                  <p className="mt-0.5 text-[11px] text-zinc-500">
                                    {group.completedTasks.length} completed task{group.completedTasks.length === 1 ? '' : 's'}
                                  </p>
                                </button>
                              ) : (
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13px] text-zinc-200">{group.label}</p>
                                  <p className="mt-0.5 text-[11px] text-zinc-500">
                                    {group.completedTasks.length} completed task{group.completedTasks.length === 1 ? '' : 's'}
                                  </p>
                                </div>
                              )}
                              <span className="shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-400">
                                Complete
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </AnimatePresence>
            </SectionCard>

            {showDirectionalColumn && (
              <SectionCard
                shell="task"
                compact
                className={`flex flex-col px-0 py-3.5 sm:px-0 sm:py-4 [--card-bg:#12141A] ${
                  pageLayoutMode === 'columns'
                    ? `flex flex-col flex-1 min-h-0 min-w-0 ${collapsedStacks.directional ? 'self-start' : ''}`
                    : 'w-full max-w-full'
                }`}
              >
              <div className="relative mb-3 px-3.5 sm:px-4">
              <SectionHeader
                title="Directional Goals"
                count={scopedDirectionGroups.length}
                actions={
                  !(pageLayoutMode === 'columns' && collapsedStacks.directional) ? (
                    <IconButton
                      ref={directionsPanelTriggerRef}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDirectionsPanelOpen((current) => !current)
                      }}
                      variant="muted"
                      size="sm"
                      ariaLabel={directionsPanelOpen ? 'Close directional controls' : 'Open directional controls'}
                      icon={<GoalsControlIcon />}
                    />
                  ) : null
                }
                isCollapsed={collapsedStacks.directional}
                onToggleCollapse={
                  pageLayoutMode === 'columns'
                    ? () => setCollapsedStacks((current) => ({ ...current, directional: !current.directional }))
                    : pageLayoutMode === 'stacked'
                      ? () => setCollapsedStacks((current) => ({ ...current, directional: !current.directional }))
                      : undefined
                }
                collapsedSummary={
                  ((pageLayoutMode === 'columns' && collapsedStacks.directional) ||
                    (pageLayoutMode === 'stacked' && collapsedStacks.directional)) &&
                  collapsedDirectionalColumnSummary.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-zinc-500">
                      {collapsedDirectionalColumnSummary.join(' · ')}
                    </p>
                  ) : null
                }
              />
              <AnimatePresence>
                {directionsPanelOpen ? (
                  <motion.aside
                    ref={directionsPanelRef}
                    className="absolute right-0 top-[calc(100%+10px)] z-[40] w-[300px] max-w-[calc(100vw-48px)]"
                    initial={{ opacity: 0, x: 12, y: -6 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: 12, y: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    <ControlsPanelShell className="grid gap-3">
                      <GoalsPanelSection title="Preview Mode">
                        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                          <button
                            type="button"
                            onClick={() => setDirectionalPreviewMode('follow-scope')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalPreviewMode === 'follow-scope' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Follow task scope
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionalPreviewMode('all-active')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalPreviewMode === 'all-active' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Show all active
                          </button>
                        </div>
                      </GoalsPanelSection>
                      <GoalsPanelSection title="Focus Mode">
                        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                          <button
                            type="button"
                            onClick={() => setDirectionalFocusMode('off')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalFocusMode === 'off' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Off
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionalFocusMode('focus-only')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalFocusMode === 'focus-only' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Focus only
                          </button>
                        </div>
                      </GoalsPanelSection>
                      <GoalsPanelSection title="Sort">
                        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                          <button
                            type="button"
                            onClick={() => setDirectionalSortMode('default')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalSortMode === 'default' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Default
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionalSortMode('most-active')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalSortMode === 'most-active' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Most active
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectionalSortMode('recently-updated')}
                            className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                              directionalSortMode === 'recently-updated' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                            }`}
                          >
                            Recently updated
                          </button>
                        </div>
                      </GoalsPanelSection>
                      <GoalsPanelSection title="Hide empty goals">
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Hide empty goals</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={directionalHideEmpty}
                            onClick={() => setDirectionalHideEmpty((current) => !current)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                              directionalHideEmpty
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.16)]'
                                : 'border-white/[0.08] bg-white/[0.04]'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white transition ${directionalHideEmpty ? 'translate-x-5' : 'translate-x-1'}`}
                            />
                          </button>
                        </label>
                      </GoalsPanelSection>
                    </ControlsPanelShell>
                  </motion.aside>
                ) : null}
              </AnimatePresence>
              </div>
              <AnimatePresence initial={false}>
                {pageLayoutMode === 'columns' ? (
                  !collapsedStacks.directional && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="theme-scrollbar flex-1 min-h-0 overflow-y-auto">
                      <div className="px-3.5 sm:px-4">
                        <div className="pr-1">
                {scopedDirectionGroups.length > 0 ? scopedDirectionGroups.map((group) => (
                  <div key={group.goal.id} className="space-y-3">
                    <div className="flex items-center gap-1.5 px-1">
                      <DirectionalCompassGlyph color={getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories)} />
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories) }}
                      >
                        {group.goal.category || 'Uncategorized'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-800/40">
                        <p className="text-[13px] font-medium text-zinc-300">
                          {group.goal.title}
                        </p>

                        {group.preview.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {group.preview.map((task) => (
                              <div key={task.id} className="flex items-center gap-2">
                                <DirectionalTaskBullet />
                                <span className="text-[11px] text-zinc-500">
                                  {task.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-600">No current tasks</p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm text-white/46">No directional tasks in this scope.</p>}
                        </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : !collapsedStacks.directional ? (
                  <motion.div
                    key="directional-stack-content"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18, ease: 'easeInOut' }}
                    className="w-full max-w-full overflow-visible"
                  >
                    <div className="space-y-4">
                      <div className="px-3.5 sm:px-4">
                        <div className="pr-1">
                {scopedDirectionGroups.length > 0 ? scopedDirectionGroups.map((group) => (
                  <div key={group.goal.id} className="space-y-3">
                    <div className="flex items-center gap-1.5 px-1">
                      <DirectionalCompassGlyph color={getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories)} />
                      <span
                        className="text-[12px] font-medium"
                        style={{ color: getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories) }}
                      >
                        {group.goal.category || 'Uncategorized'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-800/40">
                        <p className="text-[13px] font-medium text-zinc-300">
                          {group.goal.title}
                        </p>

                        {group.preview.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {group.preview.map((task) => (
                              <div key={task.id} className="flex items-center gap-2">
                                <DirectionalTaskBullet />
                                <span className="text-[11px] text-zinc-500">
                                  {task.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-600">No current tasks</p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm text-white/46">No directional tasks in this scope.</p>}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
              </SectionCard>
            )}
          </section>

      </div>

      <SectionCard
        shell="task"
        compact
        className="mt-3.5 flex-shrink-0 space-y-2 p-2.5 sm:p-3"
      >
        <button
          type="button"
          onClick={() => setCompletedTodayOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Completed today</p>
            <p className="mt-0.5 text-sm text-zinc-500">{completedTodayTasks.length} completed</p>
          </div>
          <span className="text-zinc-500">{completedTodayOpen ? '−' : '+'}</span>
        </button>
        {completedTodayOpen ? (
          <div className="theme-scrollbar max-h-44 space-y-2 overflow-y-auto pr-1">
            {completedTodayTasks.length > 0 ? completedTodayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                lifeGoals={safeLifeGoals}
                lifeGoalCategories={lifeGoalCategories}
                allTasks={safeTasks}
                selected={isTaskPeekSelected(task.id)}
                rowRef={isTaskPeekSelected(task.id) ? selectedTaskRowRef : undefined}
                onOpen={() => openTaskPeek(task)}
                onToggleComplete={() => restoreTask(task.id)}
                onFocus={() => focusTask(task.id)}
                onRescheduleTomorrow={() => rescheduleTask(task.id, 1)}
                onRescheduleNextWeek={() => rescheduleTask(task.id, 7)}
                completed
              />
            )) : <p className="text-sm text-white/46">Nothing completed yet today.</p>}
          </div>
        ) : null}
      </SectionCard>

      {selectedTask ? (
        <TaskPeek
          task={selectedTask}
          open={isTaskPeekOpen}
          autoSelectTitle={taskPeekAutoSelectTitle}
          rightOffset={taskPeekRightOffset}
          onClose={handleTaskPeekClose}
          onComplete={handleTaskPeekComplete}
          onDelete={handleTaskPeekDelete}
          onUpdate={handleTaskPeekUpdate}
          goalOptions={taskPeekGoalOptions}
          directionOptions={taskPeekDirectionOptions}
          goalContext={selectedTaskGoalContext}
          linkedContextById={taskPeekLinkedContextById}
          milestoneOptionsByGoalId={taskPeekMilestoneOptionsByGoalId}
          onCreateMilestoneForGoal={createMilestoneForTaskPeekGoal}
          onOpenLinkedGoal={onOpenLifeGoal}
          showLaterToggle={true}
        />
      ) : null}

      <AnimatePresence>
        {taskDeleteUndo ? (
          <motion.div
            className="fixed bottom-5 right-5 z-[95] max-w-[min(320px,calc(100vw-2rem))] rounded-[18px] border border-white/[0.07] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] px-3.5 py-2.5 shadow-[0_16px_34px_rgba(0,0,0,0.24)] backdrop-blur-[10px]"
            initial={{ opacity: 0, y: 8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white/78">{taskDeleteUndo.message}</p>
              <button
                type="button"
                onClick={undoDeletedTask}
                className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.76)] transition hover:text-[rgb(var(--theme-info-rgb)/0.96)]"
              >
                Undo
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  )
}


function TaskRow({
  task,
  lifeGoals,
  lifeGoalCategories,
  allTasks,
  selected,
  prominent = false,
  completed = false,
  lowEmphasis = false,
  triageActions,
  rowRef,
  onOpen,
  onToggleComplete,
  onFocus,
  onRescheduleTomorrow,
  onRescheduleNextWeek,
}: {
  task: Task
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  allTasks: Task[]
  selected: boolean
  prominent?: boolean
  completed?: boolean
  lowEmphasis?: boolean
  triageActions?: ReactNode
  rowRef?: RefObject<HTMLDivElement | null>
  onOpen: () => void
  onToggleComplete: () => void
  onFocus: () => void
  onRescheduleTomorrow: () => void
  onRescheduleNextWeek: () => void
}) {
  const goalById = useMemo(() => new Map(lifeGoals.map((goal) => [goal.id, goal])), [lifeGoals])
  const linkDescriptor = useMemo(
    () => getTaskLinkDescriptor(task, goalById, lifeGoalCategories, allTasks),
    [allTasks, goalById, lifeGoalCategories, task],
  )

  return (
    <div
      ref={rowRef}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className={`group w-full rounded-[22px] border px-4 py-3 text-left transition ${
        selected
          ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.08)]'
          : lowEmphasis
            ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
            : prominent
              ? 'border-white/[0.1] bg-white/[0.05] hover:bg-white/[0.06]'
              : completed
                ? 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.03]'
                : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]'
      }`}
      style={linkDescriptor.rowStyle}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleComplete()
          }}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
            task.completed ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white' : 'border-white/[0.16] text-white/44'
          }`}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed ? '✓' : list ? <span className="opacity-0 transition-opacity hover:opacity-40">✓</span> : ''}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${task.completed ? 'text-white/48 line-through' : 'text-white/86'}`}>
                {task.text}
              </p>
              {(linkDescriptor.label || task.dueDate || task.dueTime) ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-white/52">
                  {linkDescriptor.label ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5"
                      style={{ ...linkDescriptor.chipStyle, ...linkDescriptor.chipTextStyle }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={linkDescriptor.dotStyle} />
                      {linkDescriptor.label}
                      {linkDescriptor.quiet ? <span className="text-white/40">quiet</span> : null}
                    </span>
                  ) : null}
                  {task.dueDate ? <MetaChip label={formatDateContextual(task.dueDate)} /> : null}
                  {task.dueTime ? <MetaChip label={formatDueTime(task.dueTime)} /> : null}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <PriorityPill priority={task.priority} />
              {task.taskTag ? <MetaChip label={task.taskTag} /> : null}
              {task.notes.trim() ? <MetaChip label="Notes" /> : null}
              {task.subtasks.length > 0 ? <MetaChip label={`${task.subtasks.filter((subtask) => subtask.completed).length}/${task.subtasks.length}`} /> : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onFocus()
                }}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  task.starred
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/58 hover:text-white'
                }`}
              >
                {task.starred ? 'Focused' : 'Focus'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRescheduleTomorrow()
                }}
                className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-white/52 transition hover:text-white"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onRescheduleNextWeek()
                }}
                className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] text-white/52 transition hover:text-white"
              >
                Next week
              </button>
            </div>
          </div>
          {triageActions ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{triageActions}</div> : null}
          {completed && task.completedAt ? (
            <p className="mt-2 text-xs text-white/42">Completed {formatTaskCompletedDate(task.completedAt)}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompactTaskRow({
  task,
  lifeGoals,
  lifeGoalCategories,
  allTasks,
  selected,
  prominent = false,
  completed = false,
  subdued = false,
  flat = false,
  list = false,
  hideFocusAction = false,
  rowRef,
  onOpen,
  onToggleComplete,
  onFocus,
  onTagClick,
  activeQuickTag = null,
  hideTagChip = false,
  completedMetadataOnly = false,
}: {
  task: Task
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  allTasks: Task[]
  selected: boolean
  prominent?: boolean
  completed?: boolean
  subdued?: boolean
  flat?: boolean
  list?: boolean
  hideFocusAction?: boolean
  rowRef?: RefObject<HTMLDivElement | null>
  onOpen: () => void
  onToggleComplete: () => void
  onFocus: () => void
  onTagClick?: (tag: string) => void
  activeQuickTag?: string | null
  hideTagChip?: boolean
  completedMetadataOnly?: boolean
}) {
  const goalById = useMemo(() => new Map(lifeGoals.map((goal) => [goal.id, goal])), [lifeGoals])
  const linkDescriptor = useMemo(
    () => getTaskLinkDescriptor(task, goalById, lifeGoalCategories, allTasks),
    [allTasks, goalById, lifeGoalCategories, task],
  )

  return (
    <div
      ref={rowRef}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className={`group w-full text-left transition ${
        flat
          ? `border-none bg-transparent px-2 py-3 ${
              selected ? 'text-white' : 'hover:bg-white/[0.02]'
            }`
          : list
            ? `rounded-[12px] border-none bg-transparent px-1.5 pt-[11px] pb-[7px] ${
                selected
                  ? 'bg-white/[0.04]'
                  : subdued
                    ? 'hover:bg-white/[0.022]'
                    : 'hover:bg-white/[0.028]'
              }`
          : `rounded-[16px] border px-3 py-2.5 ${
              selected
                ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.08)]'
                : prominent
                  ? 'border-white/[0.08] bg-white/[0.04]'
                  : subdued
                    ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                    : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]'
            }`
      }`}
      style={linkDescriptor.rowStyle}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleComplete()
          }}
          className={`group/checkbox mt-1 flex h-4 w-4 shrink-0 items-center justify-center border text-[9px] transition-colors ${
            list ? 'rounded-[6px]' : 'rounded-full'
          } ${
            task.completed
              ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
              : list
                ? 'border-white/[0.2] text-white/46 hover:border-emerald-400/70 hover:bg-[rgb(var(--theme-accent-rgb)/0.08)] hover:text-emerald-400'
                : 'border-white/[0.14] text-white/38'
          }`}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          title={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed ? '✓' : list ? <span className="opacity-0 transition-opacity group-hover/checkbox:opacity-40">✓</span> : ''}
        </button>
        <div className="min-w-0 flex-1">
          {list ? (
            <div className="min-w-0 w-full">
              <p className={`truncate text-[13.5px] ${completed ? 'text-white/46 line-through' : 'text-white/68'}`}>
                {task.text}
              </p>
              {completedMetadataOnly ? (
                <p className="mt-1 text-[11px] text-white/36">
                  {task.completedAt ? `Completed ${formatTaskCompletedDate(task.completedAt)}` : 'Completed'}
                </p>
              ) : (
                <div className="mt-0.5 flex w-full items-center justify-between gap-3 text-[10px]">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    {task.dueDate ? (() => {
                      const dueMeta = getGeneralTaskDueDateMeta(task.dueDate)
                      return (
                        <span className={`inline-flex items-center ${dueMeta.className} ${dueMeta.pulseClassName ?? ''}`}>
                          <span>{dueMeta.label}</span>
                        </span>
                      )
                    })() : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpen()
                        }}
                        className="inline-flex items-center text-zinc-700 transition hover:text-zinc-500"
                        aria-label={`Set due date for ${task.text}`}
                        title="Set due date"
                      >
                        <CalendarGlyph className="text-zinc-700" />
                      </button>
                    )}
                    {task.taskTag && !hideTagChip ? (
                      <TaskTagPill
                        tag={task.taskTag}
                        tagColor={task.tagColor}
                        active={Boolean(onTagClick && activeQuickTag === normalizeTaskTag(task.taskTag))}
                        onClick={
                          onTagClick
                            ? (event) => {
                                event.stopPropagation()
                                onTagClick(normalizeTaskTag(task.taskTag) ?? task.taskTag ?? '')
                              }
                            : undefined
                        }
                      />
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center justify-end">
                    <div className="flex min-w-[34px] justify-end">
                      {task.priority === 'high' ? (
                        <span
                          className="inline-flex shrink-0 rounded-[5px] border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-1 py-[2px] text-[8px] uppercase tracking-[0.06em] text-[rgb(var(--theme-negative-rgb)/0.9)]"
                          aria-label="High priority"
                          title="High priority"
                        >
                          High
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`truncate text-[15px] ${completed ? 'text-white/46 line-through' : 'text-white/86'}`}>
                  {task.text}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/46">
                  {task.dueDate ? <span>{formatDateContextual(task.dueDate)}</span> : null}
                  {task.taskTag ? <MetaChip label={task.taskTag} /> : null}
                  {!flat && !list && linkDescriptor.label ? <span className="truncate text-white/42">{linkDescriptor.label}</span> : null}
                </div>
              </div>
              {hideFocusAction || list ? null : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onFocus()
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    task.starred
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/54 hover:text-white'
                  }`}
                >
                  {task.starred ? 'Focused' : 'Focus'}
                </button>
              )}
            </div>
          )}
          {completed && task.completedAt && !completedMetadataOnly ? (
            <p className="mt-1 text-[11px] text-white/36">Completed {formatTaskCompletedDate(task.completedAt)}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function getGoalScannerRowStyle(
  goal: LifeGoal,
  lifeGoalCategories: LifeGoalCategoryDefinition[],
): CSSProperties {
  const color = getLifeGoalCategoryColor(goal.category, lifeGoalCategories)
  return {
    boxShadow: `inset 2px 0 0 ${color}`,
  }
}

function DirectionalCompassGlyph({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="6" cy="6" r="4.5" stroke={color} strokeWidth="1.2" />
      <path d="M7.9 4.1 6.8 6.8 4.1 7.9 5.2 5.2 7.9 4.1Z" fill={color} />
    </svg>
  )
}

function DirectionalTaskBullet() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" className="text-zinc-700" />
    </svg>
  )
}

function GoalsPanelSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2 border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
      <p className={`uppercase tracking-[0.18em] ${TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME}`}>{title}</p>
      {children}
    </section>
  )
}

function GoalsControlIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 11.75H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5.25" cy="4.25" r="1.35" fill="currentColor" />
      <circle cx="10.75" cy="8" r="1.35" fill="currentColor" />
      <circle cx="7.25" cy="11.75" r="1.35" fill="currentColor" />
    </svg>
  )
}

function ClockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-zinc-500">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6 3.4V6.1L7.9 7.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowRightGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.25 5.5H8.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M5.75 3 8.25 5.5 5.75 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3V13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3 8H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function CalendarGlyph({ className = 'text-zinc-600' }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect x="1.5" y="2.25" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3.25 1.5V3.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M8.75 1.5V3.1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M1.5 4.25H10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}

function Tag({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={className}>
      <path
        d="M2 3.25C2 2.56 2.56 2 3.25 2H6.15C6.48 2 6.8 2.13 7.03 2.37L9.63 4.97C10.12 5.46 10.12 6.25 9.63 6.74L6.74 9.63C6.25 10.12 5.46 10.12 4.97 9.63L2.37 7.03C2.13 6.8 2 6.48 2 6.15V3.25Z"
        stroke="currentColor"
        strokeWidth="0.95"
        strokeLinejoin="round"
      />
      <circle cx="4.1" cy="4.1" r="0.7" fill="currentColor" />
    </svg>
  )
}

function getTaskTagColorClass(tag?: string) {
  const t = tag?.trim().toLowerCase()

  switch (t) {
    case 'dev':
      return 'bg-blue-500/15 text-blue-400'
    case 'docs':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'bug':
      return 'bg-red-500/15 text-red-400'
    case 'meeting':
      return 'bg-amber-500/15 text-amber-400'
    case 'design':
      return 'bg-violet-500/15 text-violet-400'
    case 'admin':
      return 'bg-violet-500/15 text-violet-400'
    case 'book':
      return 'bg-amber-500/15 text-amber-400'
    case 'buy':
      return 'bg-emerald-500/15 text-emerald-400'
    case 'call':
      return 'bg-pink-500/15 text-pink-400'
    case 'health':
      return 'bg-cyan-500/15 text-cyan-400'
    case 'mindset':
      return 'bg-cyan-500/15 text-cyan-400'
    case 'build':
      return 'bg-blue-500/15 text-blue-400'
    case 'plan':
      return 'bg-violet-500/15 text-violet-400'
    case 'research':
      return 'bg-cyan-500/15 text-cyan-400'
    case 'urgent':
      return 'bg-pink-500/15 text-pink-400'
    case 'review':
      return 'bg-orange-500/15 text-orange-400'
    case 'reminder':
      return 'bg-amber-500/15 text-amber-400'
    case 'someday':
      return 'bg-slate-500/15 text-slate-400'
    default:
      return 'bg-slate-500/15 text-slate-400'
  }
}

function resolveTaskTagColor(tag?: string | null, tagColor?: string | null) {
  if (typeof tagColor === 'string' && tagColor.trim().length > 0) return tagColor
  const normalizedTag = normalizeTaskTag(tag)
  return normalizedTag ? getTaskTagColorClass(normalizedTag) : ''
}

function getTaskTagAccentRgb(tag?: string | null) {
  switch (normalizeTaskTag(tag)) {
    case 'dev':
    case 'build':
      return '96 165 250'
    case 'docs':
    case 'buy':
      return '52 211 153'
    case 'bug':
      return '248 113 113'
    case 'meeting':
    case 'book':
    case 'reminder':
      return '251 191 36'
    case 'design':
    case 'admin':
    case 'plan':
      return '192 132 252'
    case 'research':
    case 'health':
    case 'mindset':
      return '34 211 238'
    case 'call':
    case 'urgent':
      return '244 114 182'
    case 'review':
      return '251 146 60'
    case 'someday':
      return '148 163 184'
    default:
      return null
  }
}

function getComingUpGoalAccentStyles(color: LifeGoalCategoryDefinition['color']) {
  const accentColor = resolveLifeGoalCategoryCssColor(color)
  return {
    dotColor: accentColor,
    chipStyle: {
      backgroundColor: resolveLifeGoalCategoryCssColor(color, 0.12),
      color: resolveLifeGoalCategoryCssColor(color, 0.98),
    } as CSSProperties,
  }
}

function getComingUpTaskTagAccentStyles(tag?: string | null, _tagColor?: string | null) {
  const accentRgb = getTaskTagAccentRgb(tag)
  if (!accentRgb) {
    return {
      dotColor: 'rgba(255,255,255,0.38)',
      chipStyle: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: 'rgba(255,255,255,0.62)',
      } as CSSProperties,
    }
  }

  return {
    dotColor: `rgb(${accentRgb})`,
    chipStyle: {
      backgroundColor: `rgb(${accentRgb} / 0.14)`,
      color: `rgb(${accentRgb} / 0.98)`,
    } as CSSProperties,
  }
}

function formatTaskTagLabel(tag?: string) {
  if (!tag) return ''
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="theme-pill-shell border-white/[0.08] bg-white/[0.03] text-white/58">
      {label}
    </span>
  )
}

function TaskTagPill({
  tag,
  tagColor,
  monochrome = false,
  active = false,
  onClick,
}: {
  tag?: string | null
  tagColor?: string | null
  monochrome?: boolean
  active?: boolean
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  if (!tag) return null

  const content = (
    <>
      <Tag className="w-2 h-2" />
      {formatTaskTagLabel(tag)}
    </>
  )

  if (monochrome) {
    return (
      <span className="theme-pill-shell-compact gap-1 border-transparent bg-white/[0.05] text-zinc-500">
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-all duration-150 ${
        resolveTaskTagColor(tag, tagColor)
      } ${
        active
          ? 'ring-1 ring-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
          : ''
      } ${
        onClick ? 'hover:-translate-y-[1px] hover:opacity-100 hover:brightness-110 hover:ring-1 hover:ring-white/12' : ''
      }`}
    >
      {content}
    </button>
  )
}

function TaskTagMetaChip({ tag }: { tag?: string | null }) {
  if (!tag) return null
  return <TaskTagPill tag={tag} monochrome />
}

function PriorityPill({ priority }: { priority: LifeGoalTaskPriority }) {
  if (priority === 'none') return null
  const toneClassName =
    priority === 'high'
      ? 'border-[rgb(var(--theme-negative-rgb)/0.22)] bg-[rgb(var(--theme-negative-rgb)/0.08)] text-[rgb(var(--theme-negative-rgb)/0.88)]'
      : priority === 'medium'
        ? 'border-[rgb(var(--theme-warning-rgb)/0.22)] bg-[rgb(var(--theme-warning-rgb)/0.08)] text-[rgb(var(--theme-warning-rgb)/0.9)]'
        : 'border-[rgb(var(--theme-info-rgb)/0.22)] bg-[rgb(var(--theme-info-rgb)/0.08)] text-[rgb(var(--theme-info-rgb)/0.9)]'
  return (
    <span className={`theme-pill-shell ${toneClassName}`}>
      {toLabel(priority)}
    </span>
  )
}

function createEmptyCaptureDraft(): CaptureDraft {
  return {
    text: '',
    dueDate: '',
    dueTime: '',
    priority: 'none',
    linkedGoalId: '',
    linkedDirectionId: '',
    taskTag: '',
  }
}

function createTaskId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function isTaskPeekDraftEmpty(
  task: TaskPeekTaskData,
  options?: {
    seedTitle?: string | null
    seedLinkedGoalId?: string | null
    seedLinkedDirectionId?: string | null
  },
) {
  const normalizedTitle = normalizeTaskPeekDraftText(task.title)
  const normalizedSeedTitle = normalizeTaskPeekDraftText(options?.seedTitle)
  const hasMeaningfulTitle =
    normalizedTitle.length > 0 &&
    !(normalizedTitle === normalizedSeedTitle && TASK_PEEK_EMPTY_DRAFT_TITLE_SEEDS.has(normalizedSeedTitle))
  const hasMeaningfulGoalLink = Boolean(task.linkedGoalId && task.linkedGoalId !== (options?.seedLinkedGoalId ?? null))
  const hasMeaningfulDirectionLink = Boolean(
    task.linkedDirectionId && task.linkedDirectionId !== (options?.seedLinkedDirectionId ?? null),
  )

  return (
    !hasMeaningfulTitle &&
    !task.dueDate &&
    !normalizeDueTime(task.dueTime) &&
    !normalizeTaskTag(task.tag) &&
    task.priority === 'none' &&
    !(task.details?.trim()) &&
    (task.subtasks?.length ?? 0) === 0 &&
    (task.externalLinks?.length ?? 0) === 0 &&
    !hasMeaningfulGoalLink &&
    !hasMeaningfulDirectionLink
  )
}

function normalizeTaskPeekDraftText(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : ''
}

function withTaskDueDateFields(dueDate: string | null) {
  return { dueDate }
}

function normalizeDueTime(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null
}

function normalizeTaskTag(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return trimmed.length > 0 ? trimmed : null
}

function isSomedayTask(task: Task) {
  return task.isSomeday === true || normalizeTaskTag(task.taskTag) === 'someday'
}

function getNextTaskOrder(tasks: Task[]) {
  return tasks.reduce((max, task) => Math.max(max, Number.isFinite(task.order) ? task.order : 0), -1) + 1
}

function withTaskTimestamp(task: Task): Task {
  const somedayState = normalizeSomedayTagState(task.taskTag)
  return {
    ...task,
    isSomeday: task.isSomeday === true || somedayState.isSomeday,
    dueTime: normalizeDueTime(task.dueTime),
    taskTag: somedayState.taskTag,
    tagColor: somedayState.taskTag ? resolveTaskTagColor(somedayState.taskTag, task.tagColor) : null,
    updatedAt: new Date().toISOString(),
  }
}

function matchesScope(task: Task, scope: TaskSuperScope, todayIso: string) {
  if (scope === 'today') {
    return task.starred || task.dueDate === todayIso
  }

  if (scope === 'upcoming') {
    return Boolean(task.dueDate && task.dueDate > todayIso && task.dueDate <= shiftIsoDate(todayIso, 3))
  }

  return true
}

function compareExecutionTasks(todayIso: string) {
  return (left: Task, right: Task) => {
    if (left.starred !== right.starred) return left.starred ? -1 : 1
    const leftDue = left.dueDate ?? '9999-12-31'
    const rightDue = right.dueDate ?? '9999-12-31'
    const leftDuePriority = left.dueDate && left.dueDate < todayIso ? 0 : left.dueDate === todayIso ? 1 : 2
    const rightDuePriority = right.dueDate && right.dueDate < todayIso ? 0 : right.dueDate === todayIso ? 1 : 2
    if (leftDuePriority !== rightDuePriority) return leftDuePriority - rightDuePriority
    if (left.priority !== right.priority) return getPriorityRank(right.priority) - getPriorityRank(left.priority)
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
    const leftDueTime = left.dueTime ?? ''
    const rightDueTime = right.dueTime ?? ''
    if (leftDueTime !== rightDueTime) return leftDueTime.localeCompare(rightDueTime)
    if (left.order !== right.order) return left.order - right.order
    return left.text.localeCompare(right.text)
  }
}

function compareComingUpStripTasks(todayIso: string) {
  return (left: Task, right: Task) => {
    const leftDuePriority = left.dueDate && left.dueDate < todayIso ? 0 : left.dueDate === todayIso ? 1 : 2
    const rightDuePriority = right.dueDate && right.dueDate < todayIso ? 0 : right.dueDate === todayIso ? 1 : 2
    if (leftDuePriority !== rightDuePriority) return leftDuePriority - rightDuePriority

    const leftDue = left.dueDate ?? '9999-12-31'
    const rightDue = right.dueDate ?? '9999-12-31'
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)

    const leftDueTime = left.dueTime ?? ''
    const rightDueTime = right.dueTime ?? ''
    if (leftDueTime !== rightDueTime) return leftDueTime.localeCompare(rightDueTime)

    return compareExecutionTasks(todayIso)(left, right)
  }
}

function compareGeneralTasks(sortMode: GeneralSortMode, todayIso: string) {
  if (sortMode === 'due') {
    return (left: Task, right: Task) => {
      const leftDue = left.dueDate ?? '9999-12-31'
      const rightDue = right.dueDate ?? '9999-12-31'
      const leftDuePriority = left.dueDate && left.dueDate < todayIso ? 0 : left.dueDate === todayIso ? 1 : left.dueDate ? 2 : 3
      const rightDuePriority = right.dueDate && right.dueDate < todayIso ? 0 : right.dueDate === todayIso ? 1 : right.dueDate ? 2 : 3
      if (leftDuePriority !== rightDuePriority) return leftDuePriority - rightDuePriority
      if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
      const leftDueTime = left.dueTime ?? ''
      const rightDueTime = right.dueTime ?? ''
      if (leftDueTime !== rightDueTime) return leftDueTime.localeCompare(rightDueTime)
      if (left.order !== right.order) return left.order - right.order
      return left.text.localeCompare(right.text)
    }
  }

  if (sortMode === 'priority') {
    return (left: Task, right: Task) => {
      const priorityDelta = getPriorityRank(right.priority) - getPriorityRank(left.priority)
      if (priorityDelta !== 0) return priorityDelta
      return compareExecutionTasks(todayIso)(left, right)
    }
  }

  if (sortMode === 'recent') {
    return (left: Task, right: Task) => {
      if ((right.createdAt ?? '') !== (left.createdAt ?? '')) return (right.createdAt ?? '').localeCompare(left.createdAt ?? '')
      return right.order - left.order
    }
  }

  return (left: Task, right: Task) => {
    if (left.order !== right.order) return left.order - right.order
    return compareExecutionTasks(todayIso)(left, right)
  }
}

function compareGeneralTasksWithinBucket(sortMode: GeneralSortMode, todayIso: string) {
  const fallbackComparator = compareGeneralTasks(sortMode, todayIso)
  return (left: Task, right: Task) => {
    const leftIsHighPriority = left.priority === 'high'
    const rightIsHighPriority = right.priority === 'high'
    if (leftIsHighPriority !== rightIsHighPriority) return leftIsHighPriority ? -1 : 1
    return fallbackComparator(left, right)
  }
}

function compareUnassignedTasks(left: Task, right: Task) {
  if (left.updatedAt !== right.updatedAt) return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
  return right.order - left.order
}

function readTaskSuperPanelState(storageKey: string) {
  if (typeof window === 'undefined') return {} as Record<string, unknown>

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) return {} as Record<string, unknown>
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {} as Record<string, unknown>
  }
}

function readTasksPageLayoutMode(): TasksPageLayoutMode {
  if (typeof window === 'undefined') return 'columns'

  try {
    const rawValue = window.localStorage.getItem(TASKS_VIEW_MODE_STORAGE_KEY)
    return rawValue === 'stacked' ? 'stacked' : 'columns'
  } catch {
    return 'columns'
  }
}

function readCollapsedStacksState(): CollapsedStacksState {
  if (typeof window === 'undefined') {
    return { general: false, outcome: false, directional: false }
  }

  try {
    const rawValue =
      window.localStorage.getItem(TASKS_COLLAPSED_STACKS_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_TASKS_COLLAPSED_STACKS_STORAGE_KEY)
    if (!rawValue) return { general: false, outcome: false, directional: false }
    const parsed = JSON.parse(rawValue) as Partial<CollapsedStacksState>
    return {
      general: parsed.general === true,
      outcome: parsed.outcome === true,
      directional: parsed.directional === true,
    }
  } catch {
    return { general: false, outcome: false, directional: false }
  }
}

function readGoalsColumnViewOptions(value: Record<string, unknown>) {
  const candidate = value.goalsColumnViewOptions
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const viewOptions = candidate as Partial<GoalsColumnViewOptions>
    const allTasks = viewOptions.allTasks ?? DEFAULT_GOALS_COLUMN_VIEW_OPTIONS.allTasks
    const next = allTasks ? false : viewOptions.next ?? DEFAULT_GOALS_COLUMN_VIEW_OPTIONS.next
    const dueSoon = allTasks ? false : viewOptions.dueSoon ?? DEFAULT_GOALS_COLUMN_VIEW_OPTIONS.dueSoon
    const highPriority = allTasks ? false : viewOptions.highPriority ?? DEFAULT_GOALS_COLUMN_VIEW_OPTIONS.highPriority
    return {
      next,
      highPriority,
      dueSoon,
      allTasks,
      completed: viewOptions.completed ?? DEFAULT_GOALS_COLUMN_VIEW_OPTIONS.completed,
    }
  }

  if (value.goalsColumnMode === 'all-tasks') {
    return { ...DEFAULT_GOALS_COLUMN_VIEW_OPTIONS, allTasks: true, next: false }
  }

  if (value.goalsColumnMode === 'next-and-high-priority') {
    return { ...DEFAULT_GOALS_COLUMN_VIEW_OPTIONS, allTasks: false, next: true, highPriority: true }
  }

  return DEFAULT_GOALS_COLUMN_VIEW_OPTIONS
}

function readGoalsColumnCategoryFilter(value: Record<string, unknown>): GoalsColumnCategoryFilter {
  const candidate = value.goalsColumnCategoryFilter

  if (Array.isArray(candidate)) {
    return candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }

  if (candidate === 'all' || candidate == null) return []
  if (typeof candidate === 'string' && candidate.trim().length > 0) return [candidate]
  return []
}

function readGeneralSortMode(value: Record<string, unknown>): GeneralSortMode {
  const candidate = value.generalSortMode
  if (candidate === 'due' || candidate === 'priority' || candidate === 'recent') return candidate
  if (candidate === 'manual' || candidate === 'default' || candidate === 'oldest-added') return 'due'
  if (candidate === 'recently-added') return 'recent'
  return 'due'
}

function readGeneralGroupMode(value: Record<string, unknown>): GeneralGroupMode {
  const candidate = value.generalGroupMode
  return candidate === 'tag' || candidate === 'due' || candidate === 'priority' ? candidate : 'none'
}

function readGeneralTagGroupOrder(value: Record<string, unknown>): string[] {
  const candidate = value.generalTagGroupOrder
  if (!Array.isArray(candidate)) return []
  return candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function readGeneralViewFilters(value: Record<string, unknown>): GeneralViewFilters {
  const candidate = value.generalViewFilters
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const filters = candidate as Partial<GeneralViewFilters>
    return {
      highPriority: filters.highPriority ?? DEFAULT_GENERAL_VIEW_FILTERS.highPriority,
      dueToday: filters.dueToday ?? DEFAULT_GENERAL_VIEW_FILTERS.dueToday,
      withNotes: filters.withNotes ?? DEFAULT_GENERAL_VIEW_FILTERS.withNotes,
      withSubtasks: filters.withSubtasks ?? DEFAULT_GENERAL_VIEW_FILTERS.withSubtasks,
      includeCompleted: filters.includeCompleted ?? DEFAULT_GENERAL_VIEW_FILTERS.includeCompleted,
    }
  }
  return DEFAULT_GENERAL_VIEW_FILTERS
}

function getGeneralDueBucketMeta(dueDate: string, todayIso: string) {
  const today = new Date(`${todayIso}T00:00:00Z`)
  const due = new Date(`${dueDate}T00:00:00Z`)
  const tomorrowIso = shiftIsoDate(todayIso, 1)
  const dayOfWeek = (today.getUTCDay() + 6) % 7
  const startOfWeek = new Date(today)
  startOfWeek.setUTCDate(today.getUTCDate() - dayOfWeek)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6)
  const nextWeekStart = new Date(endOfWeek)
  nextWeekStart.setUTCDate(endOfWeek.getUTCDate() + 1)
  const nextWeekEnd = new Date(nextWeekStart)
  nextWeekEnd.setUTCDate(nextWeekStart.getUTCDate() + 6)
  const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))

  if (dueDate < todayIso) return { id: 'due-overdue', label: 'Overdue', order: 0 }
  if (dueDate === todayIso) return { id: 'due-today', label: 'Today', order: 1 }
  if (dueDate === tomorrowIso) return { id: 'due-tomorrow', label: 'Tomorrow', order: 2 }
  if (due > today && due <= endOfWeek) return { id: 'due-this-week', label: 'This Week', order: 3 }
  if (due >= nextWeekStart && due <= nextWeekEnd) return { id: 'due-next-week', label: 'Next Week', order: 4 }
  if (due > nextWeekEnd && due <= endOfMonth) return { id: 'due-later-this-month', label: 'Later This Month', order: 5 }

  const monthLabel = new Intl.DateTimeFormat('en', {
    month: 'long',
    ...(due.getUTCFullYear() !== today.getUTCFullYear() ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(due)
  const monthOrder =
    (due.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (due.getUTCMonth() - today.getUTCMonth())

  return {
    id: `due-month-${due.getUTCFullYear()}-${due.getUTCMonth() + 1}`,
    label: monthLabel,
    order: 5 + monthOrder,
  }
}

function matchesGeneralDueTodayFilter(task: Task, todayIso: string) {
  return Boolean(task.dueDate && task.dueDate <= todayIso)
}

function buildGeneralDueTodayTaskGroups(tasks: Task[], todayIso: string): GeneralTaskGroup[] {
  const dueSectionComparator = compareGeneralTasksWithinBucket('due', todayIso)
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < todayIso).slice().sort(dueSectionComparator)
  const todayTasks = tasks.filter((task) => task.dueDate === todayIso).slice().sort(dueSectionComparator)

  return [
    ...(todayTasks.length > 0 ? [{ id: 'due-today-today', label: 'Today', tasks: todayTasks }] : []),
    ...(overdueTasks.length > 0 ? [{ id: 'due-today-overdue', label: 'Overdue', tasks: overdueTasks }] : []),
  ]
}

function buildGeneralTaskGroups(tasks: Task[], groupMode: GeneralGroupMode, todayIso: string, tagGroupOrder: string[]): GeneralTaskGroup[] {
  if (groupMode === 'none') {
    return [{ id: 'all', label: 'All Tasks', tasks }]
  }

  if (groupMode === 'tag') {
    const buckets = new Map<string, Task[]>()
    tasks.forEach((task) => {
      const key = normalizeTaskTag(task.taskTag) ?? 'untagged'
      buckets.set(key, [...(buckets.get(key) ?? []), task])
    })
    return Array.from(buckets.entries())
      .sort(([left], [right]) => {
        const leftIndex = tagGroupOrder.indexOf(left)
        const rightIndex = tagGroupOrder.indexOf(right)
        if (leftIndex !== -1 || rightIndex !== -1) {
          if (leftIndex === -1) return 1
          if (rightIndex === -1) return -1
          return leftIndex - rightIndex
        }
        if (left === 'untagged') return 1
        if (right === 'untagged') return -1
        return left.localeCompare(right)
      })
      .map(([key, bucketTasks]) => ({
        id: `tag-${key}`,
        label: key === 'untagged' ? 'Untagged' : formatTaskTagLabel(key),
        tasks: bucketTasks,
        normalizedTag: key,
        accentStyle:
          key === 'untagged'
            ? undefined
            : {
                backgroundColor: `rgb(${getTaskTagAccentRgb(key) ?? '148 163 184'} / 0.12)`,
                borderColor: `rgb(${getTaskTagAccentRgb(key) ?? '148 163 184'} / 0.22)`,
              },
        accentTextStyle:
          key === 'untagged'
            ? undefined
            : {
                color: `rgb(${getTaskTagAccentRgb(key) ?? '148 163 184'} / 0.96)`,
              },
        accentDividerStyle:
          key === 'untagged'
            ? undefined
            : {
                backgroundColor: `rgb(${getTaskTagAccentRgb(key) ?? '148 163 184'} / 1)`,
              },
      }))
  }

  if (groupMode === 'priority') {
    return (['high', 'medium', 'low', 'none'] as LifeGoalTaskPriority[])
      .map((priority) => ({
        id: `priority-${priority}`,
        label: priority === 'none' ? 'No Priority' : `${toLabel(priority)} Priority`,
        tasks: tasks.filter((task) => task.priority === priority),
      }))
      .filter((group) => group.tasks.length > 0)
  }

  const groupedByDue = new Map<string, { id: string; label: string; order: number; tasks: Task[] }>()

  tasks.forEach((task) => {
    if (!task.dueDate) {
      const existing = groupedByDue.get('due-none')
      if (existing) {
        existing.tasks.push(task)
      } else {
        groupedByDue.set('due-none', { id: 'due-none', label: 'No Date', order: 999, tasks: [task] })
      }
      return
    }

    const bucket = getGeneralDueBucketMeta(task.dueDate, todayIso)
    const existing = groupedByDue.get(bucket.id)
    if (existing) {
      existing.tasks.push(task)
    } else {
      groupedByDue.set(bucket.id, { ...bucket, tasks: [task] })
    }
  })

  return Array.from(groupedByDue.values())
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map((group) => ({
      id: group.id,
      label: group.label,
      tasks: [...group.tasks].sort(compareGeneralTasksWithinBucket('due', todayIso)),
    }))
}

function buildGoalsColumnVisibleTasks(
  tasks: Task[],
  options: {
    nextEnabled: boolean
    dueSoonEnabled: boolean
    highPriorityEnabled: boolean
    allTasksEnabled: boolean
    nextTask: Task | null
    dueSoonTask: Task | null
    highPriorityTasks: Task[]
  },
) {
  if (options.allTasksEnabled) return tasks

  const orderedTasks: Task[] = []
  const seenTaskIds = new Set<string>()

  const pushTask = (task: Task | null) => {
    if (!task || seenTaskIds.has(task.id)) return
    seenTaskIds.add(task.id)
    orderedTasks.push(task)
  }

  if (options.nextEnabled) pushTask(options.nextTask)
  if (options.dueSoonEnabled) pushTask(options.dueSoonTask)
  if (options.highPriorityEnabled) options.highPriorityTasks.forEach((task) => pushTask(task))

  return orderedTasks
}

function resolveLifeGoalCategoryCssColor(color: LifeGoalCategoryDefinition['color'], alpha = 0.9) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return `rgb(var(${variable}) / ${alpha})`
}

function getGeneralTaskDueDateMeta(dueDate: string) {
  const todayIso = getTodayIsoDate()
  const dueTimestamp = new Date(`${dueDate}T00:00:00Z`).getTime()
  const todayTimestamp = new Date(`${todayIso}T00:00:00Z`).getTime()
  const dayDelta = Math.round((dueTimestamp - todayTimestamp) / 86400000)

  if (dayDelta < 0) {
    const overdueDays = Math.abs(dayDelta)
    return {
      label: `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`,
      className: 'text-[rgb(var(--theme-negative-rgb)/0.88)]',
      iconClassName: 'text-[rgb(var(--theme-negative-rgb)/0.82)]',
      pulseClassName: undefined,
    }
  }

  if (dayDelta === 0) {
    return {
      label: 'Today',
      className: 'text-[rgb(var(--theme-accent-rgb)/0.92)]',
      iconClassName: 'text-[rgb(var(--theme-accent-rgb)/0.88)]',
      pulseClassName: 'animate-[pulse_2.2s_ease-in-out_infinite]',
    }
  }

  if (dayDelta <= 3) {
    return {
      label: `Due in ${dayDelta} day${dayDelta === 1 ? '' : 's'}`,
      className: 'text-zinc-500',
      iconClassName: 'text-zinc-600',
      pulseClassName: undefined,
    }
  }

  return {
    label: formatDateContextual(dueDate),
    className: 'text-zinc-500',
    iconClassName: 'text-zinc-600',
    pulseClassName: undefined,
  }
}

function writeTaskSuperPanelState(storageKey: string, value: Record<string, unknown>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Ignore storage failures and keep the UI functional.
  }
}

function getPriorityRank(priority: LifeGoalTaskPriority) {
  switch (priority) {
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function getDashboardGreeting(now: Date, name: string) {
  const hour = now.getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function formatDashboardHeaderDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function getTaskDueTimestamp(task: Task) {
  if (!task.dueDate) return null
  const dueTime = normalizeDueTime(task.dueTime)
  const dueDateTime = dueTime ? `${task.dueDate}T${dueTime}:00` : `${task.dueDate}T23:59:59`
  const timestamp = new Date(dueDateTime).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function getStartOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + diff)
  return next
}

function formatDueTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date.toLocaleTimeString('en-IE', { hour: 'numeric', minute: '2-digit' })
}

function formatComingUpTimingLabel(dueDate: string, dueTime: string | null | undefined, todayIso: string) {
  const baseLabel = dueDate === todayIso ? 'Today' : dueDate === shiftIsoDate(todayIso, 1) ? 'Tomorrow' : formatDateContextual(dueDate)
  const normalizedDueTime = normalizeDueTime(dueTime ?? null)
  return normalizedDueTime ? `${baseLabel}, ${formatDueTime(normalizedDueTime)}` : baseLabel
}

function formatOutcomeTaskDueLabel(dueDate: string, todayIso: string) {
  if (dueDate === todayIso) return 'Due today'
  if (dueDate === shiftIsoDate(todayIso, 1)) return 'Due tomorrow'
  return formatDateContextual(dueDate)
}

function getOutcomeTaskDueClassName(dueDate: string, todayIso: string) {
  if (dueDate < todayIso) return 'text-[rgb(var(--theme-negative-rgb)/0.92)]'
  if (dueDate === todayIso) return 'text-emerald-400'
  return 'text-zinc-500'
}

function getNextFocusCandidateId(tasks: Task[], completedTaskId: string, todayIso: string) {
  return tasks
    .filter((task) => !task.completed && task.id !== completedTaskId && !isSomedayTask(task))
    .slice()
    .sort(compareExecutionTasks(todayIso))[0]?.id ?? null
}

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getTaskLinkDescriptor(
  task: Task,
  goalById: Map<string, LifeGoal>,
  lifeGoalCategories: LifeGoalCategoryDefinition[],
  allTasks: Task[],
): LinkDescriptor {
  const linkedGoal =
    (task.linkedDirectionId ? goalById.get(task.linkedDirectionId) : null) ??
    (task.linkedGoalId ? goalById.get(task.linkedGoalId) : null) ??
    null
  if (!linkedGoal) {
    return {
      type: 'none',
      label: null,
      quiet: false,
    }
  }
  const color = getLifeGoalCategoryColor(linkedGoal.category, lifeGoalCategories)
  const goalTasks = allTasks.filter((candidate) =>
    linkedGoal.goalType === 'directional'
      ? candidate.linkedDirectionId === linkedGoal.id
      : candidate.linkedGoalId === linkedGoal.id,
  )
  const lastCompletion = goalTasks
    .map((candidate) => candidate.completedAt)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .sort((left, right) => right.localeCompare(left))[0] ?? null
  const quiet = !lastCompletion || Math.round((Date.now() - new Date(lastCompletion).getTime()) / 86400000) > 7

  return {
    type: linkedGoal.goalType === 'directional' ? 'direction' : 'goal',
    label: linkedGoal.title,
    quiet,
    chipStyle: getLifeGoalCategoryChipStyle(color),
    chipTextStyle: getLifeGoalCategoryChipTextStyle(color),
    dotStyle: getLifeGoalCategoryDotStyle(color),
    rowStyle: getLifeGoalRowHighlightStyle(color),
  }
}

const fieldClassName =
  'w-full rounded-2xl border border-white/[0.08] bg-[#161616] px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] placeholder:text-white/24 focus:border-white/[0.14] focus:bg-[#1b1b1b]'
