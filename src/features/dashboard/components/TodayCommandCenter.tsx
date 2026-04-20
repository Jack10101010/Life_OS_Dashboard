import { CheckCircle2, Play, Sparkles, Target } from 'lucide-react'

type TodayPriorityTask = {
  id: string
  title: string
  goalLabel?: string
  dueLabel?: string
  guidance?: string
  priority?: 'none' | 'low' | 'medium' | 'high'
}

type TodayCommandCenterProps = {
  tasks: TodayPriorityTask[]
  onOpenTask?: (taskId: string) => void
  onCompleteTask?: (taskId: string) => void
}

export default function TodayCommandCenter({
  tasks,
  onOpenTask,
  onCompleteTask,
}: TodayCommandCenterProps) {
  const task = tasks[0] ?? null
  const title = task?.title ?? 'No priority task selected'
  const goalLabel = task?.goalLabel ?? 'Task list'
  const dueLabel = task?.dueLabel ?? 'No due date'
  const guidance =
    task?.guidance ?? 'Review your task list and choose the highest-leverage task for today.'
  const secondaryTasks = tasks.slice(1, 4)

  const priorityDotClass = (priority?: TodayPriorityTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-rose-400'
      case 'medium':
        return 'bg-amber-400'
      case 'low':
        return 'bg-zinc-500'
      default:
        return 'bg-zinc-600'
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl surface-2 border border-[hsl(220,80%,65%,0.12)] glow-blue">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] via-transparent to-violet-500/[0.03]" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

      <div className="relative px-7 py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/15">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400">
              Today&apos;s Priority
            </span>
          </div>
          <span className="text-[11px] text-tertiary-content">
            {new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            }).format(new Date())}
          </span>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-primary-content tracking-tight leading-snug">
              {title}
            </h2>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-violet-400" />
                <span className="text-[12px] text-violet-400 font-medium">
                  {goalLabel}
                </span>
              </div>
              <span className="text-[11px] text-tertiary-content">·</span>
              <span className="text-[11px] text-amber-400/80 font-medium">{dueLabel}</span>
            </div>

            <p className="text-[12px] text-secondary-content mt-3 leading-relaxed max-w-lg">
              {guidance}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              type="button"
              onClick={() => task && onOpenTask?.(task.id)}
              disabled={!task || !onOpenTask}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-[13px] font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:hover:bg-blue-500 disabled:hover:shadow-none"
            >
              <Play className="w-3.5 h-3.5" />
              Start Task
            </button>
            <button
              type="button"
              onClick={() => task && onCompleteTask?.(task.id)}
              disabled={!task || !onCompleteTask}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-medium hover:border-zinc-600 text-secondary-content hover:text-primary-content text-[13px] font-medium transition-all duration-200 bg-transparent disabled:opacity-50 disabled:hover:border-medium disabled:hover:text-secondary-content"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </button>
          </div>
        </div>

        {secondaryTasks.length > 0 ? (
          <div className="mt-5 space-y-2">
            {secondaryTasks.map((secondaryTask) => (
              <div
                key={secondaryTask.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-subtle bg-black/10 px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => onOpenTask?.(secondaryTask.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className={`h-2 w-2 shrink-0 rounded-full ${priorityDotClass(secondaryTask.priority)}`} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-primary-content">
                      {secondaryTask.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-tertiary-content">
                      <span className="truncate">{secondaryTask.goalLabel ?? 'Task list'}</span>
                      {secondaryTask.dueLabel ? <span>· {secondaryTask.dueLabel}</span> : null}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onCompleteTask?.(secondaryTask.id)}
                  className="shrink-0 text-secondary-content transition-colors hover:text-primary-content"
                  aria-label={`Complete ${secondaryTask.title}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
