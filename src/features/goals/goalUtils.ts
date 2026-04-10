import type { CSSProperties } from 'react'
import type {
  DayEntry,
  LifeGoal,
  LifeGoalCategoryColor,
  LifeGoalCategoryDefinition,
  LifeGoalStatus,
  LifeGoalTask,
  LifeGoalTaskPriority,
  LifeGoalType,
} from '../../types'

export function canGoalTypeLinkToGoalType(sourceType: LifeGoalType, targetType: LifeGoalType) {
  if (sourceType === 'directional') {
    return targetType === 'outcome'
  }
  return false
}

export function toTitleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

export function getMilestoneTaskProgress(tasks: LifeGoalTask[]) {
  const total = tasks.length
  const completed = tasks.filter((task) => task.completed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : null
  return { total, completed, percent }
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateShortYear(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

export function formatDateContextual(date: string) {
  const targetDate = new Date(`${date}T00:00:00Z`)
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`)
  const sameYear = targetDate.getUTCFullYear() === today.getUTCFullYear()

  return targetDate.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' as const }),
  })
}

export function formatTaskDueDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatTaskCompletedDate(date: string) {
  return new Date(date).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
  })
}

export function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function shiftIsoDate(date: string, deltaDays: number) {
  const shiftedDate = new Date(`${date}T00:00:00Z`)
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + deltaDays)
  return shiftedDate.toISOString().slice(0, 10)
}

export function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function getLifeSignalBucket(day: DayEntry): 'good' | 'neutral' | 'low' | null {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)
  if (values.length === 0) return null
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  if (average >= 7) return 'good'
  if (average <= 4) return 'low'
  return 'neutral'
}

export function getCalendarMonthDate(date?: string) {
  if (date && isValidIsoDate(date)) {
    return new Date(`${date}T00:00:00Z`)
  }
  return new Date(`${getTodayIsoDate()}T00:00:00Z`)
}

export function startOfCalendarMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function shiftCalendarMonth(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

export function formatCalendarMonthLabel(date: Date) {
  return date.toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function getCalendarDays(date: Date) {
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

export function formatCalendarDayValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function isLifeGoalScheduled(status: LifeGoalStatus, startDate: string) {
  return status === 'not-started' && isValidIsoDate(startDate) && startDate > getTodayIsoDate()
}

export function getLifeGoalStatusMeta(status: LifeGoalStatus, startDate = '') {
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

export function getLifeGoalSecondaryContext(goal: LifeGoal) {
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

export function getLifeGoalProgress(goal: LifeGoal, tasks: LifeGoalTask[] = goal.tasks) {
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.completed).length
  const percent = goal.status === 'complete' ? 100 : totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const nextTask = tasks.find((task) => !task.completed) ?? null
  const completedTaskItems = tasks.filter((task) => task.completed)
  const lastCompletedTask = [...completedTaskItems]
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))[0] ?? null

  return {
    totalTasks,
    completedTasks,
    plannedTasks: tasks.filter((task) => !task.completed),
    completedTaskItems,
    lastCompletedTask,
    percent,
    nextTask,
  }
}

export function getLifeGoalFlowState(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
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

export function getLifeGoalMomentumState(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
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

export function getLifeGoalAnchorText(whyItMatters: string) {
  const trimmed = whyItMatters.trim()
  if (!trimmed) return ''
  const firstSentence = trimmed.split(/(?<=[.!?])\s+/)[0] ?? trimmed
  return firstSentence.length > 120 ? `${firstSentence.slice(0, 117).trim()}...` : firstSentence
}

export function formatGoalCardTitle(title: string) {
  return title
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

export function getTaskPriorityOptions(): Array<{ value: LifeGoalTaskPriority; label: string }> {
  return [
    { value: 'none', label: 'None' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
  ]
}

export function normalizeCategoryValue(category: string) {
  return category.trim().toLowerCase()
}

export function getLifeGoalCategoryColorTokenVariable(color: LifeGoalCategoryColor) {
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

export function getLifeGoalCategoryColor(name: string, categories: LifeGoalCategoryDefinition[]) {
  const normalizedName = normalizeCategoryValue(name)
  return categories.find((category) => normalizeCategoryValue(category.name) === normalizedName)?.color ?? 'neutral'
}

export function getLifeGoalCategoryOptions(
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

export function getLifeGoalCategoryDotStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    backgroundColor: `rgb(var(${variable}) / 0.9)`,
    boxShadow: `0 0 0 1px rgb(var(${variable}) / 0.18)`,
  }
}

export function getLifeGoalCategoryChipStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    borderColor: `rgb(var(${variable}) / 0.24)`,
    backgroundColor: `rgb(var(${variable}) / 0.055)`,
  }
}

export function getLifeGoalCategoryChipTextStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    color: `rgb(var(${variable}) / 0.82)`,
  }
}

export function getLifeGoalAccentBarStyle(color: LifeGoalCategoryColor): CSSProperties {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    ['--goal-rail-rgb' as string]: `var(${variable})`,
  }
}

export function getLifeGoalCardHighlightStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.06), 0 0 0 1px rgb(var(${variable}) / 0.14), 0 16px 34px rgb(15 23 42 / 0.12)`,
  }
}

export function getLifeGoalRowHighlightStyle(color: LifeGoalCategoryColor) {
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  return {
    boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.04), 0 0 0 1px rgb(var(${variable}) / 0.12)`,
  }
}

export function getLifeGoalPrimaryGlowStyle(
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

export function getLifeGoalCategorySurfaceWashStyle(color: LifeGoalCategoryColor, isPrimary: boolean, hover = false) {
  if (color === 'neutral') return undefined
  const variable = getLifeGoalCategoryColorTokenVariable(color)
  const topAlpha = isPrimary ? (hover ? 0.034 : 0.026) : hover ? 0.082 : 0.072
  const midAlpha = isPrimary ? (hover ? 0.016 : 0.012) : hover ? 0.038 : 0.03
  const tailAlpha = isPrimary ? (hover ? 0.006 : 0.004) : hover ? 0.014 : 0.01
  return {
    backgroundImage: `linear-gradient(180deg, rgb(var(${variable}) / ${topAlpha}) 0%, rgb(var(${variable}) / ${midAlpha}) 18%, rgb(var(${variable}) / ${tailAlpha}) 32%, transparent 48%)`,
  }
}

export function getLifeGoalProgressTone(goal: LifeGoal, progress: ReturnType<typeof getLifeGoalProgress>) {
  if (goal.status === 'complete') return 'complete'
  if (progress.completedTasks > 0) return 'active'
  return 'quiet'
}

export function getLifeGoalProgressSurfaceStyle(
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

export function getLifeGoalUrgencyMeta(goal: LifeGoal) {
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

export function getSubtaskProgressDots(subtasks: LifeGoalTask['subtasks']) {
  const total = subtasks.length
  if (total === 0) return []

  const completed = subtasks.filter((subtask) => subtask.completed).length
  const visibleCount = Math.min(5, total)

  return Array.from({ length: visibleCount }, (_, index) => {
    const threshold = Math.round(((index + 1) / visibleCount) * total)
    return completed >= threshold
  })
}

export function getSubtaskProgressSummary(subtasks: LifeGoalTask['subtasks']) {
  const total = subtasks.length
  const completed = subtasks.filter((subtask) => subtask.completed).length
  return { total, completed }
}

export function getGoalSubtaskProgress(tasks: LifeGoalTask[]) {
  const total = tasks.reduce((sum, task) => sum + task.subtasks.length, 0)
  const completed = tasks.reduce(
    (sum, task) => sum + task.subtasks.filter((subtask) => subtask.completed).length,
    0,
  )
  return { total, completed }
}

export function getLifeGoalEditSnapshot(goal: LifeGoal) {
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

export function sortLifeGoals(goals: LifeGoal[]) {
  return [...goals].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order
    return right.updatedAt.localeCompare(left.updatedAt)
  })
}

export function sortLifeGoalsByDue(goals: LifeGoal[]) {
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

export function sortLifeGoalsByRecentlyAdded(goals: LifeGoal[]) {
  return [...goals].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function sortLifeGoalsByName(goals: LifeGoal[]) {
  return [...goals].sort((left, right) => left.title.localeCompare(right.title))
}

export function sortLifeGoalsByStatus(goals: LifeGoal[]) {
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
