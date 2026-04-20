import { Flame, TrendingUp } from 'lucide-react'

type GreetingHeaderProps = {
  userName?: string
  subtitle?: string
  momentumLabel?: string
  momentumValue?: string | number
  streakLabel?: string
  streakValue?: string | number
  weeklySummary?: string
}

export default function GreetingHeader({
  userName = 'Jack',
  subtitle = 'Saturday, April 12 — 3 tasks due today, 1 habit pending',
  momentumLabel = 'momentum',
  momentumValue = '87%',
  streakLabel = 'day streak',
  streakValue = 4,
  weeklySummary = '12 done this week · 2 overdue',
}: GreetingHeaderProps) {
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const [doneText, overdueText] = weeklySummary.split('·').map((part) => part.trim())

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-primary-content tracking-tight">
          {greeting}, {userName}
        </h1>
        <p className="text-[13px] text-secondary-content mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl surface-2 border border-subtle">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">{momentumValue}</span>
          </div>
          <span className="text-[11px] text-secondary-content">{momentumLabel}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl surface-2 border border-subtle">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">{streakValue}</span>
          </div>
          <span className="text-[11px] text-secondary-content">{streakLabel}</span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-tertiary-content">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{doneText}</span>
          <span className="mx-1">·</span>
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>{overdueText}</span>
        </div>
      </div>
    </div>
  )
}
