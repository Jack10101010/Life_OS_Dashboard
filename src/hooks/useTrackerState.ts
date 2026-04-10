import { useEffect, useMemo, useState } from 'react'
import { createMockData } from '../data/mockData'
import { createEmptyDashboardExecution, dashboardExecutionHasMeaningfulContent, normalizeDashboardExecution } from '../lib/dashboardExecution'
import { clearCanonicalDayRecord, saveCanonicalDayRecord } from '../lib/persistence/dayRecords'
import { createEmptyWorkspaceScratchpad } from '../lib/persistence/workspace'
import { getDailyScore, getWeeklyScore } from '../lib/scoring'
import { getConsecutiveDateStreak, getConsecutiveDateStreakEndingAt } from '../lib/streaks'
import { PersistedAppState } from '../lib/persistence'
import {
  BadHabitDefinition,
  BadHabitLog,
  ColorMode,
  DayLogSection,
  DayTagEntry,
  DayEntry,
  HabitTrackerCalendarRange,
  HeatmapLayout,
  Tag,
  TagKind,
  TagPolarity,
  TagSection,
  TrackerFilters,
  TrackerViewMode,
} from '../types'

export function useTrackerState(initialState: PersistedAppState, currentYear: number, enableBadHabitTracking: boolean) {
  const [dataByYear, setDataByYear] = useState(() => normalizeTrackerData(initialState.dataByYear))
  const [habits] = useState(initialState.habits)
  const [badHabits, setBadHabits] = useState(initialState.badHabits)
  const [badHabitLogs, setBadHabitLogs] = useState(initialState.badHabitLogs)
  const [tags, setTags] = useState(initialState.tags)
  const [viewMode, setViewMode] = useState<TrackerViewMode>(initialState.viewMode)
  const [colorMode, setColorMode] = useState<ColorMode>(initialState.colorMode)
  const [heatmapLayout, setHeatmapLayout] = useState<HeatmapLayout>(initialState.heatmapLayout)
  const [filters, setFilters] = useState<TrackerFilters>(initialState.filters)
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(initialState.selectedWeekId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(initialState.selectedDayId)
  const [openDrawer, setOpenDrawer] = useState<'day' | 'week' | null>(initialState.openDrawer)
  const [moodHeatmapFocusDate, setMoodHeatmapFocusDate] = useState(initialState.moodHeatmapFocusDate)
  const [moodHeatmapCalendarRange, setMoodHeatmapCalendarRange] = useState<HabitTrackerCalendarRange>(
    initialState.moodHeatmapCalendarRange,
  )
  const [moodHighlightCurrentWeek, setMoodHighlightCurrentWeek] = useState(initialState.moodHighlightCurrentWeek)
  const [moodShowAlcoholMarkers, setMoodShowAlcoholMarkers] = useState(initialState.moodShowAlcoholMarkers)
  const [moodShowHabitMarkers, setMoodShowHabitMarkers] = useState(initialState.moodShowHabitMarkers)

  const availableDatasetYears = useMemo(
    () => Object.keys(dataByYear).map((year) => Number(year)).filter((year) => Number.isFinite(year)).sort((left, right) => right - left),
    [dataByYear],
  )
  const activeYear = dataByYear[filters.year as keyof typeof dataByYear] ? filters.year : availableDatasetYears[0] ?? currentYear
  const dataset = dataByYear[activeYear as keyof typeof dataByYear]

  useEffect(() => {
    if (filters.year !== activeYear) {
      setFilters((current) => ({ ...current, year: activeYear }))
    }
  }, [activeYear, filters.year])

  const alcoholBadHabit = useMemo(() => getAlcoholBadHabit(badHabits), [badHabits])
  const alcoholConsumedDateSet = useMemo(
    () => new Set(getOccurredBadHabitDates(badHabitLogs, alcoholBadHabit?.id)),
    [badHabitLogs, alcoholBadHabit?.id],
  )
  const badHabitDateMap = useMemo(() => getBadHabitDateMap(badHabitLogs, badHabits), [badHabitLogs, badHabits])
  const badHabitDates = useMemo(() => Array.from(badHabitDateMap.keys()).sort(), [badHabitDateMap])
  const activeBadHabits = useMemo(() => badHabits.filter((habit) => habit.isActive && !habit.isArchived), [badHabits])
  const visibleBadHabitStreaks = useMemo(
    () => {
      const todayIso = new Date().toISOString().slice(0, 10)
      const currentYear = new Date().getUTCFullYear()
      const yesterday = new Date(`${todayIso}T00:00:00Z`)
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayIso = yesterday.toISOString().slice(0, 10)

      return badHabits
        .filter((habit) => habit.showStreakInUI && !habit.isArchived)
        .map((habit) => {
          const habitCreatedAtIso = habit.createdAt.slice(0, 10)
          const occurredToday = (badHabitDateMap.get(todayIso) ?? []).some((item) => item.id === habit.id)
          const cleanCalendarDays = new Set(
            dataset.days
              .filter(
                (day) =>
                  day.date >= habitCreatedAtIso &&
                  !(badHabitDateMap.get(day.date) ?? []).some((item) => item.id === habit.id),
              )
              .map((day) => day.date),
          )

          const streak =
            filters.year === currentYear
              ? occurredToday
                ? 0
                : getConsecutiveDateStreakEndingAt(cleanCalendarDays, yesterdayIso)
              : getConsecutiveDateStreak(cleanCalendarDays, filters.year)

          return {
            habit,
            streak,
            startsToday: streak === 0 && habitCreatedAtIso === todayIso && !occurredToday,
            brokenToday: occurredToday,
          }
        })
    },
    [badHabitDateMap, badHabits, dataset.days, filters.year],
  )

  const computedWeeks = useMemo(() => {
    return dataset.weeks.map((week) => {
      const linkedDays = dataset.days.filter((day) => week.linkedDays.includes(day.id))
      const loggedDays = linkedDays.filter((day) => day.isLogged)
      const habitCompletionPercent =
        loggedDays.length === 0
          ? 0
          : Math.round(
              (loggedDays.reduce((sum, day) => sum + day.habitsCompleted, 0) /
                Math.max(loggedDays.reduce((sum, day) => sum + day.habitsTotal, 0), 1)) *
                100,
            )
      const moodAverage =
        loggedDays.length === 0
          ? 0
          : Number(
              (
                loggedDays.reduce((sum, day) => sum + (day.morningMood + day.eveningMood) / 2, 0) / loggedDays.length
              ).toFixed(1),
            )
      const tags = Array.from(new Set(loggedDays.flatMap((day) => day.tags))).slice(0, 4)
      const reflection = loggedDays.find((day) => day.journal)?.journal ?? ''
      const whatWentWell = loggedDays.find((day) => day.bigWin)?.bigWin ?? ''
      const whatSlipped = loggedDays.some((day) => alcoholConsumedDateSet.has(day.date))
        ? 'A drink was logged during this week.'
        : loggedDays.length > 0
          ? 'No slip note added yet.'
          : ''

      return {
        ...week,
        loggedDaysCount: loggedDays.length,
        weeklyScore: getWeeklyScore(loggedDays.map((day) => day.score)),
        habitCompletionPercent,
        moodAverage,
        drankThisWeek: loggedDays.some((day) => alcoholConsumedDateSet.has(day.date)),
        bigWin: loggedDays.find((day) => day.bigWin)?.bigWin ?? '',
        reflection,
        whatWentWell,
        whatSlipped,
        tags,
      }
    })
  }, [alcoholConsumedDateSet, dataset.days, dataset.weeks])

  const filteredDays = useMemo(() => {
    return dataset.days.filter((day) => {
      if (filters.mood !== 'all') {
        const bucket = getMoodFilterBucket(day)
        if (bucket !== filters.mood) return false
      }

      if (filters.selectedTagIds.length > 0 && !filters.selectedTagIds.some((tagId) => day.tags.includes(tagId))) {
        return false
      }

      if (enableBadHabitTracking && filters.selectedBadHabitIds.length > 0) {
        const occurredBadHabitIds = new Set((badHabitDateMap.get(day.date) ?? []).map((habit) => habit.id))
        if (!filters.selectedBadHabitIds.some((habitId) => occurredBadHabitIds.has(habitId))) {
          return false
        }
      }

      return true
    })
  }, [badHabitDateMap, dataset.days, enableBadHabitTracking, filters])

  const filteredWeeks = useMemo(() => {
    const filteredDayIds = new Set(filteredDays.map((day) => day.id))
    return computedWeeks.filter((week) => week.linkedDays.some((dayId) => filteredDayIds.has(dayId)))
  }, [computedWeeks, filteredDays])

  const selectedWeek = filteredWeeks.find((week) => week.id === selectedWeekId) ?? filteredWeeks[0] ?? null
  const selectedWeekDays = selectedWeek ? dataset.days.filter((day) => selectedWeek.linkedDays.includes(day.id)) : []
  const selectedDay = dataset.days.find((day) => day.id === selectedDayId) ?? selectedWeekDays[0] ?? filteredDays[0] ?? null

  const alcoholFreeStreak = useMemo(() => {
    return getConsecutiveDateStreak(
      new Set(dataset.days.filter((day) => day.isLogged && !alcoholConsumedDateSet.has(day.date)).map((day) => day.date)),
      filters.year,
    )
  }, [alcoholConsumedDateSet, dataset.days, filters.year])

  const momentumScore = useMemo(() => {
    const recent = computedWeeks.slice(-4)
    const loggedWeeks = recent.filter((week) => week.loggedDaysCount > 0)
    if (loggedWeeks.length === 0) return 0
    return Math.round(loggedWeeks.reduce((sum, week) => sum + week.weeklyScore, 0) / loggedWeeks.length)
  }, [computedWeeks])

  const hydrate = (next: PersistedAppState) => {
    setDataByYear(normalizeTrackerData(next.dataByYear))
    setBadHabits(next.badHabits)
    setBadHabitLogs(next.badHabitLogs)
    setViewMode(next.viewMode)
    setColorMode(next.colorMode)
    setHeatmapLayout(next.heatmapLayout)
    setFilters(next.filters)
    setSelectedWeekId(next.selectedWeekId)
    setSelectedDayId(next.selectedDayId)
    setOpenDrawer(next.openDrawer)
    setMoodHeatmapFocusDate(next.moodHeatmapFocusDate)
    setMoodHeatmapCalendarRange(next.moodHeatmapCalendarRange)
    setMoodHighlightCurrentWeek(next.moodHighlightCurrentWeek)
    setMoodShowAlcoholMarkers(next.moodShowAlcoholMarkers)
    setMoodShowHabitMarkers(next.moodShowHabitMarkers)
  }

  const updateDayForYear = (
    year: number,
    dayId: string,
    updater: (day: DayEntry) => DayEntry,
    options?: { skipCanonicalSave?: boolean },
  ) => {
    setDataByYear((current) => {
      const yearData = current[year as keyof typeof current]
      if (!yearData) return current
      return {
        ...current,
        [year]: {
          ...yearData,
          days: yearData.days.map((day) => {
            if (day.id !== dayId) return day
            const updated = updater(day)
            const score = updated.isLogged
              ? getDailyScore({
                  habitsCompleted: updated.habitsCompleted,
                  habitsTotal: updated.habitsTotal,
                  morningMood: updated.morningMood,
                  eveningMood: updated.eveningMood,
                  drank: updated.drank,
                })
              : 0
            const nextDay = { ...updated, score, updatedAt: new Date().toISOString() }
            if (!options?.skipCanonicalSave) {
              saveCanonicalDayRecord({
                ...nextDay,
                dashboardScratchpad: createEmptyWorkspaceScratchpad(),
              })
            }
            return nextDay
          }),
        },
      }
    })
  }

  const updateDay = (
    dayId: string,
    updater: (day: DayEntry) => DayEntry,
    options?: { skipCanonicalSave?: boolean },
  ) => {
    updateDayForYear(filters.year, dayId, updater, options)
  }

  const updateDayByDate = (
    date: string,
    updater: (day: DayEntry) => DayEntry,
    options?: { skipCanonicalSave?: boolean },
  ) => {
    const targetYear = Number(date.slice(0, 4))
    const targetDay = dataByYear[targetYear as keyof typeof dataByYear]?.days.find((day) => day.date === date)
    if (!targetDay) return
    updateDayForYear(targetYear, targetDay.id, updater, options)
  }

  const toggleBadHabit = (dayId: string, date: string, badHabitId: string) => {
    const isAlcohol = badHabitId === alcoholBadHabit?.id
    const nextOccurred = isAlcohol ? !alcoholConsumedDateSet.has(date) : !badHabitDateMap.get(date)?.some((habit) => habit.id === badHabitId)
    setBadHabitLogs((current) => {
      const existingIndex = current.findIndex((log) => log.date === date && log.badHabitId === badHabitId)

      if (existingIndex === -1) {
        return [...current, { date, badHabitId, occurred: true }]
      }

      return current.map((log, index) => (index === existingIndex ? { ...log, occurred: nextOccurred } : log))
    })

    updateDay(dayId, (day) => ({
      ...day,
      isLogged: true,
      drank: isAlcohol ? nextOccurred : day.drank,
    }))
  }

  const handleSelectTag = (tagId: string, timeSection: DayLogSection = 'evening') => {
    if (!selectedDay) return
    const tag = tags.find((item) => item.id === tagId)
    if (!tag) return
    updateDay(selectedDay.id, (day) => ({
      ...day,
      isLogged: true,
      tags: day.tags.includes(tagId) ? day.tags.filter((value) => value !== tagId) : [...day.tags, tagId],
      tagEntries: day.tags.includes(tagId)
        ? day.tagEntries.filter((entry) => entry.tagId !== tagId)
        : [
            ...day.tagEntries.filter((entry) => entry.tagId !== tagId),
            {
              id: createDayTagEntryId(tagId),
              tagId,
              section: tag.section,
              kind: tag.kind,
              polarity: tag.polarity,
              flag: 'none',
              timeSection,
              selected: true,
            },
          ],
    }))
  }

  const createTag = ({
    name,
    section = 'actions',
    kind,
    polarity = 'positive',
    availableIn,
  }: {
    name: string
    section?: TagSection
    kind?: TagKind
    polarity?: TagPolarity
    availableIn?: DayLogSection[]
  }): Tag => {
    const trimmed = name.trim()
    const resolvedKind = kind ?? getDefaultKindForSection(section)
    const resolvedAvailability = availableIn && availableIn.length > 0 ? availableIn : getDefaultTagAvailability(section)
    const existingTag = tags.find(
      (item) =>
        item.name.toLowerCase() === trimmed.toLowerCase() &&
        item.section === section &&
        item.kind === resolvedKind &&
        item.polarity === polarity &&
        haveSameAvailability(item.availableIn, resolvedAvailability),
    )

    if (existingTag) {
      if (!existingTag.isActive) {
        const reactivatedTag = { ...existingTag, isActive: true }
        setTags((current) => current.map((item) => (item.id === existingTag.id ? reactivatedTag : item)))
        return reactivatedTag
      }

      return existingTag
    }

    const tag: Tag = {
      id: createTagId(trimmed),
      name: trimmed,
      color: getTagColor(polarity),
      section,
      kind: resolvedKind,
      polarity,
      flag: 'none',
      availableIn: resolvedAvailability,
      isCustom: true,
      isActive: true,
    }

    setTags((current) => {
      return [...current, tag]
    })

    return tag
  }

  const renameTag = (tagId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return

    setTags((current) =>
      current.map((tag) => {
        if (tag.id !== tagId) return tag
        return {
          ...tag,
          name: trimmed,
        }
      }),
    )
  }

  const updateTag = (
    tagId: string,
    updates: {
      name: string
      section: TagSection
      kind: TagKind
      polarity: TagPolarity
      availableIn: DayLogSection[]
    },
  ) => {
    const trimmed = updates.name.trim()
    if (!trimmed) return

    setTags((current) =>
      current.map((tag) => {
        if (tag.id !== tagId) return tag
        return {
          ...tag,
          name: trimmed,
          section: updates.section,
          kind: updates.kind,
          polarity: updates.polarity,
          availableIn: updates.availableIn.length > 0 ? updates.availableIn : getDefaultTagAvailability(updates.section),
          color: getTagColor(updates.polarity),
        }
      }),
    )

    setDataByYear((current) => syncTagMetadataAcrossDatasets(current, tagId, updates.section, updates.kind, updates.polarity))
  }

  const reorganizeTag = (tagId: string, targetSection: TagSection, beforeTagId?: string) => {
    let nextSection = targetSection
    let nextKind: TagKind = 'action'
    let nextPolarity: TagPolarity = 'positive'

    setTags((current) => {
      const sourceIndex = current.findIndex((tag) => tag.id === tagId)
      if (sourceIndex === -1) return current

      const tag = current[sourceIndex]
      nextSection = targetSection
      nextKind = targetSection === 'sleep' ? tag.kind : getDefaultKindForSection(targetSection)
      nextPolarity = tag.polarity

      const updatedTag: Tag = {
        ...tag,
        section: nextSection,
        kind: nextKind,
      }

      const remaining = current.filter((item) => item.id !== tagId)
      const insertIndex = getTagInsertionIndex(remaining, updatedTag, beforeTagId)

      return [...remaining.slice(0, insertIndex), updatedTag, ...remaining.slice(insertIndex)]
    })

    setDataByYear((current) => syncTagMetadataAcrossDatasets(current, tagId, nextSection, nextKind, nextPolarity))
  }

  const archiveTag = (tagId: string) => {
    setTags((current) =>
      current.map((tag) => {
        if (tag.id !== tagId) return tag
        return {
          ...tag,
          isActive: false,
        }
      }),
    )
  }

  const unarchiveTag = (tagId: string) => {
    setTags((current) =>
      current.map((tag) => {
        if (tag.id !== tagId) return tag
        return {
          ...tag,
          isActive: true,
        }
      }),
    )
  }

  const deleteTag = (tagId: string) => {
    const tagToDelete = tags.find((tag) => tag.id === tagId)
    if (!tagToDelete) return

    setTags((current) => current.filter((tag) => tag.id !== tagId))
    setDataByYear((current) =>
      Object.fromEntries(
        Object.entries(current).map(([year, dataset]) => [
          year,
          {
            ...dataset,
            days: dataset.days.map((day) => ({
              ...day,
              tags: day.tags.filter((id) => id !== tagId),
              tagEntries: day.tagEntries.map((entry) =>
                entry.tagId === tagId
                  ? {
                      ...entry,
                      tagId: undefined,
                      customLabel: entry.customLabel ?? tagToDelete.name,
                      section: entry.section ?? tagToDelete.section,
                      kind: entry.kind ?? tagToDelete.kind,
                      polarity: entry.polarity ?? tagToDelete.polarity,
                    }
                  : entry,
              ),
            })),
          },
        ]),
      ) as PersistedAppState['dataByYear'],
    )
  }

  const updateBadHabit = (badHabitId: string, updater: (habit: BadHabitDefinition) => BadHabitDefinition) => {
    setBadHabits((current) => current.map((habit) => (habit.id === badHabitId ? updater(habit) : habit)))
  }

  const createBadHabit = (input: {
    name: string
    color: string
    isActive: boolean
    showStreakInUI: boolean
  }) => {
    const trimmed = input.name.trim()
    if (!trimmed) return null

    const habit: BadHabitDefinition = {
      id: createBadHabitId(trimmed),
      name: trimmed,
      color: input.color,
      category: 'Custom',
      createdAt: new Date().toISOString().slice(0, 10),
      isActive: input.isActive,
      isArchived: false,
      isBuiltIn: false,
      showStreakInUI: input.showStreakInUI,
    }

    setBadHabits((current) => [...current, habit])
    return habit
  }

  const archiveBadHabit = (badHabitId: string) => {
    setBadHabits((current) =>
      current.map((habit) =>
        habit.id === badHabitId
          ? {
              ...habit,
              isArchived: true,
              isActive: false,
            }
          : habit,
      ),
    )
  }

  const handleNavigateDay = (direction: 'prev' | 'next') => {
    if (!selectedDay) return
    const currentIndex = dataset.days.findIndex((day) => day.id === selectedDay.id)
    const target = dataset.days[currentIndex + (direction === 'next' ? 1 : -1)]
    if (target) {
      setSelectedDayId(target.id)
      setSelectedWeekId(target.linkedWeek)
    }
  }

  const openSpecificDay = (year: number, dayId: string, linkedWeek: string) => {
    setFilters((current) => ({ ...current, year }))
    setSelectedDayId(dayId)
    setSelectedWeekId(linkedWeek)
    setOpenDrawer('day')
  }

  const openToday = (navigateToTracker = false, setPage?: (page: PersistedAppState['page']) => void) => {
    const todayDate = new Date().toISOString().slice(0, 10)
    const todayYear = Number(todayDate.slice(0, 4))
    const yearData = dataByYear[todayYear as keyof typeof dataByYear] ?? createMockData(todayYear)
    if (!dataByYear[todayYear as keyof typeof dataByYear]) {
      setDataByYear((current) => ({
        ...current,
        [todayYear]: normalizeYearDataset(createMockData(todayYear)),
      }))
    }
    const todayDay = yearData?.days.find((day) => day.date === todayDate)
    if (!todayDay) return
    if (navigateToTracker && setPage) {
      setPage('tracker')
    }
    openSpecificDay(todayYear, todayDay.id, todayDay.linkedWeek)
  }

  const deleteDayEntry = (dayId: string) => {
    const existingDay = dataset.days.find((day) => day.id === dayId)
    if (!existingDay || !hasDayEntryData(existingDay)) return false

    setDataByYear((current) => {
      const yearData = current[filters.year as keyof typeof current]
      return {
        ...current,
        [filters.year]: {
          ...yearData,
          days: yearData.days.map((day) => (day.id === dayId ? resetDayEntry(day) : day)),
        },
      }
    })
    setBadHabitLogs((current) => current.filter((log) => log.date !== existingDay.date))
    clearCanonicalDayRecord(existingDay.date, existingDay)

    if (selectedDayId === dayId) {
      const currentIndex = dataset.days.findIndex((day) => day.id === dayId)
      const previousDay = currentIndex > 0 ? dataset.days[currentIndex - 1] : null
      if (previousDay) {
        setSelectedDayId(previousDay.id)
        setSelectedWeekId(previousDay.linkedWeek)
      }
    }

    return true
  }

  return {
    dataByYear,
    setDataByYear,
    habits,
    badHabits,
    setBadHabits,
    badHabitLogs,
    setBadHabitLogs,
    activeBadHabits,
    visibleBadHabitStreaks,
    badHabitDates,
    badHabitDateMap,
    tags,
    setTags,
    viewMode,
    setViewMode,
    colorMode,
    setColorMode,
    heatmapLayout,
    setHeatmapLayout,
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
    alcoholFreeStreak,
    momentumScore,
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
    hydrate,
  }
}

function getTagInsertionIndex(tags: Tag[], movingTag: Tag, beforeTagId?: string) {
  if (beforeTagId) {
    const targetIndex = tags.findIndex((tag) => tag.id === beforeTagId)
    if (targetIndex !== -1) return targetIndex
  }

  const sectionOrder: TagSection[] = ['sleep', 'feelings', 'actions', 'events']
  const movingSectionIndex = sectionOrder.indexOf(movingTag.section)
  const lastIndexInSection = findLastIndex(tags, (tag) => tag.isCustom && tag.section === movingTag.section)

  if (lastIndexInSection !== -1) return lastIndexInSection + 1

  const firstIndexAfterSection = tags.findIndex(
    (tag) => tag.isCustom && sectionOrder.indexOf(tag.section) > movingSectionIndex,
  )

  return firstIndexAfterSection === -1 ? tags.length : firstIndexAfterSection
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index
  }

  return -1
}

