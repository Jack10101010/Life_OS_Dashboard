import { CSSProperties, FormEvent, KeyboardEvent, ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageContainer, SectionCard } from '../../components/layout/LayoutPrimitives'
import { Card } from '../../components/ui/Card'
import {
  formatDateContextual,
  formatTaskCompletedDate,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryChipTextStyle,
  getLifeGoalCategoryColor,
  getLifeGoalCategoryDotStyle,
  getLifeGoalRowHighlightStyle,
  getTodayIsoDate,
  shiftIsoDate,
} from '../goals/goalUtils'
import type { LifeGoal, LifeGoalCategoryDefinition, LifeGoalTaskPriority, Task } from '../../types'

type TaskSuperScope = 'today' | 'upcoming' | 'all-active'
type TaskTimeFilter = 'all' | 'today' | 'overdue' | 'no-date' | 'scheduled'
type TaskStatusFilter = 'open' | 'completed' | 'all'
type TaskLinkMode = 'none' | 'goal' | 'direction'
type GoalsColumnMode = 'next-task' | 'all-tasks'
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

const DEFAULT_TASK_TAG_OPTIONS = ['buy', 'book', 'call', 'admin', 'reminder', 'someday'] as const
const SCOPE_OPTIONS: Array<{ id: TaskSuperScope; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all-active', label: 'All Active' },
]
const PRIORITY_OPTIONS: LifeGoalTaskPriority[] = ['none', 'low', 'medium', 'high']
const FOCUS_COMPLETION_FEEDBACK_MS = 1800
const TASK_GOALS_PANEL_SHELL_CLASSNAME =
  'overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
const TASK_GOALS_PANEL_PRIMARY_LABEL_CLASSNAME = 'text-[12px] text-[rgba(255,255,255,0.85)]'
const TASK_GOALS_PANEL_SECONDARY_LABEL_CLASSNAME = 'text-[11px] text-[rgba(255,255,255,0.55)]'
const TASK_GOALS_PANEL_SELECT_CLASSNAME =
  'h-9 w-full appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]'

type CaptureDraft = {
  text: string
  dueDate: string
  dueTime: string
  priority: LifeGoalTaskPriority
  linkedGoalId: string
  linkedDirectionId: string
  taskTag: string
}

