import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
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
  Task,
  LIFE_GOAL_CATEGORY_COLOR_OPTIONS,
} from '../../types'
import {
  LIFE_GOAL_PHASE_OPTIONS,
  getDaysFromToday,
  getLifeGoalTaskPriorityMeta,
  getPriorityAwareNextTask,
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
import { LifeGoalRoadmapPanel } from './components/LifeGoalRoadmapPanel'
import { LifeGoalTaskPeek } from './components/LifeGoalTaskPeek'

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
type LifeGoalOverviewDensity = 'compact' | 'expanded'
type LifeGoalOverviewSort = 'due' | 'recent' | 'name' | 'status'
type LifeGoalCreateStep = 'define' | 'path'
type LifeGoalRoadmapOrganization = 'default' | 'tag'
type LifeGoalTaskListSort = 'default' | 'due' | 'priority'

const LIFE_GOAL_TYPE_OPTIONS: Array<{
  value: LifeGoalType
  label: string
  description: string
}> = [
  { value: 'outcome', label: 'Outcome', description: 'A destination with a clear finish' },
  { value: 'system', label: 'System', description: 'A broader engine that supports an outcome' },
  { value: 'directional', label: 'Directional', description: 'Long-term direction' },
]

function canGoalTypeLinkToGoalType(sourceType: LifeGoalType, targetType: LifeGoalType) {
  if (sourceType === 'directional') {
    return targetType === 'outcome' || targetType === 'system'
  }
  if (sourceType === 'system') {
    return targetType === 'outcome'
  }
  return false
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
  category: string
  goalType: LifeGoalType
  relatedGoalIds: string[]
  milestonesEnabled: boolean
  whyItMatters: string
  minimumVersion: string
  startDate: string
  targetDate: string
  ifThenPlan: string
  status: LifeGoalStatus
  isPrimary: boolean
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

function createEmptyLifeGoalDraft(): LifeGoalDraft {
  return {
    title: '',
    category: '',
    goalType: 'outcome',
    relatedGoalIds: [],
    milestonesEnabled: false,
    whyItMatters: '',
    minimumVersion: '',
    startDate: getTodayIsoDate(),
    targetDate: '',
    ifThenPlan: '',
    status: 'not-started',
    isPrimary: false,
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
  const nextTask = getPriorityAwareNextTask(goal.tasks)
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
    category: goal.category,
    goalType: goal.goalType,
    relatedGoalIds: goal.relatedGoalIds ?? [],
    milestonesEnabled: goal.goalType === 'outcome' ? (goal.milestonesEnabled ?? (goal.milestones?.length ?? 0) > 0) : false,
    whyItMatters: goal.whyItMatters,
    minimumVersion: goal.minimumVersion,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    ifThenPlan: goal.ifThenPlan,
    status: goal.status,
    isPrimary: goal.isPrimary,
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
    category: draft.category.trim(),
    goalType: draft.goalType,
    relatedGoalIds: Array.from(new Set(draft.relatedGoalIds.filter(Boolean))),
    milestonesEnabled: draft.goalType === 'outcome' ? draft.milestonesEnabled : false,
    whyItMatters: draft.whyItMatters.trim(),
    visionStatement: '',
    visionImages: [],
    minimumVersion: draft.minimumVersion.trim(),
    ifThenPlan: draft.ifThenPlan.trim(),
    startDate: draft.startDate,
    targetDate: draft.targetDate,
    status: draft.status,
    isPrimary: draft.isPrimary,
    order: 0,
    milestones: draft.goalType === 'outcome' ? normalizeLifeGoalDraftMilestones(draft.milestones) : [],
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
    linkedGoalIds: [],
    linkedDirectionIds: [],
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
  const content = (
    <>
      <div className="flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-[inherit] bg-white/[0.03]">
        <motion.img
          src={image}
          alt=""
          className={`w-full transition duration-300 group-hover:scale-[1.02] ${
            fitMode === 'contain' ? 'h-full max-h-full object-contain' : 'h-full object-cover'
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
        className={`group relative overflow-hidden rounded-[18px] border border-white/[0.05] bg-white/[0.02] transition duration-300 hover:border-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] ${className}`}
      >
        {content}
      </motion.div>
    )
  }

  return (
    <div
      key={`vision-image-${index}`}
      className={`group relative overflow-hidden rounded-[18px] border border-white/[0.05] bg-white/[0.02] transition duration-300 hover:border-white/[0.08] hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] ${className}`}
    >
      {content}
    </div>
  )
}

function renderVisionImageLayout(
  images: string[],
  options?: {
    fitMode?: 'cover' | 'contain'
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
  const visibleImages = images.slice(0, LIFE_GOAL_VISION_IMAGE_LIMIT)
  if (visibleImages.length === 0) return null

  if (visibleImages.length === 1) {
    return (
      <div className="w-full">
        {renderVisionImageTile(visibleImages[0], 0, 'aspect-[16/9] w-full', options)}
      </div>
    )
  }

  if (visibleImages.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {visibleImages.map((image, index) => renderVisionImageTile(image, index, 'aspect-[1.08/1]', options))}
      </div>
    )
  }

  if (visibleImages.length === 3) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {visibleImages.slice(0, 2).map((image, index) => renderVisionImageTile(image, index, 'aspect-[1.08/1]', options))}
        </div>
        {renderVisionImageTile(visibleImages[2], 2, 'aspect-[2.1/1] w-full', options)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {visibleImages.map((image, index) => renderVisionImageTile(image, index, 'aspect-[1.08/1]', options))}
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
  onSetPrimaryLifeGoal,
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
  onSetPrimaryLifeGoal: (goalId: string | null) => void
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
  const [lifeGoalComposerOpen, setLifeGoalComposerOpen] = useState(lifeGoals.length === 0)
  const [creatingTaskPeekId, setCreatingTaskPeekId] = useState<string | null>(null)
  const [lifeGoalActionFeedback, setLifeGoalActionFeedback] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const [canUseVisionTilt, setCanUseVisionTilt] = useState(false)
  const [visionCollapsedByGoal, setVisionCollapsedByGoal] = useState<Record<string, boolean>>({})
  const [visionEditorOpenByGoal, setVisionEditorOpenByGoal] = useState<Record<string, boolean>>({})
  const [visionDropActive, setVisionDropActive] = useState(false)
  const [outcomeMilestoneViewByGoal, setOutcomeMilestoneViewByGoal] = useState<Record<string, 'tasks' | 'milestones'>>({})
  const [selectedMilestoneIdByGoal, setSelectedMilestoneIdByGoal] = useState<Record<string, string | null>>({})
  const [goalTypeChangeConfirmationOpen, setGoalTypeChangeConfirmationOpen] = useState(false)
  const [goalTypeChangePickerOpen, setGoalTypeChangePickerOpen] = useState(false)
  const [linkHabitPickerOpen, setLinkHabitPickerOpen] = useState(false)
  const [habitDraftByTaskId, setHabitDraftByTaskId] = useState<Record<string, string>>({})
  const [lifeGoalDetailTab, setLifeGoalDetailTab] = useState<LifeGoalDetailTab>('focus')
  const [roadmapHighPriorityFocus, setRoadmapHighPriorityFocus] = useState(false)
  const [roadmapOrganizationMode, setRoadmapOrganizationMode] = useState<LifeGoalRoadmapOrganization>('default')
  const [taskListSortMode, setTaskListSortMode] = useState<LifeGoalTaskListSort>('default')
  const [roadmapCompletedOpen, setRoadmapCompletedOpen] = useState(false)
  const [selectedRoadmapTaskId, setSelectedRoadmapTaskId] = useState<string | null>(null)
  const [selectedTaskPeekId, setSelectedTaskPeekId] = useState<string | null>(null)
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
  const [lifeGoalRelationIntent, setLifeGoalRelationIntent] = useState('')
  const [lifeGoalDatePickerOpen, setLifeGoalDatePickerOpen] = useState(false)
  const [lifeGoalActiveDateField, setLifeGoalActiveDateField] = useState<'startDate' | 'targetDate' | null>(null)
  const [lifeGoalStatusMenuOpen, setLifeGoalStatusMenuOpen] = useState(false)
  const [lifeGoalOverviewMode, setLifeGoalOverviewMode] = useState<LifeGoalOverviewMode>('manual')
  const [lifeGoalOverviewDensity, setLifeGoalOverviewDensity] = useState<LifeGoalOverviewDensity>('compact')
  const [lifeGoalOverviewSort, setLifeGoalOverviewSort] = useState<LifeGoalOverviewSort>('due')
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
  const lifeGoalCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStartDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDateFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewSortFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalCategoryPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewCategoryFieldRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewCategoryPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalDatePanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalStatusPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalOverviewSortPanelRef = useRef<HTMLDivElement | null>(null)
  const lifeGoalTitleInputRef = useRef<HTMLInputElement | null>(null)
  const lifeGoalComposerTriggerRef = useRef<HTMLElement | null>(null)
  const lifeGoalComposerBodyRef = useRef<HTMLDivElement | null>(null)
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
  const nextTaskVisualState =
    taskMomentumTransition?.nextTaskId &&
    selectedLifeGoalProgress?.nextTask &&
    taskMomentumTransition.nextTaskId === selectedLifeGoalProgress.nextTask.id
      ? 'active'
      : 'idle'
  const selectedLifeGoalHasVision = Boolean(
    selectedLifeGoal?.visionStatement.trim() || (selectedLifeGoal?.visionImages.length ?? 0) > 0,
  )
  const selectedLifeGoalVisionCollapsed = selectedLifeGoal ? (visionCollapsedByGoal[selectedLifeGoal.id] ?? false) : false
  const selectedLifeGoalVisionEditorOpen = selectedLifeGoal ? (visionEditorOpenByGoal[selectedLifeGoal.id] ?? false) : false
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
  const singleVisionInteractive = Boolean(
    canUseVisionTilt && !prefersReducedMotion && (selectedLifeGoal?.visionImages.length ?? 0) === 1,
  )

  const updateSelectedLifeGoalVisionStatement = (value: string) => {
    if (!selectedLifeGoal) return
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionStatement: value.slice(0, 120),
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
    setVisionCollapsedByGoal((current) => ({
      ...current,
      [selectedLifeGoal.id]:
        typeof value === 'function' ? value(current[selectedLifeGoal.id] ?? false) : value,
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

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImages: [...goal.visionImages, ...validImages].slice(0, LIFE_GOAL_VISION_IMAGE_LIMIT),
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
  const normalizedRelatedGoalsQuery = lifeGoalRelatedGoalsQuery.trim().toLowerCase()
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
    if (lifeGoalDraft.isPrimary) {
      onSetPrimaryLifeGoal(nextGoal.id)
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
    if (!lifeGoalDraft.title.trim() || !lifeGoalDraft.whyItMatters.trim()) {
      return
    }

    if (lifeGoalComposerMode === 'edit' && editingLifeGoalId) {
      if (!lifeGoalDraft.minimumVersion.trim() || draftTasks.length === 0) return
      onUpdateLifeGoal(editingLifeGoalId, (goal) => ({
        ...goal,
        title: lifeGoalDraft.title.trim(),
        category: lifeGoalDraft.category.trim(),
        goalType: lifeGoalDraft.goalType,
        relatedGoalIds: Array.from(new Set(allowedDraftRelatedGoalIds.filter((goalId) => goalId !== editingLifeGoalId))),
        milestonesEnabled: lifeGoalDraft.goalType === 'outcome' ? lifeGoalDraft.milestonesEnabled : false,
        whyItMatters: lifeGoalDraft.whyItMatters.trim(),
        minimumVersion: lifeGoalDraft.minimumVersion.trim(),
        ifThenPlan: lifeGoalDraft.ifThenPlan.trim(),
        startDate: lifeGoalDraft.startDate,
        targetDate: lifeGoalDraft.targetDate,
        status: lifeGoalDraft.status,
        milestones: lifeGoalDraft.goalType === 'outcome' ? normalizeLifeGoalDraftMilestones(lifeGoalDraft.milestones) : [],
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

    commitCreateLifeGoal()
  }

  const handleAdvanceCreateGoalStep = () => {
    if (!canAdvanceCreateGoal) return
    setLifeGoalCreateStep('path')
  }

  const draftGoalLinkLabel =
    (lifeGoalDraft.goalType ?? 'outcome') === 'system'
      ? 'Supported outcomes'
      : (lifeGoalDraft.goalType ?? 'outcome') === 'directional'
        ? 'Related goals'
        : null
  const draftGoalLinkDescription =
    (lifeGoalDraft.goalType ?? 'outcome') === 'system'
      ? 'Link the outcome goals this system supports.'
      : (lifeGoalDraft.goalType ?? 'outcome') === 'directional'
        ? 'Link goals that already move this direction forward.'
        : null

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
    setSelectedTaskPeekId(taskId)
    setSelectedRoadmapTaskId(taskId)
    setTaskPeekSubtaskDraft('')
  }

  const openNewTaskPeek = (trigger?: HTMLElement | null) => {
    if (!selectedLifeGoal) return
    const currentGoalMilestones = (selectedLifeGoal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
    const currentGoalMilestone =
      currentGoalMilestones.find((milestone) => !milestone.completed) ??
      (currentGoalMilestones.length > 0 ? currentGoalMilestones[currentGoalMilestones.length - 1] : null)
    const nextTask = {
      ...createEmptyLifeGoalTask(),
      milestoneId:
        selectedLifeGoal.goalType === 'outcome' && selectedLifeGoal.milestonesEnabled
          ? currentGoalMilestone?.id ?? null
          : null,
    }
    taskPeekTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      tasks: [...goal.tasks, nextTask],
      updatedAt: new Date().toISOString(),
    }))
    setCreatingTaskPeekId(nextTask.id)
    setSelectedTaskPeekId(nextTask.id)
    setSelectedRoadmapTaskId(nextTask.id)
    setTaskPeekSubtaskDraft('')
    setTaskPeekSubtaskEntryOpen(false)
    setTaskPeekCompletedSubtasksOpen(false)
    setTaskPeekNotesOpen(false)
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
    setPendingSubtaskFocusId(nextSubtaskId)
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

      const primaryGoal = filteredGoals.find((goal) => goal.isPrimary) ?? null
      const remainingGoals = primaryGoal ? filteredGoals.filter((goal) => goal.id !== primaryGoal.id) : filteredGoals
      const sortedRemainingGoals = sortLifeGoalsForOverview(remainingGoals, lifeGoalOverviewSort)

      return primaryGoal ? [primaryGoal, ...sortedRemainingGoals] : sortedRemainingGoals
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
    <div className="grid gap-2" role="radiogroup" aria-label="Goal type">
      {LIFE_GOAL_TYPE_OPTIONS.map((option) => {
        const active = selectedDraftGoalType === option.value
        const inputId = `${mode}-life-goal-type-${option.value}`
        return (
          <label
            key={`${mode}-${option.value}`}
            htmlFor={inputId}
            className={`theme-input flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
              active
                ? 'border-white/[0.18] bg-white/[0.09] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_12px_28px_rgba(0,0,0,0.14)]'
                : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.03]'
            }`}
          >
            <input
              id={inputId}
              type="radio"
              name={`${mode}-life-goal-type`}
              value={option.value}
              checked={active}
              onChange={() => applyLifeGoalType(option.value)}
              className="sr-only"
            />
            <div className="min-w-0">
              <p className={`text-sm transition ${active ? 'font-medium text-white' : 'text-white/76'}`}>{option.label}</p>
              <p className={`mt-0.5 text-[12px] transition ${active ? 'text-mist/72' : 'text-mist/56'}`}>{option.description}</p>
            </div>
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full border transition ${
                active
                  ? 'border-white/35 bg-white/90 shadow-[0_0_0_4px_rgba(255,255,255,0.06)]'
                  : 'border-white/10 bg-white/18'
              }`}
            />
          </label>
        )
      })}
    </div>
  )

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
    if (lifeGoalActionFeedbackTimeoutRef.current) {
      window.clearTimeout(lifeGoalActionFeedbackTimeoutRef.current)
      lifeGoalActionFeedbackTimeoutRef.current = null
    }
    setLifeGoalActionFeedback(null)
    setLifeGoalComposerMode('create')
    setLifeGoalCreateStep('define')
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
    setEditingLifeGoalId(goal.id)
    setLifeGoalRelatedGoalsQuery('')
    setLifeGoalRelationIntent('')
    setLifeGoalDraft(createLifeGoalDraftFromGoal(goal))
    setLifeGoalComposerOpen(true)
  }

  const closeLifeGoalComposer = () => {
    setLifeGoalComposerOpen(false)
    setLifeGoalCategoryMenuOpen(false)
    setLifeGoalCategoryQuery('')
    setLifeGoalRelatedGoalsQuery('')
    setLifeGoalRelationIntent('')
    setLifeGoalDatePickerOpen(false)
    setLifeGoalActiveDateField(null)
    setLifeGoalStatusMenuOpen(false)
    setLifeGoalCategoryPanelPosition(null)
    setLifeGoalDatePanelPosition(null)
    setLifeGoalStatusPanelPosition(null)
    setEditingLifeGoalId(null)
    setLifeGoalCreateStep('define')
    setGoalTypeChangeConfirmationOpen(false)
    setGoalTypeChangePickerOpen(false)

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

  const renderLifeGoalComposer = () => {
    const isCreateMode = lifeGoalComposerMode === 'create'
    const isCreateDefineStep = isCreateMode && lifeGoalCreateStep === 'define'
    const isCreatePathStep = isCreateMode && lifeGoalCreateStep === 'path'
    const isDirectionalDraftGoal = selectedDraftGoalType === 'directional'
    const isSystemDraftGoal = selectedDraftGoalType === 'system'
    const normalizedCreateTasks = draftTasks
    const canCompleteEditedGoal =
      lifeGoalComposerMode === 'edit' &&
      draftTasks.length > 0 &&
      draftTasks.every((task) => task.completed) &&
      lifeGoalDraft.status !== 'complete'

    return (
      <div className="space-y-5">
        {isCreateMode && isCreateDefineStep ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="theme-label">Goal creation</p>
              <p className="mt-1 text-[13px] text-mist/62">Step 1 of 2 · Define the goal</p>
            </div>
            <div className="theme-surface-soft inline-flex rounded-full border p-1">
              {([
                ['define', 'Define Goal'],
                ['path', isDirectionalDraftGoal ? 'Active Paths' : 'Define Path'],
              ] as Array<[LifeGoalCreateStep, string]>).map(([stepId, label]) => {
                const active = lifeGoalCreateStep === stepId
                const enabled = stepId === 'define' || canAdvanceCreateGoal
                return (
                  <button
                    key={stepId}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return
                      setLifeGoalCreateStep(stepId)
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'theme-button-secondary theme-text-primary'
                        : 'theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))] disabled:cursor-not-allowed disabled:opacity-40'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {(isCreateDefineStep || !isCreateMode) ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[15px] font-medium text-white/88">
                {isCreateMode
                  ? isDirectionalDraftGoal
                    ? 'Define your direction'
                    : isSystemDraftGoal
                      ? 'Define a supporting system'
                      : 'Define a goal worth pursuing'
                  : 'Edit goal details'}
              </p>
              <p className="text-[13px] text-mist/58">
                {isCreateMode
                  ? isDirectionalDraftGoal
                    ? 'Set the direction first. You can link the goals that move it forward in the next step.'
                    : isSystemDraftGoal
                      ? 'Use this for a broader engine that supports an outcome. Keep simple repeatable behaviors in Habits.'
                      : 'Use this for a destination with a clear finish. Save simple checkpoints for tasks or future milestones.'
                  : 'Update the core details that define this goal.'}
              </p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="theme-label">Title</span>
                  <button
                    type="button"
                    onClick={() => setLifeGoalDraft((current) => ({ ...current, isPrimary: !current.isPrimary }))}
                    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${
                      lifeGoalDraft.isPrimary
                        ? 'border-[rgb(var(--theme-border-strong-rgb)/0.78)] bg-white/[0.05] text-white/76'
                        : 'border-white/[0.08] bg-white/[0.02] text-mist/58 hover:text-white/74'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${lifeGoalDraft.isPrimary ? 'bg-white/80' : 'bg-white/28'}`} />
                    Primary
                  </button>
                </div>
                <input
                  ref={lifeGoalTitleInputRef}
                  value={lifeGoalDraft.title}
                  onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Build Life OS v1"
                  spellCheck={true}
                  className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                />
              </div>

              <label className="space-y-2">
                <span className="theme-label">Why it matters</span>
                <textarea
                  value={lifeGoalDraft.whyItMatters}
                  onChange={(event) => setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))}
                  placeholder="This matters because..."
                  spellCheck={true}
                  className="theme-input min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm leading-6 outline-none"
                />
              </label>
            </div>
          </div>
        ) : null}

        {(isCreateDefineStep || !isCreateMode) ? (
          <div className={`grid gap-4 ${isCreateMode ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
          {isCreateMode ? (
            <div className="space-y-2">
              <span className="theme-label">Goal type</span>
              {renderLifeGoalTypeSelector('create')}
            </div>
          ) : null}
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
                  {lifeGoalDraft.targetDate
                    ? formatDate(lifeGoalDraft.targetDate)
                    : isCreateMode && isDirectionalDraftGoal
                      ? 'Optional horizon'
                      : 'Optional deadline'}
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
          {!isCreateMode ? (
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
          ) : null}
          </div>
        ) : null}

        {!isCreateMode && draftGoalLinkLabel ? (
          <div className="space-y-3">
            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setEditRelatedGoalsCollapsed((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="theme-label">{draftGoalLinkLabel}</span>
                  {selectedRelatedGoals.length > 0 ? (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/52">
                      {selectedRelatedGoals.length} linked
                    </span>
                  ) : null}
                </div>
                <span className={`text-xs text-white/40 transition-transform duration-200 ${editRelatedGoalsCollapsed ? '' : 'rotate-180'}`}>
                  ▾
                </span>
              </button>

              {!editRelatedGoalsCollapsed ? (
                <div className="border-t border-white/[0.05] px-4 py-3">
                  {draftGoalLinkDescription ? <p className="mb-3 text-sm text-mist">{draftGoalLinkDescription}</p> : null}
                  <input
                    value={lifeGoalRelatedGoalsQuery}
                    onChange={(event) => setLifeGoalRelatedGoalsQuery(event.target.value)}
                    placeholder="Search goals to link..."
                    spellCheck={true}
                    className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  />

                  {selectedRelatedGoals.length > 0 ? (
                    <input
                      value={lifeGoalRelationIntent}
                      onChange={(event) => setLifeGoalRelationIntent(event.target.value)}
                      placeholder="Why does this relate?"
                      spellCheck={true}
                      className="theme-input mt-3 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    />
                  ) : null}

                  {selectedRelatedGoals.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRelatedGoals.map((goal) => (
                        <button
                          key={`selected-related-goal-${goal.id}`}
                          type="button"
                          onClick={() =>
                            setLifeGoalDraft((current) => ({
                              ...current,
                              relatedGoalIds: current.relatedGoalIds.filter((relatedGoalId) => relatedGoalId !== goal.id),
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/76 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                        >
                          <span className="truncate">{goal.title}</span>
                          <span className="text-white/38">×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1" onWheel={containScrollWithinElement}>
                    {relatedGoalCandidates.length > 0 ? (
                      relatedGoalCandidates.map((goal) => {
                        const active = safeDraftRelatedGoalIds.includes(goal.id)
                        const categoryColor = goal.category
                          ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories)
                          : 'neutral'
                        return (
                          <button
                            key={`related-goal-option-${goal.id}`}
                            type="button"
                            onClick={() =>
                              setLifeGoalDraft((current) => ({
                                ...current,
                                relatedGoalIds: (current.relatedGoalIds ?? []).includes(goal.id)
                                  ? (current.relatedGoalIds ?? []).filter((relatedGoalId) => relatedGoalId !== goal.id)
                                  : [...(current.relatedGoalIds ?? []), goal.id],
                              }))
                            }
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                              active
                                ? 'border-white/[0.1] bg-white/[0.05]'
                                : 'border-white/[0.05] bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.03]'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm text-white/84">{goal.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {goal.category ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium tracking-[0.06em] leading-none text-[rgb(var(--theme-text-muted-rgb))]"
                                    style={getLifeGoalCategoryChipStyle(categoryColor)}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                                    <span>{goal.category}</span>
                                  </span>
                                ) : null}
                                <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                                  {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                                </span>
                              </div>
                            </div>
                            <span className={`text-[11px] uppercase tracking-[0.14em] ${active ? 'text-white/62' : 'text-white/34'}`}>
                              {active ? 'Linked' : 'Link'}
                            </span>
                          </button>
                        )
                      })
                    ) : (
                      <p className="rounded-2xl border border-white/[0.05] bg-white/[0.018] px-3 py-3 text-sm text-mist">
                        No goals match that search.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        ) : null}

        {!isCreateMode && selectedDraftGoalType === 'outcome' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="theme-label">Milestones (optional)</span>
            </div>

            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-mist">Turn milestone checkpoints on for this outcome goal.</p>
                  <p className="mt-1 text-[12px] text-mist/52">Milestones are managed from the roadmap panel, not in settings.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLifeGoalDraft((current) => ({ ...current, milestonesEnabled: !current.milestonesEnabled }))}
                  aria-pressed={lifeGoalDraft.milestonesEnabled}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                    lifeGoalDraft.milestonesEnabled
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.06)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                      : 'border-white/[0.06] bg-white/[0.018] text-white/46 hover:border-white/[0.1] hover:text-white/68'
                  }`}
                >
                  {lifeGoalDraft.milestonesEnabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!isCreateMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="theme-label">Tasks</span>
            </div>

            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-white/74">
                  {`${draftTasks.length} tasks · ${draftTasks.filter((task) => task.completed).length} done · ${
                    draftTasks.filter((task) => !task.completed).length
                  } remaining`}
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (!editingLifeGoalId) return
                    onSelectLifeGoal(editingLifeGoalId)
                    onChangeGoalsView('life-detail')
                    setLifeGoalDetailTab('roadmap')
                    closeLifeGoalComposer()
                  }}
                >
                  Open roadmap
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isCreateMode && isCreatePathStep && isDirectionalDraftGoal ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[15px] font-medium text-white/88">Active paths</p>
              <p className="text-[13px] text-mist/58">Link goals that already move this direction forward.</p>
            </div>

            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <input
                value={lifeGoalRelatedGoalsQuery}
                onChange={(event) => setLifeGoalRelatedGoalsQuery(event.target.value)}
                placeholder="Search goals to link..."
                spellCheck={true}
                className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />

              {selectedRelatedGoals.length > 0 ? (
                <input
                  value={lifeGoalRelationIntent}
                  onChange={(event) => setLifeGoalRelationIntent(event.target.value)}
                  placeholder="Why does this relate?"
                  spellCheck={true}
                  className="theme-input mt-3 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                />
              ) : null}

              {selectedRelatedGoals.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedRelatedGoals.map((goal) => (
                    <button
                      key={`create-selected-related-goal-${goal.id}`}
                      type="button"
                      onClick={() =>
                        setLifeGoalDraft((current) => ({
                          ...current,
                          relatedGoalIds: current.relatedGoalIds.filter((relatedGoalId) => relatedGoalId !== goal.id),
                        }))
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/76 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                    >
                      <span className="truncate">{goal.title}</span>
                      <span className="text-white/38">×</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1" onWheel={containScrollWithinElement}>
                {relatedGoalCandidates.length > 0 ? (
                  relatedGoalCandidates.map((goal) => {
                    const active = safeDraftRelatedGoalIds.includes(goal.id)
                    const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
                    return (
                      <button
                        key={`create-related-goal-option-${goal.id}`}
                        type="button"
                        onClick={() =>
                            setLifeGoalDraft((current) => ({
                              ...current,
                              relatedGoalIds: (current.relatedGoalIds ?? []).includes(goal.id)
                                ? (current.relatedGoalIds ?? []).filter((relatedGoalId) => relatedGoalId !== goal.id)
                                : [...(current.relatedGoalIds ?? []), goal.id],
                            }))
                          }
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-white/[0.1] bg-white/[0.05]'
                            : 'border-white/[0.05] bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-white/84">{goal.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {goal.category ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium tracking-[0.06em] leading-none text-[rgb(var(--theme-text-muted-rgb))]"
                                style={getLifeGoalCategoryChipStyle(categoryColor)}
                              >
                                <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                                <span>{goal.category}</span>
                              </span>
                            ) : null}
                            <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                              {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[11px] uppercase tracking-[0.14em] ${active ? 'text-white/62' : 'text-white/34'}`}>
                          {active ? 'Linked' : 'Link'}
                        </span>
                      </button>
                    )
                  })
                ) : (
                  <p className="rounded-2xl border border-white/[0.05] bg-white/[0.018] px-3 py-3 text-sm text-mist">
                    No goals match that search.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {isCreatePathStep && !isDirectionalDraftGoal ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[15px] font-medium text-white/88">Add your first step - make it something you could do today</p>
            </div>

            <div className="space-y-1.5">
              {lifeGoalDraft.tasks.length === 0 ? (
                <div className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3 border-b border-white/[0.06] pb-0.5">
                  <p className="pt-[7px] text-[11px] font-medium text-white/28">1</p>
                  <div className="min-w-0 flex-1 border-b border-white/[0.05] pb-0.5 transition-colors duration-150 ease-out focus-within:border-white/[0.12]">
                    <input
                      ref={(element) => {
                        lifeGoalDraftTaskInputRefs.current[lifeGoalDraft.tasks[0]?.id ?? ''] = element
                      }}
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
                      onKeyDown={(event) => handleCreatePathTaskKeyDown(event, lifeGoalDraft.tasks[0]?.id ?? '', 0)}
                      placeholder="Type your first step…"
                      spellCheck={true}
                      className="w-full bg-transparent px-0 py-1 text-[15px] text-white/74 outline-none transition-colors duration-150 ease-out placeholder:text-white/38 focus:text-[rgb(var(--theme-text-primary-rgb))]"
                    />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {lifeGoalDraft.tasks.map((task, index) => (
                    <div key={task.id} className="group grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 py-1">
                      {(() => {
                        const hasTaskText = Boolean(task.text.trim())
                        const isTrailingEmptyRow = !hasTaskText && index === lifeGoalDraft.tasks.length - 1
                        return (
                          <>
                            <span className="pt-[7px] text-[11px] font-medium text-white/28">{index + 1}</span>
                            <div
                              className={`min-w-0 flex-1 border-b pb-0.5 transition-colors duration-150 ease-out ${
                                isTrailingEmptyRow
                                  ? 'border-transparent group-hover:border-white/[0.05] group-focus-within:border-white/[0.08]'
                                  : 'border-white/[0.04] group-focus-within:border-white/[0.12]'
                              }`}
                            >
                              <input
                                ref={(element) => {
                                  lifeGoalDraftTaskInputRefs.current[task.id] = element
                                }}
                                value={task.text}
                                onChange={(event) => updateDraftTask(task.id, (current) => ({ ...current, text: event.target.value }))}
                                onKeyDown={(event) => handleCreatePathTaskKeyDown(event, task.id, index)}
                                placeholder={index === 0 ? 'Type your first step…' : 'Add another step'}
                                spellCheck={true}
                                className={`w-full bg-transparent px-0 py-1 text-[15px] outline-none transition-colors duration-150 ease-out ${
                                  isTrailingEmptyRow
                                    ? 'text-white/46 placeholder:text-white/40 group-hover:text-white/60 focus:text-white/78'
                                    : 'text-white/68 placeholder:text-white/34 focus:text-[rgb(var(--theme-text-primary-rgb))]'
                                }`}
                              />
                            </div>
                            <div
                              className={`flex items-center gap-2 transition duration-150 ease-out ${
                                hasTaskText ? 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' : 'pointer-events-none opacity-0'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => reorderDraftTask(task.id, 'up')}
                                disabled={index === 0}
                                className="theme-text-muted text-[11px] transition disabled:opacity-30"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderDraftTask(task.id, 'down')}
                                disabled={index === lifeGoalDraft.tasks.length - 1}
                                className="theme-text-muted text-[11px] transition disabled:opacity-30"
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDraftTask(task.id)}
                                className="theme-text-muted text-[11px] transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isSystemDraftGoal ? (
              <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="theme-label">Milestones (optional)</span>
                    <p className="mt-1 text-sm text-mist">Turn milestone checkpoints on now and manage them from the roadmap panel after saving.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLifeGoalDraft((current) => ({ ...current, milestonesEnabled: !current.milestonesEnabled }))}
                    aria-pressed={lifeGoalDraft.milestonesEnabled}
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                      lifeGoalDraft.milestonesEnabled
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.06)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                        : 'border-white/[0.06] bg-white/[0.018] text-white/46 hover:border-white/[0.1] hover:text-white/68'
                    }`}
                  >
                    {lifeGoalDraft.milestonesEnabled ? 'On' : 'Off'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

      <div
        className={`${
          lifeGoalComposerMode === 'edit'
            ? 'sticky bottom-0 -mx-7 mt-3 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] px-7 py-3 backdrop-blur-md'
            : ''
        }`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-3 ${lifeGoalComposerMode === 'edit' ? '' : 'justify-end'}`}>
          {lifeGoalComposerMode === 'edit' && editingLifeGoalId ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setGoalTypeChangeConfirmationOpen(true)}
              >
                Change goal type
              </Button>
              {canCompleteEditedGoal ? (
                <Button
                  variant="soft"
                  onClick={() => {
                    completeLifeGoal(editingLifeGoalId)
                    closeLifeGoalComposer()
                  }}
                >
                  Complete Goal
                </Button>
              ) : null}
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
                className="theme-danger-soft hover:border-[rgb(var(--theme-negative-rgb)/0.38)] hover:bg-[rgb(var(--theme-negative-rgb)/0.12)] hover:text-[rgb(var(--theme-negative-rgb)/0.98)]"
                onClick={() => {
                  requestDeleteLifeGoal(editingLifeGoalId, 'edit')
                }}
              >
                Delete Goal
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={isCreatePathStep ? () => setLifeGoalCreateStep('define') : closeLifeGoalComposer}
            >
              {isCreatePathStep ? 'Back' : 'Cancel'}
            </Button>
            <motion.div
              className="rounded-2xl"
              animate={
                createGoalVisualState === 'starting' && isCreatePathStep
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
              <Button
                variant="soft"
                onClick={
                  lifeGoalComposerMode === 'edit'
                    ? handleSaveLifeGoal
                    : isCreateDefineStep
                      ? handleAdvanceCreateGoalStep
                      : handleStartGoalClick
                }
                disabled={isCreateDefineStep ? !canAdvanceCreateGoal : false}
              >
                {lifeGoalComposerMode === 'edit'
                  ? 'Save Changes'
                  : isCreateDefineStep
                    ? isDirectionalDraftGoal
                      ? 'Next → Active Paths'
                      : 'Next → Define Path'
                    : createGoalVisualState === 'starting'
                      ? 'Starting...'
                      : isDirectionalDraftGoal
                        ? 'Save direction'
                        : 'Start goal'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
      </div>
    )
  }

const renderLifeGoalOverviewPage = () => {
    const overviewDropdownTriggerClassName =
      'theme-surface-soft inline-flex h-7 min-w-[118px] items-center justify-between rounded-full border border-white/[0.05] px-2.5 text-[11px] font-medium text-white/56 transition hover:border-white/[0.08] hover:text-[rgb(var(--theme-text-primary-rgb)/0.84)]'
    const overviewDropdownPanelClassName =
      'theme-popover min-w-[188px] overflow-hidden rounded-[18px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.18)]'
    const sortLabel =
      lifeGoalOverviewSort === 'due'
        ? 'Due'
        : lifeGoalOverviewSort === 'recent'
          ? 'Recently added'
          : lifeGoalOverviewSort === 'name'
            ? 'A → Z'
            : 'Status'

    const sortOptions: Array<{ id: LifeGoalOverviewSort; label: string }> = [
      { id: 'due', label: 'Due' },
      { id: 'recent', label: 'Recently added' },
      { id: 'name', label: 'A → Z' },
      { id: 'status', label: 'Status' },
    ]

    return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="relative z-10 border-b border-[rgb(var(--theme-border-subtle-rgb)/0.68)] pb-3">
        <div className="flex items-center justify-between gap-4 overflow-x-auto overflow-y-visible">
        <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
          <div className="theme-surface-soft inline-flex shrink-0 rounded-full border border-white/[0.05] p-0.5">
            {(['manual', 'grouped'] as LifeGoalOverviewMode[]).map((mode) => {
              const active = lifeGoalOverviewMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLifeGoalOverviewMode(mode)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'theme-button-secondary theme-text-primary'
                      : 'theme-text-muted text-white/44 hover:text-[rgb(var(--theme-text-primary-rgb)/0.82)]'
                  }`}
                >
                  {mode === 'manual' ? 'Manual' : 'Grouped'}
                </button>
              )
            })}
          </div>
          <div className="theme-surface-soft inline-flex shrink-0 rounded-full border border-white/[0.05] p-0.5">
            {(['compact', 'expanded'] as LifeGoalOverviewDensity[]).map((density) => {
              const active = lifeGoalOverviewDensity === density
              return (
                <button
                  key={density}
                  type="button"
                  onClick={() => setLifeGoalOverviewDensity(density)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'theme-button-secondary theme-text-primary'
                      : 'theme-text-muted text-white/44 hover:text-[rgb(var(--theme-text-primary-rgb)/0.82)]'
                  }`}
                >
                  {density === 'compact' ? 'Compact' : 'Expanded'}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center justify-end gap-2 whitespace-nowrap">
          <div ref={lifeGoalOverviewCategoryFieldRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (lifeGoalOverviewCategoryMenuOpen) {
                  setLifeGoalOverviewCategoryMenuOpen(false)
                  setLifeGoalOverviewCategoryPanelPosition(null)
                  return
                }
                setLifeGoalOverviewCategoryMenuOpen(true)
              }}
              className={overviewDropdownTriggerClassName}
            >
              <span>Categories</span>
              <span className="ml-2 text-white/34">▾</span>
            </button>
          </div>
          <div ref={lifeGoalOverviewSortFieldRef} className="relative">
            <button
              type="button"
              onClick={() => {
                if (lifeGoalOverviewSortMenuOpen) {
                  setLifeGoalOverviewSortMenuOpen(false)
                  setLifeGoalOverviewSortPanelPosition(null)
                  return
                }
                setLifeGoalOverviewSortMenuOpen(true)
              }}
              className={overviewDropdownTriggerClassName}
            >
              <span>{`Sort: ${sortLabel}`}</span>
              <span className="ml-2 text-white/34">▾</span>
            </button>
          </div>
          <span className="theme-surface-soft theme-text-muted rounded-full border border-white/[0.05] px-2.5 py-1 text-[11px] text-white/52">
            {sortedLifeGoals.length} total
          </span>
          <Button
            variant="soft"
            className="border-[rgb(var(--theme-border-strong-rgb))] bg-[linear-gradient(180deg,rgb(var(--theme-surface-elevated-rgb))_0%,rgb(var(--theme-surface-soft-rgb))_100%)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.02em] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.24),inset_0_-1px_0_rgb(0_0_0_/_0.1),0_0_0_1px_rgb(255_255_255_/_0.08),0_8px_18px_rgb(15_23_42_/_0.12)]"
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
            + Create Goal
          </Button>
        </div>
        </div>
      </div>

      {sortedLifeGoals.length === 0 && !lifeGoalComposerOpen ? (
        <div className="theme-surface-soft rounded-[24px] border px-5 py-5">
          <p className="theme-body-primary">No life goals yet</p>
          <p className="theme-body-secondary mt-2">Create one meaningful direction to start using the workspace.</p>
        </div>
      ) : null}

      {lifeGoalOverviewSortMenuOpen && lifeGoalOverviewSortPanelPosition && typeof document !== 'undefined'
        ? createPortal(
            <PopoverSurface
              position={lifeGoalOverviewSortPanelPosition}
              zIndexClassName="z-[90]"
              className={overviewDropdownPanelClassName}
            >
              <motion.div
                ref={lifeGoalOverviewSortPanelRef}
                className="p-0.5"
                initial={{ opacity: 0, scale: 0.985, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: -4 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                {[
                  { id: 'due', label: 'Due' },
                  { id: 'recent', label: 'Recently added' },
                  { id: 'name', label: 'A → Z' },
                  { id: 'status', label: 'Status' },
                ].map((option) => {
                  const active = lifeGoalOverviewSort === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setLifeGoalOverviewSort(option.id as LifeGoalOverviewSort)
                        setLifeGoalOverviewSortMenuOpen(false)
                        setLifeGoalOverviewSortPanelPosition(null)
                      }}
                      className={`flex w-full items-center rounded-[14px] px-3 py-2 text-left text-[12px] transition ${
                        active
                          ? 'bg-white/[0.06] text-[rgb(var(--theme-text-primary-rgb))]'
                          : 'text-white/58 hover:bg-white/[0.04] hover:text-[rgb(var(--theme-text-primary-rgb)/0.88)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </motion.div>
            </PopoverSurface>,
            document.body,
          )
        : null}

      {lifeGoalOverviewCategoryMenuOpen && lifeGoalOverviewCategoryPanelPosition && typeof document !== 'undefined'
        ? createPortal(
            <PopoverSurface
              position={lifeGoalOverviewCategoryPanelPosition}
              zIndexClassName="z-[90]"
              className={overviewDropdownPanelClassName}
            >
              <motion.div
                ref={lifeGoalOverviewCategoryPanelRef}
                className="flex min-w-[188px] flex-col gap-1 p-0.5"
                initial={{ opacity: 0, scale: 0.985, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: -4 }}
                transition={{ duration: 0.14, ease: 'easeOut' }}
              >
                {['all', ...usedLifeGoalCategories].map((category) => {
                  const active = lifeGoalCategoryFilter === category
                  const categoryColor = category === 'all' ? 'neutral' : getLifeGoalCategoryColor(category, lifeGoalCategories)
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setLifeGoalCategoryFilter(category)
                        setLifeGoalOverviewCategoryMenuOpen(false)
                        setLifeGoalOverviewCategoryPanelPosition(null)
                      }}
                      className={`flex w-full items-center justify-between rounded-[14px] px-2.5 py-2 text-left transition ${
                        active
                          ? 'bg-white/[0.06] text-[rgb(var(--theme-text-primary-rgb))]'
                          : 'text-white/58 hover:bg-white/[0.04] hover:text-[rgb(var(--theme-text-primary-rgb)/0.84)]'
                      }`}
                    >
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[5px] text-[10px] font-medium tracking-[0.06em] leading-none text-[rgb(var(--theme-text-muted-rgb))]"
                        style={getLifeGoalCategoryChipStyle(categoryColor)}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                        <span>{category === 'all' ? 'All' : category}</span>
                      </span>
                      {active ? <span className="text-[10px] uppercase tracking-[0.12em] text-white/42">Selected</span> : null}
                    </button>
                  )
                })}
              </motion.div>
            </PopoverSurface>,
            document.body,
          )
        : null}

      {visibleLifeGoals.length > 0 ? (() => {
        const getOverviewRelationshipChips = (goal: LifeGoal) => {
          const linkedGoals = (goal.relatedGoalIds ?? [])
            .map((goalId) => safeLifeGoals.find((candidate) => candidate.id === goalId && candidate.id !== goal.id && !candidate.archivedAt))
            .filter((candidate): candidate is LifeGoal => Boolean(candidate))
            .filter((candidate, index, items) => items.findIndex((item) => item.id === candidate.id) === index)

          const linkingGoals = safeLifeGoals
            .filter(
              (candidate) =>
                !candidate.archivedAt &&
                candidate.id !== goal.id &&
                (candidate.relatedGoalIds ?? []).includes(goal.id),
            )
            .filter((candidate, index, items) => items.findIndex((item) => item.id === candidate.id) === index)

          const relationshipGoals = [
            ...linkedGoals.map((candidate) => ({
              id: candidate.id,
              label: candidate.title,
              isDirectional: (candidate.goalType ?? 'outcome') === 'directional',
              direction: 'outgoing' as const,
            })),
            ...linkingGoals.map((candidate) => ({
              id: candidate.id,
              label: candidate.title,
              isDirectional: (candidate.goalType ?? 'outcome') === 'directional',
              direction: 'incoming' as const,
            })),
          ].filter((candidate, index, items) => items.findIndex((item) => item.id === candidate.id) === index)

          return {
            labels: relationshipGoals.slice(0, 2),
            overflow: Math.max(0, relationshipGoals.length - 2),
          }
        }

        const renderOverviewGoalRow = (goal: LifeGoal) => {
            const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
            const goalDueMeta = isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
            const progress = getLifeGoalProgress(goal)
            const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
            const isDirectional = (goal.goalType ?? 'outcome') === 'directional'
            const relationshipChips = getOverviewRelationshipChips(goal)
            const isPrimary = goal.id === featuredOverviewGoalId
            const isSelected = goal.id === selectedLifeGoalId
            const canDrag = lifeGoalOverviewMode === 'manual' && !goal.isPrimary
            const dueText = isDirectional
              ? null
              : goalDueMeta
              ? goalDueMeta.label
              : goal.targetDate
                ? formatDate(goal.targetDate)
                : null
            const compactDueToneClassName = !goalDueMeta
              ? 'text-mist/50'
              : goalDueMeta.toneClassName === 'text-[rgb(var(--theme-negative-rgb)/0.78)]'
                ? goalDueMeta.toneClassName
                : goalDueMeta.toneClassName === 'text-[rgb(var(--theme-warning-rgb)/0.76)]'
                  ? 'text-[rgb(var(--theme-warning-rgb)/0.64)]'
                  : goalDueMeta.toneClassName === 'text-[rgb(var(--theme-warning-rgb)/0.72)]'
                    ? 'text-[rgb(var(--theme-warning-rgb)/0.58)]'
                    : goalDueMeta.toneClassName === 'text-[rgb(var(--theme-warning-rgb)/0.68)]'
                      ? 'text-[rgb(var(--theme-warning-rgb)/0.56)]'
                      : 'text-white/50'
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
                className={`cursor-middle-finger group relative isolate flex w-full cursor-pointer items-center justify-between gap-4 overflow-hidden rounded-[16px] border px-4 py-3 text-left transition duration-200 ease-out hover:scale-[1.005] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.62)] hover:border-[rgb(var(--theme-border-strong-rgb)/0.84)] hover:shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_0_0_1px_rgb(var(--theme-border-strong-rgb)/0.08)] ${
                  isPrimary
                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-elevated-rgb))]'
                    : isDirectional
                      ? 'border-[rgb(var(--theme-border-subtle-rgb)/0.56)] bg-[rgb(var(--theme-surface-rgb)/0.72)]'
                    : 'border-[rgb(var(--theme-border-subtle-rgb)/0.8)] bg-[rgb(var(--theme-surface-rgb)/0.94)]'
                } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedLifeGoalId === goal.id ? 'opacity-60' : ''} ${dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id ? 'border-[rgb(var(--theme-info-rgb)/0.62)]' : ''}`}
                style={{
                  ...(isSelected ? getLifeGoalCardHighlightStyle(categoryColor) : {}),
                  pointerEvents: 'auto',
                }}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-0 top-2.5 bottom-2.5 rounded-full ${isPrimary ? 'w-[3px]' : 'w-[2px]'}`}
                  style={getLifeGoalAccentBarStyle(categoryColor, isPrimary)}
                />

                <div className="min-w-0 pl-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className={`truncate text-[15px] font-medium ${isDirectional ? 'text-white/82' : 'text-white'}`}>{formatGoalCardTitle(goal.title)}</p>
                    {goal.category ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium tracking-[0.06em] leading-none text-[rgb(var(--theme-text-muted-rgb))]"
                        style={getLifeGoalCategoryChipStyle(categoryColor)}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                        <span>{goal.category}</span>
                      </span>
                    ) : null}
                    {relationshipChips.labels.map((item) => (
                      <span
                        key={`${goal.id}-relationship-row-${item.id}`}
                        className={`inline-flex items-center rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] leading-none ${
                          item.isDirectional
                            ? 'border-white/[0.04] bg-white/[0.028] text-white/40'
                            : 'border-white/[0.05] bg-white/[0.018] text-white/42'
                        }`}
                      >
                        <span className="mr-1 text-white/28">{item.direction === 'outgoing' ? '→' : '←'}</span>
                        <span>{item.label}</span>
                      </span>
                    ))}
                    {relationshipChips.overflow > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] leading-none text-white/36">
                        +{relationshipChips.overflow}
                      </span>
                    ) : null}
                    {goal.isPrimary ? (
                      <span className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.012] px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] leading-none text-white/42">
                        Primary
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative h-6 w-[282px] shrink-0">
                  <div className="absolute right-[146px] top-1/2 flex w-[132px] -translate-y-1/2 items-center justify-start">
                    {dueText ? (
                      <span className={`inline-block whitespace-nowrap text-left text-[12px] leading-[18px] tabular-nums ${compactDueToneClassName}`}>
                        {dueText}
                      </span>
                    ) : null}
                  </div>
                  <div className="absolute right-0 top-1/2 flex w-[140px] -translate-y-1/2 justify-end">
                    <span className={`${goalStatusChipClassName} h-6 shrink-0 px-2.5 py-0 text-[10px] ${statusMeta.badgeClassName}`}>
                      {isLifeGoalScheduled(goal.status, goal.startDate) ? 'Scheduled' : statusMeta.label}
                    </span>
                  </div>
                </div>
              </button>
            )
          }

        const renderOverviewGoalCard = (goal: LifeGoal) => {
            const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
            const secondaryContext = getLifeGoalSecondaryContext(goal)
            const progress = getLifeGoalProgress(goal)
            const momentum = getLifeGoalMomentumState(goal, progress)
            const progressTone = getLifeGoalProgressTone(goal, progress)
            const urgencyMeta = getLifeGoalUrgencyMeta(goal)
            const whyPreview = getLifeGoalAnchorText(goal.whyItMatters)
            const isDirectional = (goal.goalType ?? 'outcome') === 'directional'
            const relationshipChips = getOverviewRelationshipChips(goal)
            const isPrimary = goal.id === featuredOverviewGoalId
            const isSelected = goal.id === selectedLifeGoalId
            const canDrag = lifeGoalOverviewMode === 'manual' && !goal.isPrimary
            const progressSummary = `${progress.completedTasks}/${Math.max(progress.totalTasks, 1)} tasks`
            const goalSubtaskProgress = getGoalSubtaskProgress(goal.tasks)
            const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
            const flowState = getLifeGoalFlowState(goal, progress)
            const goalDueMeta = isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
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
                className={`cursor-middle-finger group relative block w-full overflow-hidden rounded-[26px] border px-5 pt-4 pb-[15px] text-left transition-all duration-150 ease-out hover:-translate-y-0.5 active:scale-[0.995] ${
                  isPrimary
                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-elevated-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.06),0_0_0_1px_rgb(var(--theme-border-strong-rgb)/0.16)] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                    : isDirectional
                      ? 'border-[rgb(var(--theme-border-subtle-rgb)/0.58)] bg-[rgb(var(--theme-surface-rgb)/0.78)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.03),0_0_0_1px_rgb(var(--theme-border-subtle-rgb)/0.1)] hover:border-[rgb(var(--theme-border-strong-rgb)/0.62)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.46)]'
                    : 'border-[rgb(var(--theme-border-subtle-rgb))] bg-[rgb(var(--theme-surface-rgb))] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04),0_0_0_1px_rgb(var(--theme-border-subtle-rgb)/0.14)] hover:border-[rgb(var(--theme-border-strong-rgb)/0.88)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.62)]'
                } ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${draggedLifeGoalId === goal.id ? 'opacity-60' : ''} ${dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id ? 'border-[rgb(var(--theme-info-rgb)/0.62)]' : ''}`}
                style={{
                  ...(isSelected ? getLifeGoalCardHighlightStyle(categoryColor) : {}),
                  ...(!isDirectional ? (getLifeGoalProgressSurfaceStyle(categoryColor, progressTone, isPrimary) ?? {}) : {}),
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
                      {relationshipChips.labels.map((item) => (
                        <span
                          key={`${goal.id}-relationship-card-${item.id}`}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] uppercase leading-none ${
                            item.isDirectional
                              ? 'border-white/[0.04] bg-white/[0.028] text-white/40'
                              : 'border-white/[0.05] bg-white/[0.018] text-white/42'
                          }`}
                        >
                          <span className="mr-1 text-white/28">{item.direction === 'outgoing' ? '→' : '←'}</span>
                          <span>{item.label}</span>
                        </span>
                      ))}
                      {relationshipChips.overflow > 0 ? (
                        <span className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.018] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-white/36 uppercase leading-none">
                          +{relationshipChips.overflow}
                        </span>
                      ) : null}
                      {goal.isPrimary ? (
                        <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.014] px-2.5 py-1 text-[10px] font-medium tracking-[0.14em] text-white/48 uppercase leading-none">
                          Primary Goal
                        </span>
                      ) : null}
                    </div>
                    {whyPreview ? <p className={`mt-1.5 max-w-[760px] ${isDirectional ? 'text-[13px] leading-6 text-white/58' : 'theme-body-secondary'}`}>{whyPreview}</p> : null}

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
                          <span className="theme-text-faint mr-1 text-[12px]">{isDirectional ? 'Direction:' : 'Next:'}</span>
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
                              {isDirectional ? whyPreview || 'Long-term direction' : progress.nextTask?.text ?? 'No next task currently planned.'}
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
                      {!isDirectional && secondaryContext ? (
                        <p className={`text-[12px] leading-5 ${goalDueMeta?.toneClassName ?? urgencyMeta?.toneClassName ?? 'theme-text-muted'}`}>
                          {goalDueMeta ? `${goalDueMeta.label} · ${formatDate(goal.targetDate)}` : secondaryContext}
                        </p>
                      ) : null}
                      {!isDirectional ? <p className="theme-text-faint text-[12px] leading-5">{progressSummary}</p> : null}
                      {!isDirectional && goalSubtaskProgress.total > 0 ? (
                        <p className="theme-text-faint text-[11px] leading-5">
                          {goalSubtaskProgress.completed}/{goalSubtaskProgress.total} subtasks complete
                        </p>
                      ) : null}
                      {!isDirectional && flowState ? <p className={`text-[11px] leading-5 ${flowState.toneClassName}`}>{flowState.label}</p> : null}
                      {!isDirectional ? <div className="ml-auto mt-1 h-[2px] w-[52px] overflow-hidden rounded-full bg-[rgb(var(--theme-border-subtle-rgb)/0.24)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${goal.status === 'complete' ? 100 : progress.totalTasks > 0 ? Math.round((progress.completedTasks / progress.totalTasks) * 100) : 0}%`,
                            backgroundColor: `rgb(var(${getLifeGoalCategoryColorTokenVariable(categoryColor)}) / ${
                              goal.status === 'complete' ? '0.42' : '0.34'
                            })`,
                          }}
                        />
                      </div> : null}
                    </div>
                  </div>
                </div>
              </button>
            )
          }

        const renderGoalItem = (goal: LifeGoal) =>
          lifeGoalOverviewDensity === 'compact' ? renderOverviewGoalRow(goal) : renderOverviewGoalCard(goal)

        const directionalGoals = visibleLifeGoals.filter((goal) => (goal.goalType ?? 'outcome') === 'directional')
        const standardGoals = visibleLifeGoals.filter((goal) => (goal.goalType ?? 'outcome') !== 'directional')
        const outcomeGoals = standardGoals.filter((goal) => (goal.goalType ?? 'outcome') === 'outcome')
        const systemGoals = standardGoals.filter((goal) => (goal.goalType ?? 'outcome') === 'system')
        const renderGoalTypeInfo = (copy: string) => (
          <span className="group/goaltype relative inline-flex items-center">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/[0.08] text-[9px] font-medium leading-none text-white/34 transition-colors duration-150 ease-out group-hover/goaltype:text-white/52">
              i
            </span>
            <span className="theme-tooltip pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-20 hidden w-max max-w-[220px] -translate-x-1/2 whitespace-normal rounded-xl border px-2.5 py-1.5 text-[11px] font-medium leading-4 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/goaltype:block group-hover/goaltype:translate-y-0 group-hover/goaltype:opacity-100">
              {copy}
            </span>
          </span>
        )
        const renderGoalGroupSection = (title: string, goals: LifeGoal[]) => {
          if (goals.length === 0) return null
          const infoCopy =
            title === 'Directions'
              ? 'Long-term life direction. Not something to complete.'
              : null
          return (
            <section className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/58">{title}</h3>
                  {infoCopy ? renderGoalTypeInfo(infoCopy) : null}
                </div>
                <div
                  aria-hidden="true"
                  className="h-px bg-[linear-gradient(90deg,transparent_0%,rgb(var(--theme-border-subtle-rgb)/0.16)_10%,rgb(var(--theme-border-subtle-rgb)/0.1)_56%,transparent_100%)]"
                />
              </div>
              <div className={lifeGoalOverviewDensity === 'compact' ? 'space-y-2' : 'space-y-3'}>{goals.map((goal) => renderGoalItem(goal))}</div>
            </section>
          )
        }
        const renderGoalTypeSubgroup = (title: 'Outcome' | 'System', content: React.ReactNode) => {
          if (!content) return null
          const infoCopy =
            title === 'Outcome'
              ? 'A goal with a clear finish.'
              : 'Ongoing behavior & habits that support outcome goals.'
          const headerPaddingClassName = title === 'System' ? 'pt-0' : 'pt-1'
          return (
            <div className="space-y-2">
              <div className={`space-y-1 ${headerPaddingClassName}`}>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">{title}</p>
                  {renderGoalTypeInfo(infoCopy)}
                </div>
                <div
                  aria-hidden="true"
                  className="h-px bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.14)_0%,rgb(var(--theme-border-subtle-rgb)/0.08)_56%,transparent_100%)]"
                />
              </div>
              {content}
            </div>
          )
        }

        if (lifeGoalOverviewMode === 'manual') {
          return (
            <div className="space-y-4">
              {renderGoalGroupSection('Directions', directionalGoals)}
              {standardGoals.length > 0 ? (
                <section className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/58">Goals</h3>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-px bg-[linear-gradient(90deg,transparent_0%,rgb(var(--theme-border-subtle-rgb)/0.16)_10%,rgb(var(--theme-border-subtle-rgb)/0.1)_56%,transparent_100%)]"
                    />
                  </div>
                  <div className="space-y-3">
                    {renderGoalTypeSubgroup(
                      'Outcome',
                      <div className={lifeGoalOverviewDensity === 'compact' ? 'space-y-2' : 'space-y-3'}>
                        {outcomeGoals.map((goal) => renderGoalItem(goal))}
                      </div>,
                    )}
                    {renderGoalTypeSubgroup(
                      'System',
                      <div className={lifeGoalOverviewDensity === 'compact' ? 'space-y-2' : 'space-y-3'}>
                        {systemGoals.map((goal) => renderGoalItem(goal))}
                      </div>,
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          )
        }

        const primaryGoal = standardGoals.find((goal) => goal.isPrimary) ?? null
        const groupedGoalsByType = (goals: LifeGoal[]) => {
          const orderedCategoryKeys: string[] = []
          const groupedByCategory = new Map<string, LifeGoal[]>()

          for (const goal of goals.filter((item) => !item.isPrimary)) {
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

          return { groupedByCategory, orderedGroupedKeys }
        }

        const groupedOutcome = groupedGoalsByType(outcomeGoals)
        const groupedSystem = groupedGoalsByType(systemGoals)
        const renderCategorySections = (grouped: { groupedByCategory: Map<string, LifeGoal[]>; orderedGroupedKeys: string[] }) =>
          grouped.orderedGroupedKeys.map((categoryKey) => {
            const goals = grouped.groupedByCategory.get(categoryKey)
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
                <div className={lifeGoalOverviewDensity === 'compact' ? 'space-y-2' : 'space-y-3'}>{goals.map((goal) => renderGoalItem(goal))}</div>
              </section>
            )
          })

        return (
          <div className="space-y-4">
            {renderGoalGroupSection('Directions', directionalGoals)}
            <section className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/58">Goals</h3>
                </div>
                <div
                  aria-hidden="true"
                  className="h-px bg-[linear-gradient(90deg,transparent_0%,rgb(var(--theme-border-subtle-rgb)/0.16)_10%,rgb(var(--theme-border-subtle-rgb)/0.1)_56%,transparent_100%)]"
                />
              </div>
              {primaryGoal ? <div className={lifeGoalOverviewDensity === 'compact' ? 'space-y-2' : 'space-y-3'}>{renderGoalItem(primaryGoal)}</div> : null}
              {outcomeGoals.length > 0
                ? renderGoalTypeSubgroup('Outcome', <div className="space-y-3">{renderCategorySections(groupedOutcome)}</div>)
                : null}
              {systemGoals.length > 0
                ? renderGoalTypeSubgroup('System', <div className="space-y-3">{renderCategorySections(groupedSystem)}</div>)
                : null}
            </section>
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
    const compactWhyText = anchorText.length > 96 ? `${anchorText.slice(0, 93).trimEnd()}…` : anchorText
    const selectedGoalType = selectedLifeGoal.goalType ?? 'outcome'
    const isOutcomeGoal = selectedGoalType === 'outcome'
    const isSystemGoal = selectedGoalType === 'system'
    const isDirectionalGoal = selectedGoalType === 'directional'
    const milestonesEnabled = isOutcomeGoal && Boolean(selectedLifeGoal.milestonesEnabled)
    const goalMilestones = (selectedLifeGoal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
    const currentMilestone =
      goalMilestones.find((milestone) => !milestone.completed) ?? (goalMilestones.length > 0 ? goalMilestones[goalMilestones.length - 1] : null)
    const selectedMilestoneId = selectedMilestoneIdByGoal[selectedLifeGoal.id] ?? null
    const selectedMilestone = goalMilestones.find((milestone) => milestone.id === selectedMilestoneId) ?? null
    const currentMilestoneIndex = currentMilestone ? goalMilestones.findIndex((milestone) => milestone.id === currentMilestone.id) : -1
    const completedMilestoneCount = goalMilestones.filter((milestone) => milestone.completed).length
    const outcomeMilestoneView =
      selectedLifeGoal ? (outcomeMilestoneViewByGoal[selectedLifeGoal.id] ?? 'tasks') : 'tasks'
    const currentMilestoneMeta = currentMilestone
      ? currentMilestone.completed
        ? `All ${goalMilestones.length} milestones complete`
        : `${Math.max(1, currentMilestoneIndex + 1)} of ${goalMilestones.length} milestones`
      : null
    const milestoneDateTarget = milestoneDatePickerMilestoneId
      ? goalMilestones.find((milestone) => milestone.id === milestoneDatePickerMilestoneId) ?? null
      : null
    const progressPathTasks = Array.isArray(selectedLifeGoal.tasks) ? selectedLifeGoal.tasks : []
    const isRoadmapMode = !isDirectionalGoal && (lifeGoalDetailTab === 'tasks' || lifeGoalDetailTab === 'roadmap')
    const compactDateRange = `${formatDate(selectedLifeGoal.startDate)} → ${selectedLifeGoal.targetDate ? formatDate(selectedLifeGoal.targetDate) : 'No target'}`
    const roadmapSections = selectedRoadmapSections
    const roadmapRemainingCount = roadmapSections.current ? roadmapSections.upcoming.length + 1 : 0
    const roadmapHasHighPriorityTasks =
      (roadmapSections.current ? getPriorityScore(roadmapSections.current) === 3 : false) ||
      roadmapSections.upcoming.some((task) => getPriorityScore(task) === 3)
    const roadmapExecutionSummaryText = `${roadmapSections.current ? 1 : 0} now · ${roadmapSections.upcoming.length} next · ${roadmapSections.completed.length} done`
    const roadmapHasTaggedTasks = selectedLifeGoal.tasks.some((task) => normalizeTaskTags(task.tags).length > 0)
    const sortedUpcomingTasks = sortTasksForDisplay(roadmapSections.upcoming, taskListSortMode)
    const sortedCompletedTasks = sortTasksForDisplay(roadmapSections.completed, taskListSortMode)
    const sortedPlannedTasks = roadmapSections.current ? [roadmapSections.current, ...sortedUpcomingTasks] : sortedUpcomingTasks
    const milestoneMap = new Map(goalMilestones.map((milestone) => [milestone.id, milestone]))
    const roadmapTasksGroupedByMilestone =
      isOutcomeGoal && milestonesEnabled && currentMilestone
        ? goalMilestones
            .map((milestone) => {
              const tasks = sortedPlannedTasks.filter((task) => {
                const assignedMilestoneId =
                  task.milestoneId && milestoneMap.has(task.milestoneId) ? task.milestoneId : currentMilestone.id
                return assignedMilestoneId === milestone.id
              })
              return tasks.length > 0 ? { milestone, tasks } : null
            })
            .filter((group): group is { milestone: typeof goalMilestones[number]; tasks: LifeGoalTask[] } => Boolean(group))
        : []
    const goalReadyToComplete =
      selectedLifeGoalProgress.totalTasks > 0 &&
      selectedLifeGoalProgress.completedTasks === selectedLifeGoalProgress.totalTasks &&
      selectedLifeGoal.status !== 'complete'
    const todayIsoDate = getTodayIsoDate()
    const recentTaskCompletionCount = progressPathTasks.filter((task) => {
      if (!task.completedAt) return false
      const taskDay = task.completedAt.slice(0, 10)
      return taskDay >= shiftIsoDate(todayIsoDate, -4) && taskDay <= todayIsoDate
    }).length
    const totalCompletedTasks = progressPathTasks.filter((task) => task.completed).length
    const completedTaskTimestamps = progressPathTasks
      .map((task) => task.completedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
    const lastCompletedTaskTimestamp =
      completedTaskTimestamps.length > 0 ? completedTaskTimestamps[completedTaskTimestamps.length - 1] : null
    const lastProgressDaysAgo =
      lastCompletedTaskTimestamp != null
        ? Math.max(0, Math.round((Date.now() - new Date(lastCompletedTaskTimestamp).getTime()) / 86400000))
        : null
    const goalCompletionPercent = selectedLifeGoalProgress?.percent ?? 0
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
    const renderGoalTypeInfoChip = (label: string, tooltip: string, chipClassName: string) => (
      <span className={`${goalHeaderChipClassName} gap-1.5 ${chipClassName}`}>
        <span>{label}</span>
        <span className="group/typeinfo relative inline-flex">
          <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[10px] text-white/38 transition group-hover/typeinfo:text-white/60">
            i
          </span>
          <span className="theme-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[240px] -translate-x-1/2 whitespace-normal rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium leading-4 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/typeinfo:block group-hover/typeinfo:translate-y-0 group-hover/typeinfo:opacity-100">
            {tooltip}
          </span>
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
              <div className="flex items-center justify-between gap-3 pb-2 pl-[36px]">
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
            className={`group relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.1)] bg-white/[0.012] py-[14px] text-left transition duration-200 ease-out hover:bg-white/[0.02] hover:border-[rgb(var(--theme-accent-rgb)/0.14)] ${
              dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
            } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
              roadmapArrivalCueActive ? 'goal-current-arrival' : ''
            } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
              taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
            }`}
            style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
          >
            <span aria-hidden="true" className="relative z-[1] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
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
          className={`group relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
            isCompressed ? 'gap-y-0 py-[5px]' : 'gap-y-1 py-[10px]'
          } ${
            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
          } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
            taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
          } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
          style={{
            ...visualState.rowStyle,
            opacity:
              visualState.opacity *
              (roadmapArrivalCueActive ? 0.78 : 1) *
              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
          }}
        >
          <span aria-hidden="true" className="relative z-[1] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
            <span className={`h-1.5 w-1.5 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
          </span>
          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-[6px]' : 'pb-[10px]'}`}>
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
    const roadmapMilestoneStructuredContent =
      roadmapTasksGroupedByMilestone.length > 0 ? (
        <div className="pb-4">
          {roadmapTasksGroupedByMilestone.map(({ milestone, tasks }, groupIndex) => {
            const isCurrentGroup = milestone.id === currentMilestone?.id
            const incompleteGroupTasks = tasks.filter((task) => !task.completed)
            if (incompleteGroupTasks.length === 0) return null

            return (
              <div key={`roadmap-milestone-group-${milestone.id}`} className={groupIndex > 0 ? 'pt-5' : ''}>
                {isCurrentGroup ? (
                  <p className="pb-2 pl-[36px] text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.96)] [text-shadow:0_0_10px_rgb(var(--theme-accent-rgb)/0.42),0_0_18px_rgb(var(--theme-accent-rgb)/0.18)]">
                    You are here
                  </p>
                ) : null}
                <div className="relative pb-3 pl-[36px]">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[3px] top-[9px] h-px w-[18px]"
                    style={{
                      background: isCurrentGroup
                        ? 'linear-gradient(90deg, rgb(var(--theme-accent-rgb)/0) 0%, rgb(var(--theme-accent-rgb)/0.24) 50%, rgb(var(--theme-accent-rgb)/0) 100%)'
                        : groupIndex === 1
                          ? 'linear-gradient(90deg, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / 0.12) 50%, rgb(255 255 255 / 0) 100%)'
                          : 'linear-gradient(90deg, rgb(255 255 255 / 0) 0%, rgb(255 255 255 / 0.08) 50%, rgb(255 255 255 / 0) 100%)',
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-[11px] uppercase tracking-[0.16em] ${isCurrentGroup ? 'text-white/78' : 'text-mist/56'}`}>
                      {milestone.title}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                        isCurrentGroup
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.05)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                          : groupIndex === 1
                            ? 'border-white/[0.06] bg-white/[0.02] text-white/48'
                            : 'border-white/[0.05] bg-white/[0.016] text-white/38'
                      }`}
                    >
                      {isCurrentGroup ? 'Current milestone' : groupIndex === 1 ? 'Next milestone' : 'Upcoming milestone'}
                    </span>
                    {milestone.targetDate ? (
                      <span className={`text-[12px] ${getRelativeDueMeta(milestone.targetDate)?.toneClassName ?? 'text-mist/50'}`}>
                        {getRelativeDueMeta(milestone.targetDate)?.label ?? formatDate(milestone.targetDate)}
                      </span>
                    ) : null}
                  </div>
                  {milestone.description.trim() ? (
                    <p className="mt-1 line-clamp-1 text-[12px] text-mist/52">{milestone.description.trim()}</p>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {incompleteGroupTasks.map((task) =>
                    renderRoadmapPanelTaskRow(task, task.id === roadmapSections.current?.id ? 'current' : 'upcoming'),
                  )}
                </div>
              </div>
            )
          })}
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
            ← {(goal.goalType ?? 'outcome') === 'directional' ? 'DIR' : 'GOAL'}
          </button>
        ))}
        {hiddenParentGoalsCount > 0 ? (
          <span className={`${goalHeaderChipClassName} border-white/[0.05] bg-white/[0.018] text-white/40`}>
            +{hiddenParentGoalsCount}
          </span>
        ) : null}
      </>
    )
    const linkedGoalsSection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">
            {isSystemGoal ? 'Supported outcomes' : 'Related goals'}
          </p>
          <p className="mt-1 text-sm text-mist">
            {isSystemGoal ? 'Outcome goals this system helps move forward.' : 'Goals linked with this goal.'}
          </p>
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
    const goalWorkspaceRail = (
      <div
        className={`rounded-[20px] border border-white/[0.045] bg-white/[0.016] px-4 py-2.5 ${
          goalCompletionFlashGoalId === selectedLifeGoal.id ? 'goal-complete-celebration' : ''
        }`}
      >
        <div className="grid items-center gap-4 lg:grid-cols-[auto_minmax(220px,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white/64">
              <span className="text-mist/50">Progress</span>
              <span className="px-1.5 text-white/18">·</span>
              {selectedLifeGoalProgress.completedTasks}/{selectedLifeGoalProgress.totalTasks}
              <span className="px-1.5 text-white/18">·</span>
              <span className="text-white/66">{goalCompletionPercent}%</span>
            </p>
            <p className="mt-0.5 text-[11px] text-mist/40">
              {recentTaskCompletionCount > 0
                ? `+${recentTaskCompletionCount} tasks in last 5 days`
                : lastProgressDaysAgo == null
                  ? 'No progress yet'
                  : `Last progress ${lastProgressDaysAgo === 0 ? 'today' : `${lastProgressDaysAgo}d ago`}`}
            </p>
          </div>
          <div className="relative h-8 px-4">
            <div className="absolute left-[18px] right-[52px] top-1/2 h-px -translate-y-1/2 bg-white/[0.1]" />
            <div
              className="absolute left-[18px] top-1/2 h-px -translate-y-1/2 bg-[rgb(var(--theme-accent-rgb)/0.42)]"
              style={{
                width:
                  progressPathTasks.length > 0
                    ? `calc((100% - 70px) * ${selectedLifeGoalProgress.completedTasks / progressPathTasks.length})`
                    : '0%',
              }}
            />

            <div className="absolute inset-y-0 left-[18px] right-[52px]">
              {progressPathTasks.length > 0 ? (
                progressPathTasks.map((task, index) => {
                  const dotLeft =
                    progressPathTasks.length === 1
                      ? '0%'
                      : `${(index / Math.max(1, progressPathTasks.length - 1)) * 100}%`
                  const isSequentiallyComplete = index < selectedLifeGoalProgress.completedTasks
                  const isCurrentAnchor =
                    selectedLifeGoalProgress.completedTasks > 0 &&
                    index === selectedLifeGoalProgress.completedTasks - 1
                  return (
                    <span
                      key={task.id}
                      className={`absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                        isCurrentAnchor
                          ? 'h-3.5 w-3.5 border-[rgb(var(--theme-accent-rgb)/0.8)] bg-[rgb(var(--theme-accent-rgb)/0.76)] shadow-[0_0_0_2px_rgb(var(--theme-surface-elevated-rgb)/0.86),0_0_0_1px_rgb(var(--theme-accent-rgb)/0.1),0_0_12px_rgb(var(--theme-accent-rgb)/0.14)]'
                          : isSequentiallyComplete
                            ? 'h-2 w-2 border-[rgb(var(--theme-accent-rgb)/0.5)] bg-[rgb(var(--theme-accent-rgb)/0.54)]'
                            : 'h-2 w-2 border-white/[0.18] bg-[rgb(var(--theme-surface-rgb)/0.94)]'
                      }`}
                      style={{ left: dotLeft }}
                    />
                  )
                })
              ) : (
                <span className="absolute left-0 top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.18] bg-[rgb(var(--theme-surface-rgb)/0.94)]" />
              )}
            </div>

            <div className="absolute right-0 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-surface-elevated-rgb)/0.92)] text-[11px] font-semibold text-white/78 shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.04)]">
              {goalCompletionPercent}%
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-mist/40">Timeline</p>
            <p className="mt-0.5 text-[13px] font-medium text-white/66">{compactDateRange}</p>
          </div>
        </div>
      </div>
    )
    const directionalAnchorCard = (
      <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="theme-page-title min-w-0">{selectedLifeGoal.title}</h3>
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
                {selectedLifeGoal.isPrimary ? (
                  <span className={`theme-surface-soft theme-text-primary ${goalHeaderChipClassName}`}>Primary Goal</span>
                ) : null}
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
          {anchorText ? (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-mist/56">Why it matters</p>
              <p className="max-w-[44rem] text-[14px] leading-6 text-white/74">{anchorText}</p>
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
    const systemSupportingHabitsSection = (
      <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Supporting habits</p>
          <p className="mt-1 text-sm text-mist">Simple repeatable behaviors linked to this broader system.</p>
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
            {goalMilestones.map((milestone, milestoneIndex) => {
              const isCurrentMilestone = currentMilestone?.id === milestone.id && !milestone.completed
              const isSelectedMilestone = selectedMilestone?.id === milestone.id
              const milestoneDueMeta = milestone.targetDate ? getRelativeDueMeta(milestone.targetDate) : null
              const milestoneDescriptionPreview = milestone.description.trim()
              return (
                <div
                  key={milestone.id}
                  onClick={() =>
                    setSelectedMilestoneIdByGoal((current) => ({
                      ...current,
                      [selectedLifeGoal.id]: current[selectedLifeGoal.id] === milestone.id ? null : milestone.id,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedMilestoneIdByGoal((current) => ({
                        ...current,
                        [selectedLifeGoal.id]: current[selectedLifeGoal.id] === milestone.id ? null : milestone.id,
                      }))
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`w-full rounded-[20px] border px-4 py-3.5 text-left transition ${
                    isSelectedMilestone
                      ? 'border-white/[0.1] bg-white/[0.03]'
                      : isCurrentMilestone
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
                        </div>
                      </div>
                      {!isSelectedMilestone && milestoneDescriptionPreview ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/58">{milestoneDescriptionPreview}</p>
                      ) : null}
                    </div>
                  </div>

                  {isSelectedMilestone ? (
                    <div
                      className="mt-3 border-t border-white/[0.04] pt-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Title</span>
                            <input
                              value={milestone.title}
                              onChange={(event) =>
                                updateSelectedLifeGoalMilestone(milestone.id, (current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                              placeholder={`Milestone ${milestoneIndex + 1}`}
                              spellCheck={true}
                              className="theme-input w-full rounded-xl border px-3 py-2 text-sm outline-none"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Target date</span>
                            <div
                              ref={(element) => {
                                milestoneDateFieldRefs.current[milestone.id] = element
                              }}
                              className="relative"
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openMilestoneDatePicker(milestone.id, milestone.targetDate)
                                }}
                                className="theme-input flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition"
                              >
                                <span className={milestone.targetDate ? 'theme-text-primary' : 'theme-text-muted'}>
                                  {milestone.targetDate ? formatDate(milestone.targetDate) : 'Optional date'}
                                </span>
                                <span className="theme-text-faint text-xs">▾</span>
                              </button>
                            </div>
                          </label>
                        </div>
                        <label className="space-y-1">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-mist/50">Description</span>
                          <textarea
                            value={milestone.description}
                            onChange={(event) =>
                              updateSelectedLifeGoalMilestone(milestone.id, (current) => ({
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
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedLifeGoalMilestone(milestone.id, (current) => ({
                                ...current,
                                completed: !current.completed,
                                completedAt: !current.completed ? new Date().toISOString() : null,
                              }))
                            }
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition ${
                              milestone.completed
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.76)]'
                                : 'border-white/[0.06] bg-white/[0.018] text-white/54 hover:border-white/[0.1] hover:text-white/74'
                            }`}
                          >
                            {milestone.completed ? 'Mark incomplete' : 'Mark complete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderSelectedLifeGoalMilestone(milestone.id, 'up')}
                            disabled={milestoneIndex === 0}
                            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.018] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74 disabled:opacity-30"
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            onClick={() => reorderSelectedLifeGoalMilestone(milestone.id, 'down')}
                            disabled={milestoneIndex === goalMilestones.length - 1}
                            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.018] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74 disabled:opacity-30"
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSelectedLifeGoalMilestone(milestone.id)}
                            className="inline-flex items-center rounded-full border border-[rgb(var(--theme-negative-rgb)/0.18)] bg-[rgb(var(--theme-negative-rgb)/0.06)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-negative-rgb)/0.76)] transition hover:border-[rgb(var(--theme-negative-rgb)/0.24)] hover:text-[rgb(var(--theme-negative-rgb)/0.86)]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pl-[36px] pt-1">
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
              className="pointer-events-none absolute bottom-3 left-[12px] top-3 w-px"
              style={{
                background:
                  roadmapSections.current
                    ? 'linear-gradient(180deg, rgb(var(--theme-border-subtle-rgb)/0.16) 0%, rgb(var(--theme-accent-rgb)/0.28) 48%, rgb(var(--theme-border-subtle-rgb)/0.16) 100%)'
                    : 'rgb(var(--theme-border-subtle-rgb) / 0.16)',
              }}
            />

            <div className="space-y-7">
              {roadmapSections.completed.length > 0 ? (
                <section>
                  <button
                    type="button"
                    onClick={() => setRoadmapCompletedOpen((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 pb-3 pl-[36px] text-left text-[11px] uppercase tracking-[0.18em] text-mist/52 transition hover:text-white/66"
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
                  <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Current</p>
                  {renderRoadmapTaskGroups([roadmapSections.current], 'current', undefined, (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const isSelected = selectedRoadmapTaskId === task.id
                    const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
                    return (
                      <div key={task.id}>
                        <p className="pb-2 pl-[36px] text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.74)]">
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
                          className={`relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.04] py-[18px] text-left transition hover:border-white/[0.07] ${
                            isSelected ? 'bg-white/[0.018]' : 'bg-white/[0.012]'
                          } ${
                            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                          }`}
                          style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
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
                  <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Upcoming</p>
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
                        className={`relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 border-b border-white/[0.035] text-left transition-all duration-200 ease-out last:border-b-0 hover:border-white/[0.07] ${
                          isCompressed ? 'gap-y-0 py-1.5' : 'gap-y-1 py-3'
                        } ${
                          isSelected ? 'bg-white/[0.012]' : ''
                        } ${
                          dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                        }`}
                        style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
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
                <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Goal</p>
                <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 border-b border-white/[0.035] py-3">
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
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
          </div>

          {isOutcomeGoal ? goalWorkspaceRail : null}

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
                  {renderParentGoalChips()}
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
          </div>
        </div>

        {isOutcomeGoal ? goalWorkspaceRail : null}

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
                  title={selectedLifeGoal.title}
                  categoryChip={
                    <>
                      {isDirectionalGoal
                        ? renderGoalTypeInfoChip(
                            'Direction',
                            'Long-term life direction. Not something to complete.',
                            'border-white/[0.08] bg-white/[0.04] text-white/76',
                          )
                        : isSystemGoal
                          ? renderGoalTypeInfoChip(
                              'System',
                              'A system goal is a broader supporting engine. Use habits for simple repeatable behaviors, and save one-time checkpoints for milestones or tasks.',
                              'border-[rgb(var(--theme-info-rgb)/0.12)] bg-[rgb(var(--theme-info-rgb)/0.06)] text-[rgb(var(--theme-info-rgb)/0.76)]',
                            )
                          : renderGoalTypeInfoChip(
                              'Outcome',
                              'An outcome goal is a destination with a clear finish. Use tasks for the execution steps to reach it.',
                              'border-white/[0.08] bg-white/[0.03] text-white/75',
                            )}
                      {renderParentGoalChips()}
                      {selectedGoalCategory ? (
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
                  primaryChip={
                    selectedLifeGoal.isPrimary ? (
                      <span className={`theme-surface-soft theme-text-primary ${goalHeaderChipClassName}`}>Primary Goal</span>
                    ) : null
                  }
                  statusChip={
                    <span
                      className={`${goalHeaderChipClassName} ${
                        getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).badgeClassName
                      }`}
                    >
                      {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate)
                        ? 'Scheduled'
                        : getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).label}
                    </span>
                  }
                  whyText={anchorText ? compactWhyText : null}
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

              <div
                className={`rounded-[22px] border border-white/[0.04] bg-[rgb(var(--theme-surface-elevated-rgb)/0.42)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.015)] ${
                  selectedLifeGoalVisionEditorOpen
                    ? ''
                    : 'xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden'
                }`}
              >
                <input
                  ref={visionUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (event) => {
                    if (!event.target.files?.length) return
                    await appendSelectedLifeGoalVisionImages(event.target.files)
                    event.target.value = ''
                  }}
                />

                <div className="flex w-full items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Vision</p>
                    <p className="mt-1 text-[13px] leading-5 text-mist/62">
                      {selectedLifeGoalVisionCollapsed
                        ? 'A small reminder of what this is really for.'
                        : selectedLifeGoalHasVision
                          ? 'A small reminder of what this is really for.'
                          : 'Add a visual reminder of why this goal matters'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    {!selectedLifeGoalVisionCollapsed ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedLifeGoalVisionEditorOpen((current) => !current)
                        }}
                        className="text-[11px] uppercase tracking-[0.16em] text-mist/44 transition hover:text-white/66"
                      >
                        {selectedLifeGoalVisionEditorOpen || !selectedLifeGoalHasVision ? 'Done' : 'Edit'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedLifeGoalVisionCollapsed((current) => !current)
                      }}
                      className="text-[11px] uppercase tracking-[0.16em] text-mist/44 transition hover:text-white/66"
                    >
                      {selectedLifeGoalVisionCollapsed ? 'Show' : 'Hide'}
                      </button>
                    </div>
                </div>

                <AnimatePresence initial={false}>
                  {!selectedLifeGoalVisionCollapsed ? (
                    <motion.div
                      key="vision-body"
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className={`overflow-hidden ${
                        selectedLifeGoalVisionEditorOpen ? '' : 'xl:flex xl:min-h-0 xl:flex-1'
                      }`}
                    >
                      <div
                        className={
                          selectedLifeGoalVisionEditorOpen
                            ? ''
                            : 'xl:roadmap-scroll xl:h-full xl:min-h-0 xl:overflow-y-auto xl:pr-1'
                        }
                      >
                      {!selectedLifeGoalHasVision && !selectedLifeGoalVisionEditorOpen ? (
                        <div className="mt-3 min-h-[210px] rounded-[18px] border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                          <div className="flex h-full min-h-[178px] flex-col justify-between gap-4">
                            <div>
                              <p className="text-[15px] font-medium text-white/82">Vision</p>
                              <p className="mt-2 max-w-[28rem] text-[13px] leading-6 text-mist/62">
                                Add a visual reminder of why this goal matters
                              </p>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => setSelectedLifeGoalVisionEditorOpen(true)}
                                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
                              >
                                Add vision
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : selectedLifeGoalVisionEditorOpen || !selectedLifeGoalHasVision ? (
                        <div className="mt-3.5 space-y-3">
                          <div
                            onDragOver={(event) => {
                              event.preventDefault()
                              if (!visionDropActive) setVisionDropActive(true)
                            }}
                            onDragLeave={(event) => {
                              event.preventDefault()
                              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                              setVisionDropActive(false)
                            }}
                            onDrop={async (event) => {
                              event.preventDefault()
                              setVisionDropActive(false)
                              if (event.dataTransfer.files?.length) {
                                await appendSelectedLifeGoalVisionImages(event.dataTransfer.files)
                              }
                            }}
                            className={`rounded-[18px] border border-dashed px-3.5 py-3 transition ${
                              visionDropActive
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.24)] bg-[rgb(var(--theme-accent-rgb)/0.05)]'
                                : 'border-white/[0.06] bg-white/[0.02]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-[12px] text-white/76">Images</p>
                                <p className="mt-1 text-[12px] text-mist/52">
                                  Drag in images or upload up to {LIFE_GOAL_VISION_IMAGE_LIMIT}.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => visionUploadInputRef.current?.click()}
                                className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
                              >
                                Upload
                              </button>
                            </div>
                          </div>

                          {selectedLifeGoal.visionImages.length > 0 ? (
                            renderVisionImageLayout(selectedLifeGoal.visionImages, {
                              fitMode: 'contain',
                              removable: true,
                              onRemove: removeSelectedLifeGoalVisionImage,
                              interactive: singleVisionInteractive
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
                                : undefined,
                            })
                          ) : null}

                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Statement</p>
                            <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3.5 py-2.5">
                              <input
                                type="text"
                                value={selectedLifeGoal.visionStatement}
                                onChange={(event) => updateSelectedLifeGoalVisionStatement(event.target.value)}
                                maxLength={120}
                                spellCheck={true}
                                placeholder="A short reminder of what this goal makes possible"
                                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                              />
                              <p className="mt-2 text-[11px] text-mist/42">{selectedLifeGoal.visionStatement.length}/120</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {selectedLifeGoal.visionImages.length > 0 ? (
                            renderVisionImageLayout(selectedLifeGoal.visionImages, {
                              fitMode: 'contain',
                              interactive: singleVisionInteractive
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
                                : undefined,
                            })
                          ) : null}
                          {selectedLifeGoal.visionStatement.trim() ? (
                            <p className="text-[13px] leading-6 text-white/78">{selectedLifeGoal.visionStatement.trim()}</p>
                          ) : null}
                        </div>
                      )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

            </div>

            {!isDirectionalGoal ? <LifeGoalRoadmapPanel
              data={{
                plannedTaskCount: selectedLifeGoalProgress.plannedTasks.length,
                completedCount: selectedLifeGoalProgress.completedTaskItems.length,
                remainingCount: roadmapRemainingCount,
                lastCompletedText: selectedLifeGoalProgress.lastCompletedTask?.text ?? null,
                executionSummaryText: roadmapExecutionSummaryText,
                milestoneSummaryText:
                  goalMilestones.length > 0
                    ? `${completedMilestoneCount}/${goalMilestones.length} milestones complete`
                    : 'Milestones enabled',
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
                          className={`group grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 rounded-[12px] text-left transition-all duration-200 ease-out hover:bg-white/[0.014] ${
                            isCompressed ? 'gap-y-0 py-[5px]' : 'gap-y-1 py-[10px]'
                          } ${
                            visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''
                          } ${
                            taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                          }`}
                          style={{
                            opacity:
                              visualState.opacity *
                              (roadmapArrivalCueActive ? 0.78 : 1) *
                              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                          }}
                        >
                          <span aria-hidden="true" className="relative z-[1] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.5)] transition-transform duration-200 ease-out group-hover:scale-110" />
                          </span>
                          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-[6px]' : 'pb-[10px]'}`}>
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
                          <p className="pb-2 pl-[36px] text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.96)] [text-shadow:0_0_10px_rgb(var(--theme-accent-rgb)/0.42),0_0_18px_rgb(var(--theme-accent-rgb)/0.18)]">
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
                            className={`group relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.14)] bg-white/[0.014] py-[18px] text-left transition duration-200 ease-out hover:bg-white/[0.022] hover:border-[rgb(var(--theme-accent-rgb)/0.18)] ${
                              dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id
                                ? 'bg-white/[0.03]'
                                : ''
                            } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                              roadmapArrivalCueActive ? 'goal-current-arrival' : ''
                            } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
                              taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                            }`}
                            style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                          >
                            <span aria-hidden="true" className="relative z-[1] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
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
                    <p className="pb-2 pl-[36px] text-[11px] uppercase tracking-[0.16em] text-mist/56">Next · {roadmapSections.upcoming.length}</p>
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
                          className={`group relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
                            isCompressed ? 'gap-y-0 py-[5px]' : 'gap-y-1 py-[10px]'
                          } ${
                            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
                          } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                            taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
                          } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
                          style={{
                            ...visualState.rowStyle,
                            opacity:
                              visualState.opacity *
                              (roadmapArrivalCueActive ? 0.78 : 1) *
                              (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                          }}
                        >
                          <span aria-hidden="true" className="relative z-[1] justify-self-center mt-[2px] flex h-4 w-4 items-center justify-center">
                            <span className={`h-1.5 w-1.5 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
                          </span>
                          <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-[6px]' : 'pb-[10px]'}`}>
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
                  setOutcomeMilestoneViewByGoal((current) => ({
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
                onAddMilestone: () => addSelectedLifeGoalMilestone(),
                onToggleCompleted: () => setRoadmapCompletedOpen((current) => !current),
              }}
              uiState={{
                roadmapHighPriorityFocus,
                completedOpen: roadmapCompletedOpen,
                showHighPriorityFocus: roadmapHasHighPriorityTasks,
                progressView: isOutcomeGoal && milestonesEnabled ? outcomeMilestoneView : 'tasks',
                showMilestonesView: isOutcomeGoal && milestonesEnabled,
                organizationMode: roadmapOrganizationMode,
                showTagGrouping: roadmapHasTaggedTasks,
              }}
            /> : isDirectionalGoal ? (
              <div className="space-y-4">
                {relatedGoalsSection}
                {directionalActivitySection}
                {directionalReflectionsSection}
              </div>
            ) : isSystemGoal && relatedGoals.length > 0 ? (
              linkedGoalsSection
            ) : null}
          </div>

          {isSystemGoal ? systemSupportingHabitsSection : null}

          {isOutcomeGoal ? <GoalProgressTimelineChart
            tasks={selectedLifeGoal.tasks}
            goalStartDate={selectedLifeGoal.startDate}
            goalCreatedAt={selectedLifeGoal.createdAt}
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
        subtitle={
          lifeGoalComposerMode === 'edit'
            ? 'Edit life goal'
            : lifeGoalCreateStep === 'define'
              ? selectedDraftGoalType === 'directional'
                ? 'Step 1 · Define direction'
                : 'Step 1 · Define goal'
              : selectedDraftGoalType === 'directional'
                ? 'Step 2 · Active paths'
                : 'Step 2 · Define path'
        }
        title={
          lifeGoalComposerMode === 'edit'
            ? 'Refine the goal without losing momentum'
            : lifeGoalCreateStep === 'define'
              ? selectedDraftGoalType === 'directional'
                ? 'Define your direction'
                : 'Define a goal worth pursuing'
              : selectedDraftGoalType === 'directional'
                ? 'Define your direction'
                : 'Define your path'
        }
        bodyRef={lifeGoalComposerBodyRef}
        panelClassName="top-[5vh] max-h-[90vh]"
        bodyClassName="max-h-[calc(90vh-92px)]"
      >
        {renderLifeGoalComposer()}
      </DetailDrawer>

      <DetailDrawer
        open={goalTypeChangeConfirmationOpen}
        onClose={() => setGoalTypeChangeConfirmationOpen(false)}
        size="md"
        subtitle="Change goal type"
        title="Change goal type?"
      >
        <div className="space-y-5">
          <p className="theme-text-muted text-sm leading-6">
            Changing goal type may affect structure like tasks, milestones, and linked goals. Continue only if you want to reshape this goal.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGoalTypeChangeConfirmationOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setGoalTypeChangeConfirmationOpen(false)
                setGoalTypeChangePickerOpen(true)
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </DetailDrawer>

      <DetailDrawer
        open={goalTypeChangePickerOpen}
        onClose={() => setGoalTypeChangePickerOpen(false)}
        size="md"
        subtitle="Change goal type"
        title="Select goal type"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="theme-label">Goal type</span>
            {renderLifeGoalTypeSelector('edit-change')}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGoalTypeChangePickerOpen(false)}>
              Done
            </Button>
          </div>
        </div>
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

      <LifeGoalTaskPeek
        data={{
          task: selectedTaskPeek,
          activeSubtasks: selectedTaskPeekActiveSubtasks,
          completedSubtasks: selectedTaskPeekCompletedSubtasks,
          datePanelPosition: taskPeekDatePanelPosition,
          dateViewMonth: taskPeekDateViewMonth,
          priorityOptions: taskPriorityOptions,
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
