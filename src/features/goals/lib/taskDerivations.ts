import { LifeGoalTask, LifeGoalTaskPriority } from '../../../types'

export const LIFE_GOAL_PHASE_OPTIONS = ['General', 'Define', 'Build', 'Refine', 'Launch'] as const

const IS_DEV =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isValidIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

export function getPriorityScore(task: Pick<LifeGoalTask, 'priority'> | LifeGoalTaskPriority) {
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

export function getPriorityAwareNextTask(tasks: LifeGoalTask[]) {
  const incompleteTasks = tasks.filter((task) => !task.completed)
  if (incompleteTasks.length === 0) return null

  const nearTermTasks = incompleteTasks.slice(0, 3)
  const highPriorityCandidate = nearTermTasks.find((task) => getPriorityScore(task) === 3)

  return highPriorityCandidate ?? incompleteTasks[0] ?? null
}

export function getLifeGoalTaskPriorityMeta(priority: LifeGoalTaskPriority) {
  switch (priority) {
    case 'high':
      return {
        label: 'High',
        chipClassName:
          'border-[rgb(var(--theme-negative-rgb)/0.28)] bg-transparent text-[rgb(var(--theme-negative-rgb)/0.95)]',
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

export function getRoadmapTaskVisualState(
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

export function getDaysFromToday(date: string) {
  if (!isValidIsoDate(date)) return null
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()
  const target = new Date(`${date}T00:00:00Z`).getTime()
  return Math.round((target - today) / 86400000)
}

export function getRelativeDueMeta(date: string) {
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

export function suggestPhase(taskText: string): string | null {
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

export function normalizeLifeGoalPhaseValue(phase?: string | null) {
  const trimmed = phase?.trim()
  if (!trimmed) return 'General'
  return LIFE_GOAL_PHASE_OPTIONS.includes(trimmed as (typeof LIFE_GOAL_PHASE_OPTIONS)[number]) ? trimmed : 'General'
}

export function getLifeGoalTaskPhaseLabel(task: Pick<LifeGoalTask, 'phase'>) {
  return normalizeLifeGoalPhaseValue(task.phase)
}

export function getRoadmapPhaseGroups(tasks: LifeGoalTask[]) {
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

export function normalizeTaskTag(tag: string) {
  const collapsed = tag.trim().toLowerCase().replace(/\s+/g, ' ')
  return collapsed
}

export function getRoadmapTagGroups(tasks: LifeGoalTask[]) {
  const groups: Array<{ label: string; tasks: LifeGoalTask[] }> = []
  const groupMap = new Map<string, { label: string; tasks: LifeGoalTask[] }>()

  for (const task of tasks) {
    const label = task.taskTag ? normalizeTaskTag(task.taskTag) : 'untagged'
    const existing = groupMap.get(label)

    if (existing) {
      existing.tasks.push(task)
      continue
    }

    const nextGroup = { label, tasks: [task] }
    groupMap.set(label, nextGroup)
    groups.push(nextGroup)
  }

  return groups
}

export function sortTasksForDisplay(
  tasks: LifeGoalTask[],
  mode: 'default' | 'due' | 'priority',
) {
  if (mode === 'default') return tasks

  const withIndex = tasks.map((task, index) => ({ task, index }))

  return [...withIndex]
    .sort((left, right) => {
      if (mode === 'priority') {
        const priorityDiff = getPriorityScore(right.task) - getPriorityScore(left.task)
        if (priorityDiff !== 0) return priorityDiff
        return left.index - right.index
      }

      const leftDiff = left.task.dueDate ? getDaysFromToday(left.task.dueDate) : null
      const rightDiff = right.task.dueDate ? getDaysFromToday(right.task.dueDate) : null

      const getDueBucket = (diff: number | null) => {
        if (diff == null) return 3
        if (diff < 0) return 0
        if (diff === 0) return 1
        return 2
      }

      const leftBucket = getDueBucket(leftDiff)
      const rightBucket = getDueBucket(rightDiff)
      if (leftBucket !== rightBucket) return leftBucket - rightBucket

      if (leftDiff != null && rightDiff != null) {
        if (leftBucket === 0 && leftDiff !== rightDiff) return leftDiff - rightDiff
        if (leftBucket !== 0 && leftDiff !== rightDiff) return leftDiff - rightDiff
      }

      return left.index - right.index
    })
    .map(({ task }) => task)
}

export function getRoadmapTaskSections(tasks: LifeGoalTask[]) {
  const completed = tasks.filter((task) => task.completed)
  const incomplete = tasks.filter((task) => !task.completed)

  const sections = {
    completed,
    current: incomplete[0] ?? null,
    upcoming: incomplete.slice(1),
  }

  if (IS_DEV) {
    validateRoadmapTaskSections(tasks, sections)
  }

  return sections
}

function validateRoadmapTaskSections(
  tasks: LifeGoalTask[],
  sections: {
    completed: LifeGoalTask[]
    current: LifeGoalTask | null
    upcoming: LifeGoalTask[]
  },
) {
  const completedIds = new Set(sections.completed.map((task) => task.id))
  const upcomingIds = new Set(sections.upcoming.map((task) => task.id))
  const currentId = sections.current?.id ?? null
  const allSectionIds = new Set([
    ...completedIds,
    ...(currentId ? [currentId] : []),
    ...upcomingIds,
  ])

  const invalidCompletedOutsideCompleted = tasks.some(
    (task) => task.completed && !completedIds.has(task.id),
  )
  const completedLeakingIntoActive =
    Boolean(sections.current?.completed) ||
    sections.upcoming.some((task) => task.completed)
  const duplicateMembershipCount =
    sections.completed.length +
    sections.upcoming.length +
    (sections.current ? 1 : 0) -
    allSectionIds.size
  const missingTaskCount = tasks.length - allSectionIds.size

  if (
    invalidCompletedOutsideCompleted ||
    completedLeakingIntoActive ||
    duplicateMembershipCount > 0 ||
    missingTaskCount !== 0
  ) {
    console.warn('[Goals] Invalid roadmap task derivation detected.', {
      taskIds: tasks.map((task) => ({
        id: task.id,
        completed: task.completed,
        phase: task.phase ?? null,
      })),
      sections: {
        completed: sections.completed.map((task) => task.id),
        current: currentId,
        upcoming: sections.upcoming.map((task) => task.id),
      },
    })
  }
}