export function TaskSuperPage({
  tasks,
  lifeGoals,
  lifeGoalCategories,
  onUpdateTasks,
  onAddCurrentFocusToTodayLog,
}: {
  tasks: Task[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  onUpdateTasks: (updater: (current: Task[]) => Task[]) => void
  onAddCurrentFocusToTodayLog?: (task: Task) => void
}) {
  const safeTasks = tasks ?? []
  const safeLifeGoals = lifeGoals ?? []
  const todayIso = getTodayIsoDate()
  const quickCaptureInputRef = useRef<HTMLInputElement | null>(null)
  const quickCaptureDueDateRef = useRef<HTMLInputElement | null>(null)
  const selectedTaskRowRef = useRef<HTMLDivElement | null>(null)
  const [scope, setScope] = useState<TaskSuperScope>('today')
  const [executionMode, setExecutionMode] = useState(false)
  const [goalFilter, setGoalFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<TaskTimeFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<LifeGoalTaskPriority | 'all'>('all')
  const [taskTagFilter, setTaskTagFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('open')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [completedTodayOpen, setCompletedTodayOpen] = useState(false)
  const [captureExpanded, setCaptureExpanded] = useState(false)
  const [captureScope, setCaptureScope] = useState<CaptureScope>(null)
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft>(createEmptyCaptureDraft())
  const [focusPromptDraft, setFocusPromptDraft] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [preferredPanelLinkMode, setPreferredPanelLinkMode] = useState<TaskLinkMode | null>(null)
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false)
  const [goalsColumnGoalFilter, setGoalsColumnGoalFilter] = useState<string>('all')
  const [goalsColumnPriorityFilter, setGoalsColumnPriorityFilter] = useState<LifeGoalTaskPriority | 'all'>('all')
  const [goalsColumnMode, setGoalsColumnMode] = useState<GoalsColumnMode>('next-task')
  const [goalsColumnCompletedOpen, setGoalsColumnCompletedOpen] = useState(false)
  const [expandedOutcomeGoalId, setExpandedOutcomeGoalId] = useState<string | null>(null)
  const [comingUpSelectedDate, setComingUpSelectedDate] = useState<string | null>(null)
  const [focusCompletionFeedback, setFocusCompletionFeedback] = useState<{
    taskId: string
    taskText: string
    contextLabel: string | null
  } | null>(null)

  const goalById = useMemo(() => new Map(safeLifeGoals.map((goal) => [goal.id, goal])), [safeLifeGoals])
  const outcomeGoals = useMemo(
    () => safeLifeGoals.filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === 'outcome'),
    [safeLifeGoals],
  )
  const orderedOutcomeGoals = useMemo(
    () => outcomeGoals.slice().sort((left, right) => left.order - right.order),
    [outcomeGoals],
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

  const comingUpDays = useMemo(
    () =>
      Array.from({ length: 3 }, (_, index) => {
        const date = shiftIsoDate(todayIso, index + 1)
        const dayTasks = safeTasks
          .filter((task) => !task.completed && !isSomedayTask(task) && task.dueDate === date)
          .slice()
          .sort(compareExecutionTasks(todayIso))
        return {
          date,
          count: dayTasks.length,
          preview: dayTasks.slice(0, 2),
        }
      }).filter((day) => day.count > 0),
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
      safeTasks.filter((task) => {
        if (goalFilter !== 'all' && task.linkedGoalId !== goalFilter) return false
        if (directionFilter !== 'all' && task.linkedDirectionId !== directionFilter) return false
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
        if (taskTagFilter !== 'all' && normalizeTaskTag(task.taskTag) !== taskTagFilter) return false
        if (statusFilter === 'open' && task.completed) return false
        if (statusFilter === 'completed' && !task.completed) return false
        if (!matchesTimeFilter(task, timeFilter, todayIso)) return false
        return true
      }),
    [directionFilter, goalFilter, priorityFilter, safeTasks, statusFilter, taskTagFilter, timeFilter, todayIso],
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

  const selectedTask = useMemo(
    () => (selectedTaskId ? safeTasks.find((task) => task.id === selectedTaskId) ?? null : null),
    [safeTasks, selectedTaskId],
  )

  const clearFilters = useCallback(() => {
    setGoalFilter('all')
    setDirectionFilter('all')
    setTimeFilter('all')
    setPriorityFilter('all')
    setTaskTagFilter('all')
    setStatusFilter('open')
    setComingUpSelectedDate(null)
  }, [])

  useEffect(() => {
    if (!selectedTaskId || safeTasks.some((task) => task.id === selectedTaskId)) return
    setSelectedTaskId(null)
  }, [safeTasks, selectedTaskId])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      const isTypingContext =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable

      if (event.key === 'Escape' && !isTypingContext && !selectedTask) {
        clearFilters()
      }

      if ((event.key === 'f' || event.key === 'F') && selectedTaskId && !isTypingContext) {
        event.preventDefault()
        focusTask(selectedTaskId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [clearFilters, selectedTask, selectedTaskId])

  useEffect(() => {
    if (!focusCompletionFeedback) return
    const timeoutId = window.setTimeout(() => setFocusCompletionFeedback(null), FOCUS_COMPLETION_FEEDBACK_MS)
    return () => window.clearTimeout(timeoutId)
  }, [focusCompletionFeedback])

  useEffect(() => {
    if (!selectedTask) return
    selectedTaskRowRef.current?.focus()
  }, [selectedTask?.id])

  const updateTask = useCallback(
    (taskId: string, updater: (task: Task) => Task) => {
      onUpdateTasks((current) => current.map((task) => (task.id === taskId ? withTaskTimestamp(updater(task)) : task)))
    },
    [onUpdateTasks],
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      onUpdateTasks((current) => current.filter((task) => task.id !== taskId))
      if (selectedTaskId === taskId) setSelectedTaskId(null)
    },
    [onUpdateTasks, selectedTaskId],
  )

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

  const rescheduleTask = useCallback(
    (taskId: string, deltaDays: number) => {
      updateTask(taskId, (task) => ({
        ...task,
        dueDate: shiftIsoDate(task.dueDate ?? todayIso, deltaDays),
      }))
    },
    [todayIso, updateTask],
  )

  const createTask = useCallback(
    (draft: CaptureDraft, options: { focus?: boolean; scope?: CaptureScope } = {}) => {
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
      const nextTask: Task = {
        id: createTaskId(),
        text,
        order: getNextTaskOrder(safeTasks),
        dueDate: draft.dueDate || null,
        dueTime: normalizeDueTime(draft.dueTime),
        taskTag: normalizeTaskTag(draft.taskTag),
        starred: options.focus ?? false,
        important: draft.priority === 'high',
        linkedGoalId: nextLinkedGoalId,
        linkedDirectionId: nextLinkedDirectionId,
        completed: false,
        completedAt: null,
        description: '',
        notes: '',
        priority: draft.priority,
        tags: [],
        subtasks: [],
        milestoneId: null,
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
      setSelectedTaskId(nextTask.id)
      return nextTask
    },
    [captureScope, onUpdateTasks, safeTasks],
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
      .filter((task) => matchesScope(task, scope, todayIso, comingUpSelectedDate))
      .slice()
      .sort(compareExecutionTasks(todayIso))
  }, [comingUpSelectedDate, filteredTasks, scope, todayIso])

  const scopedGeneralTasks = useMemo(
    () => scopedActiveTasks.filter((task) => !task.linkedGoalId && !task.linkedDirectionId),
    [scopedActiveTasks],
  )

  const isAllGoalsMode = goalsColumnGoalFilter === 'all'
  const filteredGoalSet = useMemo(
    () => orderedOutcomeGoals.filter((goal) => goalsColumnGoalFilter === 'all' || goal.id === goalsColumnGoalFilter),
    [goalsColumnGoalFilter, orderedOutcomeGoals],
  )
  const selectedGoalForColumn = useMemo(
    () => (!isAllGoalsMode ? orderedOutcomeGoals.find((goal) => goal.id === goalsColumnGoalFilter) ?? null : null),
    [goalsColumnGoalFilter, isAllGoalsMode, orderedOutcomeGoals],
  )

  useEffect(() => {
    setGoalsColumnCompletedOpen(false)
  }, [goalsColumnGoalFilter])

  useEffect(() => {
    if (expandedOutcomeGoalId && !filteredGoalSet.some((goal) => goal.id === expandedOutcomeGoalId)) {
      setExpandedOutcomeGoalId(null)
    }
  }, [expandedOutcomeGoalId, filteredGoalSet])

  const scopedGoalGroups = useMemo(
    () =>
      filteredGoalSet
        .map((goal) => {
          const scopedTasks = scopedActiveTasks
            .filter((task) => task.linkedGoalId === goal.id)
            .filter((task) =>
              goalsColumnPriorityFilter === 'all'
                ? true
                : goalsColumnPriorityFilter === 'none'
                  ? task.priority === 'none' || task.priority === 'low'
                  : task.priority === goalsColumnPriorityFilter,
            )
            .slice()
            .sort((left, right) => left.order - right.order)
          const activeTasks = safeTasks
            .filter((task) => !task.completed)
            .filter((task) => !isSomedayTask(task))
            .filter((task) => task.linkedGoalId === goal.id)
            .filter((task) => matchesGoalsColumnPriorityFilter(task, goalsColumnPriorityFilter))
            .slice()
            .sort((left, right) => left.order - right.order)
          const completedTasks = safeTasks
            .filter((task) => task.completed)
            .filter((task) => !isSomedayTask(task))
            .filter((task) => task.linkedGoalId === goal.id)
            .filter((task) => matchesGoalsColumnPriorityFilter(task, goalsColumnPriorityFilter))
            .slice()
            .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))

          return {
            goal,
            scopedTasks,
            activeTasks,
            completedTasks,
          }
        })
        .map(({ goal, scopedTasks, activeTasks, completedTasks }) => ({
          id: goal.id,
          goal,
          label: goal.title,
          sublabel: `${activeTasks.length} active tasks`,
          tasks: activeTasks,
          completedTasks,
          nextTask: activeTasks[0] ?? scopedTasks[0] ?? null,
          kind: 'goal' as const,
        })),
    [filteredGoalSet, goalsColumnPriorityFilter, safeTasks, scopedActiveTasks],
  )

  const goalsColumnSummary = useMemo(() => {
    const segments: string[] = []

    if (isAllGoalsMode) {
      segments.push('All goals')
      segments.push(goalsColumnMode === 'next-task' ? 'Next task' : 'All tasks')
    } else {
      if (selectedGoalForColumn) segments.push(selectedGoalForColumn.title)
      segments.push(goalsColumnMode === 'next-task' ? 'Next task' : 'All tasks')
    }

    if (goalsColumnPriorityFilter !== 'all') {
      segments.push(`Priority: ${goalsColumnPriorityFilter === 'none' ? 'Low / None' : toLabel(goalsColumnPriorityFilter)}`)
    }

    return segments.join(' · ')
  }, [goalsColumnMode, goalsColumnPriorityFilter, isAllGoalsMode, selectedGoalForColumn])

  const scopedDirectionGroups = useMemo(
    () =>
      directionalGoals
        .map((goal) => {
          const directionTasks = scopedActiveTasks
            .filter((task) => task.linkedDirectionId === goal.id)
            .slice()
            .sort((left, right) => left.order - right.order)
          return {
            goal,
            tasks: directionTasks,
            preview: directionTasks.slice(0, 3),
          }
        })
        .filter((group) => group.tasks.length > 0),
    [directionalGoals, scopedActiveTasks],
  )

  const scopedSomedayTasks = useMemo(
    () =>
      filteredTasks
        .filter((task) => !task.completed)
        .filter((task) => isSomedayTask(task))
        .slice()
        .sort(compareExecutionTasks(todayIso)),
    [filteredTasks, todayIso],
  )

  const activeFilterChips = useMemo(
    () =>
      [
        goalFilter !== 'all' ? `Goal` : null,
        directionFilter !== 'all' ? `Direction` : null,
        timeFilter !== 'all' ? `Time` : null,
        priorityFilter !== 'all' ? `Priority` : null,
        taskTagFilter !== 'all' ? `Tag` : null,
        statusFilter !== 'open' ? `Status` : null,
      ].filter((value): value is string => Boolean(value)),
    [directionFilter, goalFilter, priorityFilter, statusFilter, taskTagFilter, timeFilter],
  )

  const executionModeTasks = useMemo(
    () => activeExecutionQueue.filter((task) => !focusedTask || task.id !== focusedTask.id).slice(0, 3),
    [activeExecutionQueue, focusedTask],
  )

  return (
    <PageContainer width="page" className="-mx-2 pb-7 pt-2 sm:-mx-2 lg:-mx-3 2xl:-mx-4">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3.5">
        <Card className="space-y-3 p-3.5 sm:p-4">
          <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Priorities & Tasks</h1>
                {activeFilterChips.length > 0 ? (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/56">
                    {activeFilterChips.join(' · ')}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setScope(option.id)
                    if (option.id !== 'upcoming') setComingUpSelectedDate(null)
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[13px] transition ${
                    scope === option.id
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.11)] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/66 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExecutionMode((current) => !current)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] transition ${
                  executionMode
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.24)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                    : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                Execution Mode {executionMode ? 'On' : 'Off'}
              </button>
            </div>
          </div>

            {!executionMode ? (
              <>
              <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] xl:items-start">
                <form onSubmit={submitQuickCapture} className="min-w-0 space-y-2">
                  {captureScope ? (
                    <button
                      type="button"
                      onClick={() => setCaptureScope(null)}
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/66 transition hover:text-white"
                    >
                      Scoped to {captureScope.title}
                      <span className="text-white/36">×</span>
                    </button>
                  ) : null}
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      ref={quickCaptureInputRef}
                      value={captureDraft.text}
                      onChange={(event) => setCaptureDraft((current) => ({ ...current, text: event.target.value }))}
                      onKeyDown={handleQuickCaptureKeyDown}
                      placeholder="Capture the next task"
                      className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#161616] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.14] focus:bg-[#1b1b1b]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setCaptureExpanded((current) => !current)}
                        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/68 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        {captureExpanded ? 'Less' : 'More'}
                      </button>
                    </div>
                  </div>
                  {captureExpanded ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <InlineField label="Due date">
                          <input
                            ref={quickCaptureDueDateRef}
                            type="date"
                            value={captureDraft.dueDate}
                            onChange={(event) => setCaptureDraft((current) => ({ ...current, dueDate: event.target.value }))}
                            className={fieldClassName}
                          />
                        </InlineField>
                        <InlineField label="Due time">
                          <input
                            type="time"
                            value={captureDraft.dueTime}
                            onChange={(event) => setCaptureDraft((current) => ({ ...current, dueTime: event.target.value }))}
                            className={fieldClassName}
                          />
                        </InlineField>
                        <InlineField label="Priority">
                          <select
                            value={captureDraft.priority}
                            onChange={(event) => setCaptureDraft((current) => ({ ...current, priority: event.target.value as LifeGoalTaskPriority }))}
                            className={fieldClassName}
                          >
                            {PRIORITY_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {toLabel(option)}
                              </option>
                            ))}
                          </select>
                        </InlineField>
                        <InlineField label="Goal">
                          <select
                            value={captureDraft.linkedGoalId}
                            onChange={(event) =>
                              setCaptureDraft((current) => ({
                                ...current,
                                linkedGoalId: event.target.value,
                                linkedDirectionId: event.target.value ? '' : current.linkedDirectionId,
                              }))
                            }
                            className={fieldClassName}
                          >
                            <option value="">None</option>
                            {outcomeGoals.map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                {goal.title}
                              </option>
                            ))}
                          </select>
                        </InlineField>
                        <InlineField label="Direction">
                          <select
                            value={captureDraft.linkedDirectionId}
                            onChange={(event) =>
                              setCaptureDraft((current) => ({
                                ...current,
                                linkedDirectionId: event.target.value,
                                linkedGoalId: event.target.value ? '' : current.linkedGoalId,
                              }))
                            }
                            className={fieldClassName}
                          >
                            <option value="">None</option>
                            {directionalGoals.map((goal) => (
                              <option key={goal.id} value={goal.id}>
                                {goal.title}
                              </option>
                            ))}
                          </select>
                        </InlineField>
                        <InlineField label="Tag">
                          <input
                            list="task-super-tags"
                            value={captureDraft.taskTag}
                            onChange={(event) => setCaptureDraft((current) => ({ ...current, taskTag: event.target.value }))}
                            className={fieldClassName}
                            placeholder="buy / call / someday"
                          />
                        </InlineField>
                        <datalist id="task-super-tags">
                          {taskTagOptions.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      </div>
                  ) : null}
                </form>

                  <div className="flex flex-col gap-2 xl:items-end">
                  <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                    <FilterSelect label="Goal" value={goalFilter} onChange={setGoalFilter} options={[
                      { value: 'all', label: 'All goals' },
                      ...outcomeGoals.map((goal) => ({ value: goal.id, label: goal.title })),
                    ]} />
                    <FilterSelect label="Direction" value={directionFilter} onChange={setDirectionFilter} options={[
                      { value: 'all', label: 'All directions' },
                      ...directionalGoals.map((goal) => ({ value: goal.id, label: goal.title })),
                    ]} />
                    <FilterSelect
                      label="Time"
                      value={timeFilter}
                      onChange={(value) => setTimeFilter(value as TaskTimeFilter)}
                      options={[
                        { value: 'all', label: 'Any time' },
                        { value: 'today', label: 'Today' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'no-date', label: 'No date' },
                        { value: 'scheduled', label: 'Scheduled' },
                      ]}
                    />
                    <button
                      type="button"
                      onClick={() => setMoreFiltersOpen((current) => !current)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/68 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      More
                    </button>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/54 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex w-full flex-wrap items-stretch gap-1.5 xl:max-w-[500px] xl:justify-end">
                    {comingUpDays.length > 0 ? comingUpDays.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => {
                          setComingUpSelectedDate(day.date)
                          setScope('upcoming')
                        }}
                        className={`min-w-[108px] flex-1 rounded-2xl border px-2.5 py-2 text-left transition xl:flex-none ${
                          comingUpSelectedDate === day.date
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.08)]'
                            : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-white/42">{formatDateContextual(day.date)}</p>
                          <span className="text-xs font-medium text-white/82">{day.count}</span>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-white/58">
                          {day.preview.map((task) => (
                            <p key={task.id} className="truncate">{task.text}</p>
                          ))}
                        </div>
                      </button>
                    )) : (
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/46">
                        Nothing scheduled in the next three days.
                      </div>
                    )}
                    {comingUpSelectedDate ? (
                      <button
                        type="button"
                        onClick={() => {
                          setComingUpSelectedDate(null)
                          setScope('today')
                        }}
                        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/62 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        Clear day
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {moreFiltersOpen ? (
                <div className="grid gap-2.5 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-3.5 md:grid-cols-3">
                  <FilterSelect
                    label="Priority"
                    value={priorityFilter}
                    onChange={(value) => setPriorityFilter(value as LifeGoalTaskPriority | 'all')}
                    options={[
                      { value: 'all', label: 'Any priority' },
                      ...PRIORITY_OPTIONS.map((option) => ({ value: option, label: toLabel(option) })),
                    ]}
                  />
                  <FilterSelect
                    label="Tag"
                    value={taskTagFilter}
                    onChange={setTaskTagFilter}
                    options={[
                      { value: 'all', label: 'Any tag' },
                      ...taskTagOptions.map((option) => ({ value: option, label: option })),
                    ]}
                  />
                  <FilterSelect
                    label="Status"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter(value as TaskStatusFilter)}
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'all', label: 'All' },
                    ]}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </Card>

        <Card className="overflow-hidden p-0" style={currentFocusLinkDescriptor?.rowStyle}>
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Current Focus</p>
                  <AnimatePresence initial={false}>
                    {focusCompletionFeedback ? (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.08)] px-3 py-1 text-[11px] text-[rgb(var(--theme-accent-rgb)/0.88)]"
                      >
                        <span className="font-medium text-white/88">{focusCompletionFeedback.taskText}</span>
                        {focusCompletionFeedback.contextLabel ? <span>• {focusCompletionFeedback.contextLabel}</span> : null}
                        {onAddCurrentFocusToTodayLog ? (
                          <button
                            type="button"
                            onClick={() => {
                              const completedTask = safeTasks.find((task) => task.id === focusCompletionFeedback.taskId)
                              if (completedTask) onAddCurrentFocusToTodayLog(completedTask)
                            }}
                            className="rounded-full border border-white/[0.12] px-2 py-0.5 text-[11px] text-white/82 transition hover:bg-white/[0.06]"
                          >
                            Add to today&apos;s log
                          </button>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {focusedTask ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(focusedTask.id)}
                    className="mt-1.5 flex min-w-0 flex-col items-start text-left"
                  >
                    <p className="truncate text-[16px] font-semibold tracking-[-0.02em] text-white">{focusedTask.text}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {focusedTask.dueDate ? <MetaChip label={formatDateContextual(focusedTask.dueDate)} /> : null}
                      {focusedTask.dueTime ? <MetaChip label={formatDueTime(focusedTask.dueTime)} /> : null}
                      <PriorityPill priority={focusedTask.priority} />
                      {focusedTask.taskTag ? <MetaChip label={focusedTask.taskTag} /> : null}
                      {currentFocusLinkDescriptor?.label ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                          style={{ ...currentFocusLinkDescriptor.chipStyle, ...currentFocusLinkDescriptor.chipTextStyle }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={currentFocusLinkDescriptor.dotStyle} />
                          {currentFocusLinkDescriptor.label}
                          {currentFocusLinkDescriptor.quiet ? <span className="text-white/42">• quiet</span> : null}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ) : scope === 'today' && todayExecutionTasks.length === 0 ? (
                  <form onSubmit={submitFocusPrompt} className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={focusPromptDraft}
                      onChange={(event) => setFocusPromptDraft(event.target.value)}
                      placeholder="What's the one thing you're doing today?"
                      className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-white/[0.14] focus:bg-[#1b1b1b]"
                    />
                    <button
                      type="submit"
                      className="rounded-2xl border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]"
                    >
                      Create & focus
                    </button>
                  </form>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {todayExecutionTasks.slice(0, 3).map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => focusTask(task.id)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        Focus {task.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {focusedTask ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleTaskCompletion(focusedTask.id)}
                      className="rounded-full border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(focusedTask.id)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => rescheduleTask(focusedTask.id, 1)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/64 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => rescheduleTask(focusedTask.id, 7)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/64 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      Next week
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {executionMode ? (
          <SectionCard compact className="space-y-3 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">Execution queue</p>
                <p className="mt-1 text-sm text-white/56">Only the next few moves stay in view.</p>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/62">
                {executionModeTasks.length} visible
              </span>
            </div>
            <div className="space-y-2.5">
              {executionModeTasks.length > 0 ? executionModeTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lifeGoals={safeLifeGoals}
                  lifeGoalCategories={lifeGoalCategories}
                  allTasks={safeTasks}
                  selected={selectedTaskId === task.id}
                  rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                  onOpen={() => setSelectedTaskId(task.id)}
                  onToggleComplete={() => toggleTaskCompletion(task.id)}
                  onFocus={() => focusTask(task.id)}
                  onRescheduleTomorrow={() => rescheduleTask(task.id, 1)}
                  onRescheduleNextWeek={() => rescheduleTask(task.id, 7)}
                />
              )) : (
                <p className="text-sm text-white/48">No active tasks in the queue.</p>
              )}
            </div>
          </SectionCard>
        ) : (
          <section className="grid gap-3.5 xl:grid-cols-3">
            <SectionCard compact className="flex h-[560px] min-h-0 flex-col p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">General Tasks</p>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/52">
                    {scopedGeneralTasks.length}
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {scope === 'today' && scopedActiveTasks.length > 5 ? (
                  <div className="rounded-[16px] border border-[rgb(var(--theme-warning-rgb)/0.18)] bg-[rgb(var(--theme-warning-rgb)/0.08)] px-3 py-2 text-sm text-[rgb(var(--theme-warning-rgb)/0.88)]">
                    You&apos;ve got too much on today — trim this down
                  </div>
                ) : null}
                {scopedGeneralTasks.length > 0 ? scopedGeneralTasks.map((task) => (
                  <CompactTaskRow
                    key={task.id}
                    task={task}
                    lifeGoals={safeLifeGoals}
                    lifeGoalCategories={lifeGoalCategories}
                    allTasks={safeTasks}
                    selected={selectedTaskId === task.id}
                    rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                    onOpen={() => setSelectedTaskId(task.id)}
                    onToggleComplete={() => toggleTaskCompletion(task.id)}
                    onFocus={() => focusTask(task.id)}
                  />
                )) : <p className="text-sm text-white/46">No general tasks in this scope.</p>}

                {scopedSomedayTasks.length > 0 ? (
                  <div className="pt-3">
                    <div className="mb-2 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-white/32">Someday</p>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/48">
                        {scopedSomedayTasks.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {scopedSomedayTasks.map((task) => (
                        <CompactTaskRow
                          key={task.id}
                          task={task}
                          lifeGoals={safeLifeGoals}
                          lifeGoalCategories={lifeGoalCategories}
                          allTasks={safeTasks}
                          selected={selectedTaskId === task.id}
                          rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                          onOpen={() => setSelectedTaskId(task.id)}
                          onToggleComplete={() => toggleTaskCompletion(task.id)}
                          onFocus={() => focusTask(task.id)}
                          subdued
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard compact className="flex h-[560px] min-h-0 flex-col border-[rgb(var(--theme-accent-rgb)/0.08)] bg-[linear-gradient(180deg,rgba(var(--theme-accent-rgb),0.03),rgba(255,255,255,0.01))] p-3.5 sm:p-4">
              <div className="relative mb-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Outcome Goals</p>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/52">
                      {scopedGoalGroups.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoalsPanelOpen((current) => !current)}
                    className={`rounded-full border p-2 transition ${
                      goalsPanelOpen
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/62 hover:bg-white/[0.05] hover:text-white'
                    }`}
                    aria-label={goalsPanelOpen ? 'Close goals controls' : 'Open goals controls'}
                  >
                    <GoalsControlIcon />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] text-white/46">
                  <p className="min-w-0 truncate">{goalsColumnSummary || 'Execution-focused goal lens'}</p>
                </div>

                <AnimatePresence>
                  {goalsPanelOpen ? (
                    <motion.aside
                      className={`absolute right-0 top-[calc(100%+10px)] z-[40] w-[344px] max-w-[calc(100vw-48px)] ${TASK_GOALS_PANEL_SHELL_CLASSNAME}`}
                      initial={{ opacity: 0, x: 12, y: -6 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      exit={{ opacity: 0, x: 12, y: -6 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                    >
                      <div className="grid gap-3">
                        <GoalsPanelSection title="Filters">
                          <div className="grid gap-4">
                            <label className="flex items-center justify-between gap-5">
                              <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Goal</span>
                              <select
                                value={goalsColumnGoalFilter}
                                onChange={(event) => {
                                  setGoalsColumnGoalFilter(event.target.value)
                                  setGoalsColumnMode(event.target.value === 'all' ? 'next-task' : 'all-tasks')
                                }}
                                className={`${TASK_GOALS_PANEL_SELECT_CLASSNAME} w-[min(308px,58%)] shrink-0`}
                              >
                                <option value="all">All goals</option>
                                {orderedOutcomeGoals.map((goal) => (
                                  <option key={goal.id} value={goal.id}>
                                    {goal.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center justify-between gap-5">
                              <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Priority</span>
                              <select
                                value={goalsColumnPriorityFilter}
                                onChange={(event) => setGoalsColumnPriorityFilter(event.target.value as LifeGoalTaskPriority | 'all')}
                                className={`${TASK_GOALS_PANEL_SELECT_CLASSNAME} w-[min(308px,58%)] shrink-0`}
                              >
                                <option value="all">All priorities</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="none">Low / None</option>
                              </select>
                            </label>
                            <div className="flex items-center justify-between gap-5">
                              <span className="text-[12px] text-[rgba(255,255,255,0.78)]">Mode</span>
                              <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
                                <button
                                  type="button"
                                  onClick={() => setGoalsColumnMode('next-task')}
                                  className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                                    goalsColumnMode === 'next-task' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                                  }`}
                                >
                                  Next task
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setGoalsColumnMode('all-tasks')}
                                  className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                                    goalsColumnMode === 'all-tasks' ? 'bg-white/[0.08] text-white' : 'text-white/54 hover:text-white/74'
                                  }`}
                                >
                                  All tasks
                                </button>
                              </div>
                            </div>
                          </div>
                        </GoalsPanelSection>
                      </div>
                    </motion.aside>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {scopedGoalGroups.length > 0 ? scopedGoalGroups.map((group) => {
                  const isExpanded = expandedOutcomeGoalId === group.id
                  const visibleTasks = goalsColumnMode === 'next-task' ? group.tasks.slice(0, 1) : group.tasks
                  const groupAccentStyle = getGoalScannerRowStyle(group.goal, lifeGoalCategories)

                  return (
                    <div
                      key={group.id}
                      className="space-y-1.5 pl-2.5"
                      style={isExpanded ? groupAccentStyle : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedOutcomeGoalId((current) => (current === group.id ? null : group.id))}
                        className={`w-full border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition hover:bg-white/[0.04] ${
                          isExpanded ? 'rounded-[18px]' : 'rounded-[18px]'
                        }`}
                        style={!isExpanded ? groupAccentStyle : undefined}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-medium text-white">{group.label}</p>
                            {!isExpanded ? (
                              <p className="mt-1 truncate text-[13px] text-white/56">
                                {group.nextTask ? `→ ${group.nextTask.text}` : 'No open tasks'}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/52">
                              {group.tasks.length}
                            </span>
                            <span className={`text-white/28 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                          </div>
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="pl-3 pr-1">
                          {visibleTasks.length > 0 ? (
                            <div className="divide-y divide-white/[0.05]">
                              {visibleTasks.map((task) => (
                                <CompactTaskRow
                                  key={task.id}
                                  task={task}
                                  lifeGoals={safeLifeGoals}
                                  lifeGoalCategories={lifeGoalCategories}
                                  allTasks={safeTasks}
                                  selected={selectedTaskId === task.id}
                                  rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                                  onOpen={() => setSelectedTaskId(task.id)}
                                  onToggleComplete={() => toggleTaskCompletion(task.id)}
                                  onFocus={() => focusTask(task.id)}
                                  prominent={task.id === group.tasks[0]?.id}
                                  flat
                                  hideFocusAction
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="px-2 py-1 text-sm text-white/46">No active tasks for this goal.</p>
                          )}

                          {group.completedTasks.length > 0 ? (
                            <div className="pt-1.5">
                              <button
                                type="button"
                                onClick={() => setGoalsColumnCompletedOpen((current) => !current)}
                                className="flex w-full items-center justify-between py-1 text-left"
                              >
                                <span className="text-[11px] uppercase tracking-[0.22em] text-white/34">Completed</span>
                                <span className="text-[11px] text-white/46">{goalsColumnCompletedOpen ? 'Hide' : group.completedTasks.length}</span>
                              </button>
                              {goalsColumnCompletedOpen ? (
                                <div className="mt-1 divide-y divide-white/[0.05]">
                                  {group.completedTasks.map((task) => (
                                    <CompactTaskRow
                                      key={task.id}
                                      task={task}
                                      lifeGoals={safeLifeGoals}
                                      lifeGoalCategories={lifeGoalCategories}
                                      allTasks={safeTasks}
                                      selected={selectedTaskId === task.id}
                                      rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                                      onOpen={() => setSelectedTaskId(task.id)}
                                      onToggleComplete={() => toggleTaskCompletion(task.id)}
                                      onFocus={() => focusTask(task.id)}
                                      completed
                                      subdued
                                      flat
                                      hideFocusAction
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                }) : <p className="text-sm text-white/46">No goal-linked tasks in this scope.</p>}
              </div>
            </SectionCard>

            <SectionCard compact className="flex h-[560px] min-h-0 flex-col p-3.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Directional Goals</p>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/52">
                    {scopedDirectionGroups.length}
                  </span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {scopedDirectionGroups.length > 0 ? scopedDirectionGroups.map((group) => (
                  <div key={group.goal.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-[15px] font-medium"
                        style={{ color: getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories) }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: getLifeGoalCategoryColor(group.goal.category, lifeGoalCategories) }}
                        />
                        {group.goal.title}
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/52">
                        {group.tasks.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {group.preview.map((task) => (
                        <CompactTaskRow
                          key={task.id}
                          task={task}
                          lifeGoals={safeLifeGoals}
                          lifeGoalCategories={lifeGoalCategories}
                          allTasks={safeTasks}
                          selected={selectedTaskId === task.id}
                          rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                          onOpen={() => setSelectedTaskId(task.id)}
                          onToggleComplete={() => toggleTaskCompletion(task.id)}
                          onFocus={() => focusTask(task.id)}
                          subdued
                        />
                      ))}
                    </div>
                  </div>
                )) : <p className="text-sm text-white/46">No directional tasks in this scope.</p>}
              </div>
            </SectionCard>
          </section>
        )}

        <SectionCard compact className="space-y-3 p-3.5 sm:p-4">
          <button
            type="button"
            onClick={() => setCompletedTodayOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-left transition hover:bg-white/[0.05]"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Completed today</p>
              <p className="mt-1 text-sm text-white/56">{completedTodayTasks.length} completed</p>
            </div>
            <span className="text-white/46">{completedTodayOpen ? '−' : '+'}</span>
          </button>
          {completedTodayOpen ? (
            <div className="space-y-2.5">
              {completedTodayTasks.length > 0 ? completedTodayTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lifeGoals={safeLifeGoals}
                  lifeGoalCategories={lifeGoalCategories}
                  allTasks={safeTasks}
                  selected={selectedTaskId === task.id}
                  rowRef={selectedTaskId === task.id ? selectedTaskRowRef : undefined}
                  onOpen={() => setSelectedTaskId(task.id)}
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
      </div>

      {selectedTask ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setSelectedTaskId(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col border-l border-white/[0.08] bg-[#101010] shadow-[-24px_0_64px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Task Peek</p>
                <p className="mt-1 text-sm text-white/58">Edit the task without leaving the execution surface.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/68 transition hover:bg-white/[0.05] hover:text-white"
              >
                Close
              </button>
            </div>
            <TaskSidePanel
              task={selectedTask}
              lifeGoals={safeLifeGoals}
              lifeGoalCategories={lifeGoalCategories}
              allTasks={safeTasks}
              preferredLinkMode={preferredPanelLinkMode}
              onConsumedPreferredLinkMode={() => setPreferredPanelLinkMode(null)}
              taskTagOptions={taskTagOptions}
              onUpdateTask={updateTask}
              onToggleComplete={() => toggleTaskCompletion(selectedTask.id)}
              onDeleteTask={() => deleteTask(selectedTask.id)}
              onFocusTask={() => focusTask(selectedTask.id)}
              onRestoreTask={() => restoreTask(selectedTask.id)}
              onRescheduleTomorrow={() => rescheduleTask(selectedTask.id, 1)}
              onRescheduleNextWeek={() => rescheduleTask(selectedTask.id, 7)}
            />
          </aside>
        </>
      ) : null}
    </PageContainer>
  )
}

function TaskSidePanel({
  task,
  lifeGoals,
  lifeGoalCategories,
  allTasks,
  preferredLinkMode,
  onConsumedPreferredLinkMode,
  taskTagOptions,
  onUpdateTask,
  onToggleComplete,
  onDeleteTask,
  onFocusTask,
  onRestoreTask,
  onRescheduleTomorrow,
  onRescheduleNextWeek,
}: {
  task: Task
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  allTasks: Task[]
  preferredLinkMode: TaskLinkMode | null
  onConsumedPreferredLinkMode: () => void
  taskTagOptions: string[]
  onUpdateTask: (taskId: string, updater: (task: Task) => Task) => void
  onToggleComplete: () => void
  onDeleteTask: () => void
  onFocusTask: () => void
  onRestoreTask: () => void
  onRescheduleTomorrow: () => void
  onRescheduleNextWeek: () => void
}) {
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [linkMode, setLinkMode] = useState<TaskLinkMode>(
    task.linkedDirectionId ? 'direction' : task.linkedGoalId ? 'goal' : 'none',
  )
  const linkDescriptor = useMemo(
    () => getTaskLinkDescriptor(task, new Map(lifeGoals.map((goal) => [goal.id, goal])), lifeGoalCategories, allTasks),
    [allTasks, lifeGoalCategories, lifeGoals, task],
  )

  useEffect(() => {
    setLinkMode(task.linkedDirectionId ? 'direction' : task.linkedGoalId ? 'goal' : 'none')
  }, [task.id, task.linkedDirectionId, task.linkedGoalId])

  useEffect(() => {
    if (!preferredLinkMode) return
    setLinkMode(preferredLinkMode)
    onConsumedPreferredLinkMode()
  }, [onConsumedPreferredLinkMode, preferredLinkMode])

  const candidateGoals = useMemo(
    () =>
      lifeGoals.filter((goal) =>
        (goal.goalType ?? 'outcome') === (linkMode === 'direction' ? 'directional' : 'outcome'),
      ),
    [lifeGoals, linkMode],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Title</label>
            <input
              value={task.text}
              onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, text: event.target.value }))}
              className={panelInputClassName}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InlineField label="Due date">
              <input
                type="date"
                value={task.dueDate ?? ''}
                onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, dueDate: event.target.value || null }))}
                className={panelInputClassName}
              />
            </InlineField>
            <InlineField label="Due time">
              <input
                type="time"
                value={task.dueTime ?? ''}
                onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, dueTime: normalizeDueTime(event.target.value) }))}
                className={panelInputClassName}
              />
            </InlineField>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Priority</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => onUpdateTask(task.id, (current) => ({ ...current, priority, important: priority === 'high' }))}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    task.priority === priority
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/64 hover:text-white'
                  }`}
                >
                  {toLabel(priority)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Link</label>
            <div className="flex flex-wrap items-center gap-2">
              {(['none', 'goal', 'direction'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setLinkMode(mode)
                    if (mode === 'none') {
                      onUpdateTask(task.id, (current) => ({
                        ...current,
                        linkedGoalId: null,
                        linkedDirectionId: null,
                      }))
                    }
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    linkMode === mode
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/64 hover:text-white'
                  }`}
                >
                  {toLabel(mode)}
                </button>
              ))}
            </div>
            {linkMode !== 'none' ? (
              <select
                value={linkMode === 'goal' ? task.linkedGoalId ?? '' : task.linkedDirectionId ?? ''}
                onChange={(event) =>
                  onUpdateTask(task.id, (current) => ({
                    ...current,
                    linkedGoalId: linkMode === 'goal' ? event.target.value || null : null,
                    linkedDirectionId: linkMode === 'direction' ? event.target.value || null : null,
                  }))
                }
                className={panelInputClassName}
              >
                <option value="">None</option>
                {candidateGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            ) : null}
            {linkDescriptor.label ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                style={{ ...linkDescriptor.chipStyle, ...linkDescriptor.chipTextStyle }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={linkDescriptor.dotStyle} />
                {linkDescriptor.label}
              </span>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Tag</label>
            <input
              list="task-side-panel-tags"
              value={task.taskTag ?? ''}
              onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, taskTag: normalizeTaskTag(event.target.value) }))}
              className={panelInputClassName}
              placeholder="buy / call / reminder / someday"
            />
            <datalist id="task-side-panel-tags">
              {taskTagOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={onRescheduleTomorrow}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
            >
              Move to tomorrow
            </button>
            <button
              type="button"
              onClick={onRescheduleNextWeek}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
            >
              Move to next week
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Description</label>
            <textarea
              value={task.description}
              onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, description: event.target.value }))}
              className={`${panelInputClassName} min-h-[92px] resize-none`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Notes</label>
            <textarea
              value={task.notes}
              onChange={(event) => onUpdateTask(task.id, (current) => ({ ...current, notes: event.target.value }))}
              className={`${panelInputClassName} min-h-[120px] resize-none`}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[11px] uppercase tracking-[0.22em] text-white/38">Subtasks</label>
              <span className="text-xs text-white/46">
                {task.subtasks.filter((subtask) => subtask.completed).length}/{task.subtasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTask(task.id, (current) => ({
                        ...current,
                        subtasks: current.subtasks.map((item) =>
                          item.id === subtask.id ? { ...item, completed: !item.completed } : item,
                        ),
                      }))
                    }
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${subtask.completed ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white' : 'border-white/[0.16] text-white/44'}`}
                  >
                    {subtask.completed ? '✓' : ''}
                  </button>
                  <input
                    value={subtask.text}
                    onChange={(event) =>
                      onUpdateTask(task.id, (current) => ({
                        ...current,
                        subtasks: current.subtasks.map((item) =>
                          item.id === subtask.id ? { ...item, text: event.target.value } : item,
                        ),
                      }))
                    }
                    className="min-w-0 flex-1 bg-transparent text-sm text-white/82 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateTask(task.id, (current) => ({
                        ...current,
                        subtasks: current.subtasks.filter((item) => item.id !== subtask.id),
                      }))
                    }
                    className="text-sm text-white/42 transition hover:text-white/78"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={subtaskDraft}
                onChange={(event) => setSubtaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  const text = subtaskDraft.trim()
                  if (!text) return
                  onUpdateTask(task.id, (current) => ({
                    ...current,
                    subtasks: [...current.subtasks, { id: createSubtaskId(task.id), text, completed: false }],
                  }))
                  setSubtaskDraft('')
                }}
                placeholder="Add subtask"
                className={`${panelInputClassName} flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  const text = subtaskDraft.trim()
                  if (!text) return
                  onUpdateTask(task.id, (current) => ({
                    ...current,
                    subtasks: [...current.subtasks, { id: createSubtaskId(task.id), text, completed: false }],
                  }))
                  setSubtaskDraft('')
                }}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {task.completed ? (
            <button
              type="button"
              onClick={onRestoreTask}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleComplete}
              className="rounded-full border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-3.5 py-2 text-sm text-white transition hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]"
            >
              Complete
            </button>
          )}
          <button
            type="button"
            onClick={onFocusTask}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
          >
            Focus this task
          </button>
          <button
            type="button"
            onClick={onDeleteTask}
            className="rounded-full border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.08)] px-3.5 py-2 text-sm text-[rgb(var(--theme-negative-rgb)/0.92)] transition hover:bg-[rgb(var(--theme-negative-rgb)/0.14)]"
          >
            Delete
          </button>
        </div>
      </div>
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
          {task.completed ? '✓' : ''}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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
  hideFocusAction = false,
  rowRef,
  onOpen,
  onToggleComplete,
  onFocus,
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
  hideFocusAction?: boolean
  rowRef?: RefObject<HTMLDivElement | null>
  onOpen: () => void
  onToggleComplete: () => void
  onFocus: () => void
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
          : `rounded-[16px] border px-3 py-2.5 ${
              selected
                ? 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.08)]'
                : prominent
                  ? 'border-white/[0.08] bg-white/[0.04]'
                  : subdued
                    ? 'border-white/[0.05] bg-white/[0.015]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]'
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
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border text-[11px] ${
            'h-5 w-5'
          } ${
            task.completed ? 'border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white' : 'border-white/[0.14] text-white/38'
          }`}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed ? '✓' : ''}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`truncate text-[15px] ${completed ? 'text-white/46 line-through' : 'text-white/86'}`}>
                {task.text}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/46">
                {task.dueDate ? <span>{formatDateContextual(task.dueDate)}</span> : null}
                {task.taskTag ? <MetaChip label={task.taskTag} /> : null}
                {!flat && linkDescriptor.label ? <span className="truncate text-white/42">{linkDescriptor.label}</span> : null}
              </div>
            </div>
            {hideFocusAction ? null : (
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
          {completed && task.completedAt ? <p className="mt-1 text-[11px] text-white/36">Completed {formatTaskCompletedDate(task.completedAt)}</p> : null}
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

function InlineField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</span>
      {children}
    </label>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2">
      <span className="text-xs text-white/44">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm text-white/72 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/58">
      {label}
    </span>
  )
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
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${toneClassName}`}>
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

