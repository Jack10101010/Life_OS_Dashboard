import { Dispatch, SetStateAction } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import DashboardPage from '../../features/dashboard/DashboardPage'
import { GoalsPage } from '../../features/goals/GoalsPage'
import { HabitMapsPage } from '../../features/habit-maps/HabitMapsPage'
import { JournalPage } from '../../features/journal/JournalPage'
import { PlaceholderPage } from '../../features/placeholder/PlaceholderPage'
import { SettingsPage } from '../../features/settings/SettingsPage'
import { TaskSuperPage } from '../../features/tasks/TaskSuperPage'
import { TrackerWorkspace } from '../../features/tracker/TrackerWorkspace'
import { YourDaysPage } from '../../features/your-days/YourDaysPage'
import { getLifeGoalRuntimeTasks } from '../../features/goals/goalUtils'
import { LifeGoal, LifeGoalCategoryDefinition, PageId, Task } from '../../types'

type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'
type GoalDetailOrigin = 'tasks' | null

type AppPageRouterProps = {
  page: PageId
  computedWeeks: any[]
  dataset: { days: any[] }
  tags: any[]
  tasks: Task[]
  lifeGoals: LifeGoal[]
  lifeGoalCategories: LifeGoalCategoryDefinition[]
  habitTrackers: any[]
  filters: { year: number; [key: string]: any }
  visibleBadHabitStreaks: any[]
  settings: { enableBadHabitTracking: boolean; [key: string]: any }
  updateDay: (dayId: string, updater: (day: any) => any) => void
  setTasks: Dispatch<SetStateAction<Task[]>>
  openToday: (openFullNote: boolean, setPage: (page: PageId) => void) => void
  setPage: (page: PageId) => void
  setViewMode: (mode: any) => void
  setFilters: Dispatch<SetStateAction<any>>
  openSpecificDay: (year: number, dayId: string, weekId: string) => void
  setSelectedWeekId: (weekId: string) => void
  setSelectedDayId: (dayId: string) => void
  setOpenDrawer: (drawer: any) => void
  viewMode: any
  colorMode: any
  setColorMode: (mode: any) => void
  availableYears: number[]
  filteredWeeks: any[]
  filteredDays: any[]
  habits: any[]
  badHabits: any[]
  selectedWeek: any
  selectedWeekDays: any[]
  selectedDay: any
  moodHeatmapFocusDate: any
  setMoodHeatmapFocusDate: (value: any) => void
  moodHeatmapCalendarRange: any
  setMoodHeatmapCalendarRange: (value: any) => void
  moodHighlightCurrentWeek: boolean
  setMoodHighlightCurrentWeek: (value: boolean) => void
  moodShowAlcoholMarkers: boolean
  setMoodShowAlcoholMarkers: (value: boolean) => void
  moodShowHabitMarkers: boolean
  setMoodShowHabitMarkers: (value: boolean) => void
  badHabitDateMap: Record<string, any>
  heatmapLayout: any
  habitTrackerPeriodView: any
  setHabitTrackerPeriodView: (value: any) => void
  habitTrackerFocusDate: any
  setHabitTrackerFocusDate: (value: any) => void
  habitTrackerCalendarRangeByTracker: Record<string, any>
  setHabitTrackerCalendarRangeByTracker: Dispatch<SetStateAction<Record<string, any>>>
  habitEntryDraft: any
  setHabitEntryDraft: Dispatch<SetStateAction<any>>
  collapsedTrackers: Record<string, boolean>
  setCollapsedTrackers: Dispatch<SetStateAction<Record<string, boolean>>>
  createTracker: (...args: any[]) => any
  setEditingTracker: Dispatch<SetStateAction<any>>
  setGoalEditingTracker: Dispatch<SetStateAction<any>>
  useStreakPauseForToday: (trackerId: string, date: string) => void
  saveTracker: (...args: any[]) => any
  updateDayByDate: (date: string, updater: (day: any) => any) => void
  createBadHabit: (...args: any[]) => any
  updateBadHabit: (...args: any[]) => any
  archiveBadHabit: (...args: any[]) => any
  setSettings: Dispatch<SetStateAction<any>>
  handleExportState: () => void
  handleImportState: (file: File) => Promise<void>
  snapshots: any[]
  snapshotsLoading: boolean
  handleCreateBackupNow: () => Promise<void>
  handleRestoreSnapshot: (snapshotId: string) => Promise<void>
  handleDeleteSnapshot: (snapshotId: string) => Promise<void>
  taskPeekRightOffset: number
  setLifeGoals: Dispatch<SetStateAction<LifeGoal[]>>
  handleAddCurrentFocusToTodayLog: (task: Task) => void
  setGoalDetailOrigin: Dispatch<SetStateAction<GoalDetailOrigin>>
  setSelectedLifeGoalId: Dispatch<SetStateAction<string | null>>
  setGoalsView: Dispatch<SetStateAction<GoalsView>>
  goalsView: GoalsView
  outcomeGoalCategoryFilter: string | null
  directionalGoalCategoryFilter: string | null
  selectedLifeGoalId: string | null
  goalDetailOrigin: GoalDetailOrigin
  setLifeGoalCategories: Dispatch<SetStateAction<LifeGoalCategoryDefinition[]>>
}

