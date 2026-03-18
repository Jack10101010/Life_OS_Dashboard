import { PageId } from '../../types'

const descriptions: Record<PageId, string> = {
  dashboard: 'A calm home base for your week, trendline, and momentum.',
  tracker: 'Heatmap-first tracking for days, weeks, and the year at a glance.',
  'journal-recordings': 'A dedicated list of your saved daily reflections, notes, and journal moments.',
  gratitude: 'A future space for daily gratitude, reflection prompts, and memory anchors.',
  goals: 'A future layer for outcome planning, still intentionally light in v1.',
  tasks: 'Task flow will plug in here once the tracker foundation feels solid.',
  notes: 'Quick capture and linked notes are planned after persistence lands.',
  'vision-board': 'A curated space for themes, identity cues, and future direction.',
  analytics: 'Deeper pattern analysis, correlations, and review workflows are coming.',
  'trade-log': 'A dedicated module for trading review and decision quality later on.',
  settings: 'Defaults, labels, habits, and export controls for the dashboard.',
}

export function TopBar({ page, onOpenToday }: { page: PageId; onOpenToday: () => void }) {
  return (
    <div className="flex items-start justify-between border-b border-[#222] px-8 py-6">
      <div>
        <p className="text-xs uppercase tracking-[0.26em] text-[#8E8E8E]">Version 1</p>
        <h2 className="mt-2 text-3xl font-semibold text-white capitalize">{page.replace('-', ' ')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#A3A3A3]">{descriptions[page]}</p>
      </div>
      <button
        type="button"
        onClick={onOpenToday}
        className="rounded-2xl border border-[#2A2A2A] bg-[#171717] px-4 py-3 text-right shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-white/10 hover:bg-[#1D1D1D]"
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
    </div>
  )
}
