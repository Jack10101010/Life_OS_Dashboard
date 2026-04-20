import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export default function SectionHeader({
  title,
  count,
  actions,
  isCollapsed,
  onToggleCollapse,
  collapsedSummary,
}: {
  title: string
  count: ReactNode
  actions?: ReactNode
  isCollapsed: boolean
  onToggleCollapse?: () => void
  collapsedSummary?: ReactNode | null
}) {
  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 ${onToggleCollapse ? 'cursor-pointer' : ''}`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{title}</p>
          <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">{count}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onToggleCollapse ? (
            <ChevronRight
              className={`ml-1 h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
            />
          ) : null}
        </div>
      </div>
      {collapsedSummary}
    </>
  )
}