function createSubtaskId(taskId: string) {
  return `${taskId}-subtask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
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
  return normalizeTaskTag(task.taskTag) === 'someday'
}

function getNextTaskOrder(tasks: Task[]) {
  return tasks.reduce((max, task) => Math.max(max, Number.isFinite(task.order) ? task.order : 0), -1) + 1
}

function withTaskTimestamp(task: Task): Task {
  return {
    ...task,
    dueTime: normalizeDueTime(task.dueTime),
    taskTag: normalizeTaskTag(task.taskTag),
    updatedAt: new Date().toISOString(),
  }
}

function matchesTimeFilter(task: Task, timeFilter: TaskTimeFilter, todayIso: string) {
  if (timeFilter === 'all') return true
  if (timeFilter === 'today') return task.dueDate === todayIso
  if (timeFilter === 'overdue') return Boolean(task.dueDate && task.dueDate < todayIso)
  if (timeFilter === 'no-date') return !task.dueDate
  return Boolean(task.dueDate)
}

function matchesScope(task: Task, scope: TaskSuperScope, todayIso: string, selectedUpcomingDate: string | null) {
  if (scope === 'today') {
    return task.starred || task.dueDate === todayIso
  }

  if (scope === 'upcoming') {
    if (selectedUpcomingDate) return task.dueDate === selectedUpcomingDate
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

function matchesGoalsColumnPriorityFilter(
  task: Task,
  goalsColumnPriorityFilter: LifeGoalTaskPriority | 'all',
) {
  if (goalsColumnPriorityFilter === 'all') return true
  if (goalsColumnPriorityFilter === 'none') {
    return task.priority === 'none' || task.priority === 'low'
  }
  return task.priority === goalsColumnPriorityFilter
}

function compareUnassignedTasks(left: Task, right: Task) {
  if (left.updatedAt !== right.updatedAt) return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
  return right.order - left.order
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

function formatDueTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date.toLocaleTimeString('en-IE', { hour: 'numeric', minute: '2-digit' })
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
const panelInputClassName =
  'w-full rounded-2xl border border-white/[0.08] bg-[#161616] px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] placeholder:text-white/24 focus:border-white/[0.14] focus:bg-[#1b1b1b]'
