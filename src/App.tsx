import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { DayDrawer } from './components/tracker/DayDrawer'
import { HabitTrackerEntryModal } from './components/tracker/HabitTrackerEntryModal'
import { HabitTrackerSettingsModal } from './components/tracker/HabitTrackerSettingsModal'
import { DevNotesCard } from './components/ui/DevNotesCard'
import { WeekDrawer } from './components/tracker/WeekDrawer'
import { exportPersistedAppState, importPersistedAppState, loadPersistedAppState, savePersistedAppState } from './lib/persistence'
import { useAppShellState } from './hooks/useAppShellState'
import { useDashboardState } from './hooks/useDashboardState'
import { useHabitTrackerState } from './hooks/useHabitTrackerState'
import { useSettingsState } from './hooks/useSettingsState'
import { useTrackerState } from './hooks/useTrackerState'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { JournalPage } from './features/journal/JournalPage'
import { PlaceholderPage } from './features/placeholder/PlaceholderPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { TrackerWorkspace } from './features/tracker/TrackerWorkspace'
import { PageId } from './types'

const currentYear = 2026
const availableYears = [2025, 2026]
export default function App() {
  const persisted = useMemo(() => loadPersistedAppState(currentYear), [])
  const appShell = useAppShellState(persisted)
  const settingsState = useSettingsState(persisted.settings)
  const trackerState = useTrackerState(persisted, currentYear)
  const habitTrackerState = useHabitTrackerState(persisted)

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
    tags,
    viewMode,
    setViewMode,
    colorMode,
    setColorMode,
    heatmapLayout,
    setHeatmapLayout,
    showFilters,
    setShowFilters,
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
    dataset,
    computedWeeks,
    filteredDays,
    filteredWeeks,
    selectedWeek,
    selectedWeekDays,
    selectedDay,
    alcoholFreeStreak,
    momentumScore,
    updateDay,
    handleSelectTag,
    handleNavigateDay,
    openSpecificDay,
    openToday,
    deleteDayEntry,
    hydrate: hydrateTracker,
  } = trackerState
  const {
    habitTrackers,
    setHabitTrackers,
    editingTracker,
    setEditingTracker,
    habitEntryDraft,
    setHabitEntryDraft,
    moodCollapsed,
    setMoodCollapsed,
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
    moveTrackerUp,
    moveTrackerDown,
    saveTracker,
    saveHabitEntry,
    hydrate: hydrateHabitTrackers,
  } = habitTrackerState

  useEffect(() => {
    savePersistedAppState({
      dataByYear,
      habits,
      tags,
      settings,
      page,
      viewMode,
      colorMode,
      heatmapLayout,
      showFilters,
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
    })
  }, [
    dataByYear,
    habits,
    tags,
    settings,
    page,
    viewMode,
    colorMode,
    heatmapLayout,
    showFilters,
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
  ])

  const buildPersistedSnapshot = () => ({
    dataByYear,
    habits,
    tags,
    settings,
    page,
    viewMode,
    colorMode,
    heatmapLayout,
    showFilters,
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
          alcoholFreeStreak={alcoholFreeStreak}
          momentumScore={momentumScore}
          onExportState={handleExportState}
          onOpenToday={() => openToday(false, setPage)}
          onOpenTracker={() => {
            setPage('tracker')
            setViewMode('days')
          }}
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
            years: availableYears,
            filters,
            showFilters,
            onToggleFilters: () => setShowFilters((value) => !value),
            onFiltersChange: setFilters,
            weeks: filteredWeeks,
            days: filteredDays,
            habits,
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
                note: entry?.note ?? '',
              })
            },
            onOpenSettings: setEditingTracker,
          }}
        />
      )
    }

    if (page === 'journal-recordings') {
      return (
        <JournalPage
          entries={dataset.days}
          onOpenDay={(day) => {
            setPage('tracker')
            setSelectedDayId(day.id)
            setSelectedWeekId(day.linkedWeek)
            setOpenDrawer('day')
          }}
        />
      )
    }

    if (page === 'gratitude') {
      return (
        <PlaceholderPage
          title="Gratitude"
          description="A dedicated gratitude space is planned for short daily entries, memory anchors, and weekly reflection prompts."
          highlights={['Daily gratitude capture', 'Prompted reflection', 'Weekly gratitude review']}
        />
      )
    }

    if (page === 'settings') {
      return (
        <SettingsPage
          settings={settings}
          habits={habits}
          onUpdateSettings={setSettings}
          onExportState={handleExportState}
          onImportState={handleImportState}
        />
      )
    }

    const placeholderMap: Record<
      Exclude<PageId, 'dashboard' | 'tracker' | 'settings' | 'journal-recordings' | 'gratitude'>,
      { title: string; description: string; highlights: string[] }
    > = {
      goals: {
        title: 'Goals',
        description: 'This module is reserved for structured goals, horizons, and progress tracking once the core tracker data is persisted.',
        highlights: ['Quarterly goals and milestones', 'Goal-to-habit linking', 'Review cadence and drift detection'],
      },
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
      'vision-board': {
        title: 'Vision Board',
        description: 'A calm, intentional space for visual direction, identity reminders, and long-range themes will live here in a future version.',
        highlights: ['Image and text cards', 'Theme clusters', 'Weekly review tie-ins'],
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
      page as Exclude<PageId, 'dashboard' | 'tracker' | 'settings' | 'journal-recordings' | 'gratitude'>
    ]
    return <PlaceholderPage {...placeholder} />
  }

  return (
    <div className="app-grid min-h-screen bg-ink text-white" style={{ minHeight: '100vh' }}>
      <div className="flex min-h-screen">
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
          currentStreak={alcoholFreeStreak}
          momentumScore={momentumScore}
          onQuickAdd={() => openToday(true, setPage)}
        />

        <div className="flex-1">
          <TopBar page={page} onOpenToday={() => openToday(false, setPage)} />
          <main className="px-8 py-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              {page !== 'dashboard' && page !== 'tracker' ? (
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
          </main>
        </div>
      </div>

      <WeekDrawer
        open={openDrawer === 'week'}
        week={selectedWeek}
        days={selectedWeekDays}
        tags={tags}
        onClose={() => setOpenDrawer(null)}
        onOpenDay={(day) => {
          setSelectedDayId(day.id)
          setOpenDrawer('day')
        }}
      />

      <DayDrawer
        open={openDrawer === 'day'}
        day={selectedDay}
        week={selectedWeek}
        habits={habits}
        tags={tags}
        onClose={() => setOpenDrawer(null)}
        onSelectTag={handleSelectTag}
        onNavigateDay={handleNavigateDay}
        onUpdateDay={updateDay}
        onDeleteDay={deleteDayEntry}
      />

      <HabitTrackerSettingsModal
        tracker={editingTracker}
        open={Boolean(editingTracker)}
        onClose={() => setEditingTracker(null)}
        onDelete={(trackerId) => {
          deleteTracker(trackerId)
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

      <HabitTrackerEntryModal
        open={Boolean(habitEntryDraft)}
        onClose={() => setHabitEntryDraft(null)}
        trackerTitle={habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.title ?? 'Habit tracker'}
        trackerColor={habitTrackers.find((tracker) => tracker.id === habitEntryDraft?.trackerId)?.color ?? '#17C964'}
        date={habitEntryDraft?.date ?? new Date().toISOString().slice(0, 10)}
        completed={habitEntryDraft?.completed ?? false}
        note={habitEntryDraft?.note ?? ''}
        onChange={(next) => setHabitEntryDraft((current) => (current ? { ...current, ...next } : current))}
        onSave={saveHabitEntry}
      />
    </div>
  )
}
