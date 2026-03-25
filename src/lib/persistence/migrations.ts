import { createMockData, defaultSettings, starterBadHabits, starterHabits, starterTags } from '../../data/mockData'
import { createEmptyDashboardExecution, normalizeDashboardExecution } from '../dashboardExecution'
import { normalizeHabitTracker, syncHabitTrackerAchievements } from '../habitTrackerGoals'
import { getDefaultSidebarLabels, getDefaultSidebarOrder } from '../sidebar'
import {
  BadHabitCategory,
  BadHabitDefinition,
  BadHabitLog,
  ColorMode,
  Habit,
  HabitTracker,
  HabitTrackerCalendarRange,
  HabitTrackerEntryDraft,
  HabitTrackerPeriodView,
  HeatmapLayout,
  PageId,
  SettingsState,
  DayEventEntry,
  DayLogSection,
  DayTagEntry,
  Tag,
  TagKind,
  TagPolarity,
  TagSection,
  Task,
  TrackerFilters,
  TrackerViewMode,
} from '../../types'

export interface PersistedAppState {
  dataByYear: Record<number, ReturnType<typeof createMockData>>
  habits: Habit[]
  badHabits: BadHabitDefinition[]
  badHabitLogs: BadHabitLog[]
  tags: Tag[]
  tasks: Task[]
  settings: SettingsState
  page: PageId
  viewMode: TrackerViewMode
  colorMode: ColorMode
  heatmapLayout: HeatmapLayout
  filters: TrackerFilters
  selectedWeekId: string | null
  selectedDayId: string | null
  openDrawer: 'day' | 'week' | null
  habitTrackers: HabitTracker[]
  editingTracker: HabitTracker | null
  habitEntryDraft: HabitTrackerEntryDraft | null
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
  moodShowAlcoholMarkers: boolean
  moodShowHabitMarkers: boolean
}

