export type PageId =
  | 'dashboard'
  | 'tracker'
  | 'habit-maps'
  | 'your-days'
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
export type ColorMode = 'overall' | 'habits' | 'mood' | 'alcohol'
export type HeatmapLayout = 'github' | 'calendar'
export type ManualCellColor = 'blank' | 'green' | 'yellow' | 'orange' | 'red'
export type EveningOutcome = 'good' | 'mixed' | 'poor' | null
export type EveningTrajectory = 'improved' | 'declined' | 'stable' | 'unstable' | null
export type EveningSelfInfluence = 'helped' | 'neutral' | 'hurt' | null
export type ScoreFilter = 'all' | 'high' | 'low'
export type TagPolarity = 'positive' | 'neutral' | 'negative'
export type TagType = TagPolarity
export type TagFlag = 'none' | 'important'
export type TagSection = 'sleep' | 'feelings' | 'actions' | 'events'
export type TagKind = 'feeling' | 'action'
export type DayLogSection = 'morning' | 'evening' | 'day'
export type BadHabitCategory = 'Substances' | 'Food' | 'Mind' | 'Body' | 'Custom'

export interface Tag {
  id: string
  name: string
  color: string
  section: TagSection
  kind: TagKind
  polarity: TagPolarity
  flag: TagFlag
  availableIn: DayLogSection[]
  isCustom: boolean
  isActive: boolean
}

export interface DayTagEntry {
  id: string
  tagId?: string
  customLabel?: string
  section: TagSection
  kind: TagKind
  polarity: TagPolarity
  flag: TagFlag
  timeSection: DayLogSection
  selected: boolean
}

export interface Habit {
  id: string
  name: string
  color: string
  active: boolean
  targetFrequency: number
}

export interface BadHabitDefinition {
  id: string
  name: string
  color: string
  category: BadHabitCategory
  createdAt: string
  isActive: boolean
  isArchived: boolean
  isBuiltIn: boolean
  showStreakInUI: boolean
}

export interface BadHabitLog {
  date: string
  badHabitId: string
  occurred: boolean
}

export interface MedicationSupplementEntry {
  id: string
  name: string
  dose: string
  unit: string
  timeTaken: string
  notes: string
}

export interface DayEventTagEntry {
  id: string
  tagId?: string
  customLabel?: string
  section: TagSection
  kind: TagKind
  polarity: TagPolarity
  flag: TagFlag
}

export interface DayEventEntry {
  id: string
  title: string
  description: string
  time: string
  tags: DayEventTagEntry[]
}

export interface LowStateEntry {
  feelings: string[]
  customFeeling: string
  mindText: string
  mindHelping: 'yes' | 'no' | 'not-sure' | null
  realSituation: string
  nextThing: string
  completedAt: string | null
}

export interface ScratchpadLineItem {
  id: string
  name: string
  day: string
  amount: string
  settled: boolean
}

export interface ScratchpadTodoItem {
  id: string
  text: string
  completed: boolean
}

export interface ScratchpadFreeNote {
  id: string
  title: string
  text: string
}

export interface DashboardFinanceSheet {
  moneyIn: ScratchpadLineItem[]
  moneyOut: ScratchpadLineItem[]
  notes: string
}

export interface DashboardScratchpad {
  mode: 'free' | 'structured' | 'todo'
  text: string
  freeNotes: ScratchpadFreeNote[]
  activeFreeNoteId: string | null
  moneyIn: ScratchpadLineItem[]
  moneyOut: ScratchpadLineItem[]
  notes: string
  todoItems: ScratchpadTodoItem[]
  financeSheets: Record<string, DashboardFinanceSheet>
}

export type DashboardExecutionStatus = 'idle' | 'started' | 'partial' | 'complete'

export interface DashboardExecution {
  goal: string
  whyItMatters: string
  todayTask: string
  nextAction: string
  minimumVersion: string
  status: DashboardExecutionStatus
  deepWorkDone: boolean
  movementDone: boolean
  nightResetReflection: string
  nightResetNextTask: string
}

