import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar, type SidebarBadHabitStreak, type SidebarFocusTask, type SidebarTodayTask } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { AppPageRouter } from './components/layout/AppPageRouter'
import { PageContainer } from './components/layout/LayoutPrimitives'
import { DayDrawer } from './components/tracker/DayDrawer'
import { HabitTrackerEntryModal } from './components/tracker/HabitTrackerEntryModal'
import { HabitTrackerGoalModal } from './components/tracker/HabitTrackerGoalModal'
import { HabitTrackerSettingsModal } from './components/tracker/HabitTrackerSettingsModal'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { WeekDrawer } from './components/tracker/WeekDrawer'
import {
  createPersistedAppStateBackupSnapshot,
  createPersistedAppStateSnapshot,
  deletePersistedAppStateSnapshot,
  exportPersistedAppState,
  getDefaultPersistedAppState,
  getPersistedAppStateBackupFilename,
  getPersistedAppStateSnapshot,
  importPersistedAppState,
  listPersistedAppStateSnapshots,
  loadPersistedAppState,
  normalizeImportedPersistedAppState,
  savePersistedAppState,
  type PersistedAppState,
  type PersistedAppStateSnapshotSummary,
} from './lib/persistence'
import { useAppShellState } from './hooks/useAppShellState'
import { useHabitTrackerState } from './hooks/useHabitTrackerState'
import { useSettingsState } from './hooks/useSettingsState'
import { useTrackerState } from './hooks/useTrackerState'
import { APP_STATE_STORAGE_KEY } from './lib/persistence/keys'
import { repairDirectionalGoalTaskFieldsFromEmbedded } from './lib/persistence/migrations'
import { readJsonStorage } from './lib/persistence/storage'
import { LifeGoal, LifeGoalCategoryDefinition, PageId, Task } from './types'

type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'
type GoalDetailOrigin = 'tasks' | null
type AppHistoryState = {
  __appNavigation: true
  page: PageId
  goalsView: GoalsView
  selectedLifeGoalId: string | null
}

const GOALS_BASE_PATH = '/goals'

function buildAppPath(page: PageId, goalsView: GoalsView, selectedLifeGoalId: string | null) {
  if (page === 'goals') {
    return goalsView === 'life-detail' && selectedLifeGoalId
      ? `${GOALS_BASE_PATH}/${encodeURIComponent(selectedLifeGoalId)}`
      : GOALS_BASE_PATH
  }

  return '/'
}

function buildAppHistoryState(page: PageId, goalsView: GoalsView, selectedLifeGoalId: string | null): AppHistoryState {
  return {
    __appNavigation: true,
    page,
    goalsView,
    selectedLifeGoalId,
  }
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppHistoryState>
  return candidate.__appNavigation === true
}

function getInitialGoalUrlState(defaultSelectedLifeGoalId: string | null): {
  pageOverride: PageId | null
  goalsViewOverride: GoalsView | null
  selectedLifeGoalIdOverride: string | null
} {
  if (typeof window === 'undefined') {
    return {
      pageOverride: null,
      goalsViewOverride: null,
      selectedLifeGoalIdOverride: defaultSelectedLifeGoalId,
    }
  }

  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
  const historyState = window.history.state

  if (pathname === GOALS_BASE_PATH) {
    const persistedGoalsView =
      isAppHistoryState(historyState) &&
      historyState.page === 'goals' &&
      historyState.goalsView !== 'life-detail'
        ? historyState.goalsView
        : 'life-overview'
    return {
      pageOverride: 'goals',
      goalsViewOverride: persistedGoalsView,
      selectedLifeGoalIdOverride: defaultSelectedLifeGoalId,
    }
  }

  if (pathname.startsWith(`${GOALS_BASE_PATH}/`)) {
    const rawGoalId = pathname.slice(GOALS_BASE_PATH.length + 1)
    const nextGoalId = rawGoalId ? decodeURIComponent(rawGoalId) : defaultSelectedLifeGoalId
    return {
      pageOverride: 'goals',
      goalsViewOverride: nextGoalId ? 'life-detail' : 'life-overview',
      selectedLifeGoalIdOverride: nextGoalId,
    }
  }

  return {
    pageOverride: null,
    goalsViewOverride: null,
    selectedLifeGoalIdOverride: defaultSelectedLifeGoalId,
  }
}