export function getDefaultPersistedAppState(currentYear: number): PersistedAppState {
  return {
    dataByYear: getDefaultDataByYear(currentYear),
    habits: starterHabits,
    badHabits: starterBadHabits,
    badHabitLogs: [],
    tags: starterTags,
    tasks: [],
    settings: defaultSettings,
    page: 'dashboard',
    viewMode: 'weeks',
    colorMode: defaultSettings.defaultColorMode,
    heatmapLayout: 'github',
    filters: {
      year: currentYear,
      mood: 'all',
      selectedTagIds: [],
      selectedBadHabitIds: [],
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
      'habit-maps': '',
      'your-days': '',
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
    moodShowAlcoholMarkers: true,
    moodShowHabitMarkers: true,
  }
}

export function normalizePersistedAppState(parsed: Partial<PersistedAppState>, currentYear: number): PersistedAppState {
  const defaults = getDefaultPersistedAppState(currentYear)
  const normalizedDataByYear = ensureYearDataset(
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
                bedtime: typeof day.bedtime === 'string' ? day.bedtime : '',
                wakeTime: typeof day.wakeTime === 'string' ? day.wakeTime : '',
                wokeDuringNight: typeof day.wokeDuringNight === 'boolean' ? day.wokeDuringNight : null,
                journal: day.journal ?? (day as { notes?: string }).notes ?? '',
                dashboardQuickNote: day.dashboardQuickNote ?? '',
                dashboardExecution: normalizeDashboardExecution(day.dashboardExecution, createEmptyDashboardExecution()),
                dashboardScratchpad: normalizeScratchpad(day.dashboardScratchpad, day.date),
                dailyIntentCompleteOneTask: day.dailyIntentCompleteOneTask ?? false,
                morningIntention: typeof day.morningIntention === 'string' ? day.morningIntention : '',
                eveningOutcome:
                  day.eveningOutcome === 'good' ||
                  day.eveningOutcome === 'mixed' ||
                  day.eveningOutcome === 'poor' ||
                  day.eveningOutcome === 'unstable'
                    ? day.eveningOutcome
                    : null,
                eveningTrajectory:
                  day.eveningTrajectory === 'improved' ||
                  day.eveningTrajectory === 'declined' ||
                  day.eveningTrajectory === 'stable' ||
                  day.eveningTrajectory === 'unstable'
                    ? day.eveningTrajectory
                    : null,
                eveningSelfInfluence:
                  day.eveningSelfInfluence === 'helped' ||
                  day.eveningSelfInfluence === 'neutral' ||
                  day.eveningSelfInfluence === 'hurt'
                    ? day.eveningSelfInfluence
                    : null,
                lowStateEntry:
                  day.lowStateEntry && typeof day.lowStateEntry === 'object'
                    ? {
                        feelings: Array.isArray(day.lowStateEntry.feelings) ? day.lowStateEntry.feelings.filter((item): item is string => typeof item === 'string') : [],
                        customFeeling: day.lowStateEntry.customFeeling ?? '',
                        mindText: day.lowStateEntry.mindText ?? '',
                        mindHelping:
                          day.lowStateEntry.mindHelping === 'yes' ||
                          day.lowStateEntry.mindHelping === 'no' ||
                          day.lowStateEntry.mindHelping === 'not-sure'
                            ? day.lowStateEntry.mindHelping
                            : null,
                        realSituation: day.lowStateEntry.realSituation ?? '',
                        nextThing: day.lowStateEntry.nextThing ?? '',
                        completedAt: day.lowStateEntry.completedAt ?? null,
                      }
                    : null,
                medications: Array.isArray((day as { medications?: unknown[] }).medications)
                  ? (day as { medications: any[] }).medications.map((entry) => ({
                      id: entry?.id ?? `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      name: entry?.name ?? '',
                      dose: entry?.dose != null ? String(entry.dose) : '',
                      unit: entry?.unit ?? '',
                      timeTaken: entry?.timeTaken ?? entry?.time ?? '',
                      notes: entry?.notes ?? '',
                    }))
                  : [],
                tasks: day.tasks ?? [],
                reminders: day.reminders ?? [],
                dailyActions: normalizeDayEvents(day.dailyActions),
                tags: normalizeReusableTagIds(day.tags),
                tagEntries: normalizeDayTagEntries(day),
                updatedAt: day.updatedAt ?? null,
              })),
            },
          ]),
        )
      : defaults.dataByYear,
    currentYear,
  )
  const normalizedFilterYear =
    parsed.filters?.year != null && normalizedDataByYear[parsed.filters.year]
      ? parsed.filters.year
      : currentYear
  const earliestDatasetDate = getEarliestDatasetDate(normalizedDataByYear)
  const normalizedBadHabits = Array.isArray(parsed.badHabits)
    ? parsed.badHabits.map((habit) =>
        normalizeBadHabitDefinition(habit, {
          defaultCreatedAt:
            habit?.id === 'alcohol' || habit?.isBuiltIn ? earliestDatasetDate : new Date().toISOString().slice(0, 10),
        }),
      )
    : defaults.badHabits
  const migratedBadHabitLogs = getMigratedBadHabitLogs(normalizedDataByYear, normalizedBadHabits, parsed.badHabitLogs)

  return {
    ...defaults,
    ...parsed,
    dataByYear: normalizedDataByYear,
    habits: Array.isArray(parsed.habits) ? parsed.habits : defaults.habits,
    badHabits: normalizedBadHabits,
    badHabitLogs: migratedBadHabitLogs,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(normalizeTag) : defaults.tags,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map(normalizeTask).filter((task) => task.text) : defaults.tasks,
    settings: parsed.settings ? { ...defaults.settings, ...parsed.settings } : defaults.settings,
    filters: parsed.filters
      ? {
          year: normalizedFilterYear,
          mood: parsed.filters.mood === 'good' || parsed.filters.mood === 'average' || parsed.filters.mood === 'low' ? parsed.filters.mood : 'all',
          selectedTagIds: Array.isArray(parsed.filters.selectedTagIds) ? parsed.filters.selectedTagIds : [],
          selectedBadHabitIds: Array.isArray(parsed.filters.selectedBadHabitIds) ? parsed.filters.selectedBadHabitIds : [],
        }
      : defaults.filters,
    habitTrackers: Array.isArray(parsed.habitTrackers)
      ? parsed.habitTrackers.map((tracker) => ({
          ...syncHabitTrackerAchievements(normalizeHabitTracker({
            ...tracker,
            habitType: tracker.habitType ?? 'checkbox',
            colorIntensity: tracker.colorIntensity ?? 100,
            showAlcoholMarkers: tracker.showAlcoholMarkers ?? false,
            showCurrentWeekHighlight: tracker.showCurrentWeekHighlight ?? false,
            weekendVisibility: tracker.weekendVisibility ?? 'show',
            clampDescription: tracker.clampDescription ?? true,
            goal:
              tracker.goal && typeof tracker.goal === 'object'
                ? tracker.goal.type === 'streak' && tracker.goal.target === 7 && (tracker.achievements?.length ?? 0) === 0
                  ? null
                  : { ...tracker.goal, startDate: tracker.goal.startDate ?? new Date().toISOString().slice(0, 10) }
                : null,
            achievements: Array.isArray(tracker.achievements)
              ? tracker.achievements.map((achievement: any) => ({
                  ...achievement,
                  goalType: achievement.goalType ?? (achievement.type === 'streak-goal' ? 'streak' : 'streak'),
                  date: achievement.date ?? achievement.completedDate,
                  startedDate: achievement.startedDate ?? achievement.date ?? achievement.completedDate,
                  completedDate: achievement.completedDate ?? achievement.date,
                  durationDays:
                    achievement.durationDays ??
                    1,
                }))
              : [],
            entries: Object.fromEntries(
              Object.entries(tracker.entries ?? {}).map(([date, entry]) => [
                date,
                {
                  date,
                  completed: entry?.completed ?? false,
                  value: entry?.value ?? null,
                  note: entry?.note ?? '',
                },
              ]),
            ),
          })),
        }))
      : defaults.habitTrackers,
    habitEntryDraft:
      parsed.habitEntryDraft && typeof parsed.habitEntryDraft === 'object'
        ? {
            trackerId: parsed.habitEntryDraft.trackerId,
            date: parsed.habitEntryDraft.date,
            completed: parsed.habitEntryDraft.completed ?? false,
            value: parsed.habitEntryDraft.value ?? null,
            note: parsed.habitEntryDraft.note ?? '',
          }
        : defaults.habitEntryDraft,
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
    moodShowAlcoholMarkers:
      typeof parsed.moodShowAlcoholMarkers === 'boolean'
        ? parsed.moodShowAlcoholMarkers
        : defaults.moodShowAlcoholMarkers,
    moodShowHabitMarkers:
      typeof parsed.moodShowHabitMarkers === 'boolean'
        ? parsed.moodShowHabitMarkers
        : defaults.moodShowHabitMarkers,
  }
}

function getDefaultDataByYear(currentYear: number) {
  const years = [currentYear - 1, currentYear]
  return Object.fromEntries(years.map((year) => [year, createMockData(year)])) as PersistedAppState['dataByYear']
}

function ensureYearDataset(
  dataByYear: PersistedAppState['dataByYear'],
  year: number,
): PersistedAppState['dataByYear'] {
  if (dataByYear[year]) return dataByYear
  return {
    ...dataByYear,
    [year]: createMockData(year),
  }
}

function normalizeTask(task: Partial<Task>): Task {
  return {
    id: task.id ?? `task-${Date.now().toString(36)}`,
    text: typeof task.text === 'string' ? task.text.trim() : typeof (task as { title?: string }).title === 'string' ? (task as { title: string }).title.trim() : '',
    dueDate: typeof task.dueDate === 'string' ? task.dueDate : new Date().toISOString().slice(0, 10),
    starred: (task as Partial<Task> & { starred?: boolean }).starred ?? task.important ?? false,
    important: (task as Partial<Task> & { important?: boolean }).important ?? false,
    completed: task.completed ?? false,
    completedAt: typeof task.completedAt === 'string' ? task.completedAt : null,
  }
}

function normalizeScratchpad(scratchpad: any, dayDate?: string) {
  const defaultMonthKey = typeof dayDate === 'string' && dayDate.length >= 7 ? dayDate.slice(0, 7) : new Date().toISOString().slice(0, 7)
  const normalizedLegacyMoneyIn = Array.isArray(scratchpad?.moneyIn)
    ? scratchpad.moneyIn.map((item: any) => ({
        id: item?.id ?? `scratch-in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item?.name ?? '',
        day: item?.day ?? '',
        amount: item?.amount != null ? String(item.amount) : '',
        settled: item?.settled ?? false,
      }))
    : []
  const normalizedLegacyMoneyOut = Array.isArray(scratchpad?.moneyOut)
    ? scratchpad.moneyOut.map((item: any) => ({
        id: item?.id ?? `scratch-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item?.name ?? '',
        day: item?.day ?? '',
        amount: item?.amount != null ? String(item.amount) : '',
        settled: item?.settled ?? false,
      }))
    : []
  const normalizedFinanceSheets =
    scratchpad?.financeSheets && typeof scratchpad.financeSheets === 'object' && !Array.isArray(scratchpad.financeSheets)
      ? Object.fromEntries(
          Object.entries(scratchpad.financeSheets).map(([monthKey, sheet]) => [
            monthKey,
            normalizeFinanceSheet(sheet),
          ]),
        )
      : normalizedLegacyMoneyIn.length > 0 || normalizedLegacyMoneyOut.length > 0 || typeof scratchpad?.notes === 'string'
        ? {
            [defaultMonthKey]: {
              moneyIn: normalizedLegacyMoneyIn,
              moneyOut: normalizedLegacyMoneyOut,
              notes: scratchpad?.notes ?? '',
            },
          }
        : {}
  const normalizedFreeNotes = normalizeFreeNotes(scratchpad?.freeNotes, scratchpad?.text)

  return {
    mode:
      scratchpad?.mode === 'structured'
        ? ('structured' as const)
        : scratchpad?.mode === 'todo'
          ? ('todo' as const)
          : ('free' as const),
    text: scratchpad?.text ?? '',
    freeNotes: normalizedFreeNotes,
    activeFreeNoteId: normalizeActiveFreeNoteId(scratchpad?.activeFreeNoteId, normalizedFreeNotes),
    moneyIn: normalizedLegacyMoneyIn,
    moneyOut: normalizedLegacyMoneyOut,
    notes: scratchpad?.notes ?? '',
    todoItems: Array.isArray(scratchpad?.todoItems)
      ? scratchpad.todoItems.map((item: any) => ({
          id: item?.id ?? `scratch-todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: item?.text ?? '',
          completed: item?.completed ?? false,
        }))
      : [],
    financeSheets: normalizedFinanceSheets,
  }
}

function normalizeFreeNotes(notes: any, legacyText: unknown) {
  const normalizedNotes = Array.isArray(notes)
    ? notes.map((note: any, index: number) => ({
        id: note?.id ?? `scratch-free-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        title: typeof note?.title === 'string' && note.title.trim().length > 0 ? note.title.trim() : `Note ${index + 1}`,
        text: note?.text ?? '',
      }))
    : []

  if (normalizedNotes.length > 0) return normalizedNotes

  return [
    {
      id: `scratch-free-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Note 1',
      text: typeof legacyText === 'string' ? legacyText : '',
    },
  ]
}

function normalizeActiveFreeNoteId(activeId: unknown, notes: Array<{ id: string }>) {
  if (typeof activeId === 'string' && notes.some((note) => note.id === activeId)) return activeId
  return notes[0]?.id ?? null
}

function normalizeFinanceSheet(sheet: any) {
  return {
    moneyIn: Array.isArray(sheet?.moneyIn)
      ? sheet.moneyIn.map((item: any) => ({
          id: item?.id ?? `scratch-in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item?.name ?? '',
          day: item?.day ?? '',
          amount: item?.amount != null ? String(item.amount) : '',
          settled: item?.settled ?? false,
        }))
      : [],
    moneyOut: Array.isArray(sheet?.moneyOut)
      ? sheet.moneyOut.map((item: any) => ({
          id: item?.id ?? `scratch-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: item?.name ?? '',
          day: item?.day ?? '',
          amount: item?.amount != null ? String(item.amount) : '',
          settled: item?.settled ?? false,
        }))
      : [],
    notes: sheet?.notes ?? '',
  }
}

function normalizeTag(
  tag: Partial<Tag> & {
    category?: string
    polarity?: TagPolarity
    type?: TagPolarity
    section?: TagSection
    kind?: TagKind
  },
): Tag {
  const normalizedPolarity: TagPolarity =
    tag.polarity === 'negative' || tag.polarity === 'neutral' || tag.polarity === 'positive'
      ? tag.polarity
      : tag.type === 'negative' || tag.type === 'neutral' || tag.type === 'positive'
        ? tag.type
        : inferPolarity(tag.id, tag.name)

  const normalizedSection: TagSection =
    tag.section === 'sleep' || tag.section === 'feelings' || tag.section === 'actions' || tag.section === 'events'
      ? tag.section
      : inferSection(tag.category, tag.id, tag.name)

  const normalizedKind: TagKind =
    tag.kind === 'feeling' || tag.kind === 'action' ? tag.kind : inferKind(normalizedSection, tag.id, tag.name)

  return {
    id: tag.id ?? `tag-${Date.now()}`,
    name: tag.name ?? 'Untitled tag',
    color:
      normalizedPolarity === 'positive'
        ? tag.color === '#4A9A67' || tag.color == null
          ? '#22C55E'
          : tag.color
        : normalizedPolarity === 'neutral'
          ? tag.color ?? '#60A5FA'
          : tag.color ?? '#B35A65',
    section: normalizedSection,
    kind: normalizedKind,
    polarity: normalizedPolarity,
    availableIn: normalizeTagAvailability((tag as { availableIn?: unknown }).availableIn, normalizedSection),
    isCustom: tag.isCustom ?? true,
    isActive: tag.isActive ?? true,
  }
}

function normalizeReusableTagIds(tags: unknown) {
  return Array.isArray(tags) ? tags.filter((tagId): tagId is string => typeof tagId === 'string') : []
}

function normalizeDayTagEntries(day: {
  tags?: unknown
  tagEntries?: unknown
}): DayTagEntry[] {
  if (Array.isArray(day.tagEntries)) {
    return day.tagEntries
      .map((entry: any, index: number) => normalizeDayTagEntry(entry, index))
      .filter((entry): entry is DayTagEntry => entry != null)
  }

  return normalizeReusableTagIds(day.tags).map((tagId, index) => ({
    id: `day-tag-${tagId}-${index}`,
    tagId,
    section: inferSection(undefined, tagId, tagId),
    kind: inferKind(inferSection(undefined, tagId, tagId), tagId, tagId),
    polarity: inferPolarity(tagId, tagId),
    timeSection: 'day',
    selected: true,
  }))
}

function normalizeDayTagEntry(entry: any, index: number): DayTagEntry | null {
  const tagId = typeof entry?.tagId === 'string' && entry.tagId.trim().length > 0 ? entry.tagId : undefined
  const customLabel =
    typeof entry?.customLabel === 'string' && entry.customLabel.trim().length > 0 ? entry.customLabel.trim() : undefined

  if (!tagId && !customLabel) return null

  const section =
    entry?.section === 'sleep' || entry?.section === 'feelings' || entry?.section === 'actions' || entry?.section === 'events'
      ? entry.section
      : inferSection(undefined, tagId, customLabel)

  return {
    id: typeof entry?.id === 'string' && entry.id.trim().length > 0 ? entry.id : `day-tag-${tagId ?? 'custom'}-${index}`,
    tagId,
    customLabel,
    section,
    kind: entry?.kind === 'feeling' || entry?.kind === 'action' ? entry.kind : inferKind(section, tagId, customLabel),
    polarity:
      entry?.polarity === 'negative' || entry?.polarity === 'neutral' || entry?.polarity === 'positive'
        ? entry.polarity
        : inferPolarity(tagId, customLabel),
    timeSection:
      entry?.timeSection === 'morning' || entry?.timeSection === 'evening' || entry?.timeSection === 'day'
        ? entry.timeSection
        : 'day',
    selected: entry?.selected ?? true,
  }
}

function normalizeBadHabitDefinition(
  habit: Partial<BadHabitDefinition>,
  options: { defaultCreatedAt: string },
): BadHabitDefinition {
  const normalizedCategory: BadHabitCategory =
    habit.category === 'Substances' ||
    habit.category === 'Food' ||
    habit.category === 'Mind' ||
    habit.category === 'Body' ||
    habit.category === 'Custom'
      ? habit.category
      : 'Custom'

  return {
    id: habit.id ?? `bad-habit-${Date.now()}`,
    name: habit.name ?? 'Untitled bad habit',
    color: habit.color ?? '#FF4D4F',
    category: normalizedCategory,
    createdAt: typeof habit.createdAt === 'string' ? habit.createdAt : options.defaultCreatedAt,
    isActive: habit.isActive ?? true,
    isArchived: habit.isArchived ?? false,
    isBuiltIn: habit.isBuiltIn ?? false,
    showStreakInUI: habit.showStreakInUI ?? habit.id === 'alcohol',
  }
}

function getEarliestDatasetDate(dataByYear: PersistedAppState['dataByYear']) {
  const allDates = Object.values(dataByYear)
    .flatMap((dataset) => dataset.days.map((day) => day.date))
    .sort()

  return allDates[0] ?? new Date().toISOString().slice(0, 10)
}

function getMigratedBadHabitLogs(
  dataByYear: PersistedAppState['dataByYear'],
  badHabits: BadHabitDefinition[],
  logs: Partial<BadHabitLog>[] | undefined,
) {
  const alcoholId = badHabits.find((habit) => habit.id === 'alcohol')?.id ?? 'alcohol'
  const normalizedLogs = Array.isArray(logs)
    ? logs
        .filter((log): log is Partial<BadHabitLog> => Boolean(log?.date && log?.badHabitId))
        .map((log) => ({
          date: log.date as string,
          badHabitId: log.badHabitId as string,
          occurred: log.occurred ?? true,
        }))
    : []

  const logKeySet = new Set(normalizedLogs.map((log) => `${log.date}:${log.badHabitId}`))
  const legacyAlcoholLogs = Object.values(dataByYear)
    .flatMap((dataset) => dataset.days)
    .filter((day) => day.drank)
    .map((day) => ({
      date: day.date,
      badHabitId: alcoholId,
      occurred: true,
    }))
    .filter((log) => !logKeySet.has(`${log.date}:${log.badHabitId}`))

  return [...normalizedLogs, ...legacyAlcoholLogs]
}

function normalizeDayEvents(raw: unknown): DayEventEntry[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const title = entry.trim()
        return title
          ? {
              id: `day-event-${index}`,
              title,
              description: '',
              time: '',
              tags: [],
            }
          : null
      }

      if (!entry || typeof entry !== 'object') return null

      const title = typeof entry.title === 'string' ? entry.title.trim() : ''
      const description = typeof entry.description === 'string' ? entry.description.trim() : ''
      const legacyDescription = typeof entry.note === 'string' ? entry.note.trim() : ''
      const fallbackTitle =
        !title && (description || legacyDescription)
          ? (description || legacyDescription).slice(0, 80)
          : title

      if (!fallbackTitle) return null

      return {
        id: typeof entry.id === 'string' ? entry.id : `day-event-${index}`,
        title: fallbackTitle,
        description: description || legacyDescription,
        time: typeof entry.time === 'string' ? entry.time : '',
        tags: normalizeDayEventTags((entry as { tags?: unknown }).tags),
      }
    })
    .filter((entry): entry is DayEventEntry => entry != null)
}

