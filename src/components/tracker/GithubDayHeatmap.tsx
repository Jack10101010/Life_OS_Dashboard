import { motion } from 'framer-motion'
import { ColorMode, DayEntry } from '../../types'
import { DayHeatmapCell } from './DayHeatmapCell'
import { HeatmapTooltip } from './HeatmapTooltip'
import { GITHUB_DAY_LABELS, getContributionColumns, getContributionMonthSpans } from './heatmapUtils'
import { useHeatmapHover } from './useHeatmapHover'

export function GithubDayHeatmap({
  days,
  mode,
  selectedDayId,
  onSelectDay,
}: {
  days: DayEntry[]
  mode: ColorMode
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
}) {
  const { columns } = getContributionColumns(days)
  const monthSpans = getContributionMonthSpans(days)
  const totalColumns = Math.max(columns.length, 1)
  const { containerRef, hovered, bindHover } = useHeatmapHover<DayEntry>()

  return (
    <div ref={containerRef} className="relative overflow-visible rounded-[28px] border border-white/5 bg-white/[0.02] px-4 py-4">
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 gap-y-2">
        <div />
        <div
          className="grid items-end gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(12px, 1fr))` }}
        >
          {monthSpans.map((label) => (
            <div
              key={`${label.label}-${label.column}`}
              className="truncate text-[10px] uppercase tracking-[0.16em] text-mist/60"
              style={{ gridColumn: `${label.column + 1} / span ${label.span}` }}
            >
              {label.label}
            </div>
          ))}
        </div>

        <div className="grid gap-[3px] pt-px">
          {GITHUB_DAY_LABELS.map((label, index) => (
            <div key={`${label}-${index}`} className="flex h-[12px] items-center justify-start text-[10px] uppercase tracking-[0.12em] text-mist/45">
              {label}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto pb-1">
          <div
            className="grid min-w-[780px] gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${totalColumns}, minmax(12px, 1fr))` }}
          >
            {columns.map((column, columnIndex) => (
              <div key={columnIndex} className="grid gap-[3px]">
                {column.map((day, rowIndex) => {
                  return day ? (
                    <motion.button
                      whileHover={{ scale: 1.08, filter: 'brightness(1.08)' }}
                      key={day.id}
                      onClick={() => onSelectDay(day)}
                      type="button"
                      className="relative z-10 block h-full w-full cursor-pointer text-left"
                      {...bindHover(day)}
                    >
                      <DayHeatmapCell day={day} mode={mode} active={selectedDayId === day.id} />
                    </motion.button>
                  ) : (
                    <DayHeatmapCell key={`empty-${columnIndex}-${rowIndex}`} day={null} mode={mode} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {hovered ? <HeatmapTooltip day={hovered.day} anchorRect={hovered.rect} containerRect={hovered.container} /> : null}
    </div>
  )
}
