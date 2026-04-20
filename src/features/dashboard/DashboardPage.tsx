import { useMemo, useState } from 'react'
import GreetingHeader from './components/GreetingHeader'
import TodayCommandCenter from './components/TodayCommandCenter'
import WeeklySummary from './components/WeeklySummary'
import HabitsWeek from './components/HabitsWeek'
import GoalsNextAction from './components/GoalsNextAction'
import MomentumCard from './components/MomentumCard'
import InsightLayer from './components/InsightLayer'
import TaskPeek, { type TaskData as TaskPeekTaskData } from '../../components/tasks/TaskPeek'
import {
  getLifeGoalRuntimeTasks,
  getLifeGoalStatusMeta,
  getVisibleGoalOverviewOrder,
  GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY,
  GOAL_OVERVIEW_VIEW_CONTROLS_STORAGE_KEY,
  type GoalOverviewOrderingControls,
  type GoalOverviewOrderingRowActions,
} from '../goals/goalUtils'
import { getPriorityScore } from '../goals/lib/taskDerivations'
import { readJsonStorage } from '../../lib/persistence/storage'
import { taskPeekDataToTask, taskToTaskPeekData } from '../../lib/taskAdapters'
import type {
  BadHabitDefinition,
  DayEntry,
  HabitTracker,
  LifeGoal,
  LifeGoalCategoryDefinition,
  Task,
  WeekEntry,
} from '../../types'

type BadHabitStreak = {
  habit: BadHabitDefinition
  streak: number
  startsToday?: boolean
  brokenToday?: boolean
}

type DashboardPageProps = {
  weeks: WeekEntry[]
  days: DayEntry[]
  tasks: Task[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories?: LifeGoalCategoryDefinition[]
  habitTrackers: HabitTracker[]
  badHabitStreaks: BadHabitStreak[]
  showBadHabitTracking: boolean
  onToggleTask: (taskId: string) => void
  onOpenTracker: () => void
  onOpenGoals: () => void
  onOpenGoal: (goalId: string) => void
  onUpdateTask: (taskId: string, updater: (task: Task) => Task) => void
  onDeleteTask: (taskId: string) => void
  onOpenTasks: () => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const goalColorMap: Record<string, 'violet' | 'emerald' | 'blue' | 'amber'> = {
  purple: 'violet',
  blue: 'blue',
  green: 'emerald',
  teal: 'emerald',
  amber: 'amber',
  red: 'amber',
  neutral: 'blue',
}

function readGoalOverviewOrderingControls(): GoalOverviewOrderingControls {
  const value = readJsonStorage<Partial<GoalOverviewOrderingControls>>(GOAL_OVERVIEW_VIEW_CONTROLS_STORAGE_KEY)
  return {
    groupBy:
      value?.groupBy === 'none' ||
      value?.groupBy === 'status' ||
      value?.groupBy === 'category' ||
      value?.groupBy === 'life-direction'
        ? value.groupBy
        : 'none',
    sortBy:
      value?.sortBy === 'manual' ||
      value?.sortBy === 'due' ||
      value?.sortBy === 'priority' ||
      value?.sortBy === 'updated'
        ? value.sortBy
        : 'manual',
  }
}

function readGoalOverviewOrderingRowActions(): GoalOverviewOrderingRowActions {
  const value = readJsonStorage<Partial<GoalOverviewOrderingRowActions>>(GOAL_OVERVIEW_ROW_ACTIONS_STORAGE_KEY)
  return {
    pinnedGoalIds: Array.isArray(value?.pinnedGoalIds)
      ? value.pinnedGoalIds.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [],
  }
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10)
}

function getMondayStart(dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`)
  const day = date.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}

function formatLongTodayLabel(todayIso: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${todayIso}T00:00:00Z`))
}

