import { ReactNode, useState } from 'react'
import { PageContainer } from './LayoutPrimitives'
import { PageId } from '../../types'

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
  goals: 'A future layer for outcome planning, still intentionally light in v1.',
  tasks: 'Task flow will plug in here once the tracker foundation feels solid.',
  notes: 'Quick capture and linked notes are planned after persistence lands.',
  'vision-board': 'A quieter space for daily reflections, gratitude, and longer-range vision in one place.',
  analytics: 'Deeper pattern analysis, correlations, and review workflows are coming.',
  'trade-log': 'A dedicated module for trading review and decision quality later on.',
  settings: 'Defaults, labels, habits, and export controls for the dashboard.',
}

export function TopBar({ page, onOpenToday, sidebarCollapsed }: { page: PageId; onOpenToday: () => void; sidebarCollapsed: boolean }) {
  const [pushedToday, setPushedToday] = useState(false)

  return (
    <div className="border-b border-[#222] py-5 sm:py-6">
      <PageContainer width="wide" className={sidebarCollapsed ? 'lg:pl-16' : ''}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.26em] text-[#8E8E8E]">Version 1</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">{labels[page]}</h2>
            <p
              className="mt-2 max-w-2xl text-[15px]"
              style={{
                color: page === 'dashboard' ? '#FFFFFF' : '#A3A3A3',
              }}
            >
              {descriptions[page]}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <button
              type="button"
              onClick={onOpenToday}
              className="self-start rounded-2xl border border-[#2A2A2A] bg-[#171717] px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-white/10 hover:bg-[#1D1D1D] lg:text-right"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-[#8E8E8E]">Today</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {new Date().toLocaleDateString('en-IE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </button>
            {page === 'dashboard' ? (
              <button
                type="button"
                onClick={() => setPushedToday((current) => !current)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  pushedToday
                    ? 'border-[#4FDC94]/18 bg-[#4FDC94]/10 text-[#CDEFD9] hover:border-[#4FDC94]/24 hover:bg-[#4FDC94]/12'
                    : 'border-[#D9A26A]/18 bg-[#D9A26A]/10 text-[#E9C7A5] hover:border-[#D9A26A]/24 hover:bg-[#D9A26A]/12'
                }`}
              >
                {pushedToday ? '✅ Synced today' : '⚠️ Not pushed today'}
              </button>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </div>
  )
}
