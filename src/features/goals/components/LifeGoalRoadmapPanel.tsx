import { ReactNode, useEffect, useRef, useState } from 'react'

type LifeGoalRoadmapPanelProps = {
  data: {
    plannedTaskCount: number
    completedCount: number
    remainingCount: number
    lastCompletedText: string | null
    executionSummaryText: string
    milestoneSummaryText?: string
    sortControl?: ReactNode
    currentContent: ReactNode
    upcomingContent: ReactNode
    completedContent: ReactNode
    milestoneContent?: ReactNode
    emptyMessage: string
  }
  actions: {
    onToggleHighPriorityFocus: () => void
    onToggleOrganizationMode: () => void
    onSetProgressView: (view: 'tasks' | 'milestones') => void
    onOpenRoadmap: () => void
    onRoadmapKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
    onAddTask: (trigger?: HTMLElement | null) => void
    onAddMilestone?: () => void
    onToggleCompleted: () => void
  }
  uiState: {
    roadmapHighPriorityFocus: boolean
    completedOpen: boolean
    showHighPriorityFocus: boolean
    progressView: 'tasks' | 'milestones'
    showMilestonesView: boolean
    organizationMode: 'default' | 'tag'
    showTagGrouping: boolean
  }
}

export function LifeGoalRoadmapPanel({
  data,
  actions,
  uiState,
}: LifeGoalRoadmapPanelProps) {
  const [controlsOpen, setControlsOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!controlsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setControlsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [controlsOpen])

  return (
    <div className="self-start rounded-[24px] border border-white/[0.045] bg-[rgb(var(--theme-surface-elevated-rgb)/0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] xl:flex xl:h-[78vh] xl:flex-col">
      <div className="px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {uiState.showMilestonesView ? (
              <div className="theme-surface-soft inline-flex rounded-full border p-1">
                <button
                  type="button"
                  onClick={() => actions.onSetProgressView('tasks')}
                  className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] transition ${
                    uiState.progressView === 'tasks'
                      ? 'theme-button-secondary text-white'
                      : 'text-white/42 hover:text-white/68'
                  }`}
                >
                  Task Roadmap
                </button>
                <button
                  type="button"
                  onClick={() => actions.onSetProgressView('milestones')}
                  className={`rounded-full px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] transition ${
                    uiState.progressView === 'milestones'
                      ? 'theme-button-secondary text-white'
                      : 'text-white/42 hover:text-white/68'
                  }`}
                >
                  Milestones
                </button>
              </div>
            ) : (
              <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Task roadmap</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {uiState.progressView === 'tasks' && uiState.showHighPriorityFocus ? (
              <button
                type="button"
                onClick={actions.onToggleHighPriorityFocus}
                className={`inline-flex items-center rounded-full border px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] transition ${
                  uiState.roadmapHighPriorityFocus
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.06)] text-[rgb(var(--theme-accent-rgb)/0.72)] hover:border-[rgb(var(--theme-accent-rgb)/0.16)] hover:text-[rgb(var(--theme-accent-rgb)/0.82)]'
                    : 'border-white/[0.045] bg-white/[0.018] text-white/50 hover:border-white/[0.08] hover:text-white/70'
                }`}
              >
                High priority
              </button>
            ) : null}
            {uiState.progressView === 'tasks' ? (
              <button
                type="button"
                onClick={actions.onOpenRoadmap}
                className="inline-flex items-center rounded-full border border-white/[0.045] bg-white/[0.018] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-white/50 transition hover:border-white/[0.08] hover:text-white/70"
              >
                Open roadmap
              </button>
            ) : null}
            <div className="relative" ref={controlsRef}>
              <button
                type="button"
                onClick={() => setControlsOpen((current) => !current)}
                aria-label="Roadmap controls"
                className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full border border-white/[0.045] bg-white/[0.018] text-white/44 transition hover:border-white/[0.08] hover:text-white/68"
              >
                <span className="text-[11px] leading-none">▾</span>
              </button>
              {controlsOpen && uiState.progressView === 'tasks' ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 min-w-[220px] rounded-[18px] border border-white/[0.07] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.34)]">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-mist/44">Sort</p>
                      <div className="flex">{data.sortControl ?? null}</div>
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-mist/44">View</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (uiState.organizationMode !== 'default') {
                              actions.onToggleOrganizationMode()
                            }
                            setControlsOpen(false)
                          }}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] transition ${
                            uiState.organizationMode === 'default'
                              ? 'border-white/[0.08] bg-white/[0.04] text-white/74'
                              : 'border-white/[0.04] bg-white/[0.014] text-white/42 hover:border-white/[0.07] hover:text-white/62'
                          }`}
                        >
                          Default
                        </button>
                        {uiState.showTagGrouping ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (uiState.organizationMode !== 'tag') {
                                actions.onToggleOrganizationMode()
                              }
                              setControlsOpen(false)
                            }}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] transition ${
                              uiState.organizationMode === 'tag'
                                ? 'border-white/[0.08] bg-white/[0.04] text-white/74'
                                : 'border-white/[0.04] bg-white/[0.014] text-white/42 hover:border-white/[0.07] hover:text-white/62'
                            }`}
                          >
                            Group by tag
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div
        className="roadmap-scroll border-t border-white/[0.05] px-4 pt-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain"
        tabIndex={0}
        onKeyDown={actions.onRoadmapKeyDown}
      >
        {uiState.progressView === 'milestones' ? (
          data.milestoneContent ?? <p className="pb-4 pl-[36px] text-sm text-mist">{data.emptyMessage}</p>
        ) : data.plannedTaskCount > 0 ? (
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
        {uiState.progressView === 'milestones' ? (
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1 text-xs text-mist">
              <p>{data.milestoneSummaryText ?? `${data.completedCount} completed • ${data.remainingCount} remaining`}</p>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
