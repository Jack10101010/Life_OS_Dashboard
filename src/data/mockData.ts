import { BadHabitDefinition, DayEntry, DayLogSection, Habit, SettingsState, Tag, TagSection, WeekEntry } from '../types'
import { createEmptyDashboardExecution } from '../lib/dashboardExecution'

const starterTagDefinitions: Omit<Tag, 'availableIn'>[] = [
  { id: 'good-sleep', name: 'Good sleep', color: '#3E8F63', section: 'sleep', kind: 'feeling', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'exercise', name: 'Exercise', color: '#4A9A67', section: 'actions', kind: 'action', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'social', name: 'Social', color: '#4E8A74', section: 'actions', kind: 'action', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'productive', name: 'Productive', color: '#5D936B', section: 'actions', kind: 'action', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'calm', name: 'Calm', color: '#4A8A83', section: 'feelings', kind: 'feeling', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'clear-headed', name: 'Clear-headed', color: '#538E86', section: 'feelings', kind: 'feeling', polarity: 'positive', flag: 'none', isCustom: false, isActive: true },
  { id: 'poor-sleep', name: 'Poor sleep', color: '#B05E54', section: 'sleep', kind: 'feeling', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
  { id: 'alcohol', name: 'Alcohol', color: '#C26F46', section: 'actions', kind: 'action', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
  { id: 'nicotine', name: 'Nicotine', color: '#C97A4E', section: 'actions', kind: 'action', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
  { id: 'stress', name: 'Stress', color: '#B35A65', section: 'feelings', kind: 'feeling', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
  { id: 'overthinking', name: 'Overthinking', color: '#A45D73', section: 'feelings', kind: 'feeling', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
  { id: 'junk-food', name: 'Junk food', color: '#C47A3E', section: 'actions', kind: 'action', polarity: 'negative', flag: 'none', isCustom: false, isActive: true },
]

export const starterTags: Tag[] = starterTagDefinitions.map((tag) => ({
  ...tag,
  availableIn: getDefaultTagAvailability(tag.section),
}))

function getDefaultTagAvailability(section: TagSection): DayLogSection[] {
  if (section === 'sleep') return ['morning']
  if (section === 'feelings') return ['morning', 'day', 'evening']
  if (section === 'events') return ['day']
  return ['morning', 'day', 'evening']
}

export const starterHabits: Habit[] = [
  { id: 'training', name: 'Training', color: '#89B5E3', active: true, targetFrequency: 5 },
  { id: 'reading', name: 'Reading', color: '#D7A6B3', active: true, targetFrequency: 6 },
  { id: 'walk', name: 'Walk', color: '#9BE3C6', active: true, targetFrequency: 7 },
  { id: 'journal', name: 'Journal', color: '#D4C6A1', active: true, targetFrequency: 7 },
]

export const starterBadHabits: BadHabitDefinition[] = [
  {
    id: 'alcohol',
    name: 'Alcohol',
    color: '#FF4D4F',
    category: 'Substances',
    createdAt: '2025-01-01',
    isActive: true,
    isArchived: false,
    isBuiltIn: true,
    showStreakInUI: true,
  },
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
        habitsTotal: starterHabits.length,
        completedHabitIds: [],
        drank: false,
        bigWin: '',
        journal: '',
        dashboardQuickNote: '',
        dashboardExecution: createEmptyDashboardExecution(),
        dashboardScratchpad: {
          mode: 'free',
          text: '',
          freeNotes: [
            {
              id: `scratch-free-${year}-${weekIndex}-${dayIndex}`,
              title: 'Note 1',
              text: '',
            },
          ],
          activeFreeNoteId: `scratch-free-${year}-${weekIndex}-${dayIndex}`,
          moneyIn: [],
          moneyOut: [],
          notes: '',
          todoItems: [],
          financeSheets: {},
        },
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
  panelHue: 'none',
  panelHueIntensity: 100,
  enableBadHabitTracking: true,
  enableMedicationTracking: true,
}
