export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function getDailyScore(input: {
  habitsCompleted: number
  habitsTotal: number
  morningMood: number
  eveningMood: number
  drank: boolean
}) {
  const habitRatio = input.habitsTotal === 0 ? 0 : input.habitsCompleted / input.habitsTotal
  const moodRatio = ((input.morningMood + input.eveningMood) / 2 - 1) / 4
  const alcoholRatio = input.drank ? 0 : 1

  return clampScore(habitRatio * 70 + moodRatio * 20 + alcoholRatio * 10)
}

export function getWeeklyScore(dailyScores: number[]) {
  if (dailyScores.length === 0) return 0
  return clampScore(dailyScores.reduce((sum, score) => sum + score, 0) / dailyScores.length)
}
