import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'soft' | 'inline-muted' | 'panel-link'
}

export function Button({ className = '', variant = 'ghost', ...props }: ButtonProps) {
  const styles = {
    primary: 'rounded-2xl border px-4 py-2 text-sm font-semibold transition text-[var(--button-primary-text)]',
    ghost: 'rounded-2xl border px-4 py-2 text-sm font-semibold transition text-[rgb(var(--theme-button-ghost-text-rgb))]',
    soft: 'rounded-2xl border px-4 py-2 text-sm font-semibold transition text-[rgb(var(--theme-button-secondary-text-rgb))]',
    'inline-muted': 'transition text-zinc-600 hover:text-zinc-400',
    'panel-link': 'text-[12px] text-[rgba(255,255,255,0.85)] transition hover:text-white/82',
  }
  const usesSurfaceBackground = variant === 'primary' || variant === 'ghost' || variant === 'soft'

  return (
    <button
      className={`${styles[variant]} ${className}`}
      style={
        usesSurfaceBackground
          ? {
              borderColor: 'var(--button-border)',
              backgroundColor:
                variant === 'primary'
                  ? 'var(--button-primary-bg)'
                  : variant === 'soft'
                    ? 'var(--button-soft-bg)'
                    : 'var(--button-ghost-bg)',
            }
          : undefined
      }
      onMouseEnter={(event) => {
        if (!usesSurfaceBackground) return
        event.currentTarget.style.backgroundColor =
          variant === 'primary'
            ? 'var(--button-primary-hover-bg)'
            : variant === 'soft'
              ? 'var(--button-soft-hover-bg)'
              : 'var(--button-ghost-hover-bg)'
      }}
      onMouseLeave={(event) => {
        if (!usesSurfaceBackground) return
        event.currentTarget.style.backgroundColor =
          variant === 'primary'
            ? 'var(--button-primary-bg)'
            : variant === 'soft'
              ? 'var(--button-soft-bg)'
              : 'var(--button-ghost-bg)'
      }}
      {...props}
    />
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  ariaLabel: string
  title?: string
  variant?: 'plain' | 'muted'
  size?: 'default' | 'sm'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, ariaLabel, className = '', title, type = 'button', variant = 'plain', size = 'default', ...props },
  ref,
) {
  const variantClassName = variant === 'muted' ? 'text-zinc-600 hover:text-zinc-400' : ''
  const sizeClassName = size === 'sm' ? 'p-1' : ''

  return (
    <button
      ref={ref}
      type={type}
      aria-label={ariaLabel}
      title={title}
      className={`inline-flex items-center justify-center transition-colors ${variantClassName} ${sizeClassName} ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
})