export function AppPageRouter({
  page,
  computedWeeks,
  dataset,
  tags,
  tasks,
  lifeGoals,
  lifeGoalCategories,
  habitTrackers,
  filters,
  visibleBadHabitStreaks,
  settings,
  updateDay,
  setTasks,
  openToday,
  setPage,
  setViewMode,
  setFilters,
  openSpecificDay,
  setSelectedWeekId,
  setSelectedDayId,
  setOpenDrawer,
  viewMode,
  colorMode,
  setColorMode,
  availableYears,
  filteredWeeks,
  filteredDays,
  habits,
  badHabits,
  selectedWeek,
  selectedWeekDays,
  selectedDay,
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
  badHabitDateMap,
  heatmapLayout,
  habitTrackerPeriodView,
  setHabitTrackerPeriodView,
  habitTrackerFocusDate,
  setHabitTrackerFocusDate,
  habitTrackerCalendarRangeByTracker,
  setHabitTrackerCalendarRangeByTracker,
  habitEntryDraft,
  setHabitEntryDraft,
  collapsedTrackers,
  setCollapsedTrackers,
  createTracker,
  setEditingTracker,
  setGoalEditingTracker,
  useStreakPauseForToday,
  saveTracker,
  updateDayByDate,
  createBadHabit,
  updateBadHabit,
  archiveBadHabit,
  setSettings,
  handleExportState,
  handleImportState,
  snapshots,
  snapshotsLoading,
  handleCreateBackupNow,
  handleRestoreSnapshot,
  handleDeleteSnapshot,
  taskPeekRightOffset,
  setLifeGoals,
  handleAddCurrentFocusToTodayLog,
  setGoalDetailOrigin,
  setSelectedLifeGoalId,
  setGoalsView,
  goalsView,
  outcomeGoalCategoryFilter,
  directionalGoalCategoryFilter,
  selectedLifeGoalId,
  goalDetailOrigin,
  setLifeGoalCategories,
}: AppPageRouterProps) {
  if (page === 'dashboard') {
    return (
      <ErrorBoundary title="Dashboard unavailable" description="The dashboard could not be displayed right now.">
        <DashboardPage
          weeks={computedWeeks}
          days={dataset.days}
          tasks={tasks}
          lifeGoals={lifeGoals}
          lifeGoalCategories={lifeGoalCategories}
          habitTrackers={habitTrackers}
          badHabitStreaks={visibleBadHabitStreaks}
          showBadHabitTracking={settings.enableBadHabitTracking}
          onToggleTask={(taskId) =>
            setTasks((current) =>
              current.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      completed: !task.completed,
                      completedAt: !task.completed ? new Date().toISOString() : null,
                      updatedAt: new Date().toISOString(),
                    }
                  : task,
              ),
            )
          }
          onOpenTracker={() => {
            setPage('tracker')
            setViewMode('days')
          }}
          onOpenGoals={() => setPage('goals')}
          onOpenGoal={(goalId) => {
            setGoalDetailOrigin(null)
            setSelectedLifeGoalId(goalId)
            setGoalsView('life-detail')
            setPage('goals')
            requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
          }}
          onUpdateTask={(taskId, updater) => {
            setTasks((current) => current.map((task) => (task.id === taskId ? updater(task) : task)))
          }}
          onDeleteTask={(taskId) => {
            setTasks((current) => current.filter((task) => task.id !== taskId))
          }}
          onOpenTasks={() => setPage('tasks')}
        />
      </ErrorBoundary>
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
          onYearChange: (year) => setFilters((current: any) => ({ ...current, year })),
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

  if (page === 'tasks') {
    return (
      <ErrorBoundary title="Tasks unavailable" description="The task workspace could not be displayed right now.">
        <TaskSuperPage
          tasks={tasks}
          lifeGoals={lifeGoals}
          lifeGoalCategories={lifeGoalCategories}
          taskPeekRightOffset={taskPeekRightOffset}
          onUpdateTasks={(updater) => setTasks((current) => updater(current))}
          onUpdateLifeGoal={(goalId, updater) =>
            setLifeGoals((current) => current.map((goal) => (goal.id === goalId ? updater(goal) : goal)))
          }
          onAddCurrentFocusToTodayLog={handleAddCurrentFocusToTodayLog}
          onOpenDashboard={() => setPage('dashboard')}
          onOpenLifeGoal={(goalId) => {
            setGoalDetailOrigin('tasks')
            setSelectedLifeGoalId(goalId)
            setGoalsView('life-detail')
            setPage('goals')
          }}
        />
      </ErrorBoundary>
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
          taskPeekRightOffset={taskPeekRightOffset}
          days={dataset.days}
          badHabitDateMap={badHabitDateMap}
          year={filters.year}
          goalsView={goalsView}
          outcomeGoalCategoryFilter={outcomeGoalCategoryFilter}
          directionalGoalCategoryFilter={directionalGoalCategoryFilter}
          selectedLifeGoalId={selectedLifeGoalId}
          goalDetailOrigin={goalDetailOrigin}
          onSelectLifeGoal={setSelectedLifeGoalId}
          onChangeGoalsView={setGoalsView}
          onOpenDashboard={() => setPage('dashboard')}
          onOpenTasks={() => setPage('tasks')}
          onCreateHabitTracker={saveTracker}
          onCreateLifeGoal={(goal) => {
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
          }}
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
          onSetLifeGoalAsTodayTask={(goal, tasksOverride) => {
            const todayIso = new Date().toISOString().slice(0, 10)
            const runtimeTasks = tasksOverride ?? getLifeGoalRuntimeTasks(goal, tasks)
            const nextTask = runtimeTasks.find((task) => !task.completed)?.text.trim() || goal.minimumVersion
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
          onOpenGlobalTasks={() => setPage('tasks')}
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
    Exclude<PageId, 'dashboard' | 'tracker' | 'habit-maps' | 'your-days' | 'settings' | 'journal-recordings' | 'gratitude' | 'vision-board' | 'goals' | 'tasks'>,
    { title: string; description: string; highlights: string[] }
  > = {
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
    page as Exclude<PageId, 'dashboard' | 'tracker' | 'habit-maps' | 'your-days' | 'settings' | 'journal-recordings' | 'gratitude' | 'vision-board' | 'goals' | 'tasks'>
  ]
  return <PlaceholderPage {...placeholder} />
}
