import { useMemo } from 'react'
import { DashboardExecution, DashboardScratchpad, DayEntry, WeekEntry } from '../types'

const EMPTY_DASHBOARD_EXECUTION: DashboardExecution = {
  goal: '',
  whyItMatters: '',
  todayTask: '',
  nextAction: '',
  minimumVersion: '',
  status: 'idle',
  deepWorkDone: false,
  movementDone: false,
  nightResetReflection: '',
  nightResetNextTask: '',
}

const EMPTY_DASHBOARD_SCRATCHPAD: DashboardScratchpad = {
  mode: 'free',
  text: '',
  freeNotes: [],
  activeFreeNoteId: null,
  moneyIn: [],
  moneyOut: [],
  notes: '',
  todoItems: [],
  financeSheets: {},
}

function createFallbackDayEntry(date: string): DayEntry {
  return {
    id: `fallback-day-${date}`,
    date,
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
    morningMood: 0,
    eveningMood: 0,
    moodNote: '',
    eveningOutcome: null,
    eveningUnstable: false,
    eveningTrajectory: null,
    eveningSelfInfluence: null,
    habitsCompleted: 0,
    habitsTotal: 0,
    completedHabitIds: [],
    drank: false,
    bigWin: '',
    journal: '',
    dashboardQuickNote: '',
    dashboardScratchpad: EMPTY_DASHBOARD_SCRATCHPAD,
    dashboardExecution: EMPTY_DASHBOARD_EXECUTION,
    dailyIntentCompleteOneTask: false,
    morningIntention: '',
    lowStateEntry: null,
    medications: [],
    tasks: [],
    reminders: [],
    dailyActions: [],
    tags: [],
    tagEntries: [],
    score: 0,
    updatedAt: null,
    linkedWeek: `fallback-week-${date}`,
  }
}

function createFallbackWeekEntry(date: string): WeekEntry {
  return {
    id: `fallback-week-${date}`,
    weekNumber: 1,
    year: Number(date.slice(0, 4)) || new Date().getUTCFullYear(),
    startDate: date,
    endDate: date,
    loggedDaysCount: 0,
    weeklyScore: 0,
    habitCompletionPercent: 0,
    moodAverage: 0,
    drankThisWeek: false,
    bigWin: '',
    reflection: '',
    whatWentWell: '',
    whatSlipped: '',
    tags: [],
    linkedDays: [],
  }
}

export function useDashboardState({ days, weeks }: { days: DayEntry[]; weeks: WeekEntry[] }) {
  const recentDays = days.slice(-14)
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayEntry = days.find((day) => day.date === todayDate) ?? days[days.length - 1] ?? createFallbackDayEntry(todayDate)
  const currentWeek =
    weeks.find((week) => todayDate >= week.startDate && todayDate <= week.endDate) ??
    weeks[weeks.length - 1] ??
    createFallbackWeekEntry(todayDate)

  const moodTrend = useMemo(
    () =>
      recentDays.map((day) => ({
        name: new Date(day.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }),
        am: day.isLogged ? day.morningMood : null,
        pm: day.isLogged ? day.eveningMood : null,
      })),
    [recentDays],
  )

  const loggedDays = useMemo(() => days.filter((day) => day.isLogged), [days])

  const topHabits = useMemo(
    () => [
      {
        label: 'Training',
        value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('training')).length / loggedDays.length) * 100)}%`,
      },
      {
        label: 'Walk',
        value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('walk')).length / loggedDays.length) * 100)}%`,
      },
      {
        label: 'Journal',
        value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.completedHabitIds.includes('journal')).length / loggedDays.length) * 100)}%`,
      },
      {
        label: 'Sleep',
        value: loggedDays.length === 0 ? '0%' : `${Math.round((loggedDays.filter((day) => day.tags.includes('tag-clear')).length / loggedDays.length) * 100)}%`,
      },
    ],
    [loggedDays],
  )

  const journalHighlights = useMemo(
    () =>
      days
        .filter((day) => day.isLogged && (day.journal || day.moodNote))
        .slice()
        .reverse()
        .slice(0, 3),
    [days],
  )

  const recentWins = useMemo(() => weeks.slice(-3).filter((week) => week.bigWin), [weeks])

  const todayStatus = useMemo(
    () => [
      todayEntry?.isLogged ? 'Logged' : 'Not logged yet',
      `Habits ${todayEntry?.habitsCompleted ?? 0}/${todayEntry?.habitsTotal ?? 0}`,
      todayEntry?.drank ? 'Alcohol logged' : 'No alcohol logged',
    ],
    [todayEntry],
  )

  return {
    currentWeek,
    todayEntry,
    moodTrend,
    topHabits,
    journalHighlights,
    recentWins,
    todayStatus,
  }
}
