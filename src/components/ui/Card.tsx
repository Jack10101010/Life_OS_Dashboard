import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`theme-card rounded-3xl border p-5 shadow-panel ring-1 ring-[var(--panel-hue-line)] ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow: 'var(--theme-card-shadow)',
      }}
      {...props}
    />
  )
}
