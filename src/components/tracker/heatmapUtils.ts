import { DayEntry } from '../../types'

type DateLike = { date: string }

export const GITHUB_DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getDayMap<T extends DateLike>(days: T[]) {
  return new Map(days.map((day) => [day.date, day]))
}

export function getContributionColumns<T extends DateLike>(days: T[]) {
  if (days.length === 0) {
    return {
      columns: [] as Array<Array<T | null>>,
      monthLabels: [] as Array<{ label: string; column: number }>,
    }
  }

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const first = new Date(`${sortedDays[0].date}T00:00:00Z`)
  const last = new Date(`${sortedDays[sortedDays.length - 1].date}T00:00:00Z`)
  const start = new Date(first)
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  const end = new Date(last)
  end.setUTCDate(end.getUTCDate() + (7 - ((end.getUTCDay() + 6) % 7) - 1) % 7)

  const dayMap = getDayMap(sortedDays)
  const columns: Array<Array<T | null>> = []
  const monthLabels: Array<{ label: string; column: number }> = []
  let cursor = new Date(start)
  let columnIndex = 0

  while (cursor <= end) {
    const column: Array<T | null> = []
    for (let row = 0; row < 7; row += 1) {
      const key = cursor.toISOString().slice(0, 10)
      const day = dayMap.get(key) ?? null
      column.push(day)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    columns.push(column)
    const firstReal = column.find((value): value is T => value !== null)
    if (firstReal) {
      const month = new Date(`${firstReal.date}T00:00:00Z`).getUTCMonth()
      const lastMonthLabel = monthLabels[monthLabels.length - 1]
      if (!lastMonthLabel || lastMonthLabel.label !== MONTH_LABELS[month]) {
        monthLabels.push({ label: MONTH_LABELS[month], column: columnIndex })
      }
    }
    columnIndex += 1
  }

  return { columns, monthLabels }
}

export function getContributionMonthSpans<T extends DateLike>(days: T[]) {
  const { columns, monthLabels } = getContributionColumns(days)
  return monthLabels.map((label, index) => ({
    ...label,
    span:
      index === monthLabels.length - 1
        ? Math.max(columns.length - label.column, 1)
        : Math.max(monthLabels[index + 1].column - label.column, 1),
  }))
}

export function getMonthMatrix<T extends DateLike>(days: T[], year: number) {
  const dayMap = getDayMap(days)

  return MONTH_LABELS.map((label, monthIndex) => {
    const cells = Array.from({ length: 31 }, (_, dayOffset) => {
      const date = new Date(Date.UTC(year, monthIndex, dayOffset + 1))
      if (date.getUTCMonth() !== monthIndex) {
        return null
      }
      return dayMap.get(date.toISOString().slice(0, 10)) ?? null
    })

    return { label, cells }
  })
}
