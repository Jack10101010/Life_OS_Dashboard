import { ReactNode, useState } from 'react'
import { PageContainer } from './LayoutPrimitives'
import { PageId } from '../../types'

type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'

const labels: Record<PageId, string> = {
  dashboard: 'Dashboard',
  tracker: 'Tracker',
  'habit-maps': 'Habit Maps',
  'your-days': 'Your Days',
  'journal-recordings': 'Journal',
  gratitude: 'Journal',
  goals: 'Goals',
  tasks: 'Tasks',
  notes: 'Notes',
  'vision-board': 'Journal',
  analytics: 'Analytics',
  'trade-log': 'Trade Log',
  settings: 'Settings',
}

const descriptions: Record<PageId, ReactNode> = {
  dashboard: (
    <>
      How do you make progress in life? You complete <span className="whitespace-nowrap underline underline-offset-4">small habits</span> that lead to{' '}
      <span className="whitespace-nowrap underline underline-offset-4">big changes</span>.
    </>
  ),
  tracker: 'Heatmap-first tracking for days, weeks, and the year at a glance.',
  'habit-maps': 'A dedicated space for custom habit heatmaps, controls, and pattern review without crowding the mood tracker.',
  'your-days': 'A quieter read-only view for browsing previous days, revisiting what happened, and reopening any day in the Daily Log.',
  'journal-recordings': 'A quieter space for daily reflections, gratitude, and longer-range vision in one place.',
  gratitude: 'A quieter space for daily reflections, gratitude, and longer-range vision in one place.',
  goals: 'A focused planning layer for the goals that matter most, with one clear next task always in view.',
  tasks: 'Task flow will plug in here once the tracker foundation feels solid.',
  notes: 'Quick capture and linked notes are planned after persistence lands.',
  'vision-board': 'A quieter space for daily reflections, gratitude, and longer-range vision in one place.',
  analytics: 'Deeper pattern analysis, correlations, and review workflows are coming.',
  'trade-log': 'A dedicated module for trading review and decision quality later on.',
  settings: 'Defaults, labels, habits, and export controls for the dashboard.',
}

export function TopBar({
  page,
  onOpenToday,
  goalsView,
}: {
  page: PageId
  onOpenToday: () => void
  goalsView?: GoalsView
}) {
  const [pushedToday, setPushedToday] = useState(false)
  const isGoalsPage = page === 'goals'
  const isGoalDetailPage = isGoalsPage && goalsView === 'life-detail'
  const isGoalsLandingPage = isGoalsPage && (goalsView === 'life-overview' || goalsView === 'directional-overview')
  const isTasksPage = page === 'tasks'
  const isDashboardPage = page === 'dashboard'
  const showDescription = !isGoalsPage
  const showTodayCard = !isGoalsPage

  if (isGoalDetailPage || isGoalsLandingPage || isTasksPage || isDashboardPage) {
    return null
  }

  return (
    <div
      className={`theme-border-subtle border-b ${
        isGoalsPage ? 'pt-3 pb-3 sm:pt-3.5 sm:pb-3.5' : 'pt-5 pb-4 sm:pt-6 sm:pb-5'
      }`}
      style={isGoalsPage ? { borderBottomColor: 'rgba(255,255,255,0.055)' } : undefined}
    >
      <PageContainer width="wide">
        <div className={`flex flex-col ${isGoalsPage ? 'gap-2' : 'gap-4'} lg:flex-row lg:items-center lg:justify-between`}>
          <div className="min-w-0">
            <h2
              id={isGoalsPage ? 'goals-page-title' : undefined}
              className={
                isGoalsPage
                  ? 'text-[28px] font-semibold tracking-[-0.03em] theme-text-primary'
                  : 'theme-page-title'
              }
            >
              {labels[page]}
            </h2>
            {showDescription ? (
              <p
                className="theme-body-secondary mt-1.5 max-w-2xl"
                style={{
                  color: page === 'dashboard' ? 'rgb(var(--theme-text-primary-rgb))' : 'rgb(var(--theme-text-muted-rgb))',
                }}
              >
                {descriptions[page]}
              </p>
            ) : null}
          </div>
          <div className={`flex items-center gap-2 lg:self-center ${showTodayCard || isGoalsPage ? '' : 'hidden'}`}>
            {page === 'dashboard' ? (
              <button
                type="button"
                onClick={() => setPushedToday((current) => !current)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  pushedToday
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.10)] text-[rgb(var(--theme-accent-rgb))]'
                    : 'border-[rgb(var(--theme-warning-rgb)/0.18)] bg-[rgb(var(--theme-warning-rgb)/0.10)] text-[rgb(var(--theme-warning-rgb))]'
                }`}
              >
                {pushedToday ? '✅ Synced today' : '⚠️ Not pushed today'}
              </button>
            ) : null}
            {showTodayCard ? (
              <button
                type="button"
                onClick={onOpenToday}
                className="theme-surface-elevated self-start rounded-2xl border px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-white/10 lg:text-right"
              >
                <p className="theme-label theme-text-faint">Today</p>
                <p className="theme-body-primary mt-2">
                  {new Date().toLocaleDateString('en-IE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </button>
            ) : null}
            {isGoalsPage ? <div id="goals-header-controls-slot" className="flex h-9 min-w-[86px] shrink-0 items-center justify-end gap-2" /> : null}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
