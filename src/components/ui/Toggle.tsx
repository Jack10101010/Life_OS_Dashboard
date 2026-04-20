import { ButtonHTMLAttributes } from 'react'

type ToggleVariant = 'neutral' | 'accent'
type ToggleTrack = 'filled' | 'outline'

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  variant?: ToggleVariant
  track?: ToggleTrack
}

export default function Toggle({
  checked,
  onChange,
  variant = 'neutral',
  track = 'filled',
  type = 'button',
  className = '',
  disabled = false,
  ...props
}: ToggleProps) {
  const baseClassName = 'inline-flex h-5 w-9 rounded-full border p-[2px] transition'
  const trackClassName = checked
    ? track === 'outline'
      ? 'border-white/[0.12] bg-transparent'
      : 'border-white/[0.12] bg-white/[0.08]'
    : 'border-white/[0.06] bg-transparent'
  const thumbClassName =
    variant === 'accent'
      ? `h-full w-4 rounded-full transition ${checked ? 'translate-x-[14px] bg-[rgb(var(--theme-accent-rgb)/0.88)]' : 'bg-white/70'}`
      : `h-full w-4 rounded-full bg-white/70 transition ${checked ? 'translate-x-[14px]' : ''}`

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onChange(!checked)
      }}
      className={`${baseClassName} ${trackClassName} ${className}`}
      {...props}
    >
      <span className={thumbClassName} />
    </button>
  )
}
