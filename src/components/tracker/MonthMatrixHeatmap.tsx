import { motion } from 'framer-motion'
import { Fragment } from 'react'
import { ColorMode, DayEntry } from '../../types'
import { DayHeatmapCell } from './DayHeatmapCell'
import { HeatmapTooltip } from './HeatmapTooltip'
import { getMonthMatrix } from './heatmapUtils'
import { useHeatmapHover } from './useHeatmapHover'

export function MonthMatrixHeatmap({
  days,
  mode,
  year,
  selectedDayId,
  onSelectDay,
}: {
  days: DayEntry[]
  mode: ColorMode
  year: number
  selectedDayId?: string
  onSelectDay: (day: DayEntry) => void
}) {
  const rows = getMonthMatrix(days, year)
  const { containerRef, hovered, bindHover } = useHeatmapHover<DayEntry>()

  return (
    <div ref={containerRef} className="relative overflow-visible rounded-[28px] border border-white/5 bg-white/[0.02] px-4 py-4">
      <div className="overflow-x-auto">
        <div className="grid min-w-[860px] w-full grid-cols-[56px_repeat(31,minmax(14px,1fr))] gap-x-[3px] gap-y-[3px]">
          <div />
          {Array.from({ length: 31 }, (_, index) => (
            <div
              key={index + 1}
              className="flex h-[14px] items-center justify-center text-[10px] uppercase tracking-[0.12em] text-mist/55"
            >
              {index + 1}
            </div>
          ))}

          {rows.map((row) => (
            <Fragment key={row.label}>
              <div className="flex h-[14px] items-center pr-2 text-[11px] uppercase tracking-[0.16em] text-mist/60">
                {row.label}
              </div>
              {row.cells.map((day, index) =>
                day ? (
                  <motion.button
                    whileHover={{ scale: 1.08, filter: 'brightness(1.08)' }}
                    key={day.id}
                    onClick={() => onSelectDay(day)}
                    type="button"
                    className="relative z-10 block h-full w-full cursor-pointer text-left"
                    {...bindHover(day)}
                  >
                    <DayHeatmapCell
                      day={day}
                      mode={mode}
                      active={selectedDayId === day.id}
                      sizeClassName="aspect-square min-h-[14px] w-full min-w-[14px]"
                    />
                  </motion.button>
                ) : (
                  <DayHeatmapCell
                    key={`${row.label}-${index}`}
                    day={null}
                    mode={mode}
                    sizeClassName="aspect-square min-h-[14px] w-full min-w-[14px]"
                  />
                ),
              )}
            </Fragment>
          ))}
        </div>
      </div>
      {hovered ? <HeatmapTooltip day={hovered.day} anchorRect={hovered.rect} containerRect={hovered.container} /> : null}
    </div>
  )
}