function formatShortDueLabel(dueDate: string | null, todayIso: string) {
  if (!dueDate) return undefined
  if (dueDate < todayIso) return 'Overdue'
  if (dueDate === todayIso) return 'Due today'
  return `Due ${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${dueDate}T00:00:00Z`))}`
}

function getTaskPriorityRank(priority: Task['priority']) {
  switch (priority) {
    case 'high':
      return 0
    case 'medium':
      return 1
    case 'low':
      return 2
    default:
      return 3
  }
}

function sortTodayTasks(left: Task, right: Task, todayIso: string) {
  const leftDueRank = left.dueDate ? (left.dueDate < todayIso ? 0 : left.dueDate === todayIso ? 1 : 2) : 3
  const rightDueRank = right.dueDate ? (right.dueDate < todayIso ? 0 : right.dueDate === todayIso ? 1 : 2) : 3
  if (leftDueRank !== rightDueRank) return leftDueRank - rightDueRank

  const priorityDiff = getTaskPriorityRank(left.priority) - getTaskPriorityRank(right.priority)
  if (priorityDiff !== 0) return priorityDiff

  const leftDue = left.dueDate ?? '9999-12-31'
  const rightDue = right.dueDate ?? '9999-12-31'
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)

  return left.order - right.order
}

function getTrackerStreak(tracker: HabitTracker, todayIso: string) {
  let streak = 0
  const cursor = new Date(`${todayIso}T00:00:00Z`)
  while (true) {
    const iso = cursor.toISOString().slice(0, 10)
    const entry = tracker.entries[iso]
    if (!entry || (!entry.completed && !entry.paused)) break
    if (entry.completed) streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

function getHabitEmoji(title: string) {
  const value = title.toLowerCase()
  if (value.includes('meditat')) return '🧘'
  if (value.includes('exercise') || value.includes('workout') || value.includes('run')) return '💪'
  if (value.includes('read')) return '📖'
  if (value.includes('social')) return '📵'
  if (value.includes('journal')) return '✍️'
  return '•'
}

export default function DashboardPage({
  weeks,
  days,
  tasks,
  lifeGoals,
  lifeGoalCategories = [],
  habitTrackers,
  badHabitStreaks,
  showBadHabitTracking,
  onToggleTask,
  onOpenTracker,
  onOpenGoals,
  onOpenGoal,
  onUpdateTask,
  onDeleteTask,
  onOpenTasks,
}: DashboardPageProps) {
  const [selectedTaskPeekId, setSelectedTaskPeekId] = useState<string | null>(null)
  const todayIso = getTodayIso()
  const todayEntry = useMemo(
    () => days.find((day) => day.date === todayIso) ?? days.slice().sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [days, todayIso],
  )
  const currentWeek = useMemo(() => {
    if (!todayEntry) return weeks.slice().sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null
    return weeks.find((week) => week.id === todayEntry.linkedWeek) ?? null
  }, [todayEntry, weeks])

  const weekDays = useMemo(() => {
    const monday = getMondayStart(todayIso)
    return DAY_LABELS.map((label, index) => {
      const date = new Date(monday)
      date.setUTCDate(monday.getUTCDate() + index)
      const iso = date.toISOString().slice(0, 10)
      const day = days.find((entry) => entry.date === iso) ?? null
      return {
        label,
        date: iso,
        logged: Boolean(day?.isLogged),
        isToday: iso === todayIso,
      }
    })
  }, [days, todayIso])

  const dueTodayCount = useMemo(
    () => tasks.filter((task) => !task.completed && task.dueDate === todayIso).length,
    [tasks, todayIso],
  )

  const pendingHabitsCount = useMemo(
    () =>
      habitTrackers.filter((tracker) => {
        const entry = tracker.entries[todayIso]
        return !entry?.completed
      }).length,
    [habitTrackers, todayIso],
  )

  const weeklyLoggedCount = useMemo(() => weekDays.filter((day) => day.logged).length, [weekDays])

  const weeklyHabitCompletion = useMemo(() => {
    const weekEntries = weekDays
      .map((day) => days.find((entry) => entry.date === day.date))
      .filter((day): day is DayEntry => Boolean(day))
    const completed = weekEntries.reduce((sum, day) => sum + day.habitsCompleted, 0)
    const total = weekEntries.reduce((sum, day) => sum + day.habitsTotal, 0)
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [days, weekDays])

  const todayTasks = useMemo(() => {
    const activeTasks = tasks.filter((task) => !task.completed && task.isSomeday !== true)
    const primaryTodaySet = activeTasks
      .filter((task) => task.dueDate !== null && task.dueDate <= todayIso)
      .slice()
      .sort((left, right) => sortTodayTasks(left, right, todayIso))

    if (primaryTodaySet.length > 0) {
      return primaryTodaySet.slice(0, 4)
    }

    return activeTasks
      .filter((task) => task.dueDate === null && task.priority === 'high')
      .slice()
      .sort((left, right) => left.order - right.order)
      .slice(0, 3)
  }, [tasks, todayIso])

  const focusTask = todayTasks[0] ?? null

  const selectedTaskPeek = useMemo(
    () => tasks.find((task) => task.id === selectedTaskPeekId) ?? null,
    [selectedTaskPeekId, tasks],
  )

  const linkedContextById = useMemo(
    () =>
      Object.fromEntries(
        lifeGoals.map((goal) => [
          goal.id,
          {
            title: goal.title,
            goalType: goal.goalType,
          },
        ]),
      ),
    [lifeGoals],
  )

  const goalOptions = useMemo(
    () =>
      lifeGoals
        .filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === 'outcome')
        .map((goal) => ({ id: goal.id, label: goal.title })),
    [lifeGoals],
  )

  const directionOptions = useMemo(
    () =>
      lifeGoals
        .filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === 'directional')
        .map((goal) => ({ id: goal.id, label: goal.title })),
    [lifeGoals],
  )

  const selectedTaskPeekData = useMemo(
    () =>
      selectedTaskPeek
        ? taskToTaskPeekData(selectedTaskPeek, {
            linkedGoal: selectedTaskPeek.linkedGoalId
              ? lifeGoals.find((goal) => goal.id === selectedTaskPeek.linkedGoalId)?.title
              : undefined,
            linkedDirection: selectedTaskPeek.linkedDirectionId
              ? lifeGoals.find((goal) => goal.id === selectedTaskPeek.linkedDirectionId)?.title
              : undefined,
          })
        : null,
    [lifeGoals, selectedTaskPeek],
  )

  const focusGoalTitle = useMemo(() => {
    if (!focusTask) return undefined
    const linkedGoal = lifeGoals.find((goal) => goal.id === (focusTask.linkedDirectionId ?? focusTask.linkedGoalId))
    return linkedGoal?.title
  }, [focusTask, lifeGoals])

  const weeklyDoneCount = useMemo(() => {
    const weekDates = new Set(
      currentWeek
        ? Array.from({ length: currentWeek.linkedDays.length }, (_, index) => {
            const date = new Date(`${currentWeek.startDate}T00:00:00Z`)
            date.setUTCDate(date.getUTCDate() + index)
            return date.toISOString().slice(0, 10)
          })
        : weekDays.map((day) => day.date),
    )

    return tasks.filter((task) => task.completedAt && weekDates.has(task.completedAt.slice(0, 10))).length
  }, [currentWeek, tasks, weekDays])

  const overdueCount = useMemo(
    () => tasks.filter((task) => !task.completed && task.dueDate !== null && task.dueDate < todayIso).length,
    [tasks, todayIso],
  )

  const habitsWeek = useMemo(() => {
    return habitTrackers.slice(0, 4).map((tracker, index) => {
      const colorCycle = ['emerald', 'blue', 'violet', 'amber'] as const
      return {
        id: tracker.id,
        name: tracker.title,
        emoji: getHabitEmoji(tracker.title),
        color: colorCycle[index % colorCycle.length],
        streak: getTrackerStreak(tracker, todayIso),
        days: weekDays.map((day) => Boolean(tracker.entries[day.date]?.completed)),
      }
    })
  }, [habitTrackers, todayIso, weekDays])

  const goalsNextAction = useMemo(() => {
    const allOverviewGoals = lifeGoals.filter((goal) => !goal.archivedAt)
    const activeOverviewGoals = allOverviewGoals.filter((goal) => goal.status !== 'complete')
    const orderingControls = readGoalOverviewOrderingControls()
    const orderingRowActions = readGoalOverviewOrderingRowActions()
    const visibleOrderedGoals = getVisibleGoalOverviewOrder(activeOverviewGoals, {
      controls: orderingControls,
      rowActions: orderingRowActions,
      baseManualGoals: allOverviewGoals,
      getPriorityValue: (goal) =>
        getLifeGoalRuntimeTasks(goal, tasks).reduce((highest, task) => Math.max(highest, getPriorityScore(task)), 0),
      getGroupLabel: (goal) => {
        switch (orderingControls.groupBy) {
          case 'status':
            return getLifeGoalStatusMeta(goal.status, goal.startDate).label
          case 'category':
            return goal.category.trim() || 'Uncategorized'
          case 'life-direction': {
            const parentDirections = allOverviewGoals.filter(
              (candidate) =>
                candidate.id !== goal.id &&
                (candidate.goalType ?? 'outcome') === 'directional' &&
                (candidate.relatedGoalIds ?? []).includes(goal.id),
            )
            if ((goal.goalType ?? 'outcome') === 'directional') return 'Life directions'
            if (parentDirections.length === 0) return 'Unlinked goals'
            if (parentDirections.length === 1) return parentDirections[0].title
            return `${parentDirections[0].title} +${parentDirections.length - 1}`
          }
          case 'none':
          default:
            return ''
        }
      },
    })
    const highImpactGoals = visibleOrderedGoals.filter((goal) => goal.isPrimary)
    const selectedGoals = [
      ...highImpactGoals,
      ...visibleOrderedGoals.filter((goal) => !goal.isPrimary),
    ]

    return selectedGoals
      .map((goal) => {
        const linkedTasks = tasks.filter(
          (task) =>
            !task.completed &&
            (task.linkedGoalId === goal.id || task.linkedDirectionId === goal.id),
        )
        const nextTask =
          linkedTasks
            .slice()
            .sort((left, right) => {
              const leftDue = left.dueDate ?? '9999-12-31'
              const rightDue = right.dueDate ?? '9999-12-31'
              if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
              return getTaskPriorityRank(left.priority) - getTaskPriorityRank(right.priority)
            })[0] ?? null
        const allGoalTasks = tasks.filter((task) => task.linkedGoalId === goal.id || task.linkedDirectionId === goal.id)
        const completedCount = allGoalTasks.filter((task) => task.completed).length
        const progress = allGoalTasks.length > 0 ? Math.round((completedCount / allGoalTasks.length) * 100) : 0
        const categoryColor = lifeGoalCategories.find((category) => category.name === goal.category)?.color ?? 'blue'
        return {
          id: goal.id,
          name: goal.title,
          progress,
          color: goalColorMap[categoryColor] ?? 'blue',
          nextTask: (nextTask?.text ?? goal.minimumVersion) || 'Define next action',
          nextTaskId: nextTask?.id,
          dueLabel: formatShortDueLabel(nextTask?.dueDate ?? null, todayIso),
          highImpact: Boolean(goal.isPrimary),
        }
      })
  }, [lifeGoalCategories, lifeGoals, tasks, todayIso])

  const alcoholStreak = useMemo(
    () => badHabitStreaks.find((entry) => entry.habit.id === 'alcohol')?.streak ?? 0,
    [badHabitStreaks],
  )

  const momentumValue = useMemo(() => {
    const recentDays = days.slice(-14)
    const loggedDays = recentDays.filter((day) => day.isLogged)
    if (loggedDays.length === 0) return 0
    return Math.max(0, Math.min(100, Math.round(loggedDays.reduce((sum, day) => sum + day.score, 0) / loggedDays.length)))
  }, [days])

  const momentumSparkline = useMemo(() => {
    const recentDays = days
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-7)

    if (recentDays.length === 0) {
      return [62, 70, 75, 68, 82, 88, 87]
    }

    return recentDays.map((day) => {
      if (!day.isLogged) return 20
      return Math.max(10, Math.min(100, Math.round(day.score)))
    })
  }, [days])

  const monthlyConsistency = useMemo(() => {
    return days
      .slice()
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-30)
      .map((day) => {
        if (!day.isLogged) return 0
        if (day.habitsTotal === 0) return 1
        const ratio = day.habitsCompleted / Math.max(day.habitsTotal, 1)
        if (ratio >= 0.9) return 4
        if (ratio >= 0.66) return 3
        if (ratio >= 0.33) return 2
        return 1
      })
  }, [days])

  const tasksPreview = useMemo(() => {
    return tasks
      .filter((task) => !task.completed)
      .slice()
      .sort((left, right) => {
        const priorityDiff = getTaskPriorityRank(left.priority) - getTaskPriorityRank(right.priority)
        if (priorityDiff !== 0) return priorityDiff
        const leftDue = left.dueDate ?? '9999-12-31'
        const rightDue = right.dueDate ?? '9999-12-31'
        if (leftDue !== rightDue) return leftDue.localeCompare(rightDue)
        return left.order - right.order
      })
      .slice(0, 3)
      .map((task) => ({
        id: task.id,
        title: task.text,
        priority: task.priority,
      }))
  }, [tasks])

  const journalEntries = useMemo(() => {
    return days
      .filter((day) => day.journal.trim() || day.dashboardQuickNote.trim())
      .slice()
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 3)
      .map((day) => ({
        id: day.id,
        date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${day.date}T00:00:00Z`)),
        text: day.journal.trim() || day.dashboardQuickNote.trim(),
      }))
  }, [days])

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-8">
      <section className="space-y-5 mb-8">
        <GreetingHeader
          subtitle={`${formatLongTodayLabel(todayIso)} — ${dueTodayCount} tasks due today, ${pendingHabitsCount} habit${pendingHabitsCount === 1 ? '' : 's'} pending`}
          momentumValue={`${momentumValue}%`}
          streakValue={showBadHabitTracking ? alcoholStreak : 0}
          weeklySummary={`${weeklyDoneCount} done this week · ${overdueCount} overdue`}
        />
        <TodayCommandCenter
          tasks={todayTasks.map((task) => ({
            id: task.id,
            title: task.text,
            goalLabel:
              lifeGoals.find((goal) => goal.id === (task.linkedDirectionId ?? task.linkedGoalId))?.title ?? 'Task list',
            dueLabel: formatShortDueLabel(task.dueDate, todayIso),
            guidance:
              task.notes.trim() || "You've been consistent this week — keep the momentum going.",
            priority: task.priority,
          }))}
          onOpenTask={onOpenTasks}
          onCompleteTask={onToggleTask}
        />
      </section>

      <section className="space-y-4 mb-8">
        <WeeklySummary
          days={weekDays}
          loggedCount={weeklyLoggedCount}
          habitCompletion={weeklyHabitCompletion}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <HabitsWeek habits={habitsWeek} onOpenTracker={onOpenTracker} />

          <div className="flex h-full flex-col justify-between gap-4">
            <GoalsNextAction
              goals={goalsNextAction}
              onOpenGoals={onOpenGoals}
              onOpenGoal={onOpenGoal}
              onOpenTask={setSelectedTaskPeekId}
            />
            <MomentumCard
              streak={showBadHabitTracking ? alcoholStreak : 0}
              momentum={momentumValue}
              sparklineData={momentumSparkline}
            />
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-zinc-800/60" />
          <span className="text-[10px] uppercase tracking-widest text-tertiary-content font-medium">
            Reflection
          </span>
          <div className="h-px flex-1 bg-zinc-800/60" />
        </div>
        <InsightLayer
          consistency={monthlyConsistency}
          tasks={tasksPreview}
          entries={journalEntries}
          onOpenTasks={onOpenTasks}
        />
      </section>

      {selectedTaskPeek && selectedTaskPeekData ? (
        <TaskPeek
          task={selectedTaskPeekData}
          open
          onClose={() => setSelectedTaskPeekId(null)}
          onComplete={(taskId) => {
            onToggleTask(taskId)
            setSelectedTaskPeekId(null)
          }}
          onDelete={(taskId) => {
            onDeleteTask(taskId)
            setSelectedTaskPeekId(null)
          }}
          onUpdate={(updatedTask: TaskPeekTaskData) => {
            onUpdateTask(selectedTaskPeek.id, (task) =>
              taskPeekDataToTask(task, updatedTask, {
                dueDate: updatedTask.dueDate ?? null,
                dueTime: updatedTask.dueTime ?? null,
                isSomeday: updatedTask.isSomeday === true,
                taskTag: updatedTask.tag ?? null,
                tagColor: updatedTask.tagColor ?? null,
                linkedGoalId: updatedTask.linkedGoalId ?? null,
                linkedDirectionId: updatedTask.linkedDirectionId ?? null,
                updatedAt: new Date().toISOString(),
              }),
            )
          }}
          goalOptions={goalOptions}
          directionOptions={directionOptions}
          linkedContextById={linkedContextById}
          onOpenLinkedGoal={onOpenGoal}
        />
      ) : null}
    </main>
  )
}
