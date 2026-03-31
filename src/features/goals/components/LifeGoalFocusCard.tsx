import { ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'

export function LifeGoalFocusCard({
  title,
  categoryChip,
  primaryChip,
  statusChip,
  whyText,
  nextTaskText,
  actionFeedback,
  onCompleteNext,
  onFocusToday,
}: {
  title: string
  categoryChip: ReactNode
  primaryChip: ReactNode
  statusChip: ReactNode
  whyText: string | null
  nextTaskText: string
  actionFeedback: string | null
  onCompleteNext?: (event: React.MouseEvent<HTMLButtonElement>) => void
  onFocusToday: () => void
}) {
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 transition-[transform,border-color,box-shadow,background-color] duration-150 ease-out hover:-translate-y-[1px] hover:border-white/[0.11] hover:bg-white/[0.034] hover:shadow-[0_16px_30px_rgba(0,0,0,0.16)]">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-4">
          <h3 className="theme-page-title min-w-0 flex-1 pr-2">{title}</h3>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            {categoryChip}
            {primaryChip}
            {statusChip}
          </div>
        </div>
        <div className="mt-2 h-px bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.72)_0%,rgb(var(--theme-border-subtle-rgb)/0.22)_82%,transparent_100%)]" />
      </div>

      <div className="mt-2.5 space-y-3.5">
        {whyText ? (
          <div className="space-y-0.5">
            <p className="text-[11px] text-mist/56">Why</p>
            <p className="text-[13px] font-medium leading-5 text-white/68">{whyText}</p>
          </div>
        ) : null}
        <div className="space-y-1.5 pt-1.5">
          <p className="text-[11px] text-mist/62">Next task</p>
          <p className="text-[22px] font-semibold leading-[1.28] text-white">{nextTaskText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCompleteNext ? (
            <Button
              variant="soft"
              onClick={onCompleteNext}
              className="px-3 py-1.5 text-[13px] text-[rgb(var(--theme-text-primary-rgb))] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.04),0_8px_18px_rgb(var(--theme-accent-rgb)/0.08)] transition-transform duration-150 ease-out hover:-translate-y-[1px]"
              style={{
                borderColor: 'rgb(var(--theme-accent-rgb) / 0.18)',
                backgroundColor: 'rgb(var(--theme-accent-rgb) / 0.12)',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = 'rgb(var(--theme-accent-rgb) / 0.16)'
                event.currentTarget.style.borderColor = 'rgb(var(--theme-accent-rgb) / 0.24)'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = 'rgb(var(--theme-accent-rgb) / 0.12)'
                event.currentTarget.style.borderColor = 'rgb(var(--theme-accent-rgb) / 0.18)'
              }}
            >
              Done — continue
            </Button>
          ) : null}
          <Button
            variant="ghost"
            onClick={onFocusToday}
            className="border-white/[0.06] px-3 py-1.5 text-[13px] transition-transform duration-150 ease-out hover:-translate-y-[1px]"
          >
            Focus this today
          </Button>
        </div>
        {actionFeedback ? <p className="text-sm text-mist">{actionFeedback}</p> : null}
      </div>
    </div>
  )
}