export interface DayEntry {
  id: string
  date: string
  isLogged: boolean
  cellColor: ManualCellColor
  mood: number | null
  motivation: number | null
  clarity: number | null
  energy: number | null
  sleepQuality: number | null
  bedtime: string
  wakeTime: string
  wokeDuringNight: boolean | null
  sleepNote: string
  morningMood: number
  eveningMood: number
  moodNote: string
  eveningOutcome: EveningOutcome
  eveningUnstable: boolean
  eveningTrajectory: EveningTrajectory
  eveningSelfInfluence: EveningSelfInfluence
  habitsCompleted: number
  habitsTotal: number
  completedHabitIds: string[]
  drank: boolean
  bigWin: string
  journal: string
  dashboardQuickNote: string
  dashboardScratchpad: DashboardScratchpad
  dashboardExecution: DashboardExecution
  dailyIntentCompleteOneTask: boolean
  morningIntention: string
  lowStateEntry: LowStateEntry | null
  medications: MedicationSupplementEntry[]
  tasks: string[]
  reminders: string[]
  dailyActions: DayEventEntry[]
  tags: string[]
  tagEntries: DayTagEntry[]
  score: number
  updatedAt: string | null
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
  text: string
  dueDate: string
  starred: boolean
  important: boolean
  completed: boolean
  completedAt: string | null
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
  paused: boolean
  value: number | null
  note: string
}

export interface HabitLog {
  date: string
  habitId: string
  completed: boolean
}

export interface HabitTrackerEntryDraft {
  trackerId: string
  date: string
  completed: boolean
  paused: boolean
  value: number | null
  note: string
}

export type LifeGoalStatus = 'not-started' | 'in-motion' | 'paused' | 'complete'
export type LifeGoalCategoryColor = 'green' | 'blue' | 'purple' | 'amber' | 'teal' | 'red' | 'neutral'

export interface LifeGoalCategoryDefinition {
  name: string
  color: LifeGoalCategoryColor
}

export const LIFE_GOAL_CATEGORY_COLOR_OPTIONS: readonly LifeGoalCategoryColor[] = [
  'green',
  'blue',
  'purple',
  'amber',
  'teal',
  'red',
  'neutral',
] as const

export const DEFAULT_LIFE_GOAL_CATEGORIES: readonly LifeGoalCategoryDefinition[] = [
  { name: 'Health', color: 'green' },
  { name: 'Career', color: 'blue' },
  { name: 'Social', color: 'purple' },
  { name: 'Finance', color: 'amber' },
  { name: 'Home', color: 'neutral' },
  { name: 'Mind', color: 'teal' },
] as const

export type LifeGoalTaskPriority = 'none' | 'low' | 'medium' | 'high'

export interface LifeGoalTaskSubtask {
  id: string
  text: string
  completed: boolean
}

export interface LifeGoalTask {
  id: string
  text: string
  description: string
  notes: string
  dueDate: string | null
  priority: LifeGoalTaskPriority
  tags: string[]
  subtasks: LifeGoalTaskSubtask[]
  completed: boolean
  completedAt: string | null
}

export interface LifeGoal {
  id: string
  title: string
  category: string
  whyItMatters: string
  minimumVersion: string
  ifThenPlan: string
  startDate: string
  targetDate: string
  status: LifeGoalStatus
  isPrimary: boolean
  order: number
  tasks: LifeGoalTask[]
  linkedHabitIds: string[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type HabitTrackerType = 'checkbox' | 'number' | 'timer' | 'options'

export type HabitTrackerGoal =
  | {
      type: 'streak'
      target: number
      startDate: string
    }
  | {
      type: 'times-per-week'
      target: number
      period: 'week'
      startDate: string
    }
  | {
      type: 'target-value'
      target: number
      startDate: string
    }
  | {
      type: 'minutes-target'
      target: number
      startDate: string
    }

export interface HabitTrackerAchievement {
  id: string
  goalType: HabitTrackerGoal['type']
  date: string
  target: number
  period?: 'week'
  startedDate: string
  completedDate: string
  durationDays: number
}

export interface HabitTracker {
  id: string
  title: string
  description: string
  habitType: HabitTrackerType
  color: string
  colorIntensity: number
  showAlcoholMarkers: boolean
  showCurrentWeekHighlight: boolean
  weekendVisibility: 'show' | 'disable' | 'hide'
  clampDescription: boolean
  goal: HabitTrackerGoal | null
  achievements: HabitTrackerAchievement[]
  entries: Record<string, HabitTrackerDayEntry>
}

export interface TrackerFilters {
  year: number
  mood: 'all' | 'good' | 'average' | 'low'
  selectedTagIds: string[]
  selectedBadHabitIds: string[]
}

export interface SettingsState {
  theme: 'dark' | 'light'
  startDayOfWeek: 'monday' | 'sunday'
  defaultColorMode: ColorMode
  moodLabels: string[]
  panelHue: 'blue' | 'purple' | 'green' | 'amber' | 'none'
  panelHueIntensity: number
  enableBadHabitTracking: boolean
  enableMedicationTracking: boolean
}