export default function App() {
  const currentYear = new Date().getUTCFullYear()
  const persisted = useMemo(() => getDefaultPersistedAppState(currentYear), [currentYear])
  const initialGoalUrlState = useMemo(
    () => getInitialGoalUrlState(persisted.lifeGoals[0]?.id ?? null),
    [persisted],
  )
  const [hasHydratedFromStorage, setHasHydratedFromStorage] = useState(false)
  const [storageMode, setStorageMode] = useState<'indexeddb' | 'readonly-localstorage'>('indexeddb')
  const appShell = useAppShellState(
    initialGoalUrlState.pageOverride
      ? {
          ...persisted,
          page: initialGoalUrlState.pageOverride,
        }
      : persisted,
  )
  const settingsState = useSettingsState(persisted.settings)
  const trackerState = useTrackerState(persisted, currentYear, settingsState.settings.enableBadHabitTracking)
  const habitTrackerState = useHabitTrackerState(persisted)
  const [tasks, setTasks] = useState(persisted.tasks)
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>(persisted.lifeGoals)
  const [lifeGoalCategories, setLifeGoalCategories] = useState<LifeGoalCategoryDefinition[]>(persisted.lifeGoalCategories)
  const [snapshots, setSnapshots] = useState<PersistedAppStateSnapshotSummary[]>([])
  const [snapshotsLoading, setSnapshotsLoading] = useState(true)
  const [selectedLifeGoalId, setSelectedLifeGoalId] = useState<string | null>(initialGoalUrlState.selectedLifeGoalIdOverride)
  const [goalsView, setGoalsView] = useState<GoalsView>(initialGoalUrlState.goalsViewOverride ?? 'life-overview')
  const [goalDetailOrigin, setGoalDetailOrigin] = useState<GoalDetailOrigin>(null)
  const [outcomeGoalCategoryFilter, setOutcomeGoalCategoryFilter] = useState<string | null>(null)
  const [directionalGoalCategoryFilter, setDirectionalGoalCategoryFilter] = useState<string | null>(null)
  const [taskPeekRightOffset, setTaskPeekRightOffset] = useState(0)
  const isApplyingHistoryRef = useRef(false)
  const hasInitializedHistoryRef = useRef(false)
  const hasCreatedStartupSnapshotRef = useRef(false)
  const startupHydrationStatusRef = useRef<'idle' | 'running' | 'done'>('idle')
  const persistedSnapshotRef = useRef<PersistedAppState>(persisted)
  const latestAutoSnapshotFingerprintRef = useRef<string | null>(null)
  const pendingSnapshotFingerprintRef = useRef<string | null>(null)
  const hasCompletedStartupHydrationRef = useRef(false)
  const hasAttemptedDirectionalLegacyRepairRef = useRef(false)
  const appShellRef = useRef<HTMLDivElement | null>(null)

  const { settings, setSettings, hydrate: hydrateSettings } = settingsState
  const {
    page,
    setPage,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOrder,
    sidebarLabels,
    pageDevNotes,
    hydrate: hydrateAppShell,
  } = appShell

  useEffect(() => {
    const updateTaskPeekRightOffset = () => {
      if (typeof window === 'undefined') return
      const shellRect = appShellRef.current?.getBoundingClientRect()
      if (!shellRect) {
        setTaskPeekRightOffset(0)
        return
      }
      setTaskPeekRightOffset(Math.max(0, Math.round(window.innerWidth - shellRect.right)))
    }

    updateTaskPeekRightOffset()
    window.addEventListener('resize', updateTaskPeekRightOffset)
    return () => window.removeEventListener('resize', updateTaskPeekRightOffset)
  }, [hasHydratedFromStorage, sidebarCollapsed])
  const {
    dataByYear,
    habits,
    badHabits,
    badHabitLogs,
    activeBadHabits,
    visibleBadHabitStreaks,
    badHabitDateMap,
    tags,
    viewMode,
    setViewMode,
    colorMode,
    setColorMode,
    heatmapLayout,
    filters,
    setFilters,
    selectedWeekId,
    setSelectedWeekId,
    selectedDayId,
    setSelectedDayId,
    openDrawer,
    setOpenDrawer,
    moodHeatmapFocusDate,
    setMoodHeatmapFocusDate,
    moodHeatmapCalendarRange,
    setMoodHeatmapCalendarRange,
    moodHighlightCurrentWeek,
    setMoodHighlightCurrentWeek,
    moodShowAlcoholMarkers,
    setMoodShowAlcoholMarkers,
    moodShowHabitMarkers,
    setMoodShowHabitMarkers,
    dataset,
    computedWeeks,
    filteredDays,
    filteredWeeks,
    selectedWeek,
    selectedWeekDays,
    selectedDay,
    updateDay,
    updateDayByDate,
    toggleBadHabit,
    handleSelectTag,
    createTag,
    renameTag,
    updateTag,
    reorganizeTag,
    archiveTag,
    unarchiveTag,
    deleteTag,
    createBadHabit,
    updateBadHabit,
    archiveBadHabit,
    handleNavigateDay,
    openSpecificDay,
    openToday,
    deleteDayEntry,
    hydrate: hydrateTracker,
  } = trackerState
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const sidebarTodayTaskPool = useMemo(() => {
    const getPriorityRank = (priority: Task['priority']) => {
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

    const getDueRank = (task: Task) => {
      if (!task.dueDate) return 2
      if (task.dueDate < todayIso) return 0
      if (task.dueDate === todayIso) return 1
      return 3
    }

    const incompleteActiveTasks = tasks.filter((task) => !task.completed && task.isSomeday !== true)
    const actionableDueTasks = incompleteActiveTasks
      .filter((task) => task.dueDate !== null && task.dueDate <= todayIso)
      .slice()
      .sort((left, right) => {
        const dueRankDiff = getDueRank(left) - getDueRank(right)
        if (dueRankDiff !== 0) return dueRankDiff

        const priorityDiff = getPriorityRank(left.priority) - getPriorityRank(right.priority)
        if (priorityDiff !== 0) return priorityDiff

        if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate)
        }
        if (left.dueDate && !right.dueDate) return -1
        if (!left.dueDate && right.dueDate) return 1

        return left.order - right.order
      })

    if (actionableDueTasks.length > 0) {
      return actionableDueTasks
    }

    return incompleteActiveTasks
      .filter((task) => task.dueDate === null && task.priority === 'high')
      .slice()
      .sort((left, right) => left.order - right.order)
      .slice(0, 2)
  }, [tasks, todayIso])
  const sidebarTodayTasks = useMemo<SidebarTodayTask[]>(
    () =>
      sidebarTodayTaskPool.slice(0, 5).map((task) => ({
        id: task.id,
        text: task.text,
        dueDate: task.dueDate,
        priority: task.priority,
      })),
    [sidebarTodayTaskPool],
  )
  const sidebarTodayTaskCount = sidebarTodayTaskPool.length
  const sidebarFocusTask = useMemo<SidebarFocusTask | null>(() => {
    const incompleteActiveTasks = tasks.filter((task) => !task.completed && task.isSomeday !== true)

    const explicitFocusTask =
      incompleteActiveTasks
        .filter((task) => task.starred)
        .slice()
        .sort((left, right) => left.order - right.order)[0] ?? null

    const overdueHighPriorityTask =
      incompleteActiveTasks
        .filter((task) => task.priority === 'high' && task.dueDate !== null && task.dueDate < todayIso)
        .slice()
        .sort((left, right) => {
          if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
            return left.dueDate.localeCompare(right.dueDate)
          }
          return left.order - right.order
        })[0] ?? null

    const dueTodayTask =
      incompleteActiveTasks
        .filter((task) => task.dueDate === todayIso)
        .slice()
        .sort((left, right) => {
          const leftPriority = left.priority === 'high' ? 0 : left.priority === 'medium' ? 1 : left.priority === 'low' ? 2 : 3
          const rightPriority = right.priority === 'high' ? 0 : right.priority === 'medium' ? 1 : right.priority === 'low' ? 2 : 3
          if (leftPriority !== rightPriority) return leftPriority - rightPriority
          return left.order - right.order
        })[0] ?? null

    const highPriorityTask =
      incompleteActiveTasks
        .filter((task) => task.priority === 'high')
        .slice()
        .sort((left, right) => {
          if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
            return left.dueDate.localeCompare(right.dueDate)
          }
          if (left.dueDate && !right.dueDate) return -1
          if (!left.dueDate && right.dueDate) return 1
          return left.order - right.order
        })[0] ?? null

    const selectedTask = explicitFocusTask ?? overdueHighPriorityTask ?? dueTodayTask ?? highPriorityTask

    return selectedTask
      ? {
          id: selectedTask.id,
          text: selectedTask.text,
          dueDate: selectedTask.dueDate,
          priority: selectedTask.priority,
          starred: selectedTask.starred,
        }
      : null
  }, [tasks, todayIso])
  const sidebarBadHabitStreak = useMemo<SidebarBadHabitStreak | null>(() => {
    const alcoholVisibleStreak = visibleBadHabitStreaks.find(({ habit }) => habit.id === 'alcohol')
    if (alcoholVisibleStreak) {
      return {
        label: 'Alcohol-free',
        streak: alcoholVisibleStreak.streak,
      }
    }

    return null
  }, [visibleBadHabitStreaks])
  const handleCompleteSidebarTodayTask = useCallback((taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              completed: true,
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    )
  }, [])
  const availableYears = useMemo(
    () =>
      Array.from(new Set([...Object.keys(dataByYear).map((year) => Number(year)), currentYear]))
        .filter((year) => Number.isFinite(year))
        .sort((left, right) => right - left),
    [currentYear, dataByYear],
  )
  const {
    habitTrackers,
    editingTracker,
    setEditingTracker,
    goalEditingTracker,
    setGoalEditingTracker,
    habitEntryDraft,
    setHabitEntryDraft,
    moodCollapsed,
    collapsedTrackers,
    setCollapsedTrackers,
    habitTrackerPeriodView,
    setHabitTrackerPeriodView,
    habitTrackerFocusDate,
    setHabitTrackerFocusDate,
    habitTrackerCalendarRangeByTracker,
    setHabitTrackerCalendarRangeByTracker,
    createTracker,
    deleteTracker,
    clearTrackerAchievements,
    moveTrackerUp,
    moveTrackerDown,
    saveTracker,
    saveHabitEntry,
    useStreakPauseForToday,
    toggleHabitCompletion,
    hydrate: hydrateHabitTrackers,
  } = habitTrackerState

  const persistedSnapshot = useMemo<PersistedAppState>(() => ({
    dataByYear,
    habits,
    badHabits,
    badHabitLogs,
    tags,
    tasks,
    lifeGoals,
    lifeGoalCategories,
    settings,
    page,
    viewMode,
    colorMode,
    heatmapLayout,
    filters,
    selectedWeekId,
    selectedDayId,
    openDrawer,
    habitTrackers,
    editingTracker,
    habitEntryDraft,
    moodCollapsed,
    collapsedTrackers,
    sidebarCollapsed,
    sidebarOrder,
    sidebarLabels,
    pageDevNotes,
    habitTrackerPeriodView,
    habitTrackerFocusDate,
    habitTrackerCalendarRangeByTracker,
    moodHeatmapFocusDate,
    moodHeatmapCalendarRange,
    moodHighlightCurrentWeek,
    moodShowAlcoholMarkers,
    moodShowHabitMarkers,
  }), [
    dataByYear,
    habits,
    badHabits,
    badHabitLogs,
    tags,
    tasks,
    lifeGoals,
    lifeGoalCategories,
    settings,
    page,
    viewMode,
    colorMode,
    heatmapLayout,
    filters,
    selectedWeekId,
    selectedDayId,
    openDrawer,
    habitTrackers,
    editingTracker,
    habitEntryDraft,
    moodCollapsed,
    collapsedTrackers,
    sidebarCollapsed,
    sidebarOrder,
    sidebarLabels,
    pageDevNotes,
    habitTrackerPeriodView,
    habitTrackerFocusDate,
    habitTrackerCalendarRangeByTracker,
    moodHeatmapFocusDate,
    moodHeatmapCalendarRange,
    moodHighlightCurrentWeek,
    moodShowAlcoholMarkers,
    moodShowHabitMarkers,
  ])

  const persistedSnapshotFingerprint = useMemo(() => JSON.stringify(persistedSnapshot), [persistedSnapshot])

  const applyPersistedState = useCallback((next: PersistedAppState) => {
    hydrateSettings(next.settings)
    hydrateTracker(next)
    hydrateHabitTrackers(next)
    setTasks(next.tasks)
    setLifeGoals(next.lifeGoals)
    setLifeGoalCategories(next.lifeGoalCategories)
  }, [hydrateHabitTrackers, hydrateSettings, hydrateTracker])

  useEffect(() => {
    persistedSnapshotRef.current = persistedSnapshot
    pendingSnapshotFingerprintRef.current = persistedSnapshotFingerprint
  }, [persistedSnapshot, persistedSnapshotFingerprint])

  useEffect(() => {
    if (!hasHydratedFromStorage || hasAttemptedDirectionalLegacyRepairRef.current) return
    hasAttemptedDirectionalLegacyRepairRef.current = true

    const directionalGoalIds = new Set(
      lifeGoals
        .filter((goal) => (goal.goalType ?? 'outcome') === 'directional')
        .map((goal) => goal.id),
    )
    if (directionalGoalIds.size === 0) return

    const hasLegacyDirectionalCandidates = tasks.some((task) =>
      !task.linkedDirectionId &&
      typeof task.linkedGoalId === 'string' &&
      directionalGoalIds.has(task.linkedGoalId),
    )
    if (!hasLegacyDirectionalCandidates) return

    const runtimeLegacySourceLifeGoals = lifeGoals as Array<LifeGoal & { tasks?: unknown[] }>
    const hasEmbeddedDirectionalTasksInLoadedState = runtimeLegacySourceLifeGoals.some((goal) =>
      (goal.goalType ?? 'outcome') === 'directional' &&
      Array.isArray(goal.tasks) &&
      goal.tasks.length > 0,
    )

    let legacySourceLifeGoals: unknown[] | null = hasEmbeddedDirectionalTasksInLoadedState ? runtimeLegacySourceLifeGoals : null

    if (!legacySourceLifeGoals && typeof window !== 'undefined') {
      const legacyState = readJsonStorage<Partial<PersistedAppState>>(APP_STATE_STORAGE_KEY)
      if (legacyState && Array.isArray(legacyState.lifeGoals)) {
        legacySourceLifeGoals = legacyState.lifeGoals
      }
    }

    if (!legacySourceLifeGoals) return

    const repaired = repairDirectionalGoalTaskFieldsFromEmbedded({
      tasks,
      lifeGoals: legacySourceLifeGoals,
    })
    if (!Array.isArray(repaired.tasks)) return

    const nextTasks = repaired.tasks
    const changed =
      nextTasks.length !== tasks.length ||
      nextTasks.some((task, index) => JSON.stringify(task) !== JSON.stringify(tasks[index]))

    if (!changed) return

    setTasks(nextTasks)

    const isDevelopmentRuntime =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    if (isDevelopmentRuntime) {
      console.info('[directional-task-repair] applied live-state repair', {
        source: hasEmbeddedDirectionalTasksInLoadedState ? 'loaded-state' : 'legacy-localstorage',
      })
    }
  }, [hasHydratedFromStorage, lifeGoals, tasks])

  useEffect(() => {
    if (startupHydrationStatusRef.current === 'running' || startupHydrationStatusRef.current === 'done') return
    startupHydrationStatusRef.current = 'running'

    let cancelled = false
    let hydrationCompleted = false

    console.info('[app-startup] appHydrationEffectStart', { currentYear })

    const finishHydration = (reason: string) => {
      if (cancelled || hydrationCompleted) return
      hydrationCompleted = true
      startupHydrationStatusRef.current = 'done'
      hasCompletedStartupHydrationRef.current = true
      console.info('[app-startup] hydrationComplete', { reason })
      setHasHydratedFromStorage(true)
    }

    const hydrationTimeoutId = window.setTimeout(() => {
      if (hydrationCompleted || cancelled) return
      console.error('[app-startup] hydrationTimeout', { timeoutMs: 5000 })
      setStorageMode('readonly-localstorage')
      const fallbackState = getDefaultPersistedAppState(currentYear)
      try {
        applyPersistedState(fallbackState)
        hydrateAppShell(fallbackState)
        setSelectedLifeGoalId(fallbackState.lifeGoals[0]?.id ?? null)
        setGoalsView('life-overview')
        console.info('[app-startup] timeoutFallbackApplied', { source: 'default-state' })
      } catch (error) {
        console.error('[app-startup] timeoutFallbackFailed', error)
      } finally {
        finishHydration('timeout-default-fallback')
      }
    }, 5000)

    const hydrateFromPersistence = async () => {
      try {
        const loaded = await loadPersistedAppState(currentYear)
        if (cancelled) return

        setStorageMode(loaded.storageMode)

        const nextGoalUrlState = getInitialGoalUrlState(loaded.state.lifeGoals[0]?.id ?? null)
        const nextShellState = nextGoalUrlState.pageOverride
          ? {
              ...loaded.state,
              page: nextGoalUrlState.pageOverride,
            }
          : loaded.state

        console.info('[app-startup] applyPersistedStateStart', { storageMode: loaded.storageMode })
        applyPersistedState(loaded.state)
        hydrateAppShell(nextShellState)
        setSelectedLifeGoalId(nextGoalUrlState.selectedLifeGoalIdOverride)
        setGoalsView(nextGoalUrlState.goalsViewOverride ?? 'life-overview')
        console.info('[app-startup] applyPersistedStateSuccess', { storageMode: loaded.storageMode })
      } finally {
        finishHydration('startup-load')
      }
    }

    hydrateFromPersistence().catch((error) => {
      console.error('[app-startup] hydrateFromPersistenceFailed', error)
      try {
        setStorageMode('readonly-localstorage')
        const fallbackState = getDefaultPersistedAppState(currentYear)
        applyPersistedState(fallbackState)
        hydrateAppShell(fallbackState)
        setSelectedLifeGoalId(fallbackState.lifeGoals[0]?.id ?? null)
        setGoalsView('life-overview')
        console.info('[app-startup] errorFallbackApplied', { source: 'default-state' })
      } catch (fallbackError) {
        console.error('[app-startup] errorFallbackFailed', fallbackError)
      } finally {
        finishHydration('error-default-fallback')
      }
    })

    return () => {
      cancelled = true
      if (!hydrationCompleted && startupHydrationStatusRef.current === 'running') {
        startupHydrationStatusRef.current = 'idle'
      }
      window.clearTimeout(hydrationTimeoutId)
    }
  }, [applyPersistedState, currentYear, hydrateAppShell])

  useEffect(() => {
    if (typeof window === 'undefined' || hasHydratedFromStorage) return
    console.info('[app-startup] loadingGate', {
      hasHydratedFromStorage,
      hasCompletedStartupHydration: hasCompletedStartupHydrationRef.current,
      startupHydrationStatus: startupHydrationStatusRef.current,
      storageMode,
    })
  }, [hasHydratedFromStorage, storageMode])

  useEffect(() => {
    if (!hasHydratedFromStorage || storageMode !== 'indexeddb' || typeof window === 'undefined') return

    const timeoutId = window.setTimeout(() => {
      void savePersistedAppState(persistedSnapshot)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [hasHydratedFromStorage, persistedSnapshot, storageMode])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const applyLocationState = (historyState: unknown) => {
      const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

      isApplyingHistoryRef.current = true

      if (pathname === GOALS_BASE_PATH) {
        const restoredGoalsView =
          isAppHistoryState(historyState) &&
          historyState.page === 'goals' &&
          historyState.goalsView !== 'life-detail'
            ? historyState.goalsView
            : 'life-overview'
        setPage('goals')
        setGoalsView(restoredGoalsView)
        return
      }

      if (pathname.startsWith(`${GOALS_BASE_PATH}/`)) {
        const rawGoalId = pathname.slice(GOALS_BASE_PATH.length + 1)
        const nextGoalId = rawGoalId ? decodeURIComponent(rawGoalId) : null
        setPage('goals')
        setGoalsView(nextGoalId ? 'life-detail' : 'life-overview')
        if (nextGoalId) {
          setSelectedLifeGoalId(nextGoalId)
        }
        return
      }

      if (isAppHistoryState(historyState)) {
        setPage(historyState.page)
        setGoalsView(historyState.goalsView)
        setSelectedLifeGoalId(historyState.selectedLifeGoalId)
      }
    }

    applyLocationState(window.history.state)
    hasInitializedHistoryRef.current = true

    const handlePopState = (event: PopStateEvent) => {
      applyLocationState(event.state)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setPage])

  useEffect(() => {
    if (page !== 'goals' || goalsView !== 'life-detail') {
      setGoalDetailOrigin(null)
    }
  }, [goalsView, page])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasInitializedHistoryRef.current) return

    const nextPath = buildAppPath(page, goalsView, selectedLifeGoalId)
    const nextState = buildAppHistoryState(page, goalsView, selectedLifeGoalId)
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/'
    const currentState = window.history.state
    const matchesCurrentState =
      isAppHistoryState(currentState) &&
      currentState.page === nextState.page &&
      currentState.goalsView === nextState.goalsView &&
      currentState.selectedLifeGoalId === nextState.selectedLifeGoalId

    if (currentPath === nextPath && matchesCurrentState) {
      isApplyingHistoryRef.current = false
      return
    }

    if (isApplyingHistoryRef.current) {
      window.history.replaceState(nextState, '', nextPath)
      isApplyingHistoryRef.current = false
      return
    }

    window.history.pushState(nextState, '', nextPath)
  }, [goalsView, page, selectedLifeGoalId])

  const refreshSnapshots = useCallback(async () => {
    setSnapshotsLoading(true)
    try {
      const nextSnapshots = await listPersistedAppStateSnapshots()
      setSnapshots(nextSnapshots)
    } finally {
      setSnapshotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedFromStorage) return

    let cancelled = false

    const initializeSnapshots = async () => {
      if (!hasCreatedStartupSnapshotRef.current) {
        const createdSnapshot = await createPersistedAppStateSnapshot({
          payload: persistedSnapshotRef.current,
          snapshotType: 'auto',
        })
        if (createdSnapshot) {
          latestAutoSnapshotFingerprintRef.current = pendingSnapshotFingerprintRef.current
        }
        hasCreatedStartupSnapshotRef.current = true
      }

      const nextSnapshots = await listPersistedAppStateSnapshots()
      if (!cancelled) {
        setSnapshots(nextSnapshots)
        setSnapshotsLoading(false)
      }
    }

    initializeSnapshots().catch(() => {
      if (!cancelled) {
        setSnapshotsLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [hasHydratedFromStorage])

  useEffect(() => {
    if (!hasHydratedFromStorage || typeof window === 'undefined') return

    const intervalId = window.setInterval(() => {
      const pendingFingerprint = pendingSnapshotFingerprintRef.current
      if (!pendingFingerprint || pendingFingerprint === latestAutoSnapshotFingerprintRef.current) return

      void createPersistedAppStateSnapshot({
        payload: persistedSnapshotRef.current,
        snapshotType: 'auto',
      }).then((createdSnapshot) => {
        if (!createdSnapshot) return
        latestAutoSnapshotFingerprintRef.current = pendingFingerprint
        void refreshSnapshots()
      })
    }, 5 * 60 * 1000)

    return () => window.clearInterval(intervalId)
  }, [hasHydratedFromStorage, refreshSnapshots])

  const handleExportState = () => {
    const backupSnapshot = createPersistedAppStateBackupSnapshot(persistedSnapshot)
    const blob = new Blob([exportPersistedAppState(backupSnapshot)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getPersistedAppStateBackupFilename()
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportState = async (file: File) => {
    try {
      await createPersistedAppStateSnapshot({
        payload: persistedSnapshotRef.current,
        snapshotType: 'pre_import',
        force: true,
      })
      const raw = await file.text()
      const imported = importPersistedAppState(raw, currentYear)
      applyPersistedState(imported)
      await refreshSnapshots()
      window.alert('Backup restored successfully.')
    } catch {
      window.alert('That backup file could not be imported.')
    }
  }

  const handleCreateBackupNow = useCallback(async () => {
    await createPersistedAppStateSnapshot({
      payload: persistedSnapshotRef.current,
      snapshotType: 'manual',
    })
    await refreshSnapshots()
  }, [refreshSnapshots])

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!window.confirm('Restore this snapshot and replace the current app state?')) return

    try {
      await createPersistedAppStateSnapshot({
        payload: persistedSnapshotRef.current,
        snapshotType: 'pre_restore',
        force: true,
      })
      const snapshot = await getPersistedAppStateSnapshot(snapshotId)
      if (!snapshot) {
        window.alert('That snapshot could not be loaded.')
        return
      }
      const restored = normalizeImportedPersistedAppState(snapshot.payload, currentYear)
      applyPersistedState(restored)
      await refreshSnapshots()
      window.alert('Snapshot restored successfully.')
    } catch {
      window.alert('That snapshot could not be restored.')
    }
  }, [applyPersistedState, currentYear, refreshSnapshots])

  const handleDeleteSnapshot = useCallback(async (snapshotId: string) => {
    if (!window.confirm('Delete this snapshot?')) return

    const deleted = await deletePersistedAppStateSnapshot(snapshotId)
    if (!deleted) {
      window.alert('That snapshot could not be deleted.')
      return
    }
    await refreshSnapshots()
  }, [refreshSnapshots])

  const handleAddCurrentFocusToTodayLog = useCallback((task: Task) => {
    const todayIso = new Date().toISOString().slice(0, 10)
    updateDayByDate(todayIso, (day) => {
      const trimmedText = task.text.trim()
      if (!trimmedText) return day
      const existingEntries = day.bigWin
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)
      if (existingEntries.includes(trimmedText)) return day
      return {
        ...day,
        isLogged: true,
        bigWin: [...existingEntries, trimmedText].join('\n'),
      }
    })
  }, [updateDayByDate])

  if (!hasHydratedFromStorage) {
    return (
      <div className="app-grid theme-text-primary min-h-screen bg-ink" style={{ minHeight: '100vh' }}>
        <div className="mx-auto flex min-h-screen w-full max-w-[1720px] items-center justify-center px-6 2xl:max-w-[1840px]">
          <div className="theme-surface-soft rounded-2xl border px-5 py-3 text-sm theme-text-muted">
            Loading your dashboard…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-grid theme-text-primary min-h-screen bg-ink" style={{ minHeight: '100vh' }}>
      <div ref={appShellRef} className="mx-auto flex min-h-screen w-full max-w-[1720px] flex-col lg:flex-row lg:items-start 2xl:max-w-[1840px]">
        <Sidebar
          page={page}
          setPage={(nextPage) => {
            setPage(nextPage)
            setOpenDrawer(null)
          }}
          goalsView={goalsView}
          setGoalsView={setGoalsView}
          openToday={openToday}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          todayTasks={sidebarTodayTasks}
          todayTaskCount={sidebarTodayTaskCount}
          focusTask={sidebarFocusTask}
          showBadHabitStreak={settings.enableBadHabitTracking}
          badHabitStreak={sidebarBadHabitStreak}
          onCompleteTodayTask={handleCompleteSidebarTodayTask}
        />

        <div className="min-w-0 flex-1">
          <TopBar page={page} onOpenToday={() => openToday(false, setPage)} goalsView={goalsView} />
          <main className="py-5 sm:py-6">
            <PageContainer width="wide">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28 }}>
                <AppPageRouter
                  page={page}
                  computedWeeks={computedWeeks}
                  dataset={dataset}
                  tags={tags}
                  tasks={tasks}
                  lifeGoals={lifeGoals}
                  lifeGoalCategories={lifeGoalCategories}
                  habitTrackers={habitTrackers}
                  filters={filters}
                  visibleBadHabitStreaks={visibleBadHabitStreaks}
                  settings={settings}
                  updateDay={updateDay}
                  setTasks={setTasks}
                  openToday={openToday}
                  setPage={setPage}
                  setViewMode={setViewMode}
                  setFilters={setFilters}
                  openSpecificDay={openSpecificDay}
                  setSelectedWeekId={setSelectedWeekId}
                  setSelectedDayId={setSelectedDayId}
                  setOpenDrawer={setOpenDrawer}
                  viewMode={viewMode}
                  colorMode={colorMode}
                  setColorMode={setColorMode}
                  availableYears={availableYears}
                  filteredWeeks={filteredWeeks}
                  filteredDays={filteredDays}
                  habits={habits}
                  badHabits={badHabits}
                  selectedWeek={selectedWeek}
                  selectedWeekDays={selectedWeekDays}
                  selectedDay={selectedDay}
                  moodHeatmapFocusDate={moodHeatmapFocusDate}
                  setMoodHeatmapFocusDate={setMoodHeatmapFocusDate}
                  moodHeatmapCalendarRange={moodHeatmapCalendarRange}
                  setMoodHeatmapCalendarRange={setMoodHeatmapCalendarRange}
                  moodHighlightCurrentWeek={moodHighlightCurrentWeek}
                  setMoodHighlightCurrentWeek={setMoodHighlightCurrentWeek}
                  moodShowAlcoholMarkers={moodShowAlcoholMarkers}
                  setMoodShowAlcoholMarkers={setMoodShowAlcoholMarkers}
                  moodShowHabitMarkers={moodShowHabitMarkers}
                  setMoodShowHabitMarkers={setMoodShowHabitMarkers}
                  badHabitDateMap={badHabitDateMap}
                  heatmapLayout={heatmapLayout}
                  habitTrackerPeriodView={habitTrackerPeriodView}
                  setHabitTrackerPeriodView={setHabitTrackerPeriodView}
                  habitTrackerFocusDate={habitTrackerFocusDate}
                  setHabitTrackerFocusDate={setHabitTrackerFocusDate}
                  habitTrackerCalendarRangeByTracker={habitTrackerCalendarRangeByTracker}
                  setHabitTrackerCalendarRangeByTracker={setHabitTrackerCalendarRangeByTracker}
                  habitEntryDraft={habitEntryDraft}
                  setHabitEntryDraft={setHabitEntryDraft}
                  collapsedTrackers={collapsedTrackers}
                  setCollapsedTrackers={setCollapsedTrackers}
                  createTracker={createTracker}
                  setEditingTracker={setEditingTracker}
                  setGoalEditingTracker={setGoalEditingTracker}
                  useStreakPauseForToday={useStreakPauseForToday}
                  saveTracker={saveTracker}
                  updateDayByDate={updateDayByDate}
                  createBadHabit={createBadHabit}
                  updateBadHabit={updateBadHabit}
                  archiveBadHabit={archiveBadHabit}
                  setSettings={setSettings}
                  handleExportState={handleExportState}
                  handleImportState={handleImportState}
                  snapshots={snapshots}
                  snapshotsLoading={snapshotsLoading}
                  handleCreateBackupNow={handleCreateBackupNow}
                  handleRestoreSnapshot={handleRestoreSnapshot}
                  handleDeleteSnapshot={handleDeleteSnapshot}
                  taskPeekRightOffset={taskPeekRightOffset}
                  setLifeGoals={setLifeGoals}
                  handleAddCurrentFocusToTodayLog={handleAddCurrentFocusToTodayLog}
                  setGoalDetailOrigin={setGoalDetailOrigin}
                  setSelectedLifeGoalId={setSelectedLifeGoalId}
                  setGoalsView={setGoalsView}
                  goalsView={goalsView}
                  outcomeGoalCategoryFilter={outcomeGoalCategoryFilter}
                  directionalGoalCategoryFilter={directionalGoalCategoryFilter}
                  selectedLifeGoalId={selectedLifeGoalId}
                  goalDetailOrigin={goalDetailOrigin}
                  setLifeGoalCategories={setLifeGoalCategories}
                />
              </motion.div>
            </PageContainer>
          </main>
        </div>
      </div>

      <WeekDrawer
        open={openDrawer === 'week'}
        week={selectedWeek}
        days={selectedWeekDays}
        tags={tags}
        showBadHabitTracking={settings.enableBadHabitTracking}
        onClose={() => setOpenDrawer(null)}
        onOpenDay={(day) => {
          setSelectedDayId(day.id)
          setOpenDrawer('day')
        }}
      />

      <DayDrawer
        open={openDrawer === 'day'}
        day={selectedDay}
        allDays={dataset.days}
        week={selectedWeek}
        tags={tags}
        habitTrackers={habitTrackers}
        badHabits={activeBadHabits}
        badHabitDateMap={badHabitDateMap}
        enableBadHabitTracking={settings.enableBadHabitTracking}
        enableMedicationTracking={settings.enableMedicationTracking}
        onClose={() => setOpenDrawer(null)}
        onSelectTag={handleSelectTag}
        onCreateTag={createTag}
        onRenameTag={renameTag}
        onUpdateTag={updateTag}
        onReorganizeTag={reorganizeTag}
        onArchiveTag={archiveTag}
        onUnarchiveTag={unarchiveTag}
        onDeleteTag={deleteTag}
        onNavigateDay={handleNavigateDay}
        onUpdateDay={updateDay}
        onToggleHabit={toggleHabitCompletion}
        onToggleBadHabit={toggleBadHabit}
        onDeleteDay={deleteDayEntry}
      />

      <ErrorBoundary title="Habit settings unavailable" description="This habit modal could not be displayed right now.">
        <HabitTrackerSettingsModal
          tracker={editingTracker}
          lifeGoals={lifeGoals}
          open={Boolean(editingTracker)}
          enableBadHabitTracking={settings.enableBadHabitTracking}
          onClose={() => setEditingTracker(null)}
          onOpenGoal={(tracker) => setGoalEditingTracker(tracker)}
          onDelete={(trackerId) => {
            deleteTracker(trackerId)
          }}
          onClearAchievements={(trackerId) => {
            clearTrackerAchievements(trackerId)
          }}
          onMoveUp={moveTrackerUp}
          onMoveDown={moveTrackerDown}
          canMoveUp={editingTracker ? habitTrackers.findIndex((tracker) => tracker.id === editingTracker.id) > 0 : false}
          canMoveDown={
            editingTracker
              ? habitTrackers.findIndex((tracker) => tracker.id === editingTracker.id) > -1 &&
                habitTrackers.findIndex((tracker) => tracker.id === editingTracker.id) < habitTrackers.length - 1
              : false
          }
          onSave={saveTracker}
        />
      </ErrorBoundary>

      <ErrorBoundary title="Habit goal unavailable" description="This habit goal surface could not be displayed right now.">
        <HabitTrackerGoalModal
          tracker={goalEditingTracker}
          open={Boolean(goalEditingTracker)}
          onClose={() => setGoalEditingTracker(null)}
          onSave={saveTracker}
        />
      </ErrorBoundary>

      <ErrorBoundary title="Habit entry unavailable" description="This habit entry surface could not be displayed right now.">
        <HabitTrackerEntryModal
          open={Boolean(habitEntryDraft)}
          onClose={() => setHabitEntryDraft(null)}
          trackerTitle={habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.title ?? 'Habit tracker'}
          trackerColor={habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.color ?? '#17C964'}
          trackerType={habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.habitType ?? 'checkbox'}
          date={habitEntryDraft?.date ?? new Date().toISOString().slice(0, 10)}
          hasGoal={Boolean(habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.goal)}
          completed={habitEntryDraft?.completed ?? false}
          paused={habitEntryDraft?.paused ?? false}
          value={habitEntryDraft?.value ?? null}
          note={habitEntryDraft?.note ?? ''}
          onOpenGoal={() => {
            const tracker = habitTrackers.find((item) => item.id === habitEntryDraft?.trackerId)
            if (!tracker) return
            setHabitEntryDraft(null)
            setGoalEditingTracker(tracker)
          }}
          onChange={(next) => setHabitEntryDraft((current) => (current ? { ...current, ...next } : current))}
          onSave={saveHabitEntry}
        />
      </ErrorBoundary>
    </div>
  )
}
