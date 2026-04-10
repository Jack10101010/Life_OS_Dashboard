import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { PageContainer } from './components/layout/LayoutPrimitives'
import { DayDrawer } from './components/tracker/DayDrawer'
import { HabitTrackerEntryModal } from './components/tracker/HabitTrackerEntryModal'
import { HabitTrackerGoalModal } from './components/tracker/HabitTrackerGoalModal'
import { HabitTrackerSettingsModal } from './components/tracker/HabitTrackerSettingsModal'
import { DevNotesCard } from './components/ui/DevNotesCard'
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
import { DashboardPage } from './features/dashboard/DashboardPage'
import { GoalsPage } from './features/goals/GoalsPage'
import { HabitMapsPage } from './features/habit-maps/HabitMapsPage'
import { JournalPage } from './features/journal/JournalPage'
import { PlaceholderPage } from './features/placeholder/PlaceholderPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TrackerWorkspace } from './features/tracker/TrackerWorkspace'
import { YourDaysPage } from './features/your-days/YourDaysPage'
import { LifeGoal, LifeGoalCategoryColor, LifeGoalCategoryDefinition, PageId } from './types'

const DEV_NOTES_ENABLED_PAGES: PageId[] = ['tasks', 'notes', 'analytics', 'trade-log', 'settings']
type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'
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

  if (pathname === GOALS_BASE_PATH) {
    return {
      pageOverride: 'goals',
      goalsViewOverride: 'life-overview',
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
  const isApplyingHistoryRef = useRef(false)
  const hasInitializedHistoryRef = useRef(false)
  const hasCreatedStartupSnapshotRef = useRef(false)
  const startupHydrationStatusRef = useRef<'idle' | 'running' | 'done'>('idle')
  const persistedSnapshotRef = useRef<PersistedAppState>(persisted)
  const latestAutoSnapshotFingerprintRef = useRef<string | null>(null)
  const pendingSnapshotFingerprintRef = useRef<string | null>(null)
  const hasCompletedStartupHydrationRef = useRef(false)

  const { settings, setSettings, hydrate: hydrateSettings } = settingsState
  const {
    page,
    setPage,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOrder,
    setSidebarOrder,
    sidebarLabels,
    setSidebarLabels,
    pageDevNotes,
    setPageDevNotes,
    hydrate: hydrateAppShell,
  } = appShell
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
        setPage('goals')
        setGoalsView('life-overview')
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

  const renderPage = () => {
    if (page === 'dashboard') {
      return (
        <DashboardPage
          weeks={computedWeeks}
          days={dataset.days}
          tags={tags}
          tasks={tasks}
          lifeGoals={lifeGoals}
          habitTrackers={habitTrackers}
          year={filters.year}
          badHabitStreaks={visibleBadHabitStreaks}
          showBadHabitTracking={settings.enableBadHabitTracking}
          onUpdateDay={updateDay}
          onAddTask={(text) =>
            setTasks((current) => [
              {
                id: `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                text: text.trim(),
                order: current.length,
                dueDate: new Date().toISOString().slice(0, 10),
                starred: false,
                important: false,
                linkedGoalId: null,
                linkedDirectionId: null,
                completed: false,
                completedAt: null,
              },
              ...current,
            ])
          }
          onToggleTaskStarred={(taskId) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      starred: !task.starred,
                    }
                  : task,
              ),
            )
          }
          onToggleTaskImportant={(taskId) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      important: !task.important,
                    }
                  : task,
              ),
            )
          }
          onToggleTask={(taskId) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      completed: !task.completed,
                      completedAt: !task.completed ? new Date().toISOString() : null,
                    }
                  : task,
              ),
            )
          }
          onDeleteTask={(taskId) => setTasks((current) => current.filter((task) => task.id !== taskId))}
          onUpdateTask={(taskId, updater) =>
            setTasks((current) =>
              current.map((task) => (task.id === taskId ? updater(task) : task)),
            )
          }
          onOpenToday={() => openToday(false, setPage)}
          onOpenFullNote={() => openToday(true, setPage)}
          onOpenTracker={() => {
            setPage('tracker')
            setViewMode('days')
          }}
          onOpenGoals={() => setPage('goals')}
          onOpenDay={(day) => openSpecificDay(Number(day.date.slice(0, 4)), day.id, day.linkedWeek)}
          onOpenWeek={(week) => {
            setSelectedWeekId(week.id)
            setOpenDrawer('week')
          }}
          onGoToTrackerWeek={(week) => {
            setPage('tracker')
            setViewMode('weeks')
            setSelectedWeekId(week.id)
            setOpenDrawer('week')
          }}
        />
      )
    }

    if (page === 'tracker') {
      return (
        <TrackerWorkspace
          trackerPage={{
            viewMode,
            onViewModeChange: setViewMode,
            colorMode,
            onColorModeChange: setColorMode,
            year: filters.year,
            onYearChange: (year) => setFilters((current) => ({ ...current, year })),
            years: availableYears,
            filters,
            onFiltersChange: setFilters,
            allWeeks: computedWeeks,
            weeks: filteredWeeks,
            days: filteredDays,
            allDays: dataset.days,
            habits,
            badHabits,
            habitTrackers,
            tags,
            selectedWeek,
            selectedWeekDays,
            selectedDay,
            moodHeatmapFocusDate,
            onMoodHeatmapFocusDateChange: setMoodHeatmapFocusDate,
            moodHeatmapCalendarRange,
            onMoodHeatmapCalendarRangeChange: setMoodHeatmapCalendarRange,
            moodHighlightCurrentWeek,
            onMoodHighlightCurrentWeekChange: setMoodHighlightCurrentWeek,
            moodShowBadHabitMarkers: moodShowAlcoholMarkers,
            onMoodShowAlcoholMarkersChange: setMoodShowAlcoholMarkers,
            moodShowHabitMarkers,
            onMoodShowHabitMarkersChange: setMoodShowHabitMarkers,
            enableBadHabitTracking: settings.enableBadHabitTracking,
            badHabitDateMap,
            onLogToday: () => openToday(false, setPage),
            onSelectWeek: (week) => {
              setSelectedWeekId(week.id)
              setOpenDrawer('week')
            },
            onPreviewWeek: (week) => {
              setSelectedWeekId(week.id)
            },
            onSelectDay: (day) => {
              setSelectedDayId(day.id)
              setOpenDrawer('day')
            },
          }}
          customTrackers={{
            tags,
            heatmapLayout,
            year: filters.year,
            habitTrackers,
            badHabitDateMap,
            enableBadHabitTracking: settings.enableBadHabitTracking,
            habitTrackerPeriodView,
            habitTrackerFocusDate,
            habitTrackerCalendarRangeByTracker,
            habitEntryDraft,
            collapsedTrackers,
            onCreateTracker: createTracker,
            onPeriodViewChange: setHabitTrackerPeriodView,
            onToggleCollapse: (trackerId) =>
              setCollapsedTrackers((current) => ({ ...current, [trackerId]: !current[trackerId] })),
            onShiftPeriod: setHabitTrackerFocusDate,
            onCalendarRangeChange: (trackerId, next) =>
              setHabitTrackerCalendarRangeByTracker((current) => ({ ...current, [trackerId]: next })),
            onSelectDate: (tracker, date) => {
              const entry = tracker.entries[date]
              setHabitTrackerFocusDate(date)
              setHabitEntryDraft({
                trackerId: tracker.id,
                date,
                completed: entry?.completed ?? false,
                paused: entry?.paused ?? false,
                value: entry?.value ?? null,
                note: entry?.note ?? '',
              })
            },
            onOpenSettings: setEditingTracker,
            onOpenGoalSetup: setGoalEditingTracker,
            onUseStreakPause: (tracker, date) => useStreakPauseForToday(tracker.id, date),
          }}
        />
      )
    }

    if (page === 'habit-maps') {
      return (
        <HabitMapsPage
          tags={tags}
          heatmapLayout={heatmapLayout}
          year={filters.year}
          habitTrackers={habitTrackers}
          badHabitDateMap={badHabitDateMap}
          enableBadHabitTracking={settings.enableBadHabitTracking}
          habitTrackerPeriodView={habitTrackerPeriodView}
          habitTrackerFocusDate={habitTrackerFocusDate}
          habitTrackerCalendarRangeByTracker={habitTrackerCalendarRangeByTracker}
          habitEntryDraft={habitEntryDraft}
          collapsedTrackers={collapsedTrackers}
          onCreateTracker={createTracker}
          onPeriodViewChange={setHabitTrackerPeriodView}
          onToggleCollapse={(trackerId) =>
            setCollapsedTrackers((current) => ({ ...current, [trackerId]: !current[trackerId] }))
          }
          onShiftPeriod={setHabitTrackerFocusDate}
          onCalendarRangeChange={(trackerId, next) =>
            setHabitTrackerCalendarRangeByTracker((current) => ({ ...current, [trackerId]: next }))
          }
          onSelectDate={(tracker, date) => {
            const entry = tracker.entries[date]
            setHabitTrackerFocusDate(date)
            setHabitEntryDraft({
              trackerId: tracker.id,
              date,
              completed: entry?.completed ?? false,
              paused: entry?.paused ?? false,
              value: entry?.value ?? null,
              note: entry?.note ?? '',
            })
          }}
          onOpenSettings={setEditingTracker}
          onOpenGoalSetup={setGoalEditingTracker}
          onUseStreakPause={(tracker, date) => useStreakPauseForToday(tracker.id, date)}
        />
      )
    }

    if (page === 'your-days') {
      return (
        <YourDaysPage
          days={dataset.days}
          tags={tags}
          onOpenDay={(day) => {
            setPage('tracker')
            setSelectedDayId(day.id)
            setSelectedWeekId(day.linkedWeek)
            setOpenDrawer('day')
          }}
        />
      )
    }

    if (page === 'journal-recordings' || page === 'gratitude' || page === 'vision-board') {
      return (
        <JournalPage
          entries={dataset.days}
          initialSection={page === 'gratitude' ? 'gratitude' : page === 'vision-board' ? 'vision-board' : 'journal'}
          onUpdateDay={updateDay}
          onOpenDay={(day) => {
            setPage('tracker')
            setSelectedDayId(day.id)
            setSelectedWeekId(day.linkedWeek)
            setOpenDrawer('day')
          }}
        />
      )
    }

    if (page === 'settings') {
      return (
        <SettingsPage
          settings={settings}
          habits={habits}
          badHabits={badHabits}
          onUpdateSettings={setSettings}
          onCreateBadHabit={createBadHabit}
          onUpdateBadHabit={updateBadHabit}
          onArchiveBadHabit={archiveBadHabit}
          onExportState={handleExportState}
          onImportState={handleImportState}
          snapshots={snapshots}
          snapshotsLoading={snapshotsLoading}
          onCreateBackupNow={handleCreateBackupNow}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
        />
      )
    }

    if (page === 'goals') {
      return (
        <ErrorBoundary title="Goals unavailable" description="The goals workspace could not be displayed right now.">
          <GoalsPage
            habitTrackers={habitTrackers}
            lifeGoals={lifeGoals}
            lifeGoalCategories={lifeGoalCategories}
            tasks={tasks}
            days={dataset.days}
            badHabitDateMap={badHabitDateMap}
            year={filters.year}
            goalsView={goalsView}
            selectedLifeGoalId={selectedLifeGoalId}
            onSelectLifeGoal={setSelectedLifeGoalId}
            onChangeGoalsView={setGoalsView}
            onCreateHabitTracker={saveTracker}
            onCreateLifeGoal={(goal) =>
              {
                if (goal.category.trim()) {
                  setLifeGoalCategories((current) =>
                    current.some((item) => item.name.trim().toLowerCase() === goal.category.trim().toLowerCase())
                      ? current
                      : [...current, { name: goal.category.trim(), color: 'neutral' }],
                  )
                }
                setLifeGoals((current) => {
                  const nextGoals = [
                    { ...goal, order: 0 },
                    ...current.map((item) => ({ ...item, order: item.order + 1 })),
                  ]
                  return nextGoals
                })
              }
            }
            onUpdateLifeGoal={(goalId, updater) =>
              setLifeGoals((current) => {
                const nextGoals = current.map((goal) => (goal.id === goalId ? updater(goal) : goal))
                const updatedGoal = nextGoals.find((goal) => goal.id === goalId)
                if (updatedGoal?.category.trim()) {
                  setLifeGoalCategories((existing) =>
                    existing.some((item) => item.name.trim().toLowerCase() === updatedGoal.category.trim().toLowerCase())
                      ? existing
                      : [...existing, { name: updatedGoal.category.trim(), color: 'neutral' }],
                  )
                }
                return nextGoals
              })
            }
            onEnsureLifeGoalCategory={(name) =>
              setLifeGoalCategories((current) =>
                current.some((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase())
                  ? current
                  : [...current, { name: name.trim(), color: 'neutral' }],
              )
            }
            onSetLifeGoalCategoryColor={(name, color) =>
              setLifeGoalCategories((current) => {
                const normalizedName = name.trim().toLowerCase()
                const existing = current.some((item) => item.name.trim().toLowerCase() === normalizedName)
                if (!existing) {
                  return [...current, { name: name.trim(), color }]
                }
                return current.map((item) =>
                  item.name.trim().toLowerCase() === normalizedName ? { ...item, name: name.trim(), color } : item,
                )
              })
            }
            onReorderLifeGoals={(goalIds) =>
              setLifeGoals((current) => {
                const orderMap = new Map(goalIds.map((id, index) => [id, index]))
                return current.map((goal) => ({
                  ...goal,
                  order: orderMap.get(goal.id) ?? goal.order,
                }))
              })
            }
            onArchiveLifeGoal={(goalId) =>
              setLifeGoals((current) =>
                current.map((goal) =>
                  goal.id === goalId
                    ? {
                        ...goal,
                        archivedAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      }
                    : goal,
                ),
              )
            }
            onDeleteLifeGoal={(goalId) => setLifeGoals((current) => current.filter((goal) => goal.id !== goalId))}
            onSetLifeGoalAsTodayTask={(goal) => {
              const todayIso = new Date().toISOString().slice(0, 10)
              const nextTask = goal.tasks.find((task) => !task.completed)?.text.trim() || goal.minimumVersion
              updateDayByDate(todayIso, (day) => ({
                ...day,
                isLogged: true,
                dashboardExecution: {
                  ...day.dashboardExecution,
                  goal: goal.title,
                  whyItMatters: goal.whyItMatters,
                  todayTask: nextTask,
                  nextAction: nextTask,
                  minimumVersion: goal.minimumVersion,
                },
              }))
            }}
            onUpdateTasks={(updater) => setTasks((current) => updater(current))}
            onOpenGlobalTasks={() => setPage('dashboard')}
            onOpenHabitTracker={(trackerId) => {
              const tracker = habitTrackers.find((item) => item.id === trackerId)
              if (!tracker) return
              setPage('tracker')
              setEditingTracker(tracker)
            }}
          />
        </ErrorBoundary>
      )
    }

    const placeholderMap: Record<
      Exclude<PageId, 'dashboard' | 'tracker' | 'habit-maps' | 'your-days' | 'settings' | 'journal-recordings' | 'gratitude' | 'vision-board' | 'goals'>,
      { title: string; description: string; highlights: string[] }
    > = {
      tasks: {
        title: 'Tasks',
        description: 'Task capture and execution will eventually connect daily action with the mood and habit layer without crowding this first release.',
        highlights: ['Today / upcoming views', 'Energy-aware planning', 'Task completion correlations'],
      },
      notes: {
        title: 'Notes',
        description: 'Notes will become the flexible writing layer for journal entries, references, and reflections linked back to weeks and tags.',
        highlights: ['Linked daily notes', 'Search and tagging', 'Review snippets from tracker data'],
      },
      analytics: {
        title: 'Analytics',
        description: 'Once enough data accumulates, this section will turn patterns into feedback with clean correlations and review summaries.',
        highlights: ['Mood vs habits correlation', 'Alcohol impact analysis', 'Rolling consistency reports'],
      },
      'trade-log': {
        title: 'Trade Log',
        description: 'Trade review is planned as a dedicated module so decisions, discipline, and emotional state can be tracked without muddying the core dashboard.',
        highlights: ['Trade entry journal', 'Setup tagging', 'Performance and process review'],
      },
    }

    const placeholder = placeholderMap[
      page as Exclude<PageId, 'dashboard' | 'tracker' | 'habit-maps' | 'your-days' | 'settings' | 'journal-recordings' | 'gratitude' | 'vision-board' | 'goals'>
    ]
    return <PlaceholderPage {...placeholder} />
  }

  if (!hasHydratedFromStorage) {
    return (
      <div className="app-grid theme-text-primary min-h-screen bg-ink" style={{ minHeight: '100vh' }}>
        <div className="flex min-h-screen w-full items-center justify-center px-6">
          <div className="theme-surface-soft rounded-2xl border px-5 py-3 text-sm theme-text-muted">
            Loading your dashboard…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-grid theme-text-primary min-h-screen bg-ink" style={{ minHeight: '100vh' }}>
      <div className="flex min-h-screen w-full flex-col lg:flex-row lg:items-start">
        <Sidebar
          currentPage={page}
          collapsed={sidebarCollapsed}
          pageOrder={sidebarOrder}
          pageLabels={sidebarLabels}
          goalsView={goalsView}
          selectedGoalType={lifeGoals.find((goal) => goal.id === selectedLifeGoalId)?.goalType ?? null}
          onNavigate={(nextPage) => {
            setPage(nextPage)
            setOpenDrawer(null)
          }}
          onSetGoalsView={setGoalsView}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          onReorderPages={setSidebarOrder}
          onRenamePage={(pageId, label) =>
            setSidebarLabels((current) => ({
              ...current,
              [pageId]: label,
            }))
          }
          badHabitStreaks={visibleBadHabitStreaks}
          showBadHabitTracking={settings.enableBadHabitTracking}
        />

        <div className="min-w-0 flex-1">
          <TopBar page={page} onOpenToday={() => openToday(false, setPage)} sidebarCollapsed={sidebarCollapsed} goalsView={goalsView} />
          <main className="py-5 sm:py-6">
            <PageContainer width="wide" className={sidebarCollapsed ? 'lg:pl-16' : ''}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              {DEV_NOTES_ENABLED_PAGES.includes(page) ? (
                <DevNotesCard
                  page={page}
                  value={pageDevNotes[page] ?? ''}
                  onChange={(value) =>
                    setPageDevNotes((current) => ({
                      ...current,
                      [page]: value,
                    }))
                  }
                />
              ) : null}
              {renderPage()}
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
