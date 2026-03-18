import { ColorMode, DayEntry, ManualCellColor, WeekEntry } from '../types'

const scales = {
  neutral: ['#232323', '#2E2E2E', '#4A4A4A', '#707070', '#F5F5F2'],
  habits: ['#18261E', '#1E3A2B', '#146C43', '#17C964', '#54F2A5'],
  mood: ['#2B1A16', '#4A231C', '#7A2E23', '#FF6B57', '#FFB0A8'],
  moodRed: ['#5B171B', '#8A2023', '#D92D32'],
  moodOrange: ['#4A301A', '#6C451F', '#8B5A24'],
  moodGreen: ['#16261C', '#1B3224', '#22412D', '#2B5238'],
  alcohol: ['#1A241C', '#20452B', '#1A7F49', '#17C964', '#8AF0B8'],
}

function scaleColor(value: number, palette: string[]) {
  const index = Math.max(0, Math.min(palette.length - 1, Math.floor((value / 100) * palette.length)))
  return palette[index]
}

const manualCellColors: Record<ManualCellColor, string> = {
  blank: '#242424',
  green: '#17C964',
  orange: '#FF9F0A',
  red: '#FF3B30',
}

export function getManualCellColor(cellColor: ManualCellColor) {
  return manualCellColors[cellColor]
}

export function getDayColor(day: DayEntry, mode: ColorMode) {
  if (day.cellColor !== 'blank') {
    return getManualCellColor(day.cellColor)
  }

  return getDerivedDayColor(day, mode)
}

export function getDerivedDayColor(day: DayEntry, mode: ColorMode) {
  if (!day.isLogged) {
    return '#242424'
  }
  if (mode === 'habits') {
    return scaleColor((day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100, scales.habits)
  }
  if (mode === 'mood') {
    return getCheckInColor(day)
  }
  if (mode === 'alcohol') {
    return day.drank ? '#FF6B57' : '#17C964'
  }
  return getCheckInColor(day)
}

export function getWeekColor(week: WeekEntry, mode: ColorMode) {
  if (week.loggedDaysCount === 0) {
    return '#242424'
  }
  if (mode === 'habits') {
    return scaleColor(week.habitCompletionPercent, scales.habits)
  }
  if (mode === 'mood') {
    return scaleColor(((week.moodAverage - 1) / 4) * 100, scales.mood)
  }
  if (mode === 'alcohol') {
    return week.drankThisWeek ? '#FF6B57' : '#17C964'
  }
  return scaleColor(week.weeklyScore, scales.neutral)
}

export function getTooltipTint(day: DayEntry) {
  if (day.cellColor === 'red') return 'rgba(255, 59, 48, 0.12)'
  if (day.cellColor === 'orange') return 'rgba(255, 159, 10, 0.12)'
  if (day.cellColor === 'green') return 'rgba(23, 201, 100, 0.12)'

  const values = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)
  if (values.length === 0) return 'rgba(255,255,255,0.015)'

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  if (average <= 3) return 'rgba(164, 74, 67, 0.14)'
  if (average <= 6) return 'rgba(194, 122, 44, 0.14)'
  return 'rgba(23, 201, 100, 0.12)'
}

function getCheckInColor(day: DayEntry) {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter((value): value is number => value != null)

  if (values.length === 0) {
    return '#242424'
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length

  if (average <= 3) {
    return average <= 1.75 ? scales.moodRed[2] : average <= 2.5 ? scales.moodRed[1] : scales.moodRed[0]
  }

  if (average <= 6) {
    return average <= 4 ? scales.moodOrange[2] : average <= 5 ? scales.moodOrange[1] : scales.moodOrange[0]
  }

  return average <= 7.5 ? scales.moodGreen[3] : average <= 9 ? scales.moodGreen[2] : scales.moodGreen[1]
}
