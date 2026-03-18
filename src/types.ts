export type PageId =
  | 'dashboard'
  | 'tracker'
  | 'journal-recordings'
  | 'gratitude'
  | 'goals'
  | 'tasks'
  | 'notes'
  | 'vision-board'
  | 'analytics'
  | 'trade-log'
  | 'settings'

export type TrackerViewMode = 'year' | 'weeks' | 'days'
export type HabitTrackerPeriodView = 'year' | 'month' | 'week'
export type HabitTrackerCalendarRange = 'full-year' | 'first-entry' | 'current-date'
export type DashboardBlockId =
  | 'week-overview'
  | 'mood-trend'
  | 'habit-consistency'
  | 'momentum'
  | 'recent-wins'
  | 'alcohol-status'
export type ColorMode = 'overall' | 'habits' | 'mood' | 'alcohol'
export type HeatmapLayout = 'github' | 'calendar'
export type ManualCellColor = 'blank' | 'green' | 'orange' | 'red'
export type ScoreFilter = 'all' | 'high' | 'low'

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Habit {
  id: string
  name: string
  color: string
  active: boolean
  targetFrequency: number
}

export interface DayEntry {
  id: string
  date: string
  isLogged: boolean
  cellColor: ManualCellColor
  morningMood: number
  eveningMood: number
  moodNote: string
  habitsCompleted: number
  habitsTotal: number
  completedHabitIds: string[]
  drank: boolean
  bigWin: string
  notes: string
  tasks: string[]
  reminders: string[]
  dailyActions: string[]
  tags: string[]
  score: number
  linkedWeek: string
}

export interface WeekEntry {
  id: string
  weekNumber: number
  year: number
  startDate: string
  endDate: string
  loggedDaysCount: number
  weeklyScore: number
  habitCompletionPercent: number
  moodAverage: number
  drankThisWeek: boolean
  bigWin: string
  reflection: string
  whatWentWell: string
  whatSlipped: string
  tags: string[]
  linkedDays: string[]
}

export interface Goal {
  id: string
  title: string
}

export interface Task {
  id: string
  title: string
}

export interface Note {
  id: string
  title: string
}

export interface VisionItem {
  id: string
  title: string
}

export interface TradeLogEntry {
  id: string
  symbol: string
}

export interface HabitTrackerDayEntry {
  date: string
  completed: boolean
  note: string
}

export interface HabitTracker {
  id: string
  title: string
  description: string
  color: string
  colorIntensity: number
  weekendVisibility: 'show' | 'disable' | 'hide'
  clampDescription: boolean
  entries: Record<string, HabitTrackerDayEntry>
}

export interface TrackerFilters {
  selectedTags: string[]
  alcohol: 'all' | 'drank' | 'dry'
  bigWinOnly: boolean
  score: ScoreFilter
  year: number
}

export interface SettingsState {
  theme: 'dark' | 'cyberpunk'
  startDayOfWeek: 'monday' | 'sunday'
  defaultColorMode: ColorMode
  moodLabels: string[]
  panelHue: 'blue' | 'purple' | 'green' | 'amber' | 'none'
  panelHueIntensity: number
}

export interface DashboardBlockLayoutItem {
  id: DashboardBlockId
  order: number
  colSpan: number
  rowSpan: number
}
