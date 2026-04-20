import { Flame } from 'lucide-react'

type Habit = {
  id: string
  name: string
  emoji: string
  color: string
  streak: number
  days: boolean[]
}

type HabitsWeekProps = {
  habits: Habit[]
  onOpenTracker?: () => void
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const TODAY_INDEX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

const colorMap: Record<string, { ring: string; fill: string; text: string }> = {
  emerald: {
    ring: 'ring-emerald-500/40',
    fill: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  blue: {
    ring: 'ring-blue-500/40',
    fill: 'bg-blue-500',
    text: 'text-blue-400',
  },
  violet: {
    ring: 'ring-violet-500/40',
    fill: 'bg-violet-500',
    text: 'text-violet-400',
  },
  amber: {
    ring: 'ring-amber-500/40',
    fill: 'bg-amber-500',
    text: 'text-amber-400',
  },
}

export default function HabitsWeek({ habits, onOpenTracker }: HabitsWeekProps) {
  return (
    <div className="surface-1 border border-subtle rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-primary-content">
          Habits This Week
        </h3>
        <span className="text-[11px] text-tertiary-content">
          {habits.filter((habit) => habit.days.filter(Boolean).length >= 5).length}/{habits.length}{' '}
          on track
        </span>
      </div>

      <div className="flex items-center mb-3">
        <div className="w-[140px] shrink-0" />
        <div className="flex-1 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((day, index) => (
            <span
              key={`${day}-${index}`}
              className={`text-center text-[9px] font-medium ${
                index === TODAY_INDEX ? 'text-blue-400' : 'text-tertiary-content'
              }`}
            >
              {day}
            </span>
          ))}
        </div>
        <div className="w-[52px] shrink-0" />
      </div>

      <div className="space-y-2.5">
        {habits.map((habit) => {
          const colors = colorMap[habit.color] ?? colorMap.blue
          const completedCount = habit.days.filter(Boolean).length

          return (
            <div key={habit.id} className="flex items-center">
              <div className="w-[140px] shrink-0 flex items-center gap-2 min-w-0">
                <span className="text-sm">{habit.emoji}</span>
                <span className="text-[12px] text-secondary-content truncate">
                  {habit.name}
                </span>
              </div>

              <div className="flex-1 grid grid-cols-7 gap-1">
                {habit.days.map((done, dayIdx) => {
                  const isToday = dayIdx === TODAY_INDEX
                  const isFuture = dayIdx > TODAY_INDEX

                  return (
                    <div key={dayIdx} className="flex justify-center">
                      {isFuture ? (
                        <div className="w-[18px] h-[18px] rounded-full bg-zinc-800/30" />
                      ) : isToday ? (
                        <button
                          type="button"
                          onClick={onOpenTracker}
                          className={`w-[18px] h-[18px] rounded-full transition-all duration-200 ring-2 ${
                            done
                              ? `${colors.fill} ${colors.ring}`
                              : 'bg-zinc-800 ring-zinc-600/50 hover:ring-zinc-500'
                          }`}
                          title="Open habit tracker"
                        />
                      ) : (
                        <div
                          className={`w-[18px] h-[18px] rounded-full ${
                            done ? `${colors.fill} opacity-70` : 'bg-zinc-800/50'
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="w-[52px] shrink-0 flex items-center justify-end gap-1">
                <Flame className={`w-3 h-3 ${colors.text}`} />
                <span className={`text-[11px] font-medium ${colors.text}`}>{habit.streak}</span>
                <span className="text-[9px] text-tertiary-content">({completedCount}/7)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