function syncTagMetadataAcrossDatasets(
  dataByYear: PersistedAppState['dataByYear'],
  tagId: string,
  section: TagSection,
  kind: TagKind,
  polarity: TagPolarity,
) {
  return Object.fromEntries(
    Object.entries(dataByYear).map(([year, dataset]) => [
      year,
      {
        ...dataset,
        days: dataset.days.map((day) => ({
          ...day,
          tagEntries: day.tagEntries.map((entry) =>
            entry.tagId === tagId
              ? {
                  ...entry,
                  section,
                  kind,
                  polarity,
                }
              : entry,
          ),
        })),
      },
    ]),
  ) as PersistedAppState['dataByYear']
}

function getDefaultKindForSection(section: TagSection): TagKind {
  if (section === 'feelings') return 'feeling'
  if (section === 'actions') return 'action'
  if (section === 'events') return 'action'
  return 'action'
}

function getDefaultTagAvailability(section: TagSection): DayLogSection[] {
  if (section === 'sleep') return ['morning']
  if (section === 'feelings') return ['morning', 'day', 'evening']
  if (section === 'events') return ['day']
  return ['morning', 'day', 'evening']
}

function getTagColor(polarity: TagPolarity) {
  if (polarity === 'positive') return '#22C55E'
  if (polarity === 'neutral') return '#60A5FA'
  return '#B35A65'
}

