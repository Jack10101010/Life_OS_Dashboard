import { ColorMode, DayEntry, ManualCellColor, WeekEntry } from '../types'

const scales = {
  neutral: ['#232323', '#2E2E2E', '#4A4A4A', '#707070', '#F5F5F2'],
  habits: ['#18261E', '#1E3A2B', '#146C43', '#17C964', '#54F2A5'],
  mood: ['#2B1A16', '#4A231C', '#7A2E23', '#FF6B57', '#FFB0A8'],
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
  return getManualCellColor(day.cellColor)
}

export function getDerivedDayColor(day: DayEntry, mode: ColorMode) {
  if (!day.isLogged) {
    return '#182334'
  }
  if (mode === 'habits') {
    return scaleColor((day.habitsCompleted / Math.max(day.habitsTotal, 1)) * 100, scales.habits)
  }
  if (mode === 'mood') {
    return scaleColor((((day.morningMood + day.eveningMood) / 2 - 1) / 4) * 100, scales.mood)
  }
  if (mode === 'alcohol') {
    return day.drank ? '#FF6B57' : '#17C964'
  }
  return scaleColor(day.score, scales.neutral)
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
