import { createMockData, defaultSettings, starterHabits, starterTags } from '../../data/mockData'
import { getDefaultSidebarLabels, getDefaultSidebarOrder } from '../sidebar'
import { ColorMode, Habit, HabitTracker, HabitTrackerCalendarRange, HabitTrackerPeriodView, HeatmapLayout, PageId, SettingsState, Tag, TrackerFilters, TrackerViewMode } from '../../types'

export interface PersistedAppState {
  dataByYear: Record<number, ReturnType<typeof createMockData>>
  habits: Habit[]
  tags: Tag[]
  settings: SettingsState
  page: PageId
  viewMode: TrackerViewMode
  colorMode: ColorMode
  heatmapLayout: HeatmapLayout
  showFilters: boolean
  filters: TrackerFilters
  selectedWeekId: string | null
  selectedDayId: string | null
  openDrawer: 'day' | 'week' | null
  habitTrackers: HabitTracker[]
  editingTracker: HabitTracker | null
  habitEntryDraft: { trackerId: string; date: string; completed: boolean; note: string } | null
  moodCollapsed: boolean
  collapsedTrackers: Record<string, boolean>
  sidebarCollapsed: boolean
  sidebarOrder: PageId[]
  sidebarLabels: Record<PageId, string>
  pageDevNotes: Record<PageId, string>
  habitTrackerPeriodView: HabitTrackerPeriodView
  habitTrackerFocusDate: string
  habitTrackerCalendarRangeByTracker: Record<string, HabitTrackerCalendarRange>
  moodHeatmapFocusDate: string
  moodHeatmapCalendarRange: HabitTrackerCalendarRange
  moodHighlightCurrentWeek: boolean
}

export function getDefaultPersistedAppState(currentYear: number): PersistedAppState {
  return {
    dataByYear: {
      2025: createMockData(2025),
      2026: createMockData(2026),
    },
    habits: starterHabits,
    tags: starterTags,
    settings: defaultSettings,
    page: 'dashboard',
    viewMode: 'weeks',
    colorMode: defaultSettings.defaultColorMode,
    heatmapLayout: 'github',
    showFilters: false,
    filters: {
      selectedTags: [],
      alcohol: 'all',
      bigWinOnly: false,
      score: 'all',
      year: currentYear,
    },
    selectedWeekId: `${currentYear}-12`,
    selectedDayId: null,
    openDrawer: null,
    habitTrackers: [],
    editingTracker: null,
    habitEntryDraft: null,
    moodCollapsed: false,
    collapsedTrackers: {},
    sidebarCollapsed: false,
    sidebarOrder: getDefaultSidebarOrder(),
    sidebarLabels: getDefaultSidebarLabels(),
    pageDevNotes: {
      dashboard: '',
      tracker: '',
      'journal-recordings': '',
      gratitude: '',
      goals: '',
      tasks: '',
      notes: '',
      'vision-board': '',
      analytics: '',
      'trade-log': '',
      settings: '',
    },
    habitTrackerPeriodView: 'year',
    habitTrackerFocusDate: `${currentYear}-03-17`,
    habitTrackerCalendarRangeByTracker: {},
    moodHeatmapFocusDate: `${currentYear}-03-17`,
    moodHeatmapCalendarRange: 'full-year',
    moodHighlightCurrentWeek: true,
  }
}

export function normalizePersistedAppState(parsed: Partial<PersistedAppState>, currentYear: number): PersistedAppState {
  const defaults = getDefaultPersistedAppState(currentYear)
  const normalizedDataByYear =
    parsed.dataByYear && typeof parsed.dataByYear === 'object'
      ? Object.fromEntries(
          Object.entries(parsed.dataByYear).map(([year, dataset]) => [
            year,
            {
              ...dataset,
              days: dataset.days.map((day) => ({
                ...day,
                mood: day.isLogged ? day.mood ?? null : null,
                motivation: day.isLogged ? day.motivation ?? null : null,
                clarity: day.isLogged ? day.clarity ?? null : null,
                energy: day.isLogged ? day.energy ?? null : null,
                sleepQuality: day.isLogged ? day.sleepQuality ?? null : null,
                journal: day.journal ?? (day as { notes?: string }).notes ?? '',
                tasks: day.tasks ?? [],
                reminders: day.reminders ?? [],
                dailyActions: day.dailyActions ?? [],
                updatedAt: day.updatedAt ?? null,
              })),
            },
          ]),
        )
      : defaults.dataByYear

  return {
    ...defaults,
    ...parsed,
    dataByYear: normalizedDataByYear,
    habits: Array.isArray(parsed.habits) ? parsed.habits : defaults.habits,
    tags: Array.isArray(parsed.tags) ? parsed.tags : defaults.tags,
    settings: parsed.settings ? { ...defaults.settings, ...parsed.settings } : defaults.settings,
    filters: parsed.filters ? { ...defaults.filters, ...parsed.filters } : defaults.filters,
    habitTrackers: Array.isArray(parsed.habitTrackers)
      ? parsed.habitTrackers.map((tracker) => ({
          ...tracker,
          colorIntensity: tracker.colorIntensity ?? 100,
          weekendVisibility: tracker.weekendVisibility ?? 'show',
          clampDescription: tracker.clampDescription ?? true,
        }))
      : defaults.habitTrackers,
    habitTrackerCalendarRangeByTracker:
      parsed.habitTrackerCalendarRangeByTracker && typeof parsed.habitTrackerCalendarRangeByTracker === 'object'
        ? parsed.habitTrackerCalendarRangeByTracker
        : defaults.habitTrackerCalendarRangeByTracker,
    collapsedTrackers:
      parsed.collapsedTrackers && typeof parsed.collapsedTrackers === 'object'
        ? parsed.collapsedTrackers
        : defaults.collapsedTrackers,
    sidebarOrder: Array.isArray(parsed.sidebarOrder)
      ? [
          ...parsed.sidebarOrder.filter((id): id is PageId => defaults.sidebarOrder.includes(id as PageId)),
          ...defaults.sidebarOrder.filter((id) => !parsed.sidebarOrder?.includes(id)),
        ]
      : defaults.sidebarOrder,
    sidebarLabels:
      parsed.sidebarLabels && typeof parsed.sidebarLabels === 'object'
        ? { ...defaults.sidebarLabels, ...parsed.sidebarLabels }
        : defaults.sidebarLabels,
    pageDevNotes:
      parsed.pageDevNotes && typeof parsed.pageDevNotes === 'object'
        ? { ...defaults.pageDevNotes, ...parsed.pageDevNotes }
        : defaults.pageDevNotes,
    moodHeatmapFocusDate:
      typeof parsed.moodHeatmapFocusDate === 'string' ? parsed.moodHeatmapFocusDate : defaults.moodHeatmapFocusDate,
    moodHeatmapCalendarRange:
      parsed.moodHeatmapCalendarRange === 'first-entry' ||
      parsed.moodHeatmapCalendarRange === 'current-date' ||
      parsed.moodHeatmapCalendarRange === 'full-year'
        ? parsed.moodHeatmapCalendarRange
        : defaults.moodHeatmapCalendarRange,
    moodHighlightCurrentWeek:
      typeof parsed.moodHighlightCurrentWeek === 'boolean'
        ? parsed.moodHighlightCurrentWeek
        : defaults.moodHighlightCurrentWeek,
  }
}
