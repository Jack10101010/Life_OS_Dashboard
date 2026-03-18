export function getDateRangeEndForYear(year: number) {
  const today = new Date()
  const currentYear = today.getUTCFullYear()
  if (year < currentYear) {
    return new Date(Date.UTC(year, 11, 31))
  }
  if (year > currentYear) {
    return new Date(Date.UTC(year, 0, 1))
  }
  return new Date(Date.UTC(currentYear, today.getUTCMonth(), today.getUTCDate()))
}

export function getConsecutiveDateStreak(dateSet: Set<string>, year: number) {
  let cursor = getDateRangeEndForYear(year)
  let streak = 0

  while (cursor.getUTCFullYear() === year) {
    const iso = cursor.toISOString().slice(0, 10)
    if (!dateSet.has(iso)) break
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }

  return streak
}