function createTagId(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `tag-${base || Date.now().toString(36)}-${Date.now().toString(36)}`
}

function createBadHabitId(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `bad-habit-${base || Date.now().toString(36)}-${Date.now().toString(36)}`
}

function haveSameAvailability(left: DayLogSection[], right: DayLogSection[]) {
  if (left.length !== right.length) return false

  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.every((section, index) => section === rightSorted[index])
}

function createDayTagEntryId(seed: string) {
  return `day-tag-${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeTrackerData(dataByYear: PersistedAppState['dataByYear']) {
  return Object.fromEntries(
    Object.entries(dataByYear).map(([year, dataset]) => [year, normalizeYearDataset(dataset)]),
  ) as PersistedAppState['dataByYear']
}

function normalizeYearDataset(dataset: PersistedAppState['dataByYear'][number]) {
  return {
    ...dataset,
    days: dataset.days.map((day) => normalizeDayEntry(day)),
  }
}

function normalizeDayEntry(day: DayEntry): DayEntry {
  const normalizedTagEntries = normalizeDayTagEntries(day)
  const reusableTagIds = normalizedTagEntries
    .map((entry) => entry.tagId)
    .filter((tagId): tagId is string => typeof tagId === 'string')

  if (!day.isLogged) {
    return {
      ...day,
      mood: null,
      motivation: null,
      clarity: null,
      energy: null,
      sleepQuality: null,
      bedtime: day.bedtime ?? '',
      wakeTime: day.wakeTime ?? '',
      wokeDuringNight: typeof day.wokeDuringNight === 'boolean' ? day.wokeDuringNight : null,
      sleepNote: day.sleepNote ?? '',
      eveningOutcome: day.eveningOutcome ?? null,
      eveningUnstable: day.eveningUnstable ?? false,
      eveningTrajectory: day.eveningTrajectory ?? null,
      eveningSelfInfluence: day.eveningSelfInfluence ?? null,
      dashboardExecution: normalizeDashboardExecution(day.dashboardExecution),
      dailyIntentCompleteOneTask: day.dailyIntentCompleteOneTask ?? false,
      morningIntention: day.morningIntention ?? '',
      tags: reusableTagIds,
      tagEntries: normalizedTagEntries,
    }
  }

  return {
    ...day,
    tags: reusableTagIds,
    tagEntries: normalizedTagEntries,
    mood: normalizeCheckInValue(day.mood),
    motivation: normalizeCheckInValue(day.motivation),
    clarity: normalizeCheckInValue(day.clarity),
    energy: normalizeCheckInValue(day.energy),
    sleepQuality: normalizeCheckInValue(day.sleepQuality),
    bedtime: day.bedtime ?? '',
    wakeTime: day.wakeTime ?? '',
    wokeDuringNight: typeof day.wokeDuringNight === 'boolean' ? day.wokeDuringNight : null,
    sleepNote: day.sleepNote ?? '',
    eveningOutcome: day.eveningOutcome ?? null,
    eveningUnstable: day.eveningUnstable ?? false,
    eveningTrajectory: day.eveningTrajectory ?? null,
    eveningSelfInfluence: day.eveningSelfInfluence ?? null,
    dashboardExecution: normalizeDashboardExecution(day.dashboardExecution),
    dailyIntentCompleteOneTask: day.dailyIntentCompleteOneTask ?? false,
    morningIntention: day.morningIntention ?? '',
    dashboardScratchpad: day.dashboardScratchpad
      ? {
          mode:
            day.dashboardScratchpad.mode === 'structured'
              ? 'structured'
              : day.dashboardScratchpad.mode === 'todo'
                ? 'todo'
                : 'free',
          text: day.dashboardScratchpad.text ?? '',
          freeNotes: Array.isArray(day.dashboardScratchpad.freeNotes)
            ? day.dashboardScratchpad.freeNotes.map((note, index) => ({
                id: note.id,
                title: note.title?.trim().length ? note.title : `Note ${index + 1}`,
                text: note.text ?? '',
              }))
            : [
                {
                  id: `scratch-free-${day.id}`,
                  title: 'Note 1',
                  text: day.dashboardScratchpad.text ?? '',
                },
              ],
          activeFreeNoteId:
            typeof day.dashboardScratchpad.activeFreeNoteId === 'string' &&
            Array.isArray(day.dashboardScratchpad.freeNotes) &&
            day.dashboardScratchpad.freeNotes.some((note) => note.id === day.dashboardScratchpad.activeFreeNoteId)
              ? day.dashboardScratchpad.activeFreeNoteId
              : Array.isArray(day.dashboardScratchpad.freeNotes) && day.dashboardScratchpad.freeNotes[0]
                ? day.dashboardScratchpad.freeNotes[0].id
                : `scratch-free-${day.id}`,
          moneyIn: Array.isArray(day.dashboardScratchpad.moneyIn)
            ? day.dashboardScratchpad.moneyIn.map((item) => ({
                id: item.id,
                name: item.name ?? '',
                day: item.day ?? '',
                amount: item.amount ?? '',
                settled: item.settled ?? false,
              }))
            : [],
          moneyOut: Array.isArray(day.dashboardScratchpad.moneyOut)
            ? day.dashboardScratchpad.moneyOut.map((item) => ({
                id: item.id,
                name: item.name ?? '',
                day: item.day ?? '',
                amount: item.amount ?? '',
                settled: item.settled ?? false,
              }))
            : [],
          notes: day.dashboardScratchpad.notes ?? '',
          financeSheets:
            day.dashboardScratchpad.financeSheets && typeof day.dashboardScratchpad.financeSheets === 'object'
              ? Object.fromEntries(
                  Object.entries(day.dashboardScratchpad.financeSheets).map(([monthKey, sheet]) => [
                    monthKey,
                    {
                      moneyIn: Array.isArray(sheet?.moneyIn)
                        ? sheet.moneyIn.map((item) => ({
                            id: item.id,
                            name: item.name ?? '',
                            day: item.day ?? '',
                            amount: item.amount ?? '',
                            settled: item.settled ?? false,
                          }))
                        : [],
                      moneyOut: Array.isArray(sheet?.moneyOut)
                        ? sheet.moneyOut.map((item) => ({
                            id: item.id,
                            name: item.name ?? '',
                            day: item.day ?? '',
                            amount: item.amount ?? '',
                            settled: item.settled ?? false,
                          }))
                        : [],
                      notes: sheet?.notes ?? '',
                    },
                  ]),
                )
              : {
                  [day.date.slice(0, 7)]: {
                    moneyIn: Array.isArray(day.dashboardScratchpad.moneyIn)
                      ? day.dashboardScratchpad.moneyIn.map((item) => ({
                          id: item.id,
                          name: item.name ?? '',
                          day: item.day ?? '',
                          amount: item.amount ?? '',
                          settled: item.settled ?? false,
                        }))
                      : [],
                    moneyOut: Array.isArray(day.dashboardScratchpad.moneyOut)
                      ? day.dashboardScratchpad.moneyOut.map((item) => ({
                          id: item.id,
                          name: item.name ?? '',
                          day: item.day ?? '',
                          amount: item.amount ?? '',
                          settled: item.settled ?? false,
                        }))
                      : [],
                    notes: day.dashboardScratchpad.notes ?? '',
                  },
                },
          todoItems: Array.isArray(day.dashboardScratchpad.todoItems)
            ? day.dashboardScratchpad.todoItems.map((item) => ({
                id: item.id,
                text: item.text ?? '',
                completed: item.completed ?? false,
              }))
            : [],
        }
      : {
          mode: 'free',
          text: '',
          freeNotes: [
            {
              id: `scratch-free-${day.id}`,
              title: 'Note 1',
              text: '',
            },
          ],
          activeFreeNoteId: `scratch-free-${day.id}`,
          moneyIn: [],
          moneyOut: [],
          notes: '',
          financeSheets: {},
          todoItems: [],
        },
    lowStateEntry: day.lowStateEntry
      ? {
          feelings: Array.isArray(day.lowStateEntry.feelings) ? day.lowStateEntry.feelings : [],
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
    medications: Array.isArray(day.medications)
      ? day.medications.map((entry) => ({
          id: entry.id,
          name: entry.name ?? '',
          dose: entry.dose ?? '',
          unit: entry.unit ?? '',
          timeTaken: entry.timeTaken ?? '',
          notes: entry.notes ?? '',
        }))
      : [],
    dashboardQuickNote: day.dashboardQuickNote ?? '',
  }
}

function normalizeDayTagEntries(day: DayEntry): DayTagEntry[] {
  if (Array.isArray(day.tagEntries) && day.tagEntries.length > 0) {
    return day.tagEntries
      .filter((entry): entry is DayTagEntry => Boolean(entry) && (typeof entry.tagId === 'string' || typeof entry.customLabel === 'string'))
      .map((entry) => ({
        ...entry,
        flag: 'none' as DayTagEntry['flag'],
        timeSection: entry.timeSection === 'morning' || entry.timeSection === 'evening' || entry.timeSection === 'day' ? entry.timeSection : 'day',
      }))
      .filter((entry) => !isLegacyImportantTagName(entry.customLabel))
  }

  return day.tags.map((tagId, index) => ({
    id: `day-tag-${tagId}-${index}`,
    tagId,
    section: 'actions',
    kind: 'action',
    polarity: 'positive',
    flag: 'none',
    timeSection: 'day',
    selected: true,
  }))
}

function isLegacyImportantTagName(value: unknown) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === 'important' || normalized === 'high priority' || normalized === 'priority' || normalized === 'test' || normalized === 'h'
}

function normalizeCheckInValue(value: number | null) {
  if (value == null) return null
  return Math.min(10, Math.max(1, Math.round(value)))
}

function hasDayEntryData(day: DayEntry) {
  return (
    day.isLogged ||
    day.cellColor !== 'blank' ||
    day.mood !== null ||
    day.motivation !== null ||
    day.clarity !== null ||
    day.energy !== null ||
    day.sleepQuality !== null ||
    day.bedtime.trim().length > 0 ||
    day.wakeTime.trim().length > 0 ||
    day.wokeDuringNight !== null ||
    day.sleepNote.trim().length > 0 ||
    day.eveningOutcome !== null ||
    day.eveningTrajectory !== null ||
    day.eveningSelfInfluence !== null ||
    day.morningIntention.trim().length > 0 ||
    day.moodNote.trim().length > 0 ||
    day.completedHabitIds.length > 0 ||
    day.habitsCompleted > 0 ||
    day.drank ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
    day.dashboardQuickNote.trim().length > 0 ||
    dashboardExecutionHasMeaningfulContent(day.dashboardExecution) ||
    day.dailyIntentCompleteOneTask ||
    day.dashboardScratchpad.text.trim().length > 0 ||
    day.dashboardScratchpad.freeNotes.some((note) => note.text.trim().length > 0) ||
    day.dashboardScratchpad.notes.trim().length > 0 ||
    day.dashboardScratchpad.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    day.dashboardScratchpad.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    Object.values(day.dashboardScratchpad.financeSheets).some(
      (sheet) =>
        sheet.notes.trim().length > 0 ||
        sheet.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
        sheet.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0),
    ) ||
    day.dashboardScratchpad.todoItems.some((item) => item.text.trim().length > 0 || item.completed) ||
    Boolean(
      day.lowStateEntry &&
        (day.lowStateEntry.feelings.length > 0 ||
          day.lowStateEntry.customFeeling.trim().length > 0 ||
          day.lowStateEntry.mindText.trim().length > 0 ||
          day.lowStateEntry.mindHelping !== null ||
          day.lowStateEntry.realSituation.trim().length > 0 ||
          day.lowStateEntry.nextThing.trim().length > 0),
    ) ||
    day.medications.length > 0 ||
    day.tasks.length > 0 ||
    day.reminders.length > 0 ||
    day.dailyActions.length > 0 ||
    day.tags.length > 0
  )
}

function resetDayEntry(day: DayEntry): DayEntry {
  return {
    ...day,
    isLogged: false,
    cellColor: 'blank',
    mood: null,
    motivation: null,
    clarity: null,
    energy: null,
    sleepQuality: null,
    bedtime: '',
    wakeTime: '',
    wokeDuringNight: null,
    sleepNote: '',
    morningMood: 3,
    eveningMood: 3,
    moodNote: '',
    eveningOutcome: null,
    eveningUnstable: false,
    eveningTrajectory: null,
    eveningSelfInfluence: null,
    habitsCompleted: 0,
    completedHabitIds: [],
    drank: false,
    bigWin: '',
    journal: '',
    dashboardQuickNote: '',
    dashboardExecution: createEmptyDashboardExecution(),
    dailyIntentCompleteOneTask: false,
    morningIntention: '',
    dashboardScratchpad: {
      mode: 'free',
      text: '',
      freeNotes: [
        {
          id: `scratch-free-${day.id}`,
          title: 'Note 1',
          text: '',
        },
      ],
      activeFreeNoteId: `scratch-free-${day.id}`,
      moneyIn: [],
      moneyOut: [],
      notes: '',
      financeSheets: {},
      todoItems: [],
    },
    lowStateEntry: null,
    medications: [],
    tasks: [],
    reminders: [],
    dailyActions: [],
    tags: [],
    tagEntries: [],
    score: 0,
    updatedAt: null,
  }
}

function getAlcoholBadHabit(badHabits: BadHabitDefinition[]) {
  return badHabits.find((habit) => habit.id === 'alcohol') ?? null
}

function getOccurredBadHabitDates(logs: BadHabitLog[], badHabitId?: string) {
  return logs
    .filter((log) => log.occurred && (!badHabitId || log.badHabitId === badHabitId))
    .map((log) => log.date)
}

function getBadHabitDateMap(logs: BadHabitLog[], badHabits: BadHabitDefinition[]) {
  const habitById = new Map(badHabits.map((habit) => [habit.id, habit]))
  const map = new Map<string, BadHabitDefinition[]>()

  logs.forEach((log) => {
    if (!log.occurred) return
    const habit = habitById.get(log.badHabitId)
    if (!habit) return
    const existing = map.get(log.date) ?? []
    if (!existing.some((item) => item.id === habit.id)) {
      existing.push(habit)
      map.set(log.date, existing)
    }
  })

  return map
}

function getMoodFilterBucket(day: DayEntry): 'good' | 'average' | 'low' | null {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)
  const signal =
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : day.isLogged ? ((day.morningMood + day.eveningMood) / 2) * 2 : null

  if (signal == null) return null
  if (signal >= 7) return 'good'
  if (signal >= 4) return 'average'
  return 'low'
}
