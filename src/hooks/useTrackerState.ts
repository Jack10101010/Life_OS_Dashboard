import { useMemo, useState } from 'react'
import { getDailyScore, getWeeklyScore } from '../lib/scoring'
import { getConsecutiveDateStreak } from '../lib/streaks'
import { PersistedAppState } from '../lib/persistence'
import { ColorMode, DayEntry, HabitTrackerCalendarRange, HeatmapLayout, TrackerFilters, TrackerViewMode } from '../types'

export function useTrackerState(initialState: PersistedAppState, currentYear: number) {
  const [dataByYear, setDataByYear] = useState(() => normalizeTrackerData(initialState.dataByYear))
  const [habits] = useState(initialState.habits)
  const [tags] = useState(initialState.tags)
  const [viewMode, setViewMode] = useState<TrackerViewMode>(initialState.viewMode)
  const [colorMode, setColorMode] = useState<ColorMode>(initialState.colorMode)
  const [heatmapLayout, setHeatmapLayout] = useState<HeatmapLayout>(initialState.heatmapLayout)
  const [showFilters, setShowFilters] = useState(initialState.showFilters)
  const [filters, setFilters] = useState<TrackerFilters>(initialState.filters)
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(initialState.selectedWeekId)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(initialState.selectedDayId)
  const [openDrawer, setOpenDrawer] = useState<'day' | 'week' | null>(initialState.openDrawer)
  const [moodHeatmapFocusDate, setMoodHeatmapFocusDate] = useState(initialState.moodHeatmapFocusDate)
  const [moodHeatmapCalendarRange, setMoodHeatmapCalendarRange] = useState<HabitTrackerCalendarRange>(
    initialState.moodHeatmapCalendarRange,
  )
  const [moodHighlightCurrentWeek, setMoodHighlightCurrentWeek] = useState(initialState.moodHighlightCurrentWeek)

  const dataset = dataByYear[filters.year as keyof typeof dataByYear]

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
      const whatSlipped = loggedDays.some((day) => day.drank)
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
        drankThisWeek: loggedDays.some((day) => day.drank),
        bigWin: loggedDays.find((day) => day.bigWin)?.bigWin ?? '',
        reflection,
        whatWentWell,
        whatSlipped,
        tags,
      }
    })
  }, [dataset.days, dataset.weeks])

  const filteredDays = useMemo(() => {
    return dataset.days.filter((day) => {
      if (filters.selectedTags.length > 0 && !filters.selectedTags.every((tagId) => day.tags.includes(tagId))) return false
      if (filters.alcohol === 'drank' && (!day.isLogged || !day.drank)) return false
      if (filters.alcohol === 'dry' && (!day.isLogged || day.drank)) return false
      if (filters.bigWinOnly && (!day.isLogged || !day.bigWin)) return false
      if (filters.score === 'high' && (!day.isLogged || day.score < 70)) return false
      if (filters.score === 'low' && (!day.isLogged || day.score > 45)) return false
      return true
    })
  }, [dataset.days, filters])

  const filteredWeeks = useMemo(() => {
    return computedWeeks.filter((week) => {
      if (filters.selectedTags.length > 0 && !filters.selectedTags.every((tagId) => week.tags.includes(tagId))) return false
      if (filters.alcohol === 'drank' && !week.drankThisWeek) return false
      if (filters.alcohol === 'dry' && week.drankThisWeek) return false
      if (filters.bigWinOnly && !week.bigWin) return false
      if (filters.score === 'high' && week.weeklyScore < 70) return false
      if (filters.score === 'low' && week.weeklyScore > 45) return false
      return true
    })
  }, [computedWeeks, filters])

  const selectedWeek = filteredWeeks.find((week) => week.id === selectedWeekId) ?? filteredWeeks[0] ?? null
  const selectedWeekDays = selectedWeek ? dataset.days.filter((day) => selectedWeek.linkedDays.includes(day.id)) : []
  const selectedDay = dataset.days.find((day) => day.id === selectedDayId) ?? selectedWeekDays[0] ?? filteredDays[0] ?? null

  const alcoholFreeStreak = useMemo(() => {
    return getConsecutiveDateStreak(
      new Set(dataset.days.filter((day) => day.isLogged && !day.drank).map((day) => day.date)),
      filters.year,
    )
  }, [dataset.days, filters.year])

  const momentumScore = useMemo(() => {
    const recent = computedWeeks.slice(-4)
    const loggedWeeks = recent.filter((week) => week.loggedDaysCount > 0)
    if (loggedWeeks.length === 0) return 0
    return Math.round(loggedWeeks.reduce((sum, week) => sum + week.weeklyScore, 0) / loggedWeeks.length)
  }, [computedWeeks])

  const hydrate = (next: PersistedAppState) => {
    setDataByYear(normalizeTrackerData(next.dataByYear))
    setViewMode(next.viewMode)
    setColorMode(next.colorMode)
    setHeatmapLayout(next.heatmapLayout)
    setShowFilters(next.showFilters)
    setFilters(next.filters)
    setSelectedWeekId(next.selectedWeekId)
    setSelectedDayId(next.selectedDayId)
    setOpenDrawer(next.openDrawer)
    setMoodHeatmapFocusDate(next.moodHeatmapFocusDate)
    setMoodHeatmapCalendarRange(next.moodHeatmapCalendarRange)
    setMoodHighlightCurrentWeek(next.moodHighlightCurrentWeek)
  }

  const updateDay = (dayId: string, updater: (day: DayEntry) => DayEntry) => {
    setDataByYear((current) => {
      const yearData = current[filters.year as keyof typeof current]
      return {
        ...current,
        [filters.year]: {
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
            return { ...updated, score, updatedAt: new Date().toISOString() }
          }),
        },
      }
    })
  }

  const handleSelectTag = (tagId: string) => {
    if (!selectedDay) return
    updateDay(selectedDay.id, (day) => ({
      ...day,
      isLogged: true,
      tags: day.tags.includes(tagId) ? day.tags.filter((value) => value !== tagId) : [...day.tags, tagId],
    }))
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
    const yearData = dataByYear[todayYear as keyof typeof dataByYear]
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
    hydrate,
  }
}

function normalizeTrackerData(dataByYear: PersistedAppState['dataByYear']) {
  return Object.fromEntries(
    Object.entries(dataByYear).map(([year, dataset]) => [
      year,
      {
        ...dataset,
        days: dataset.days.map((day) => normalizeDayEntry(day)),
      },
    ]),
  ) as PersistedAppState['dataByYear']
}

function normalizeDayEntry(day: DayEntry): DayEntry {
  if (!day.isLogged) {
    return {
      ...day,
      mood: null,
      motivation: null,
      clarity: null,
      energy: null,
      sleepQuality: null,
    }
  }

  return {
    ...day,
    mood: normalizeCheckInValue(day.mood),
    motivation: normalizeCheckInValue(day.motivation),
    clarity: normalizeCheckInValue(day.clarity),
    energy: normalizeCheckInValue(day.energy),
    sleepQuality: normalizeCheckInValue(day.sleepQuality),
  }
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
    day.moodNote.trim().length > 0 ||
    day.completedHabitIds.length > 0 ||
    day.habitsCompleted > 0 ||
    day.drank ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
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
    morningMood: 3,
    eveningMood: 3,
    moodNote: '',
    habitsCompleted: 0,
    completedHabitIds: [],
    drank: false,
    bigWin: '',
    journal: '',
    tasks: [],
    reminders: [],
    dailyActions: [],
    tags: [],
    score: 0,
    updatedAt: null,
  }
}
