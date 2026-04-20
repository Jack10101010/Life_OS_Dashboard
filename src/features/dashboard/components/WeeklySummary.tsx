import { Calendar, TrendingUp, Zap } from 'lucide-react'

type WeeklySummaryDay = {
  label: string
  logged: boolean
  isToday: boolean
}

type WeeklySummaryProps = {
  days: WeeklySummaryDay[]
  loggedCount: number
  habitCompletion: number
}

export default function WeeklySummary({
  days,
  loggedCount,
  habitCompletion,
}: WeeklySummaryProps) {
  return (
    <div className="flex items-center gap-6 px-5 py-3.5 rounded-xl surface-1 border border-subtle">
      <div className="flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5 text-tertiary-content mr-2" />
        {days.map((day) => (
          <div key={day.label + String(day.isToday)} className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-tertiary-content font-medium">{day.label}</span>
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                day.isToday
                  ? 'bg-blue-500 ring-2 ring-blue-500/30'
                  : day.logged
                    ? 'bg-emerald-500/80'
                    : 'bg-zinc-700/50'
              }`}
            />
          </div>
        ))}
      </div>

      <div className="w-px h-6 bg-zinc-800" />

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[12px] text-primary-content font-medium">
            {loggedCount}/{days.length}
          </span>
          <span className="text-[11px] text-tertiary-content">days logged</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-[12px] text-primary-content font-medium">
            {habitCompletion}%
          </span>
          <span className="text-[11px] text-tertiary-content">habit completion</span>
        </div>
      </div>
    </div>
  )
}
