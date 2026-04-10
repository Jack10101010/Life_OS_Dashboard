import { forwardRef, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FloatingPanelPosition } from '../../components/layout/OverlayPrimitives'
import {
  formatCalendarDayValue,
  formatCalendarMonthLabel,
  getCalendarDays,
  getCalendarMonthDate,
  getTodayIsoDate,
  isValidIsoDate,
  shiftCalendarMonth,
  startOfCalendarMonth,
} from './goalUtils'

const GOAL_DATE_PICKER_WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type GoalDatePickerProps = {
  value?: string | null
  onChange: (value: string) => void
  onClose: () => void
  anchorPosition: FloatingPanelPosition | null
  label?: string
  navigationStyle?: 'soft' | 'bordered'
}

export const GoalDatePicker = forwardRef<HTMLDivElement, GoalDatePickerProps>(function GoalDatePicker(
  {
    value,
    onChange,
    onClose,
    anchorPosition,
    label,
    navigationStyle = 'soft',
  },
  ref,
) {
  const [viewMonth, setViewMonth] = useState(() => startOfCalendarMonth(getCalendarMonthDate(value ?? undefined)))

  useEffect(() => {
    if (!anchorPosition) return
    setViewMonth(startOfCalendarMonth(getCalendarMonthDate(value ?? undefined)))
  }, [anchorPosition, value])

  const navigationButtonClassName = useMemo(
    () =>
      navigationStyle === 'bordered'
        ? 'theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
        : 'theme-text-muted rounded-full px-2.5 py-1.5 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]',
    [navigationStyle],
  )

  if (!anchorPosition || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={ref}
      className="theme-popover fixed z-[80] overflow-hidden rounded-[24px] border p-3 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
      style={{
        top: `${anchorPosition.top}px`,
        left: `${anchorPosition.left}px`,
        width: `${anchorPosition.width}px`,
      }}
    >
      {label ? <p className="theme-text-faint mb-2 text-[11px] uppercase tracking-[0.14em]">{label}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setViewMonth((current) => shiftCalendarMonth(current, -1))}
          className={navigationButtonClassName}
        >
          Prev
        </button>
        <p className="theme-text-primary text-sm font-medium">{formatCalendarMonthLabel(viewMonth)}</p>
        <button
          type="button"
          onClick={() => setViewMonth((current) => shiftCalendarMonth(current, 1))}
          className={navigationButtonClassName}
        >
          Next
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {GOAL_DATE_PICKER_WEEKDAY_LABELS.map((day) => (
          <div key={day} className="theme-text-faint px-1 py-1 text-center text-[11px] uppercase tracking-[0.12em]">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {getCalendarDays(viewMonth).map((day) => {
          const dayValue = formatCalendarDayValue(day)
          const inCurrentMonth = day.getUTCMonth() === viewMonth.getUTCMonth()
          const isSelected = dayValue === (value ?? '')
          const isToday = dayValue === getTodayIsoDate()

          return (
            <button
              key={dayValue}
              type="button"
              onClick={() => onChange(dayValue)}
              className={`rounded-2xl border px-0 py-2 text-center text-sm transition ${
                isSelected
                  ? 'border-[rgb(var(--theme-info-rgb)/0.28)] bg-[rgb(var(--theme-info-rgb)/0.12)] text-[rgb(var(--theme-text-primary-rgb))]'
                  : isToday
                    ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-soft-rgb))] text-[rgb(var(--theme-text-primary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                    : inCurrentMonth
                      ? 'border-[rgb(var(--theme-border-subtle-rgb)/0.75)] bg-transparent text-[rgb(var(--theme-text-secondary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                      : 'border-transparent bg-transparent text-[rgb(var(--theme-text-faint-rgb))] hover:border-[rgb(var(--theme-border-subtle-rgb)/0.55)] hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.6)]'
              }`}
            >
              {day.getUTCDate()}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] pt-3">
        <button
          type="button"
          onClick={() => onChange(getTodayIsoDate())}
          className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
        >
          Today
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange('')}
            className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
})
