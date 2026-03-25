import { getManualCellColor } from '../../lib/color'
import { ManualCellColor } from '../../types'

const OPTIONS: Array<{ value: ManualCellColor; label: string }> = [
  { value: 'blank', label: 'Blank' },
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
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
    <div className="inline-flex w-full flex-wrap items-center gap-1.5 rounded-[18px] border border-white/[0.05] bg-[#171717]/78 p-1.5">
      {OPTIONS.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
              active
                ? 'border-white/14 bg-white/[0.06] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                : 'border-transparent bg-transparent text-mist hover:border-white/[0.08] hover:bg-white/[0.03]'
            }`}
          >
            <span
              className="block h-2.5 w-2.5 rounded-full border border-white/10 shadow-[0_0_8px_rgba(255,255,255,0.04)]"
              style={{ backgroundColor: getManualCellColor(option.value) }}
            />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
