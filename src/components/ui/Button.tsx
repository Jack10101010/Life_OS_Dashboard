import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'soft'
}

export function Button({ className = '', variant = 'ghost', ...props }: ButtonProps) {
  const styles = {
    primary: 'text-[var(--button-primary-text)]',
    ghost: 'text-[rgb(var(--theme-button-ghost-text-rgb))]',
    soft: 'text-[rgb(var(--theme-button-secondary-text-rgb))]',
  }

  return (
    <button
      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`}
      style={{
        borderColor: 'var(--button-border)',
        backgroundColor:
          variant === 'primary'
            ? 'var(--button-primary-bg)'
            : variant === 'soft'
              ? 'var(--button-soft-bg)'
              : 'var(--button-ghost-bg)',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor =
          variant === 'primary'
            ? 'var(--button-primary-hover-bg)'
            : variant === 'soft'
              ? 'var(--button-soft-hover-bg)'
              : 'var(--button-ghost-hover-bg)'
      }}
      onMouseLeave={(event) => {
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
