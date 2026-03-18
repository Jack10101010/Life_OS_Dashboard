import { getWeekColor } from '../../lib/color'
import { WeekEntry, ColorMode } from '../../types'
import { HeatmapGrid } from './HeatmapGrid'

export function WeekHeatmap({
  weeks,
  mode,
  selectedWeekId,
  onSelectWeek,
  compact = false,
}: {
  weeks: WeekEntry[]
  mode: ColorMode
  selectedWeekId?: string
  onSelectWeek: (week: WeekEntry) => void
  compact?: boolean
}) {
  const columns = Array.from({ length: Math.ceil(weeks.length / 7) }, (_, columnIndex) =>
    weeks.slice(columnIndex * 7, columnIndex * 7 + 7),
  )

  const cellSize = compact ? 'h-[12px] w-[12px]' : 'h-[14px] w-[14px]'
  const markerSize = compact ? 'h-[3px] w-[3px]' : 'h-[4px] w-[4px]'
  const frameClassName = compact
    ? 'rounded-[24px] border border-white/5 bg-white/[0.02] px-3 py-3'
    : 'rounded-[28px] border border-white/5 bg-white/[0.02] px-3 py-4'

  return (
    <HeatmapGrid
      columns={columns}
      getKey={(week) => week.id}
      onSelect={onSelectWeek}
      frameClassName={frameClassName}
      renderCell={(week) => {
        const active = selectedWeekId === week.id
        return (
          <div
            className={`heat-cell relative ${cellSize} rounded-[3px] border ${
              active ? 'border-white/60 shadow-[0_0_0_1px_rgba(255,255,255,0.16)]' : 'border-white/10'
            }`}
            style={{ backgroundColor: getWeekColor(week, mode) }}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute bottom-[1px] right-[1px] flex items-center gap-px">
                {week.bigWin ? <span className={`${markerSize} rounded-full bg-sand`} /> : null}
                {week.drankThisWeek ? <span className={`${markerSize} rounded-full bg-rose`} /> : null}
              </div>
            </div>
          </div>
        )
      }}
    />
  )
}
