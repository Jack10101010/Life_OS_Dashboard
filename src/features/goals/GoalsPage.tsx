import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  LifeGoalTaskPriority,
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
type GoalTrajectoryTimeframe = '7d' | '14d' | '30d' | '60d' | '3m' | '6m' | '1y'

type LifeGoalDraftTask = {
  id: string
  text: string
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
const GOAL_TRAJECTORY_TIMEFRAME_OPTIONS: Array<{ value: GoalTrajectoryTimeframe; label: string; days: number }> = [
  { value: '7d', label: '7d', days: 7 },
  { value: '14d', label: '14d', days: 14 },
  { value: '30d', label: '30d', days: 30 },
  { value: '60d', label: '60d', days: 60 },
  { value: '3m', label: '3m', days: 90 },
  { value: '6m', label: '6m', days: 180 },
  { value: '1y', label: '1y', days: 365 },
] as const

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

function getPriorityScore(task: Pick<LifeGoalTask, 'priority'> | LifeGoalTaskPriority) {
  const priority = typeof task === 'string' ? task : task.priority
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

function getPriorityAwareNextTask(tasks: LifeGoalTask[]) {
  const incompleteTasks = tasks.filter((task) => !task.completed)
  if (incompleteTasks.length === 0) return null

  const nearTermTasks = incompleteTasks.slice(0, 3)
  const highPriorityCandidate = nearTermTasks.find((task) => getPriorityScore(task) === 3)

  return highPriorityCandidate ?? incompleteTasks[0] ?? null
}

function getLifeGoalTaskPriorityMeta(priority: LifeGoalTaskPriority) {
  switch (priority) {
    case 'high':
      return {
        label: 'High',
        chipClassName:
          'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.82)]',
      }
    case 'medium':
      return {
        label: 'Medium',
        chipClassName:
          'border-white/[0.07] bg-white/[0.04] text-white/60',
      }
    case 'low':
      return {
        label: 'Low',
        chipClassName:
          'border-white/[0.06] bg-white/[0.025] text-white/52',
      }
    default:
      return null
  }
}

function getRoadmapTaskVisualState(
  task: LifeGoalTask,
  section: 'completed' | 'current' | 'upcoming',
  focusHighPriorityOnly: boolean,
) {
  const priorityScore = getPriorityScore(task)
  const isHighPriority = priorityScore === 3
  const baseOpacity =
    section === 'completed'
      ? 0.56
      : section === 'current'
        ? priorityScore === 3
          ? 1
          : priorityScore <= 1
            ? 0.92
            : 0.97
        : priorityScore === 3
          ? 0.94
          : priorityScore === 2
            ? 0.84
            : priorityScore === 1
              ? 0.78
              : 0.72

  return {
    titleClassName:
      section === 'completed'
        ? 'text-white/54'
        : section === 'current'
          ? priorityScore === 3
            ? 'text-white'
            : 'text-white/96'
          : priorityScore === 3
            ? 'text-white/92'
            : priorityScore === 2
              ? 'text-white/82'
              : priorityScore === 1
                ? 'text-white/76'
                : 'text-white/68',
    metaClassName:
      section === 'completed'
        ? 'text-mist/50'
        : priorityScore === 3
          ? 'text-mist/70'
          : priorityScore === 2
            ? 'text-mist/64'
            : 'text-mist/58',
    markerClassName:
      section === 'completed'
        ? 'text-white/38'
        : section === 'current'
          ? priorityScore === 3
            ? 'text-[rgb(var(--theme-accent-rgb)/0.98)]'
            : 'text-[rgb(var(--theme-accent-rgb)/0.9)]'
          : priorityScore === 3
            ? 'text-white/62'
            : 'text-white/48',
    opacity: focusHighPriorityOnly && !isHighPriority ? (section === 'completed' ? 0.4 : 0.46) : baseOpacity,
    rowStyle:
      priorityScore === 3 && section !== 'completed'
        ? {
            boxShadow:
              section === 'current'
                ? 'inset 0 1px 0 rgb(255 255 255 / 0.02), 0 0 0 1px rgb(var(--theme-accent-rgb) / 0.1)'
                : 'inset 0 1px 0 rgb(255 255 255 / 0.01), 0 0 0 1px rgb(var(--theme-accent-rgb) / 0.06)',
          }
        : undefined,
  }
}

function getDaysFromToday(date: string) {
  if (!isValidIsoDate(date)) return null
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()
  const target = new Date(`${date}T00:00:00Z`).getTime()
  return Math.round((target - today) / 86400000)
}

function getRelativeDueMeta(date: string) {
  const diffDays = getDaysFromToday(date)
  if (diffDays === null) return null

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return {
      label: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`,
      compactLabel: `${overdueDays}d overdue`,
      toneClassName: 'text-[rgb(var(--theme-negative-rgb)/0.78)]',
    }
  }

  if (diffDays === 0) {
    return {
      label: 'Due today',
      compactLabel: 'Today',
      toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.76)]',
    }
  }

  if (diffDays === 1) {
    return {
      label: 'Due tomorrow',
      compactLabel: 'Tomorrow',
      toneClassName: 'text-[rgb(var(--theme-warning-rgb)/0.72)]',
    }
  }

  return {
    label: `Due in ${diffDays} days`,
    compactLabel: `${diffDays}d left`,
    toneClassName: diffDays <= 7 ? 'text-[rgb(var(--theme-warning-rgb)/0.68)]' : 'theme-text-muted',
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
      phase: normalizeLifeGoalPhaseValue(task.phase),
      description: task.description.trim(),
      notes: task.notes,
      dueDate: task.dueDate && isValidIsoDate(task.dueDate) ? task.dueDate : null,
      priority: task.priority,
      tags: task.tags.map((tag) => tag.trim()).filter(Boolean),
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

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
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

function getLifeGoalProgressTrajectory(tasks: LifeGoalTask[]) {
  const totalTasks = tasks.length
  if (totalTasks === 0) {
    return {
      totalTasks,
      completedCount: 0,
      points: [] as Array<{ percent: number; completedAt: string; day: string }>,
      dailyPoints: [] as Array<{ day: string; completedCount: number; percent: number }>,
      firstCompletedAt: null as string | null,
      lastCompletedAt: null as string | null,
      firstCompletedDay: null as string | null,
      lastCompletedDay: null as string | null,
      uniqueCompletionDays: 0,
    }
  }

  const completedTasks = [...tasks]
    .filter((task) => task.completed && task.completedAt)
    .sort((left, right) => (left.completedAt ?? '').localeCompare(right.completedAt ?? ''))

  const completedCount = completedTasks.length
  if (completedCount === 0) {
    return {
      totalTasks,
      completedCount,
      points: [] as Array<{ percent: number; completedAt: string; day: string }>,
      dailyPoints: [] as Array<{ day: string; completedCount: number; percent: number }>,
      firstCompletedAt: null as string | null,
      lastCompletedAt: null as string | null,
      firstCompletedDay: null as string | null,
      lastCompletedDay: null as string | null,
      uniqueCompletionDays: 0,
    }
  }

  const points = completedTasks.map((task, index) => {
    const progressCount = index + 1
    const percent = Math.round((progressCount / totalTasks) * 100)
    return {
      percent,
      completedAt: task.completedAt!,
      day: task.completedAt!.slice(0, 10),
    }
  })
  const dailyPoints = Array.from(
    completedTasks.reduce((map, task, index) => {
      const day = task.completedAt!.slice(0, 10)
      map.set(day, {
        day,
        completedCount: index + 1,
        percent: Math.round(((index + 1) / totalTasks) * 100),
      })
      return map
    }, new Map<string, { day: string; completedCount: number; percent: number }>()),
  ).map(([, point]) => point)
  const uniqueCompletionDays = new Set(points.map((point) => point.day)).size

  return {
    totalTasks,
    completedCount,
    points,
    dailyPoints,
    firstCompletedAt: points[0]?.completedAt ?? null,
    lastCompletedAt: points[points.length - 1]?.completedAt ?? null,
    firstCompletedDay: points[0]?.day ?? null,
    lastCompletedDay: points[points.length - 1]?.day ?? null,
    uniqueCompletionDays,
  }
}

function suggestPhase(taskText: string): string | null {
  const normalizedText = taskText.trim().toLowerCase()
  if (!normalizedText) return null

  const keywordGroups: Array<{ phase: string; keywords: string[] }> = [
    { phase: 'Define', keywords: ['define', 'research', 'plan', 'idea', 'vision'] },
    { phase: 'Build', keywords: ['build', 'create', 'implement', 'develop'] },
    { phase: 'Refine', keywords: ['improve', 'refine', 'optimize', 'fix', 'adjust'] },
    { phase: 'Launch', keywords: ['launch', 'publish', 'release', 'ship'] },
  ]

  for (const group of keywordGroups) {
    if (group.keywords.some((keyword) => normalizedText.includes(keyword))) {
      return group.phase
    }
  }

  return null
}

function getLifeGoalTaskPhaseLabel(task: Pick<LifeGoalTask, 'phase'>) {
  return normalizeLifeGoalPhaseValue(task.phase)
}

function getRoadmapPhaseGroups(tasks: LifeGoalTask[]) {
  const groups: Array<{ label: string | null; tasks: LifeGoalTask[] }> = []

  for (const task of tasks) {
    const label = getLifeGoalTaskPhaseLabel(task)
    const previousGroup = groups[groups.length - 1]

    if (previousGroup && previousGroup.label === label) {
      previousGroup.tasks.push(task)
      continue
    }

    groups.push({
      label,
      tasks: [task],
    })
  }

  return groups
}

function getRoadmapTaskSections(tasks: LifeGoalTask[]) {
  const completed = tasks.filter((task) => task.completed)
  const incomplete = tasks.filter((task) => !task.completed)

  return {
    completed,
    current: incomplete[0] ?? null,
    upcoming: incomplete.slice(1),
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

type FloatingPanelPosition = {
  top: number
  left: number
  width: number
}

type TaskPeekFocusField = 'title' | 'phase'

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

const LIFE_GOAL_PHASE_OPTIONS = ['General', 'Define', 'Build', 'Refine', 'Launch'] as const

function normalizeLifeGoalPhaseValue(phase?: string | null) {
  const trimmed = phase?.trim()
  if (!trimmed) return 'General'
  return LIFE_GOAL_PHASE_OPTIONS.includes(trimmed as (typeof LIFE_GOAL_PHASE_OPTIONS)[number]) ? trimmed : 'General'
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
  const [roadmapHighPriorityFocus, setRoadmapHighPriorityFocus] = useState(false)
  const [goalTrajectoryTimeframe, setGoalTrajectoryTimeframe] = useState<GoalTrajectoryTimeframe>('30d')
  const [selectedRoadmapTaskId, setSelectedRoadmapTaskId] = useState<string | null>(null)
  const [selectedTaskPeekId, setSelectedTaskPeekId] = useState<string | null>(null)
  const [pendingTaskPeekFocusField, setPendingTaskPeekFocusField] = useState<TaskPeekFocusField | null>(null)
  const [taskPeekSubtaskDraft, setTaskPeekSubtaskDraft] = useState('')
  const [taskPeekSubtaskEntryOpen, setTaskPeekSubtaskEntryOpen] = useState(false)
  const [draggedSubtaskId, setDraggedSubtaskId] = useState<string | null>(null)
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null)
  const [pendingSubtaskFocusId, setPendingSubtaskFocusId] = useState<string | null>(null)
  const [taskPeekNotesOpen, setTaskPeekNotesOpen] = useState(false)
  const [taskPeekCompletedSubtasksOpen, setTaskPeekCompletedSubtasksOpen] = useState(false)
  const [taskPeekDatePickerOpen, setTaskPeekDatePickerOpen] = useState(false)
  const [taskPeekDateViewMonth, setTaskPeekDateViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate()))
  const [taskPeekDatePanelPosition, setTaskPeekDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
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
  const taskDraftInputRef = useRef<HTMLInputElement | null>(null)
  const taskPeekPanelRef = useRef<HTMLDivElement | null>(null)
  const taskPeekTitleRef = useRef<HTMLTextAreaElement | null>(null)
  const taskPeekPhaseFieldRef = useRef<HTMLSelectElement | null>(null)
  const taskPeekTriggerRef = useRef<HTMLElement | null>(null)
  const taskPeekDateFieldRef = useRef<HTMLDivElement | null>(null)
  const taskPeekDatePanelRef = useRef<HTMLDivElement | null>(null)
  const taskPeekSubtaskDraftRef = useRef<HTMLInputElement | null>(null)
  const taskPeekSubtaskInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const completionUndoTimeoutRef = useRef<number | null>(null)
  const completionPulseTimeoutRef = useRef<number | null>(null)
  const taskPeekDeleteDialogRef = useRef<HTMLDivElement | null>(null)
  const taskPeekDeleteTriggerRef = useRef<HTMLElement | null>(null)

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
      setSelectedTaskPeekId(null)
      setTaskPeekSubtaskDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
      return
    }

    if (!selectedLifeGoal.tasks.some((task) => task.id === selectedTaskPeekId)) {
      setSelectedTaskPeekId(null)
      setTaskPeekSubtaskDraft('')
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
    }
  }, [selectedLifeGoal, selectedTaskPeekId])

  useEffect(() => {
    if (!selectedTaskPeek) {
      setTaskPeekDatePickerOpen(false)
      setTaskPeekNotesOpen(false)
      setTaskPeekSubtaskEntryOpen(false)
      setTaskPeekDeleteConfirmation(null)
      setPendingTaskPeekFocusField(null)
      const previousTrigger = taskPeekTriggerRef.current
      if (previousTrigger) {
        window.requestAnimationFrame(() => previousTrigger.focus())
      }
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (pendingTaskPeekFocusField === 'phase') {
        taskPeekPhaseFieldRef.current?.focus()
        setPendingTaskPeekFocusField(null)
        return
      }

      taskPeekTitleRef.current?.focus()
      taskPeekTitleRef.current?.setSelectionRange(
        taskPeekTitleRef.current.value.length,
        taskPeekTitleRef.current.value.length,
      )
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pendingTaskPeekFocusField, selectedTaskPeek?.id])

  useEffect(() => {
    if (!selectedTaskPeek) return
    setTaskPeekNotesOpen(Boolean(selectedTaskPeek.notes.trim()))
    setTaskPeekCompletedSubtasksOpen(false)
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
    if (!taskDraftEntryOpen) return
    const frame = window.requestAnimationFrame(() => {
      taskDraftInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [taskDraftEntryOpen])

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
  const taskPriorityOptions = useMemo(() => getTaskPriorityOptions(), [])

  const handleSaveLifeGoal = () => {
    const nextTaskText = lifeGoalDraft.tasks[0]?.text.trim() ?? ''
    if (
      !lifeGoalDraft.title.trim() ||
      !lifeGoalDraft.whyItMatters.trim() ||
      (lifeGoalComposerMode === 'edit' ? !lifeGoalDraft.minimumVersion.trim() || draftTasks.length === 0 : !nextTaskText)
    ) {
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

    const nextGoal = createLifeGoalFromDraft({
      ...lifeGoalDraft,
      minimumVersion: lifeGoalDraft.minimumVersion.trim() || nextTaskText || lifeGoalDraft.title.trim(),
      tasks: [
        {
          ...(lifeGoalDraft.tasks[0] ?? createLifeGoalDraftTask()),
          text: nextTaskText,
        },
      ],
    })
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
          phase: suggestPhase(trimmed) ?? undefined,
          description: '',
          notes: '',
          dueDate: null,
          priority: 'none',
          tags: [],
          subtasks: [],
          completed: false,
          completedAt: null,
        },
      ],
      updatedAt: new Date().toISOString(),
    }))
    setPlannedTaskDraft('')
    setTaskDraftEntryOpen(false)
  }

  const openTaskDraftEntry = () => {
    setTaskDraftEntryOpen(true)
  }

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
    if (sourceTask && !sourceTask.completed) {
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

  const updateLifeGoalTask = (goalId: string, taskId: string, updater: (task: LifeGoalTask) => LifeGoalTask) => {
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      tasks: goal.tasks.map((task) => (task.id === taskId ? updater(task) : task)),
      updatedAt: new Date().toISOString(),
    }))
  }

  const openTaskPeek = (taskId: string, trigger?: HTMLElement | null) => {
    taskPeekTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setSelectedTaskPeekId(taskId)
    setSelectedRoadmapTaskId(taskId)
    setTaskPeekSubtaskDraft('')
  }

  const closeTaskPeek = () => {
    setSelectedTaskPeekId(null)
    setTaskPeekSubtaskDraft('')
  }

  const updateSelectedTaskPeek = (updater: (task: LifeGoalTask) => LifeGoalTask) => {
    if (!selectedLifeGoal || !selectedTaskPeekId) return
    updateLifeGoalTask(selectedLifeGoal.id, selectedTaskPeekId, updater)
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
    const previousTrigger = taskPeekDeleteTriggerRef.current
    if (previousTrigger) {
      window.requestAnimationFrame(() => previousTrigger.focus())
    }
  }

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
      openTaskDraftEntry()
      return
    }
    if (event.key !== 'Enter') return
    event.preventDefault()
    openTaskPeek(taskId, event.currentTarget)
  }

  const handleTaskPeekKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (taskPeekDeleteConfirmation) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeTaskPeekDeleteConfirmation()
      }
      return
    }

    if (event.key === 'Escape') {
      if (taskPeekDatePickerOpen) {
        event.preventDefault()
        setTaskPeekDatePickerOpen(false)
        setTaskPeekDatePanelPosition(null)
        return
      }
      event.preventDefault()
      closeTaskPeek()
      return
    }

    if (event.key === 'Tab' && taskPeekPanelRef.current) {
      const focusable = getFocusableElements(taskPeekPanelRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!active || active === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }

  }

  const handleTaskPeekDeleteDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeTaskPeekDeleteConfirmation()
      return
    }

    if (event.key === 'Tab' && taskPeekDeleteDialogRef.current) {
      const focusable = getFocusableElements(taskPeekDeleteDialogRef.current)
      if (focusable.length === 0) return
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === -1 || currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1
      event.preventDefault()
      focusable[nextIndex]?.focus()
    }
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
      {(() => {
        const isCreateMode = lifeGoalComposerMode === 'create'
        return (
          <>
      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="theme-label">Title</span>
          <input
            ref={lifeGoalTitleInputRef}
            value={lifeGoalDraft.title}
            onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Build Life OS v1"
            spellCheck={true}
            className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
          />
        </label>
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
              spellCheck={true}
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
          {!isCreateMode ? (
            <label className="space-y-2">
              <span className="theme-label">Minimum version</span>
              <input
                value={lifeGoalDraft.minimumVersion}
                onChange={(event) => setLifeGoalDraft((current) => ({ ...current, minimumVersion: event.target.value }))}
                placeholder="Write the first rough outline"
                spellCheck={true}
                className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              />
            </label>
          ) : null}
        </div>
        <div className={`grid gap-4 ${isCreateMode ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
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
        {!isCreateMode ? (
          <>
            <label className="space-y-2">
              <span className="theme-label">If-Then plan</span>
              <textarea
                value={lifeGoalDraft.ifThenPlan}
                onChange={(event) => setLifeGoalDraft((current) => ({ ...current, ifThenPlan: event.target.value }))}
                placeholder="If I stall, then I..."
                spellCheck={true}
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
                          spellCheck={true}
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
          </>
        ) : null}
      </div>
          </>
        )
      })()}

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
            const goalSubtaskProgress = getGoalSubtaskProgress(goal.tasks)
            const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, lifeGoalCategories) : 'neutral'
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
                        <p className={`text-[12px] leading-5 ${goalDueMeta?.toneClassName ?? urgencyMeta?.toneClassName ?? 'theme-text-muted'}`}>
                          {goalDueMeta ? `${goalDueMeta.label} · ${formatDate(goal.targetDate)}` : secondaryContext}
                        </p>
                      ) : null}
                      <p className="theme-text-faint text-[12px] leading-5">{progressSummary}</p>
                      {goalSubtaskProgress.total > 0 ? (
                        <p className="theme-text-faint text-[11px] leading-5">
                          {goalSubtaskProgress.completed}/{goalSubtaskProgress.total} subtasks complete
                        </p>
                      ) : null}
                      {flowState ? <p className={`text-[11px] leading-5 ${flowState.toneClassName}`}>{flowState.label}</p> : null}
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
    const compactWhyText = anchorText.length > 96 ? `${anchorText.slice(0, 93).trimEnd()}…` : anchorText
    const progressWidth = Math.max(selectedLifeGoalProgress.percent, selectedLifeGoal.status === 'complete' ? 100 : 6)
    const isRoadmapMode = lifeGoalDetailTab === 'tasks' || lifeGoalDetailTab === 'roadmap'
    const compactDateRange = `${formatDate(selectedLifeGoal.startDate)} → ${selectedLifeGoal.targetDate ? formatDate(selectedLifeGoal.targetDate) : 'No target'}`
    const roadmapSections = getRoadmapTaskSections(selectedLifeGoal.tasks)
    const roadmapRemainingCount = roadmapSections.current ? roadmapSections.upcoming.length + 1 : 0
    const currentPhaseLabel = roadmapSections.current ? getLifeGoalTaskPhaseLabel(roadmapSections.current) : null
    const progressTrajectory = getLifeGoalProgressTrajectory(selectedLifeGoal.tasks)
    const goalHeaderChipClassName =
      'inline-flex h-6 shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] uppercase tracking-[0.14em] leading-none border-white/[0.06]'
    const renderRoadmapPhaseGroups = (
      tasks: LifeGoalTask[],
      keyPrefix: string,
      renderTask: (task: LifeGoalTask, meta: { groupIndex: number; taskIndex: number }) => any,
    ) =>
      getRoadmapPhaseGroups(tasks).map((group, groupIndex) => (
        <div key={`${keyPrefix}-${groupIndex}-${group.label ?? 'default'}`} className={groupIndex > 0 ? 'pt-4' : ''}>
          <div className="flex items-center justify-between gap-3 pb-2 pl-[36px]">
            <button
              type="button"
              onClick={(event) => {
                const targetTask = group.tasks[0]
                if (!targetTask) return
                setPendingTaskPeekFocusField('phase')
                setSelectedRoadmapTaskId(targetTask.id)
                openTaskPeek(targetTask.id, event.currentTarget)
              }}
              title="Phases are assigned per task"
              aria-label={`Open ${group.label ?? 'General'} phase`}
              className={`cursor-pointer text-[10px] uppercase tracking-[0.18em] transition hover:text-[rgb(var(--theme-accent-rgb)/0.72)] focus-visible:text-[rgb(var(--theme-accent-rgb)/0.72)] ${
                group.label === currentPhaseLabel ? 'text-mist/70' : 'text-mist/52'
              }`}
            >
              {group.label ?? 'General'}
            </button>
            <p className="text-[10px] tracking-[0.08em] text-mist/40">
              {group.tasks.filter((task) => task.completed).length}/{group.tasks.length}
            </p>
          </div>
          {group.tasks.map((task, taskIndex) => renderTask(task, { groupIndex, taskIndex }))}
        </div>
      ))
    const renderPriorityChip = (task: LifeGoalTask) => {
      const priorityMeta = getLifeGoalTaskPriorityMeta(task.priority)
      if (!priorityMeta) return null

      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] leading-none ${priorityMeta.chipClassName}`}>
          {priorityMeta.label}
        </span>
      )
    }
    const goalWorkspaceRail = (
      <div className="rounded-[18px] bg-white/[0.018] px-3 py-2">
        <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(180px,0.8fr)_auto]">
          <p className="text-sm font-medium text-white">
            {selectedLifeGoalProgress.completedTasks}/{selectedLifeGoalProgress.totalTasks} tasks
            <span className="px-1.5 text-white/28">•</span>
            <span className="text-mist">{selectedLifeGoalProgress.percent}%</span>
          </p>
          <div className="px-1 lg:px-2">
            <div className="h-2 rounded-full bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressWidth}%`,
                  background: 'linear-gradient(90deg, rgb(var(--theme-accent-rgb) / 0.82) 0%, rgb(var(--theme-accent-rgb) / 0.58) 100%)',
                  boxShadow: '0 0 16px rgb(var(--theme-accent-rgb) / 0.16)',
                }}
              />
            </div>
          </div>
          <p className="text-right text-sm text-white/68">{compactDateRange}</p>
        </div>
      </div>
    )
    const trajectoryChartContent = (() => {
      const chartWidth = 100
      const chartHeight = 100
      const chartPadding = { top: 8, right: 6, bottom: 12, left: 2 }
      const innerWidth = chartWidth - chartPadding.left - chartPadding.right
      const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom
      const baselineY = chartPadding.top + innerHeight
      const guideY = chartPadding.top
      const timeframeDays =
        GOAL_TRAJECTORY_TIMEFRAME_OPTIONS.find((option) => option.value === goalTrajectoryTimeframe)?.days ?? 30
      const chartEndDate = getTodayIsoDate()
      const chartStartDate = shiftIsoDate(chartEndDate, -(timeframeDays - 1))
      const timeSpanDays = Math.max(
        0,
        Math.round((new Date(`${chartEndDate}T00:00:00Z`).getTime() - new Date(`${chartStartDate}T00:00:00Z`).getTime()) / 86400000),
      )
      const getXForDay = (day: string) => {
        if (!isValidIsoDate(day)) return chartPadding.left
        if (timeSpanDays === 0) return chartPadding.left + innerWidth * 0.08
        const offset = Math.round(
          (new Date(`${day}T00:00:00Z`).getTime() - new Date(`${chartStartDate}T00:00:00Z`).getTime()) / 86400000,
        )
        return chartPadding.left + (Math.max(0, Math.min(timeSpanDays, offset)) / timeSpanDays) * innerWidth
      }
      const getYForPercent = (percent: number) => chartPadding.top + (1 - percent / 100) * innerHeight
      const completedBeforeRangeCount = progressTrajectory.points.filter((point) => point.day < chartStartDate).length
      const baselinePercent = Math.round((completedBeforeRangeCount / Math.max(progressTrajectory.totalTasks, 1)) * 100)
      const visibleProgressPoints = progressTrajectory.dailyPoints
        .filter((point) => point.day >= chartStartDate && point.day <= chartEndDate)
        .map((point) => ({
          ...point,
          svgX: getXForDay(point.day),
          svgY: getYForPercent(point.percent),
        }))
      const visibleCompletionDays = new Set(visibleProgressPoints.map((point) => point.day)).size
      const hasMeaningfulHistory = progressTrajectory.completedCount > 0
      const sparseProgress = visibleCompletionDays < 2
      const ladderTasks = selectedLifeGoal.tasks
      const ladderNodeCount = Math.max(ladderTasks.length, 1)
      const chartPoints = visibleProgressPoints.map((point) => ({
        ...point,
      }))
      const linePath = chartPoints.length > 0
        ? (() => {
            const segments = [`M ${chartPadding.left.toFixed(2)} ${getYForPercent(baselinePercent).toFixed(2)}`]
            let currentPercent = baselinePercent
            for (const point of chartPoints) {
              const currentY = getYForPercent(currentPercent)
              segments.push(`L ${point.svgX.toFixed(2)} ${currentY.toFixed(2)}`)
              segments.push(`L ${point.svgX.toFixed(2)} ${point.svgY.toFixed(2)}`)
              currentPercent = point.percent
            }
            segments.push(`L ${(chartWidth - chartPadding.right).toFixed(2)} ${getYForPercent(currentPercent).toFixed(2)}`)
            return segments.join(' ')
          })()
        : `M ${chartPadding.left.toFixed(2)} ${getYForPercent(baselinePercent).toFixed(2)} L ${(chartWidth - chartPadding.right).toFixed(2)} ${getYForPercent(baselinePercent).toFixed(2)}`
      const recentProgressCount = progressTrajectory.points.filter((point) => {
        const pointDate = new Date(`${point.day}T00:00:00Z`).getTime()
        const endDate = new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()
        return Math.round((endDate - pointDate) / 86400000) <= 4
      }).length
      const progressSpanDays =
        progressTrajectory.firstCompletedDay && progressTrajectory.lastCompletedDay
          ? Math.max(
              0,
              Math.round(
                (new Date(`${progressTrajectory.lastCompletedDay}T00:00:00Z`).getTime() -
                  new Date(`${progressTrajectory.firstCompletedDay}T00:00:00Z`).getTime()) /
                  86400000,
              ),
            )
          : 0
      const lastProgressDaysAgo = progressTrajectory.lastCompletedAt
        ? Math.max(0, Math.round((Date.now() - new Date(progressTrajectory.lastCompletedAt).getTime()) / 86400000))
        : null
      const progressContext = progressTrajectory.lastCompletedAt
        ? (() => {
            if ((lastProgressDaysAgo ?? 0) >= 4) {
              return {
                text: `No progress in ${lastProgressDaysAgo} days`,
                className: 'text-[rgb(var(--theme-warning-rgb)/0.74)]',
              }
            }
            if (recentProgressCount >= 2) {
              return {
                text: `${recentProgressCount} tasks completed in last 5 days`,
                className: 'text-mist/46',
              }
            }
            if (progressTrajectory.completedCount >= 2 && progressSpanDays > 0) {
              return {
                text: `${progressTrajectory.completedCount} tasks completed over ${progressSpanDays + 1} days`,
                className: 'text-mist/46',
              }
            }
            if (lastProgressDaysAgo === 0) {
              return {
                text: 'Last progress today',
                className: 'text-mist/46',
              }
            }
            if (lastProgressDaysAgo === 1) {
              return {
                text: 'Last progress 1 day ago',
                className: 'text-mist/46',
              }
            }
            return {
              text: `Last progress ${lastProgressDaysAgo} days ago`,
              className: 'text-mist/46',
            }
          })()
        : null
      const chartEndLabel = chartEndDate === getTodayIsoDate() ? 'Today' : formatTaskCompletedDate(chartEndDate)

      return (
        <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-mist/62">Goal progress trajectory</p>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {GOAL_TRAJECTORY_TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGoalTrajectoryTimeframe(option.value)}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] transition ${
                    goalTrajectoryTimeframe === option.value
                      ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                      : 'border-white/[0.05] bg-white/[0.02] text-mist/48 hover:border-white/[0.08] hover:text-mist/62'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 min-h-[220px] flex-1">
            <div className="grid h-full min-h-[220px] grid-cols-[44px_minmax(0,1fr)] gap-4">
              <div className="relative min-h-0">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[8px] left-[14px] top-[8px] w-px bg-[linear-gradient(180deg,rgb(var(--theme-border-subtle-rgb)/0.08)_0%,rgb(var(--theme-border-subtle-rgb)/0.18)_18%,rgb(var(--theme-border-subtle-rgb)/0.18)_82%,rgb(var(--theme-border-subtle-rgb)/0.08)_100%)]"
                />
                <div className="relative flex h-full min-h-[220px] flex-col justify-between py-2">
                  {Array.from({ length: ladderNodeCount }, (_, index) => {
                    const task = ladderTasks[index]
                    const isCompleted = task?.completed ?? false
                    const isCurrent = !isCompleted && task?.id === roadmapSections.current?.id
                    return (
                      <span key={task?.id ?? `trajectory-ladder-${index}`} className="flex justify-start pl-[15px]">
                        <span
                          className={`rounded-[1px] ${
                            isCompleted
                              ? 'bg-[rgb(var(--theme-accent-rgb)/0.82)]'
                              : isCurrent
                                ? 'bg-[rgb(var(--theme-text-primary-rgb)/0.72)]'
                                : 'bg-[rgb(var(--theme-border-subtle-rgb)/0.34)]'
                          } ${isCurrent ? 'h-[2px] w-[10px]' : 'h-[1.5px] w-[8px]'}`}
                        />
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <div className="flex items-start justify-between gap-3 text-[10px] uppercase tracking-[0.16em] text-mist/46">
                  <span>{chartStartDate ? formatTaskCompletedDate(chartStartDate) : 'Start'}</span>
                  <span>100%</span>
                </div>

                <div className="mt-3 min-h-0 flex-1">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full min-h-[188px] w-full" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="goal-trajectory-line" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgb(var(--theme-accent-rgb) / 0.34)" />
                        <stop offset="100%" stopColor="rgb(var(--theme-accent-rgb) / 0.6)" />
                      </linearGradient>
                    </defs>
                    <line
                      x1={chartPadding.left}
                      y1={guideY}
                      x2={chartWidth - chartPadding.right}
                      y2={guideY}
                      stroke="rgb(var(--theme-border-subtle-rgb) / 0.16)"
                      strokeWidth="0.7"
                      strokeDasharray="2 3"
                    />
                    <line
                      x1={chartPadding.left}
                      y1={baselineY}
                      x2={chartWidth - chartPadding.right}
                      y2={baselineY}
                      stroke="rgb(var(--theme-border-subtle-rgb) / 0.2)"
                      strokeWidth="0.9"
                    />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="url(#goal-trajectory-line)"
                      strokeWidth="1.15"
                      strokeLinecap="round"
                      strokeLinejoin="miter"
                    />
                    {chartPoints.length > 0
                      ? chartPoints.map((point) => (
                          <circle
                            key={`${point.day}-${point.percent}`}
                            cx={point.svgX}
                            cy={point.svgY}
                            r="1.05"
                            fill="rgb(var(--theme-accent-rgb) / 0.78)"
                          />
                        ))
                      : null}
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {hasMeaningfulHistory ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-mist/46">
              <span>{formatTaskCompletedDate(chartStartDate)}</span>
              <span>{chartEndLabel}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-mist">Progress will appear as you complete tasks</p>
          )}
          {visibleProgressPoints.length === 0 && hasMeaningfulHistory ? (
            <p className="mt-2 text-sm text-mist">No progress in this period</p>
          ) : null}
          {progressContext ? <p className={`mt-2 text-[11px] ${progressContext.className}`}>{progressContext.text}</p> : null}
        </div>
      )
    })()

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
              selectedLifeGoalProgress.plannedTasks.map((task, index) => {
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

            {taskDraftEntryOpen ? (
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3 py-2">
                <input
                  ref={taskDraftInputRef}
                  value={plannedTaskDraft}
                  onChange={(event) => setPlannedTaskDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.shiftKey) {
                      event.preventDefault()
                      addPlannedTask()
                    }
                  }}
                  placeholder="Add a task"
                  spellCheck={true}
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
            openTaskDraftEntry()
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Roadmap</p>
            <p className="mt-1 text-sm text-mist">A clean view of the path from the current task to the goal.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoadmapHighPriorityFocus((current) => !current)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                roadmapHighPriorityFocus
                  ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/54 hover:border-white/[0.1] hover:text-white/74'
              }`}
            >
              Focus: High priority
            </button>
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
                  <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/52">
                    Completed ({roadmapSections.completed.length})
                  </p>
                  {renderRoadmapPhaseGroups(roadmapSections.completed, 'completed', (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const visualState = getRoadmapTaskVisualState(task, 'completed', roadmapHighPriorityFocus)
                    return (
                      <div
                        key={task.id}
                        className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-white/[0.035] py-2.5 last:border-b-0 ${
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
                          className="min-w-0 text-left"
                        >
                          <p className={`text-[15px] ${visualState.titleClassName}`}>{task.text}</p>
                          <div className="mt-1 flex min-h-[18px] items-center justify-between gap-3">
                            <div className="min-w-0 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={`text-[12px] ${task.dueDate ? dueMeta?.toneClassName ?? visualState.metaClassName : visualState.metaClassName}`}>
                                  {task.dueDate ? (dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)) : 'Completed'}
                                </p>
                                {renderPriorityChip(task)}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center justify-end gap-2">
                              {renderSubtaskProgressDots(task.subtasks, 'completed')}
                              {task.completedAt ? (
                                <span className="text-[12px] text-mist/56">{formatDate(task.completedAt.slice(0, 10))}</span>
                              ) : null}
                            </div>
                          </div>
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
                  })}
                </section>
              ) : null}

              {roadmapSections.current ? (
                <section>
                  <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Current</p>
                  {renderRoadmapPhaseGroups([roadmapSections.current], 'current', (task) => {
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
                          className={`grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.04] py-[18px] text-left transition hover:border-white/[0.07] ${
                            isSelected ? 'bg-white/[0.018]' : 'bg-white/[0.012]'
                          } ${
                            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                          }`}
                          style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                        >
                          <span aria-hidden="true" className={`pt-0.5 text-[18px] leading-none ${visualState.markerClassName}`}>
                            ◎
                          </span>
                          <div className="min-w-0">
                            <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                            <div className="mt-1 flex min-h-[18px] items-center justify-between gap-3">
                              <div className="min-w-0 text-left">
                                <div className="flex flex-wrap items-center gap-2">
                                  {task.dueDate ? (
                                    <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                      {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                    </p>
                                  ) : null}
                                  {renderPriorityChip(task)}
                                </div>
                              </div>
                              <div className="flex shrink-0 justify-end">
                                {renderSubtaskProgressDots(task.subtasks)}
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </section>
              ) : null}

              {roadmapSections.upcoming.length > 0 ? (
                <section>
                  <p className="pb-3 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Upcoming</p>
                  {renderRoadmapPhaseGroups(roadmapSections.upcoming, 'upcoming', (task) => {
                    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                    const isSelected = selectedRoadmapTaskId === task.id
                    const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
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
                        className={`grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.035] py-3 text-left transition last:border-b-0 hover:border-white/[0.07] ${
                          isSelected ? 'bg-white/[0.012]' : ''
                        } ${
                          dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                        }`}
                        style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                      >
                        <span aria-hidden="true" className={`pt-0.5 text-[16px] leading-none ${visualState.markerClassName}`}>
                          ○
                        </span>
                        <div className="min-w-0">
                          <p className={`text-[15px] ${visualState.titleClassName}`}>{task.text}</p>
                          <div className="mt-1 flex min-h-[18px] items-center justify-between gap-3">
                            <div className="min-w-0 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                {task.dueDate ? (
                                  <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                    {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                  </p>
                                ) : null}
                                {renderPriorityChip(task)}
                              </div>
                            </div>
                            <div className="flex shrink-0 justify-end">
                              {renderSubtaskProgressDots(task.subtasks)}
                            </div>
                          </div>
                        </div>
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
              {taskDraftEntryOpen ? (
                <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3">
                  <span aria-hidden="true" className="text-[16px] leading-none text-white/44">
                    ○
                  </span>
                  <input
                    ref={taskDraftInputRef}
                    value={plannedTaskDraft}
                    onChange={(event) => setPlannedTaskDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && event.shiftKey) {
                        event.preventDefault()
                        addPlannedTask()
                      }
                    }}
                    placeholder="Add a task"
                    spellCheck={true}
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
        <div className="w-full space-y-4">
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

          {goalWorkspaceRail}

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
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onChangeGoalsView('life-overview')}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to Life Goals
          </button>
          <Button
            variant="ghost"
            onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
          >
            Edit Goal
          </Button>
        </div>

        {goalWorkspaceRail}

        <div className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,1fr)]">
            <div className="space-y-4 self-start xl:flex xl:h-[78vh] xl:flex-col">
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 transition-[transform,border-color,box-shadow,background-color] duration-150 ease-out hover:-translate-y-[1px] hover:border-white/[0.11] hover:bg-white/[0.034] hover:shadow-[0_16px_30px_rgba(0,0,0,0.16)]">
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="theme-page-title min-w-0 flex-1 pr-2">{selectedLifeGoal.title}</h3>
                    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                      {selectedGoalCategory ? (
                        <span
                          className={`${goalHeaderChipClassName} gap-1.5 text-white/70`}
                          style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                          {selectedGoalCategory}
                        </span>
                      ) : null}
                      {selectedLifeGoal.isPrimary ? (
                        <span className={`theme-surface-soft theme-text-primary ${goalHeaderChipClassName}`}>
                          Primary Goal
                        </span>
                      ) : null}
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
                  </div>
                  <div className="mt-2 h-px bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.72)_0%,rgb(var(--theme-border-subtle-rgb)/0.22)_82%,transparent_100%)]" />
                </div>

                <div className="mt-2.5 space-y-3.5">
                  {anchorText ? (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-mist/56">Why</p>
                      <p className="text-[13px] font-medium leading-5 text-white/68">{compactWhyText}</p>
                    </div>
                  ) : null}
                  <div className="space-y-1.5 pt-1.5">
                    <p className="text-[11px] text-mist/62">Next task</p>
                    <p className="text-[22px] font-semibold leading-[1.28] text-white">
                      {selectedLifeGoalProgress.nextTask?.text ?? 'No next task currently planned.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedLifeGoalProgress.nextTask ? (
                      <Button
                        variant="soft"
                        onClick={(event) => toggleTaskCompletion(selectedLifeGoal.id, selectedLifeGoalProgress.nextTask!.id, event.currentTarget)}
                        className="px-3 py-1.5 text-[13px] text-[rgb(var(--theme-text-primary-rgb))] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.04),0_8px_18px_rgb(var(--theme-accent-rgb)/0.08)] transition-transform duration-150 ease-out hover:-translate-y-[1px]"
                        style={{
                          borderColor: 'rgb(var(--theme-accent-rgb) / 0.18)',
                          backgroundColor: 'rgb(var(--theme-accent-rgb) / 0.12)',
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor = 'rgb(var(--theme-accent-rgb) / 0.16)'
                          event.currentTarget.style.borderColor = 'rgb(var(--theme-accent-rgb) / 0.24)'
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = 'rgb(var(--theme-accent-rgb) / 0.12)'
                          event.currentTarget.style.borderColor = 'rgb(var(--theme-accent-rgb) / 0.18)'
                        }}
                      >
                        Done — continue
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        onSetLifeGoalAsTodayTask(selectedLifeGoal)
                        setLifeGoalActionFeedback('Focused for today.')
                      }}
                      className="border-white/[0.06] px-3 py-1.5 text-[13px] transition-transform duration-150 ease-out hover:-translate-y-[1px]"
                    >
                      Focus this today
                    </Button>
                  </div>
                  {lifeGoalActionFeedback ? <p className="text-sm text-mist">{lifeGoalActionFeedback}</p> : null}
                </div>
              </div>

              {trajectoryChartContent}
            </div>

            <div className="self-start rounded-[24px] border border-white/[0.045] bg-[rgb(var(--theme-surface-elevated-rgb)/0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] xl:flex xl:h-[78vh] xl:flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Task roadmap</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLifeGoalDetailTab('roadmap')}
                    className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                  >
                    Organize roadmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoadmapHighPriorityFocus((current) => !current)}
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                      roadmapHighPriorityFocus
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/54 hover:border-white/[0.1] hover:text-white/74'
                    }`}
                  >
                    Focus: High priority
                  </button>
                  <button
                    type="button"
                    onClick={() => setLifeGoalDetailTab('roadmap')}
                    className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                  >
                    Open roadmap
                  </button>
                </div>
              </div>

              <div
                className="roadmap-scroll border-t border-white/[0.08] px-4 pt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.shiftKey) {
                    event.preventDefault()
                    openTaskDraftEntry()
                  }
                }}
              >
                {selectedLifeGoalProgress.plannedTasks.length > 0 ? (
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-3 left-[12px] top-3 w-px bg-white/[0.14]"
                      style={{
                        background:
                          roadmapSections.current
                            ? 'linear-gradient(180deg, rgb(var(--theme-border-subtle-rgb)/0.16) 0%, rgb(var(--theme-accent-rgb)/0.26) 42%, rgb(var(--theme-border-subtle-rgb)/0.16) 100%)'
                            : undefined,
                      }}
                    />
                    {roadmapSections.current ? (
                      <div className="pb-4">
                        <p className="pb-2 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Current</p>
                        {renderRoadmapPhaseGroups([roadmapSections.current], 'panel-current', (task) => {
                          const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                          const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
                          return (
                            <div key={task.id}>
                              <p className="pb-2 pl-[36px] text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.74)]">
                                You are here
                              </p>
                              <button
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
                                className={`relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-white/[0.04] bg-white/[0.012] py-[18px] text-left transition ${
                                  dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                                }`}
                                style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                              >
                                <span
                                  aria-hidden="true"
                                  className="relative z-[1] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center"
                                >
                                  <span className={`h-3 w-3 rounded-full ${getPriorityScore(task) === 3 ? 'bg-[rgb(var(--theme-accent-rgb)/0.96)]' : 'bg-[rgb(var(--theme-accent-rgb)/0.9)]'}`} />
                                </span>
                                <div className="min-w-0 pb-4 pt-0.5">
                                  <div className="min-w-0">
                                    <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                                    <div className="mt-1 flex min-h-[18px] items-center justify-between gap-3">
                                      <div className="min-w-0 text-left">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {task.dueDate ? (
                                            <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                              {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                            </p>
                                          ) : null}
                                          {renderPriorityChip(task)}
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 justify-end">
                                        {renderSubtaskProgressDots(task.subtasks)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                    {roadmapSections.upcoming.length > 0 ? (
                      <div>
                        <p className="pb-2 pl-[36px] text-[11px] uppercase tracking-[0.18em] text-mist/56">Upcoming</p>
                        {renderRoadmapPhaseGroups(roadmapSections.upcoming, 'panel-upcoming', (task) => {
                          const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                          const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
                          return (
                            <button
                              key={task.id}
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
                              className={`relative grid w-full grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left transition py-2.5 ${
                                dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                              }`}
                              style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                            >
                              <span
                                aria-hidden="true"
                                className="relative z-[1] justify-self-center mt-[2px] flex h-4 w-4 items-center justify-center"
                              >
                                <span className={`h-2.5 w-2.5 rounded-full border border-[rgb(var(--theme-accent-rgb)/0.8)] bg-[rgb(var(--theme-surface-rgb)/0.92)] ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.12)]' : ''}`} />
                              </span>
                              <div className="min-w-0 border-b border-white/[0.035] pb-2.5">
                                <div className="min-w-0">
                                  <p className={`text-[15px] ${visualState.titleClassName}`}>{task.text}</p>
                                  <div className="mt-1 flex min-h-[18px] items-center justify-between gap-3">
                                    <div className="min-w-0 text-left">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {task.dueDate ? (
                                          <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                            {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                          </p>
                                        ) : null}
                                        {renderPriorityChip(task)}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 justify-end">
                                      {renderSubtaskProgressDots(task.subtasks)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="py-2 text-sm text-mist">
                    {roadmapSections.completed.length > 0 ? 'All roadmap tasks are complete.' : 'No upcoming tasks yet. Add the next concrete step.'}
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
                      ref={taskDraftInputRef}
                      value={plannedTaskDraft}
                      onChange={(event) => setPlannedTaskDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && event.shiftKey) {
                          event.preventDefault()
                          addPlannedTask()
                        }
                      }}
                      placeholder="Add a task"
                      spellCheck={true}
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
                      {selectedLifeGoalProgress.completedTaskItems.length} completed
                      <span className="px-1.5 text-white/26">•</span>
                      {roadmapRemainingCount} remaining
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

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {selectedTaskPeek ? (
              <motion.div
                key={selectedTaskPeek.id}
                className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-black/44 px-4 py-6 backdrop-blur-[3px] sm:px-6 sm:py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onClick={closeTaskPeek}
              >
                <motion.div
                  ref={taskPeekPanelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Task detail"
                  className="theme-popover relative mx-auto w-[min(920px,calc(100vw-2rem))] max-w-[920px] overflow-hidden rounded-[30px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:w-[min(920px,calc(100vw-3rem))]"
                  initial={{ opacity: 0, y: 14, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={handleTaskPeekKeyDown}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-6 py-4">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/62">Task detail</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeTaskPeek}
                      className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
                    >
                      Close
                    </button>
                  </div>

                  <div className="max-h-[min(78vh,760px)] overflow-y-auto overscroll-contain px-6 py-3.5 pb-20">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)]">
                      <div className="space-y-3.5">
                        <div className="max-w-[34rem] space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Task</p>
                          <textarea
                            ref={taskPeekTitleRef}
                            value={selectedTaskPeek.text}
                            onChange={(event) =>
                              updateSelectedTaskPeek((task) => ({
                                ...task,
                                text: event.target.value,
                              }))
                            }
                            rows={2}
                            spellCheck={true}
                            className="w-full resize-none overflow-hidden bg-transparent text-[21px] font-semibold leading-[1.22] text-white outline-none placeholder:text-white/24"
                            placeholder="Task title"
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Description</p>
                          <textarea
                            value={selectedTaskPeek.description}
                            onChange={(event) =>
                              updateSelectedTaskPeek((task) => ({
                                ...task,
                                description: event.target.value,
                              }))
                            }
                            rows={2}
                            spellCheck={true}
                            className="w-full resize-none rounded-[20px] border border-white/[0.05] bg-white/[0.025] px-4 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/24"
                            placeholder="Short context for the task..."
                          />
                        </div>

                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Subtasks</p>
                            <p className="text-[11px] text-mist/42">{selectedTaskPeekCompletedSubtasks.length}/{selectedTaskPeek.subtasks.length}</p>
                          </div>
                          <div className="space-y-1.5">
                            {selectedTaskPeekActiveSubtasks.map((subtask) => (
                              <div
                                key={subtask.id}
                                draggable
                                onDragStart={() => setDraggedSubtaskId(subtask.id)}
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  if (dragOverSubtaskId !== subtask.id) {
                                    setDragOverSubtaskId(subtask.id)
                                  }
                                }}
                                onDrop={(event) => {
                                  event.preventDefault()
                                  if (draggedSubtaskId) {
                                    reorderSelectedTaskPeekSubtasks(draggedSubtaskId, subtask.id)
                                  }
                                  setDraggedSubtaskId(null)
                                  setDragOverSubtaskId(null)
                                }}
                                onDragEnd={() => {
                                  setDraggedSubtaskId(null)
                                  setDragOverSubtaskId(null)
                                }}
                                className={`group grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 transition hover:bg-white/[0.03] focus-within:bg-white/[0.03] focus-within:ring-1 focus-within:ring-white/[0.06] ${
                                  dragOverSubtaskId === subtask.id && draggedSubtaskId && draggedSubtaskId !== subtask.id ? 'bg-white/[0.045]' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={(event) => toggleSelectedTaskPeekSubtaskCompletion(subtask.id, event.currentTarget)}
                                  className={`h-[17px] w-[17px] shrink-0 rounded-full border transition ${
                                    subtask.completed
                                      ? 'border-[rgb(var(--theme-accent-rgb)/0.95)] bg-[rgb(var(--theme-accent-rgb)/0.95)]'
                                      : 'border-white/[0.22] bg-transparent hover:border-white/[0.34]'
                                  }`}
                                  aria-label={subtask.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                                />
                                <input
                                  ref={(element) => {
                                    taskPeekSubtaskInputRefs.current[subtask.id] = element
                                  }}
                                  value={subtask.text}
                                  onChange={(event) =>
                                    updateSelectedTaskPeek((task) => ({
                                      ...task,
                                      subtasks: task.subtasks.map((item) =>
                                        item.id === subtask.id ? { ...item, text: event.target.value } : item,
                                      ),
                                    }))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault()
                                      const currentIndex = selectedTaskPeekActiveSubtasks.findIndex((candidate) => candidate.id === subtask.id)
                                      const nextSubtask =
                                        currentIndex >= 0 ? selectedTaskPeekActiveSubtasks[currentIndex + 1] ?? null : null
                                      if (nextSubtask) {
                                        setPendingSubtaskFocusId(nextSubtask.id)
                                      } else {
                                        setTaskPeekSubtaskEntryOpen(true)
                                      }
                                    }
                                  }}
                                  spellCheck={true}
                                  className="w-full bg-transparent text-sm font-medium leading-5 text-white/88 outline-none placeholder:text-white/24"
                                  placeholder="Subtask"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (subtask.completed) {
                                      toggleSelectedTaskPeekSubtaskCompletion(subtask.id)
                                      return
                                    }
                                    setTaskPeekDeleteConfirmation({
                                      kind: 'subtask',
                                      taskId: selectedTaskPeek.id,
                                      subtaskId: subtask.id,
                                      subtaskText: subtask.text,
                                    })
                                  }}
                                  className={`text-xs uppercase tracking-[0.14em] transition ${
                                    subtask.completed
                                      ? 'text-[rgb(var(--theme-info-rgb)/0.62)] opacity-100 hover:text-[rgb(var(--theme-info-rgb)/0.9)]'
                                      : 'text-[rgb(var(--theme-negative-rgb)/0.46)] opacity-0 hover:text-[rgb(var(--theme-negative-rgb)/0.72)] focus:opacity-100 group-hover:opacity-100'
                                  }`}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {selectedTaskPeekCompletedSubtasks.length > 0 ? (
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setTaskPeekCompletedSubtasksOpen((current) => !current)}
                                  className="flex w-full items-center justify-between gap-3 rounded-[14px] px-2 py-1 text-left text-[11px] uppercase tracking-[0.14em] text-mist/46 transition hover:bg-white/[0.02] hover:text-white/64"
                                >
                                  <span>Completed ({selectedTaskPeekCompletedSubtasks.length})</span>
                                  <span className="text-white/34">{taskPeekCompletedSubtasksOpen ? '−' : '+'}</span>
                                </button>
                                <AnimatePresence initial={false}>
                                  {taskPeekCompletedSubtasksOpen ? (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0, y: -4 }}
                                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                                      exit={{ opacity: 0, height: 0, y: -4 }}
                                      transition={{ duration: 0.16, ease: 'easeOut' }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-1 space-y-0.5">
                                        {selectedTaskPeekCompletedSubtasks.map((subtask) => (
                                          <div
                                            key={subtask.id}
                                            className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[12px] px-2 py-1.5"
                                          >
                                            <span aria-hidden="true" className="text-[12px] leading-none text-white/36">
                                              ✓
                                            </span>
                                            <p className="truncate text-[13px] leading-5 text-white/42">{subtask.text}</p>
                                            <button
                                              type="button"
                                              onClick={(event) => toggleSelectedTaskPeekSubtaskCompletion(subtask.id, event.currentTarget)}
                                              className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.58)] transition hover:text-[rgb(var(--theme-info-rgb)/0.88)]"
                                            >
                                              Restore
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  ) : null}
                                </AnimatePresence>
                              </div>
                            ) : null}
                            {taskPeekSubtaskEntryOpen ? (
                              <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 ring-1 ring-white/[0.06]">
                                <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px] text-white/44">
                                  +
                                </span>
                                <input
                                  ref={taskPeekSubtaskDraftRef}
                                  value={taskPeekSubtaskDraft}
                                  onChange={(event) => setTaskPeekSubtaskDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                                      event.preventDefault()
                                      addSelectedTaskPeekSubtask()
                                    }
                                    if (event.key === 'Escape') {
                                      event.preventDefault()
                                      setTaskPeekSubtaskDraft('')
                                      setTaskPeekSubtaskEntryOpen(false)
                                    }
                                  }}
                                  spellCheck={true}
                                  className="w-full bg-transparent text-sm leading-5 text-white outline-none placeholder:text-white/24"
                                  placeholder="Add subtask"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTaskPeekSubtaskEntryOpen(true)}
                                className="grid w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 text-left text-sm text-white/48 transition hover:bg-white/[0.03] hover:text-white/72"
                              >
                                <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px]">
                                  +
                                </span>
                                <span>Add subtask</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {taskPeekNotesOpen ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Notes</p>
                              {selectedTaskPeek.notes.trim() ? null : (
                                <button
                                  type="button"
                                  onClick={() => setTaskPeekNotesOpen(false)}
                                  className="text-[11px] uppercase tracking-[0.14em] text-white/40 transition hover:text-white/66"
                                >
                                  Hide
                                </button>
                              )}
                            </div>
                            <textarea
                              value={selectedTaskPeek.notes}
                              onChange={(event) =>
                                updateSelectedTaskPeek((task) => ({
                                  ...task,
                                  notes: event.target.value,
                                }))
                              }
                              rows={4}
                              spellCheck={true}
                              className="w-full resize-none rounded-[20px] border border-white/[0.05] bg-white/[0.025] px-4 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/24"
                              placeholder="Optional notes..."
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTaskPeekNotesOpen(true)}
                            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                          >
                            Add notes
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 border-t border-white/[0.05] pt-2.5 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                        <div className="space-y-0.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Phase</p>
                          <select
                            ref={taskPeekPhaseFieldRef}
                            value={normalizeLifeGoalPhaseValue(selectedTaskPeek.phase)}
                            onChange={(event) =>
                              updateSelectedTaskPeek((task) => ({
                                ...task,
                                phase: event.target.value,
                              }))
                            }
                            className="w-full rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/24"
                          >
                            {LIFE_GOAL_PHASE_OPTIONS.map((option) => (
                              <option key={option} value={option} className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Due date</p>
                          <div ref={taskPeekDateFieldRef} className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (taskPeekDatePickerOpen) {
                                  setTaskPeekDatePickerOpen(false)
                                  setTaskPeekDatePanelPosition(null)
                                  return
                                }
                                openTaskPeekDatePicker()
                              }}
                              className="theme-input flex w-full items-center justify-between gap-2.5 rounded-[18px] border px-3 py-1.5 text-left text-sm transition"
                            >
                              <span className={selectedTaskPeek.dueDate ? 'theme-text-primary' : 'theme-text-muted'}>
                                {selectedTaskPeek.dueDate ? formatDate(selectedTaskPeek.dueDate) : 'Optional due date'}
                              </span>
                              <span className="theme-text-faint text-xs">▾</span>
                            </button>

                            {taskPeekDatePickerOpen && taskPeekDatePanelPosition && typeof document !== 'undefined'
                              ? createPortal(
                              <div
                                ref={taskPeekDatePanelRef}
                                className="theme-popover fixed z-[1020] overflow-hidden rounded-[24px] border p-3 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
                                style={{
                                  top: `${taskPeekDatePanelPosition.top}px`,
                                  left: `${taskPeekDatePanelPosition.left}px`,
                                  width: `${taskPeekDatePanelPosition.width}px`,
                                }}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setTaskPeekDateViewMonth((current) => shiftCalendarMonth(current, -1))}
                                    className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                  >
                                    Prev
                                  </button>
                                  <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(taskPeekDateViewMonth)}</p>
                                  <button
                                    type="button"
                                    onClick={() => setTaskPeekDateViewMonth((current) => shiftCalendarMonth(current, 1))}
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
                                  {getCalendarDays(taskPeekDateViewMonth).map((day) => {
                                    const dayValue = formatCalendarDayValue(day)
                                    const inCurrentMonth = day.getUTCMonth() === taskPeekDateViewMonth.getUTCMonth()
                                    const isSelected = dayValue === (selectedTaskPeek.dueDate ?? '')
                                    const isToday = dayValue === getTodayIsoDate()

                                    return (
                                      <button
                                        key={dayValue}
                                        type="button"
                                        onClick={() => applyTaskPeekDate(dayValue)}
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
                                    onClick={() => applyTaskPeekDate(getTodayIsoDate())}
                                    className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                  >
                                    Today
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => applyTaskPeekDate('')}
                                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTaskPeekDatePickerOpen(false)
                                        setTaskPeekDatePanelPosition(null)
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

                        <div className="space-y-0.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Priority</p>
                          <div className="inline-flex flex-wrap gap-1 rounded-[18px] bg-white/[0.02] p-1">
                            {taskPriorityOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                  updateSelectedTaskPeek((task) => ({
                                    ...task,
                                    priority: option.value,
                                  }))
                                }
                                className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] uppercase tracking-[0.12em] transition ${
                                  selectedTaskPeek.priority === option.value
                                    ? 'border-white/[0.12] bg-white/[0.08] text-white'
                                    : 'border-white/[0.05] bg-white/[0.02] text-white/56 hover:text-white/78'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Tags</p>
                          <input
                            value={selectedTaskPeek.tags.join(', ')}
                            onChange={(event) =>
                              updateSelectedTaskPeek((task) => ({
                                ...task,
                                tags: event.target.value
                                  .split(',')
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              }))
                            }
                            spellCheck={false}
                            className="w-full rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/24"
                            placeholder="Focus, Deep work"
                          />
                        </div>

                        <div className="text-[11px] leading-4 text-mist/34">
                          <p className={selectedTaskPeek.dueDate ? `${getRelativeDueMeta(selectedTaskPeek.dueDate)?.toneClassName ?? 'text-white/40'} text-[11px]` : 'text-white/40'}>
                            {selectedTaskPeek.completedAt
                              ? `Completed ${formatTaskCompletedDate(selectedTaskPeek.completedAt)}`
                              : selectedTaskPeek.dueDate
                                ? (() => {
                                    const dueMeta = getRelativeDueMeta(selectedTaskPeek.dueDate)
                                    return dueMeta
                                      ? `${dueMeta.label} · ${formatTaskDueDate(selectedTaskPeek.dueDate)}`
                                      : `Due ${formatTaskDueDate(selectedTaskPeek.dueDate)}`
                                  })()
                                : 'No due date set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb)/0.985)] px-6 py-2 shadow-[0_-10px_20px_rgba(0,0,0,0.12)] backdrop-blur-[10px]">
                    <p className="max-w-[16rem] text-[10px] leading-3.5 text-mist/38">Enter confirms text changes and creates subtasks. Completion requires explicit action.</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="ghost"
                        className="theme-danger-soft border-[rgb(var(--theme-negative-rgb)/0.2)] bg-[rgb(var(--theme-negative-rgb)/0.08)] text-[rgb(var(--theme-negative-rgb)/0.88)] hover:border-[rgb(var(--theme-negative-rgb)/0.34)] hover:bg-[rgb(var(--theme-negative-rgb)/0.12)]"
                        onClick={() =>
                          setTaskPeekDeleteConfirmation({
                            kind: 'task',
                            taskId: selectedTaskPeek.id,
                          })
                        }
                      >
                        Delete task
                      </Button>
                      {!selectedTaskPeek.completed && selectedLifeGoal && selectedLifeGoalProgress && selectedLifeGoalProgress.nextTask?.id !== selectedTaskPeek.id ? (
                        <Button variant="ghost" onClick={() => setTaskAsNext(selectedLifeGoal.id, selectedTaskPeek.id)}>
                          Mark as next
                        </Button>
                      ) : null}
                      {selectedTaskPeek.completed ? (
                        <Button variant="ghost" onClick={(event) => toggleSelectedTaskPeekCompletion(event.currentTarget)}>
                          Restore task
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" onClick={(event) => completeTaskFromPeek('next', event.currentTarget)}>
                            Complete + next
                          </Button>
                          <Button variant="soft" onClick={(event) => completeTaskFromPeek('close', event.currentTarget)}>
                            Complete task
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {taskPeekDeleteConfirmation ? (
                <>
                  <motion.div
                    className="fixed inset-0 z-[1100] bg-black/62 backdrop-blur-[5px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    onClick={closeTaskPeekDeleteConfirmation}
                  />
                  <motion.div
                    className="fixed inset-0 z-[1110] grid place-items-center px-4 py-6 sm:px-6 sm:py-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    onClick={closeTaskPeekDeleteConfirmation}
                  >
                    <motion.div
                      ref={taskPeekDeleteDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label={taskPeekDeleteConfirmation.kind === 'subtask' ? 'Delete subtask' : 'Delete task'}
                      className="theme-popover w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb)/0.985)] shadow-[0_30px_80px_rgba(0,0,0,0.34)]"
                      initial={{ opacity: 0, y: 10, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.985 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={handleTaskPeekDeleteDialogKeyDown}
                    >
                      <div className="border-b border-white/[0.07] px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">
                              {taskPeekDeleteConfirmation.kind === 'subtask' ? 'Delete subtask' : 'Delete task'}
                            </p>
                            <h3 className="mt-2 text-xl font-semibold text-white">
                              {taskPeekDeleteConfirmation.kind === 'subtask' ? 'Delete subtask?' : 'Delete task?'}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={closeTaskPeekDeleteConfirmation}
                            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.12] hover:text-white/76"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="space-y-5 px-6 py-5">
                        <p className="theme-text-muted text-sm leading-6">
                          {taskPeekDeleteConfirmation.kind === 'subtask'
                            ? 'This will permanently delete this subtask. This action cannot be undone.'
                            : 'This will permanently delete the task and its related details. This action cannot be undone.'}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" onClick={closeTaskPeekDeleteConfirmation}>
                            Cancel
                          </Button>
                          <Button
                            variant="ghost"
                            className="theme-danger-soft border-[rgb(var(--theme-negative-rgb)/0.24)] bg-[rgb(var(--theme-negative-rgb)/0.1)] text-[rgb(var(--theme-negative-rgb)/0.9)] hover:border-[rgb(var(--theme-negative-rgb)/0.38)] hover:bg-[rgb(var(--theme-negative-rgb)/0.14)]"
                            onClick={confirmTaskPeekDelete}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}

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
