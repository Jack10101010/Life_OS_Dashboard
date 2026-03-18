import { getManualCellColor } from '../../lib/color'
import { ManualCellColor } from '../../types'

const OPTIONS: Array<{ value: ManualCellColor; label: string }> = [
  { value: 'blank', label: 'Blank' },
  { value: 'green', label: 'Green' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
]

export function DayColorSelector({
  value,
  onChange,
}: {
  value: ManualCellColor
  onChange: (value: ManualCellColor) => void
}) {
  return (
    <div className="inline-flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border border-white/6 bg-black/20 p-1">
      {OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
              active
                ? 'border-white/18 bg-white/[0.08] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                : 'border-transparent bg-transparent text-mist hover:border-white/8 hover:bg-white/[0.04]'
            }`}
          >
            <span
              className="block h-2.5 w-2.5 rounded-full border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)]"
              style={{ backgroundColor: getManualCellColor(option.value) }}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
