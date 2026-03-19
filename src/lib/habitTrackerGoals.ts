import { HabitTracker, HabitTrackerAchievement, HabitTrackerGoal, HabitTrackerType } from '../types'

type LegacyHabitTrackerAchievement = {
  id: string
  type?: string
  date: string
  target: number
  goalType?: HabitTrackerGoal['type']
  startedDate?: string
  completedDate?: string
  durationDays?: number
  period?: 'week'
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + amount)
  return copy
}

function startOfIsoWeek(date: Date) {
  const copy = new Date(date)
  const day = (copy.getUTCDay() + 6) % 7
  copy.setUTCDate(copy.getUTCDate() - day)
  return copy
}

function endOfIsoWeek(date: Date) {
  return addDays(startOfIsoWeek(date), 6)
}

export function getTodayIsoDate() {
  return toIsoDate(new Date())
}

function diffDaysInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`)
  const end = new Date(`${endIso}T00:00:00Z`)
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
}

function getDateRangeEndForYear(year: number) {
  const today = new Date()
  const currentYear = today.getUTCFullYear()
  if (year < currentYear) return new Date(Date.UTC(year, 11, 31))
  if (year > currentYear) return new Date(Date.UTC(year, 0, 1))
  return new Date(Date.UTC(currentYear, today.getUTCMonth(), today.getUTCDate()))
}

function buildAchievementId(trackerId: string, goalType: HabitTrackerGoal['type'], target: number, completedDate: string, period?: 'week') {
  return `${trackerId}-${goalType}-${target}-${period ?? 'day'}-${completedDate}`
}

function isValidDateRange(startedDate: string, completedDate: string) {
  return startedDate <= completedDate
}

function normalizeAchievement(trackerId: string, achievement: HabitTrackerAchievement | LegacyHabitTrackerAchievement) {
  const completedDate = achievement.completedDate ?? achievement.date
  const startedDate = achievement.startedDate ?? completedDate
  const goalType =
    'goalType' in achievement && achievement.goalType
      ? achievement.goalType
      : achievement.type === 'streak-goal'
        ? 'streak'
        : 'streak'

  return {
    id: achievement.id ?? buildAchievementId(trackerId, goalType, achievement.target, completedDate),
    goalType,
    date: completedDate,
    target: achievement.target,
    period: 'period' in achievement ? achievement.period : undefined,
    startedDate,
    completedDate,
    durationDays: achievement.durationDays ?? diffDaysInclusive(startedDate, completedDate),
  } satisfies HabitTrackerAchievement
}

function validateAchievement(tracker: HabitTracker, achievement: HabitTrackerAchievement) {
  if (!isValidDateRange(achievement.startedDate, achievement.completedDate)) return false
  if (achievement.durationDays !== diffDaysInclusive(achievement.startedDate, achievement.completedDate)) return false

  switch (achievement.goalType) {
    case 'streak': {
      if (achievement.durationDays < achievement.target) return false
      const streak = getTrackerStreakEndingOnFrom(tracker, achievement.completedDate, achievement.startedDate)
      return streak >= achievement.target
    }
    case 'times-per-week': {
      const completionDate = new Date(`${achievement.completedDate}T00:00:00Z`)
      const weekStart = toIsoDate(startOfIsoWeek(completionDate))
      const effectiveStart = achievement.startedDate > weekStart ? achievement.startedDate : weekStart
      const count = Object.values(tracker.entries).filter(
        (entry) => entry.completed && entry.date >= effectiveStart && entry.date <= achievement.completedDate,
      ).length
      return count >= achievement.target
    }
    case 'target-value':
    case 'minutes-target': {
      const entry = tracker.entries[achievement.completedDate]
      if (!entry?.completed) return false
      return (entry.value ?? 0) >= achievement.target
    }
  }
}

function computeStreakAchievements(tracker: HabitTracker, target: number, startDate: string) {
  const completedDates = getCompletedTrackerDatesFrom(tracker, startDate)
  const achievements: HabitTrackerAchievement[] = []
  let streak = 0
  let streakStart: string | null = null
  let previousDate: string | null = null

  for (const date of completedDates) {
    if (!previousDate) {
      streak = 1
      streakStart = date
    } else {
      const prev = new Date(`${previousDate}T00:00:00Z`)
      const current = new Date(`${date}T00:00:00Z`)
      const dayDelta = Math.round((current.getTime() - prev.getTime()) / 86400000)
      if (dayDelta === 1) {
        streak += 1
      } else {
        streak = 1
        streakStart = date
      }
    }

    if (streak === target && streakStart) {
      achievements.push({
        id: buildAchievementId(tracker.id, 'streak', target, date),
        goalType: 'streak',
        date,
        target,
        startedDate: streakStart,
        completedDate: date,
        durationDays: diffDaysInclusive(streakStart, date),
      })
    }

    previousDate = date
  }

  return achievements
}

function computeWeeklyAchievements(tracker: HabitTracker, target: number, startDate: string) {
  const completedDates = getCompletedTrackerDatesFrom(tracker, startDate)
  const byWeek = new Map<string, string[]>()

  completedDates.forEach((date) => {
    const weekStart = toIsoDate(startOfIsoWeek(new Date(`${date}T00:00:00Z`)))
    byWeek.set(weekStart, [...(byWeek.get(weekStart) ?? []), date])
  })

  const achievements: HabitTrackerAchievement[] = []
  byWeek.forEach((dates, weekStart) => {
    if (dates.length < target) return
    const completionDate = dates[target - 1]
    achievements.push({
      id: buildAchievementId(tracker.id, 'times-per-week', target, completionDate, 'week'),
      goalType: 'times-per-week',
      date: completionDate,
      target,
      period: 'week',
      startedDate: startDate > weekStart ? startDate : weekStart,
      completedDate: completionDate,
      durationDays: diffDaysInclusive(startDate > weekStart ? startDate : weekStart, completionDate),
    })
  })

  return achievements
}

function computeValueAchievements(tracker: HabitTracker, goalType: 'target-value' | 'minutes-target', target: number, startDate: string) {
  return Object.values(tracker.entries)
    .filter((entry) => entry.completed && entry.date >= startDate && (entry.value ?? 0) >= target)
    .map(
      (entry) =>
        ({
          id: buildAchievementId(tracker.id, goalType, target, entry.date),
          goalType,
          date: entry.date,
          target,
          startedDate: entry.date,
          completedDate: entry.date,
          durationDays: 1,
        }) satisfies HabitTrackerAchievement,
    )
}

function computeAchievementsForGoal(tracker: HabitTracker) {
  if (!tracker.goal) return []

  switch (tracker.goal.type) {
    case 'streak':
      return tracker.goal.target >= 2 ? computeStreakAchievements(tracker, tracker.goal.target, tracker.goal.startDate) : []
    case 'times-per-week':
      return tracker.goal.target >= 1 ? computeWeeklyAchievements(tracker, tracker.goal.target, tracker.goal.startDate) : []
    case 'target-value':
      return tracker.goal.target >= 1 ? computeValueAchievements(tracker, 'target-value', tracker.goal.target, tracker.goal.startDate) : []
    case 'minutes-target':
      return tracker.goal.target >= 1 ? computeValueAchievements(tracker, 'minutes-target', tracker.goal.target, tracker.goal.startDate) : []
  }
}

export function normalizeHabitTracker(tracker: HabitTracker): HabitTracker {
  const normalizedEntries = Object.fromEntries(
    Object.entries(tracker.entries ?? {}).map(([date, entry]) => [
      date,
      {
        date,
        completed: entry?.completed ?? false,
        value: entry?.value ?? null,
        note: entry?.note ?? '',
      },
    ]),
  )

  const normalizedTracker = {
    ...tracker,
    habitType: tracker.habitType ?? 'checkbox',
    colorIntensity: tracker.colorIntensity ?? 100,
    showAlcoholMarkers: tracker.showAlcoholMarkers ?? false,
    weekendVisibility: tracker.weekendVisibility ?? 'show',
    clampDescription: tracker.clampDescription ?? true,
    goal: tracker.goal ? { ...tracker.goal, startDate: tracker.goal.startDate ?? getTodayIsoDate() } : null,
    entries: normalizedEntries,
  }

  return {
    ...normalizedTracker,
    achievements: (tracker.achievements ?? [])
      .map((achievement) => normalizeAchievement(tracker.id, achievement))
      .filter((achievement, index, achievements) => {
        if (!validateAchievement(normalizedTracker, achievement)) return false
        return achievements.findIndex((item) => item.id === achievement.id) === index
      }),
  }
}

export function getGoalTypesForHabitType(habitType: HabitTrackerType): Array<{ value: HabitTrackerGoal['type']; label: string }> {
  if (habitType === 'checkbox') {
    return [
      { value: 'streak', label: 'Streak goal' },
      { value: 'times-per-week', label: 'Times per week' },
    ]
  }

  if (habitType === 'number') {
    return [{ value: 'target-value', label: 'Target value' }]
  }

  if (habitType === 'timer') {
    return [{ value: 'minutes-target', label: 'Minutes target' }]
  }

  return []
}

export function buildDefaultGoalForHabitType(habitType: HabitTrackerType): HabitTrackerGoal {
  const startDate = getTodayIsoDate()
  switch (habitType) {
    case 'checkbox':
      return { type: 'streak', target: 7, startDate }
    case 'number':
      return { type: 'target-value', target: 1, startDate }
    case 'timer':
      return { type: 'minutes-target', target: 30, startDate }
    default:
      return { type: 'target-value', target: 1, startDate }
  }
}

export function getCompletedTrackerDates(tracker: HabitTracker) {
  return Object.values(tracker.entries)
    .filter((entry) => entry.completed)
    .map((entry) => entry.date)
    .sort((left, right) => left.localeCompare(right))
}

function getCompletedTrackerDatesFrom(tracker: HabitTracker, startDate: string) {
  return getCompletedTrackerDates(tracker).filter((date) => date >= startDate)
}

export function getLiveTrackerStreak(tracker: HabitTracker, year: number) {
  const completedSet = new Set(getCompletedTrackerDates(tracker))
  let cursor = getDateRangeEndForYear(year)
  const todayIso = toIsoDate(cursor)

  if (!completedSet.has(todayIso)) {
    cursor = addDays(cursor, -1)
  }

  let streak = 0
  while (cursor.getUTCFullYear() === year) {
    const iso = toIsoDate(cursor)
    if (!completedSet.has(iso)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

export function getTrackerStreakEndingOn(tracker: HabitTracker, isoDate: string) {
  if (!tracker.entries[isoDate]?.completed) return 0

  const completedSet = new Set(getCompletedTrackerDates(tracker))
  let cursor = new Date(`${isoDate}T00:00:00Z`)
  let streak = 0

  while (true) {
    const value = toIsoDate(cursor)
    if (!completedSet.has(value)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function getTrackerStreakEndingOnFrom(tracker: HabitTracker, isoDate: string, startDate: string) {
  if (isoDate < startDate || !tracker.entries[isoDate]?.completed) return 0

  const completedSet = new Set(getCompletedTrackerDatesFrom(tracker, startDate))
  let cursor = new Date(`${isoDate}T00:00:00Z`)
  let streak = 0

  while (true) {
    const value = toIsoDate(cursor)
    if (value < startDate || !completedSet.has(value)) break
    streak += 1
    cursor = addDays(cursor, -1)
  }

  return streak
}

function getWeekCompletionCount(tracker: HabitTracker, baseDate: Date, startDate?: string) {
  const weekStart = startOfIsoWeek(baseDate)
  const weekEnd = endOfIsoWeek(baseDate)
  return Object.values(tracker.entries).filter(
    (entry) =>
      entry.completed &&
      entry.date >= toIsoDate(weekStart) &&
      entry.date <= toIsoDate(weekEnd) &&
      (!startDate || entry.date >= startDate),
  ).length
}

function getTodayValue(tracker: HabitTracker, year: number, startDate?: string) {
  const date = toIsoDate(getDateRangeEndForYear(year))
  if (startDate && date < startDate) return 0
  return tracker.entries[date]?.value ?? 0
}

export function syncHabitTrackerAchievements(tracker: HabitTracker): HabitTracker {
  const normalizedTracker = normalizeHabitTracker(tracker)
  const existingAchievements = normalizedTracker.achievements
    .map((achievement) => normalizeAchievement(normalizedTracker.id, achievement))
    .filter((achievement) => validateAchievement(normalizedTracker, achievement))
  const computedAchievements = computeAchievementsForGoal(normalizedTracker)
  const merged = new Map<string, HabitTrackerAchievement>()

  existingAchievements.forEach((achievement) => {
    merged.set(achievement.id, achievement)
  })

  computedAchievements.forEach((achievement) => {
    if (!merged.has(achievement.id)) {
      merged.set(achievement.id, achievement)
    }
  })

  return {
    ...normalizedTracker,
    achievements: [...merged.values()].sort((left, right) => left.completedDate.localeCompare(right.completedDate)),
  }
}

export function getTrackerGoalLabel(goal: HabitTrackerGoal | null) {
  if (!goal) return null

  switch (goal.type) {
    case 'streak':
      return `${goal.target}-day streak goal`
    case 'times-per-week':
      return `${goal.target} times per week`
    case 'target-value':
      return `Target value`
    case 'minutes-target':
      return `${goal.target} minute target`
  }
}

export function getTrackerGoalProgress(tracker: HabitTracker, year: number) {
  const normalizedTracker = normalizeHabitTracker(tracker)

  if (!normalizedTracker.goal) return null

  const today = getDateRangeEndForYear(year)
  const yesterday = addDays(today, -1)
  const yesterdayIso = toIsoDate(yesterday)
  const todayIso = toIsoDate(today)
  const startDate = normalizedTracker.goal.startDate
  const scheduled = startDate > todayIso
  const active = !scheduled

  if (normalizedTracker.goal.type === 'streak') {
    const target = normalizedTracker.goal.target
    const liveStreak = scheduled
      ? 0
      : normalizedTracker.entries[todayIso]?.completed
        ? getTrackerStreakEndingOnFrom(normalizedTracker, todayIso, startDate)
        : getTrackerStreakEndingOnFrom(normalizedTracker, yesterdayIso, startDate)
    const current = Math.min(liveStreak, target)
    const hadRecentProgress = Object.values(normalizedTracker.entries).some(
      (entry) =>
        entry.completed &&
        entry.date >= startDate &&
        entry.date >= toIsoDate(addDays(today, -Math.max(target + 2, 7))) &&
        entry.date <= yesterdayIso,
    )
    const missed = current === 0 && hadRecentProgress && !normalizedTracker.entries[yesterdayIso]?.completed
    const matchingAchievement = normalizedTracker.achievements.find(
      (achievement) =>
        achievement.goalType === 'streak' &&
        achievement.target === target &&
        achievement.startedDate >= startDate,
    )

    return {
      target,
      current,
      completed: liveStreak >= target,
      missed,
      scheduled,
      active,
      startDate,
      completionDate: matchingAchievement?.completedDate ?? null,
      label: getTrackerGoalLabel(normalizedTracker.goal),
      progressText: `${current} / ${target} days`,
    }
  }

  if (normalizedTracker.goal.type === 'times-per-week') {
    const target = normalizedTracker.goal.target
    const weeklyCompletions = scheduled ? 0 : Math.min(getWeekCompletionCount(normalizedTracker, today, startDate), target)
    return {
      target,
      current: weeklyCompletions,
      completed: weeklyCompletions >= target,
      missed: false,
      scheduled,
      active,
      startDate,
      completionDate: null,
      label: getTrackerGoalLabel(normalizedTracker.goal),
      progressText: `${weeklyCompletions} / ${target}`,
    }
  }

  if (normalizedTracker.goal.type === 'target-value') {
    const target = normalizedTracker.goal.target
    const current = scheduled ? 0 : Math.min(getTodayValue(normalizedTracker, year, startDate), target)
    return {
      target,
      current,
      completed: current >= target,
      missed: false,
      scheduled,
      active,
      startDate,
      completionDate: null,
      label: getTrackerGoalLabel(normalizedTracker.goal),
      progressText: `${current} / ${target}`,
    }
  }

  const target = normalizedTracker.goal.target
  const current = scheduled ? 0 : Math.min(getTodayValue(normalizedTracker, year, startDate), target)
  return {
    target,
    current,
    completed: current >= target,
    missed: false,
    scheduled,
    active,
    startDate,
    completionDate: null,
    label: getTrackerGoalLabel(normalizedTracker.goal),
    progressText: `${current} / ${target} min`,
  }
}

export function getAchievementDetailLabel(achievement: HabitTrackerAchievement) {
  switch (achievement.goalType) {
    case 'streak':
      return `${achievement.target}-day streak goal`
    case 'times-per-week':
      return `${achievement.target} times per week`
    case 'target-value':
      return `${achievement.target}-point target`
    case 'minutes-target':
      return `${achievement.target}-minute target`
  }
}