function normalizeDayEventTags(raw: unknown): DayEventEntry['tags'] {
  if (!Array.isArray(raw)) return []

  return raw
    .map<DayEventEntry['tags'][number] | null>((entry, index) => {
      if (!entry || typeof entry !== 'object') return null

      return {
        id: typeof entry.id === 'string' ? entry.id : `day-event-tag-${index}`,
        tagId: typeof entry.tagId === 'string' ? entry.tagId : undefined,
        customLabel: typeof entry.customLabel === 'string' ? entry.customLabel : undefined,
        section:
          entry.section === 'sleep' || entry.section === 'feelings' || entry.section === 'actions' || entry.section === 'events'
            ? entry.section
            : 'actions',
        kind: entry.kind === 'feeling' || entry.kind === 'action' ? entry.kind : 'action',
        polarity:
          entry.polarity === 'positive' || entry.polarity === 'neutral' || entry.polarity === 'negative'
            ? entry.polarity
            : 'positive',
      }
    })
    .filter((entry): entry is DayEventEntry['tags'][number] => entry !== null)
}

function inferPolarity(id?: string, name?: string): TagPolarity {
  const value = `${id ?? ''} ${name ?? ''}`.toLowerCase()
  return /(poor|alcohol|nicotine|stress|overthinking|junk|relapse|anxious)/.test(value) ? 'negative' : 'positive'
}

