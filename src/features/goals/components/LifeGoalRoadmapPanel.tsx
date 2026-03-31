import { ReactNode } from 'react'

type LifeGoalRoadmapPanelProps = {
  data: {
    plannedTaskCount: number
    completedCount: number
    remainingCount: number
    lastCompletedText: string | null
    executionSummaryText: string
    currentContent: ReactNode
    upcomingContent: ReactNode
    completedContent: ReactNode
    emptyMessage: string
  }
  actions: {
    onToggleHighPriorityFocus: () => void
    onOpenRoadmap: () => void
    onRoadmapKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
    onAddTask: (trigger?: HTMLElement | null) => void
    onToggleCompleted: () => void
  }
  uiState: {
    roadmapHighPriorityFocus: boolean
    completedOpen: boolean
    showHighPriorityFocus: boolean
  }
}

export function LifeGoalRoadmapPanel({
  data,
  actions,
  uiState,
}: LifeGoalRoadmapPanelProps) {
  return (
    <div className="self-start rounded-[24px] border border-white/[0.045] bg-[rgb(var(--theme-surface-elevated-rgb)/0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] xl:flex xl:h-[78vh] xl:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Task roadmap</p>
          <p className="mt-1 text-[11px] text-mist/46">{data.executionSummaryText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {uiState.showHighPriorityFocus ? (
            <button
              type="button"
              onClick={actions.onToggleHighPriorityFocus}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] transition ${
                uiState.roadmapHighPriorityFocus
                  ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                  : 'border-white/[0.06] bg-white/[0.02] text-white/54 hover:border-white/[0.1] hover:text-white/74'
              }`}
            >
              Focus: High priority
            </button>
          ) : null}
          <button
            type="button"
            onClick={actions.onOpenRoadmap}
            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
          >
            Open roadmap
          </button>
        </div>
      </div>

      <div
        className="roadmap-scroll border-t border-white/[0.05] px-4 pt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain"
        tabIndex={0}
        onKeyDown={actions.onRoadmapKeyDown}
      >
        {data.plannedTaskCount > 0 ? (
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 left-[12px] top-3 w-px bg-white/[0.15]"
              style={{
                background:
                  data.currentContent
                    ? 'linear-gradient(180deg, rgb(var(--theme-border-subtle-rgb)/0.12) 0%, rgb(var(--theme-accent-rgb)/0.14) 46%, rgb(var(--theme-border-subtle-rgb)/0.12) 100%)'
                    : undefined,
              }}
            />
            {data.currentContent}
            {data.upcomingContent}
            {data.completedContent ? (
              <div className="pt-3">
                <button
                  type="button"
                  onClick={actions.onToggleCompleted}
                  className="flex w-full items-center justify-between gap-3 pb-2 pl-[36px] text-left text-[11px] uppercase tracking-[0.16em] text-mist/56 transition hover:text-white/68"
                >
                  <span>Completed · {data.completedCount}</span>
                  <span className="text-white/34">{uiState.completedOpen ? '−' : '+'}</span>
                </button>
                {uiState.completedOpen ? data.completedContent : null}
              </div>
            ) : null}
            {!data.currentContent && !data.upcomingContent ? (
              <p className="pb-4 pl-[36px] text-sm text-mist">{data.emptyMessage}</p>
            ) : null}
          </div>
        ) : (
          <p className="pb-4 pl-[36px] text-sm text-mist">{data.emptyMessage}</p>
        )}
      </div>

      <div className="border-t border-white/[0.08] px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1 text-xs text-mist">
            <p>
              {data.completedCount} completed
              <span className="px-1.5 text-white/26">•</span>
              {data.remainingCount} remaining
            </p>
            {data.lastCompletedText ? <p>Last: {data.lastCompletedText}</p> : null}
          </div>
          <button
            type="button"
            onClick={(event) => actions.onAddTask(event.currentTarget)}
            className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
          >
            + Add task
          </button>
        </div>
      </div>
    </div>
  )
}
