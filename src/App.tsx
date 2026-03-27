import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { PageContainer } from './components/layout/LayoutPrimitives'
import { DayDrawer } from './components/tracker/DayDrawer'
import { HabitTrackerEntryModal } from './components/tracker/HabitTrackerEntryModal'
import { HabitTrackerGoalModal } from './components/tracker/HabitTrackerGoalModal'
import { HabitTrackerSettingsModal } from './components/tracker/HabitTrackerSettingsModal'
import { DevNotesCard } from './components/ui/DevNotesCard'
import { WeekDrawer } from './components/tracker/WeekDrawer'
import { exportPersistedAppState, importPersistedAppState, loadPersistedAppState, savePersistedAppState } from './lib/persistence'
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
import { LifeGoal, PageId } from './types'

const DEV_NOTES_ENABLED_PAGES: PageId[] = ['tasks', 'notes', 'analytics', 'trade-log', 'settings']

export default function App() {
  const currentYear = new Date().getUTCFullYear()
  const persisted = useMemo(() => loadPersistedAppState(currentYear), [])
  const [hasHydratedFromStorage, setHasHydratedFromStorage] = useState(false)
  const appShell = useAppShellState(persisted)
  const settingsState = useSettingsState(persisted.settings)
  const trackerState = useTrackerState(persisted, currentYear, settingsState.settings.enableBadHabitTracking)
  const habitTrackerState = useHabitTrackerState(persisted)
  const [tasks, setTasks] = useState(persisted.tasks)
  const [lifeGoals, setLifeGoals] = useState<LifeGoal[]>(persisted.lifeGoals)

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

  useEffect(() => {
    setHasHydratedFromStorage(true)
  }, [])

  useEffect(() => {
    if (!hasHydratedFromStorage) return
    savePersistedAppState({
      dataByYear,
      habits,
      badHabits,
      badHabitLogs,
      tags,
      tasks,
      lifeGoals,
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
    })
  }, [
    dataByYear,
    habits,
    badHabits,
    badHabitLogs,
    tags,
    tasks,
    lifeGoals,
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
    hasHydratedFromStorage,
  ])

  const buildPersistedSnapshot = () => ({
    dataByYear,
    habits,
    badHabits,
    badHabitLogs,
    tags,
    tasks,
    lifeGoals,
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
  })

  const handleExportState = () => {
    const blob = new Blob([exportPersistedAppState(buildPersistedSnapshot())], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `life-dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportState = async (file: File) => {
    try {
      const raw = await file.text()
      const imported = importPersistedAppState(raw, currentYear)
      hydrateAppShell(imported)
      hydrateSettings(imported.settings)
      hydrateTracker(imported)
      hydrateHabitTrackers(imported)
    setTasks(imported.tasks)
      setLifeGoals(imported.lifeGoals)
      window.alert('Backup restored successfully.')
    } catch {
      window.alert('That backup file could not be imported.')
    }
  }

  const renderPage = () => {
    if (page === 'dashboard') {
      return (
        <DashboardPage
          weeks={computedWeeks}
          days={dataset.days}
          tags={tags}
          tasks={tasks}
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
                dueDate: new Date().toISOString().slice(0, 10),
                starred: false,
                important: false,
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
        />
      )
    }

    if (page === 'goals') {
      return (
        <GoalsPage
          habitTrackers={habitTrackers}
          lifeGoals={lifeGoals}
          year={filters.year}
          onCreateHabitTracker={saveTracker}
          onCreateLifeGoal={(goal) => setLifeGoals((current) => [goal, ...current])}
          onUpdateLifeGoal={(goalId, updater) =>
            setLifeGoals((current) =>
              current.map((goal) => (goal.id === goalId ? updater(goal) : goal)),
            )
          }
          onDeleteLifeGoal={(goalId) => setLifeGoals((current) => current.filter((goal) => goal.id !== goalId))}
          onSetLifeGoalAsTodayTask={(goal) => {
            const todayIso = new Date().toISOString().slice(0, 10)
            const nextMove = goal.moves.find((move) => !move.completed)?.text.trim() || goal.minimumVersion
            updateDayByDate(todayIso, (day) => ({
              ...day,
              isLogged: true,
              dashboardExecution: {
                ...day.dashboardExecution,
                goal: goal.title,
                whyItMatters: goal.whyItMatters,
                todayTask: nextMove,
                nextAction: nextMove,
                minimumVersion: goal.minimumVersion,
              },
            }))
          }}
        />
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

  return (
    <div className="app-grid min-h-screen bg-ink text-white" style={{ minHeight: '100vh' }}>
      <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col lg:flex-row lg:items-start">
        <Sidebar
          currentPage={page}
          collapsed={sidebarCollapsed}
          pageOrder={sidebarOrder}
          pageLabels={sidebarLabels}
          onNavigate={(nextPage) => {
            setPage(nextPage)
            setOpenDrawer(null)
          }}
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
          <TopBar page={page} onOpenToday={() => openToday(false, setPage)} sidebarCollapsed={sidebarCollapsed} />
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

      <HabitTrackerSettingsModal
        tracker={editingTracker}
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

      <HabitTrackerGoalModal
        tracker={goalEditingTracker}
        open={Boolean(goalEditingTracker)}
        onClose={() => setGoalEditingTracker(null)}
        onSave={saveTracker}
      />

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
    </div>
  )
}
