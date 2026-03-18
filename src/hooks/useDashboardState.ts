import { useMemo } from 'react'
import { DayEntry, Tag, WeekEntry } from '../types'

export function useDashboardState({ days, weeks }: { days: DayEntry[]; weeks: WeekEntry[] }) {
  const currentWeek = weeks[weeks.length - 1]
  const recentDays = days.slice(-14)
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayEntry = days.find((day) => day.date === todayDate) ?? days[days.length - 1]

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
