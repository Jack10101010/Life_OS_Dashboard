import { DayEntry, HabitTracker } from '../types'
import { isHabitTrackerActiveOnDate } from './habitTrackerGoals'

export type RollingMomentumMetrics = {
  score: number
  label: 'Low' | 'Building' | 'Strong' | 'High Momentum'
  consistencyDays: number
  consistencyWindowDays: number
  completionPercent: number
  trend: 'Improving' | 'Stable' | 'Declining'
  strongDayRun: number
}

export function getRollingMomentumMetrics(days: DayEntry[], habitTrackers: HabitTracker[], todayDate: string): RollingMomentumMetrics {
  const windowDates = getLastCompletedWindowDates(todayDate, 7)
  const dayMap = new Map(days.map((day) => [day.date, day]))
  const dailySnapshots = windowDates
    .map((date) => {
      const expectedActions = habitTrackers.reduce((count, tracker) => count + (isHabitTrackerActiveOnDate(tracker, date) ? 1 : 0), 0)
      if (expectedActions === 0) return null

      const completedActions = habitTrackers.reduce(
        (count, tracker) => count + (isHabitTrackerActiveOnDate(tracker, date) && tracker.entries[date]?.completed ? 1 : 0),
        0,
      )
      const completionRate = completedActions / expectedActions
      const day = dayMap.get(date) ?? null
      return {
        date,
        day,
        completionRate,
        completionPercent: Math.round(completionRate * 100),
        isConsistent: completionRate >= 0.6,
        isStrong: completionRate >= 0.7 && !(day?.drank ?? false),
      }
    })
    .filter(
      (
        snapshot,
      ): snapshot is {
        date: string
        day: DayEntry | null
        completionRate: number
        completionPercent: number
        isConsistent: boolean
        isStrong: boolean
      } => snapshot != null,
    )

  const consistencyDays = dailySnapshots.filter((snapshot) => snapshot.isConsistent).length
  const consistencyWindowDays = dailySnapshots.length
  const averageCompletionRate =
    dailySnapshots.reduce((sum, snapshot) => sum + snapshot.completionRate, 0) / Math.max(dailySnapshots.length, 1)
  const consistencyScore = (consistencyDays / Math.max(consistencyWindowDays, 1)) * 40
  const executionScore = averageCompletionRate * 40
  const trendResult = getTrend(dailySnapshots.map((snapshot) => snapshot.completionPercent))
  const score = Math.round(clamp(consistencyScore + executionScore + trendResult.points, 0, 100))

  return {
    score,
    label: getMomentumLabel(score),
    consistencyDays,
    consistencyWindowDays,
    completionPercent: Math.round(averageCompletionRate * 100),
    trend: trendResult.label,
    strongDayRun: getStrongDayRun(dailySnapshots),
  }
}

function getStrongDayRun(
  dailySnapshots: Array<{
    isStrong: boolean
  }>,
) {
  let run = 0

  for (let index = dailySnapshots.length - 1; index >= 0; index -= 1) {
    if (!dailySnapshots[index].isStrong) break
    run += 1
  }

  return run
}

function getLastCompletedWindowDates(todayDate: string, length: number) {
  const dates: string[] = []
  const cursor = new Date(`${todayDate}T00:00:00Z`)
  cursor.setUTCDate(cursor.getUTCDate() - length)

  for (let index = 0; index < length; index += 1) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function getTrend(completionPercents: number[]) {
  if (completionPercents.length < 6) {
    return { label: 'Stable' as const, points: 10 }
  }

  const recentAverage = average(completionPercents.slice(-3))
  const previousAverage = average(completionPercents.slice(-6, -3))
  if (recentAverage == null || previousAverage == null) {
    return { label: 'Stable' as const, points: 10 }
  }

  const delta = recentAverage - previousAverage

  if (delta > 5) return { label: 'Improving' as const, points: 20 }
  if (delta < -5) return { label: 'Declining' as const, points: 0 }
  return { label: 'Stable' as const, points: 10 }
}

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getMomentumLabel(score: number): RollingMomentumMetrics['label'] {
  if (score <= 30) return 'Low'
  if (score <= 60) return 'Building'
  if (score <= 80) return 'Strong'
  return 'High Momentum'
}
