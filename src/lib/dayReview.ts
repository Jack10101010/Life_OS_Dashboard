import { DayEntry } from '../types'

export function formatReviewScore(value: number | null) {
  return value != null ? `${value}/10` : 'Not logged'
}

export function formatReviewMedicationLine(item: DayEntry['medications'][number]) {
  const dose = item.dose.trim() ? `${item.dose.trim()}${item.unit.trim()}` : item.unit.trim()
  return [item.name.trim(), dose || null, item.timeTaken || null].filter(Boolean).join(' · ')
}

export function formatReviewDayEventLine(item: DayEntry['dailyActions'][number]) {
  return [item.time || null, item.title, item.description.trim() || null].filter(Boolean).join(' · ')
}
