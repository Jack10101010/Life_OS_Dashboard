export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatLongDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(dateStr: string) {
  const date = new Date(dateStr)
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export function getWeekLabel(startDate: string, endDate: string) {
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`
}
