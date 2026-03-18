import { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-panel ring-1 ring-[var(--panel-hue-line)] ${className}`}
      style={{
        backgroundColor: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow:
          '0 0 0 1px var(--panel-hue-line), 0 0 34px var(--panel-hue-glow), 0 22px 50px rgba(0, 0, 0, 0.35)',
      }}
      {...props}
    />
  )
}
