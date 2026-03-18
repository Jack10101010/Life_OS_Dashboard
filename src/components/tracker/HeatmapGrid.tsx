import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface HeatmapGridProps<T> {
  columns: T[][]
  getKey: (item: T) => string
  onSelect: (item: T) => void
  renderCell: (item: T) => ReactNode
  className?: string
  columnGapClassName?: string
  rowGapClassName?: string
  frameClassName?: string
}

export function HeatmapGrid<T>({
  columns,
  getKey,
  onSelect,
  renderCell,
  className = '',
  columnGapClassName = 'gap-[3px]',
  rowGapClassName = 'gap-[3px]',
  frameClassName = '',
}: HeatmapGridProps<T>) {
  return (
    <div className={`flex justify-center ${frameClassName}`}>
      <div className={`overflow-x-auto ${className}`}>
        <div className={`inline-flex ${columnGapClassName}`}>
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className={`grid ${rowGapClassName}`}>
              {column.map((item) => (
                <motion.button
                  whileHover={{ scale: 1.08, filter: 'brightness(1.08)' }}
                  key={getKey(item)}
                  onClick={() => onSelect(item)}
                >
                  {renderCell(item)}
                </motion.button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
