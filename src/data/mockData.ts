import { DayEntry, Habit, SettingsState, Tag, WeekEntry } from '../types'

export const starterTags: Tag[] = [
  { id: 'anxious', name: 'anxious', color: '#6E5C7A' },
  { id: 'productive', name: 'productive', color: '#527A67' },
  { id: 'poor-sleep', name: 'poor sleep', color: '#7A6252' },
  { id: 'social', name: 'social', color: '#5C6F8D' },
  { id: 'momentum', name: 'momentum', color: '#5B7D55' },
  { id: 'relapse', name: 'relapse', color: '#8A5A58' },
  { id: 'clear-headed', name: 'clear-headed', color: '#4A7D78' },
  { id: 'big-win', name: 'big win', color: '#89724E' },
]

export const starterHabits: Habit[] = [
  { id: 'training', name: 'Training', color: '#89B5E3', active: true, targetFrequency: 5 },
  { id: 'reading', name: 'Reading', color: '#D7A6B3', active: true, targetFrequency: 6 },
  { id: 'walk', name: 'Walk', color: '#9BE3C6', active: true, targetFrequency: 7 },
  { id: 'journal', name: 'Journal', color: '#D4C6A1', active: true, targetFrequency: 7 },
]

function toIso(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function createMockData(year: number) {
  const weeks: WeekEntry[] = []
  const days: DayEntry[] = []
  const start = new Date(Date.UTC(year, 0, 1))
  const mondayOffset = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - mondayOffset)

  for (let weekIndex = 0; weekIndex < 52; weekIndex += 1) {
    const weekDates: string[] = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(start)
      date.setUTCDate(start.getUTCDate() + weekIndex * 7 + dayIndex)
      const id = `${year}-W${weekIndex + 1}-${dayIndex + 1}`
      const dayEntry: DayEntry = {
        id,
        date: toIso(date),
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
        habitsTotal: starterHabits.length,
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
        linkedWeek: `${year}-${weekIndex + 1}`,
      }
      days.push(dayEntry)
      weekDates.push(dayEntry.id)
    }

    const firstDate = days[days.length - 7].date
    const lastDate = days[days.length - 1].date
    weeks.push({
      id: `${year}-${weekIndex + 1}`,
      weekNumber: weekIndex + 1,
      year,
      startDate: firstDate,
      endDate: lastDate,
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
      linkedDays: weekDates,
    })
  }

  return { weeks, days }
}

export const defaultSettings: SettingsState = {
  theme: 'dark',
  startDayOfWeek: 'monday',
  defaultColorMode: 'overall',
  moodLabels: ['Rough', 'Low', 'Steady', 'Good', 'Great'],
  panelHue: 'blue',
  panelHueIntensity: 100,
}