function inferSection(category?: string, id?: string, name?: string): TagSection {
  if (category === 'Sleep') return 'sleep'
  if (category === 'Mind') return 'feelings'

  const value = `${category ?? ''} ${id ?? ''} ${name ?? ''}`.toLowerCase()
  if (/sleep/.test(value)) return 'sleep'
  if (/(event|appointment|meeting|call|session|visit|trip|trigger)/.test(value)) return 'events'
  if (/(calm|clear|stress|overthinking|anxious|mood|feeling|emotion)/.test(value)) return 'feelings'
  return 'actions'
}

function inferKind(section: TagSection, id?: string, name?: string): TagKind {
  if (section === 'feelings') return 'feeling'
  if (section === 'actions') return 'action'
  if (section === 'events') return 'action'

  const value = `${id ?? ''} ${name ?? ''}`.toLowerCase()
  return /(sleep|stress|calm|clear|poor|good)/.test(value) ? 'feeling' : 'action'
}

function normalizeTagAvailability(raw: unknown, section: TagSection): DayLogSection[] {
  if (Array.isArray(raw)) {
    const normalized = raw.filter(
      (value): value is 'morning' | 'day' | 'evening' => value === 'morning' || value === 'day' || value === 'evening',
    )
    if (
      section === 'actions' &&
      normalized.length === 2 &&
      normalized.includes('day') &&
      normalized.includes('evening') &&
      !normalized.includes('morning')
    ) {
      return ['morning', 'day', 'evening']
    }
    if (normalized.length > 0) return normalized
  }

  if (section === 'sleep') return ['morning']
  if (section === 'feelings') return ['morning', 'day', 'evening']
  if (section === 'events') return ['day']
  return ['morning', 'day', 'evening']
}
