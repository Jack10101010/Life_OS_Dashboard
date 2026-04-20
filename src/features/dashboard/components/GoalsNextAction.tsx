import { ArrowRight, Clock, Target, Zap } from 'lucide-react'

type Goal = {
  id: string
  name: string
  progress: number
  color: string
  nextTask: string
  nextTaskId?: string
  dueLabel?: string
  highImpact?: boolean
}

type GoalsNextActionProps = {
  goals: Goal[]
  onOpenGoals?: () => void
  onOpenGoal?: (goalId: string) => void
  onOpenTask?: (taskId: string) => void
}

const barColors: Record<string, string> = {
  violet: 'bg-violet-500',
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
}

const dotColors: Record<string, string> = {
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
}

const textColors: Record<string, string> = {
  violet: 'text-violet-400',
  emerald: 'text-emerald-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
}

export default function GoalsNextAction({
  goals,
  onOpenGoals,
  onOpenGoal,
  onOpenTask,
}: GoalsNextActionProps) {
  return (
    <div className="surface-1 flex h-[380px] flex-col border border-subtle rounded-xl px-5 pb-4 pt-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          <h3 className="text-[14px] font-semibold text-primary-content">
            Goals &amp; Next Action
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenGoals}
          className="text-[11px] text-tertiary-content"
        >
          {goals.length} active
        </button>
      </div>

      <div className="theme-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="group p-3.5 rounded-lg surface-2 border border-subtle hover:border-medium transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dotColors[goal.color] ?? dotColors.blue}`} />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onOpenGoal?.(goal.id)
                  }}
                  className="text-left text-[13px] font-medium text-primary-content hover:text-white"
                >
                  {goal.name}
                </button>
                {goal.highImpact && (
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-500/70">
                    <Zap className="h-3 w-3 fill-amber-500/50 text-amber-500/70" />
                    High Impact
                  </span>
                )}
              </div>
              <span
                className={`text-[12px] font-semibold ${textColors[goal.color] ?? textColors.blue}`}
              >
                {goal.progress}%
              </span>
            </div>

            <div className="h-1 rounded-full bg-zinc-800 mb-3">
              <div
                className={`h-full rounded-full ${barColors[goal.color] ?? barColors.blue} transition-all duration-500`}
                style={{ width: `${goal.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ArrowRight className="w-3 h-3 text-tertiary-content shrink-0" />
                {goal.nextTaskId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      if (goal.nextTaskId) onOpenTask?.(goal.nextTaskId)
                    }}
                    className="truncate text-left text-[12px] text-secondary-content hover:text-primary-content"
                  >
                    {goal.nextTask}
                  </button>
                ) : (
                  <span className="truncate text-[12px] text-secondary-content">
                    {goal.nextTask}
                  </span>
                )}
              </div>
              {goal.dueLabel && (
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Clock className="w-3 h-3 text-amber-400/70" />
                  <span className="text-[10px] text-amber-400/80 font-medium">
                    {goal.dueLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
