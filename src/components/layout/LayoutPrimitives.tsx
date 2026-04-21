import { ButtonHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react'
import { Card } from '../ui/Card'

type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  width?: 'page' | 'wide' | 'reading'
}

const PAGE_CONTAINER_WIDTHS: Record<NonNullable<PageContainerProps['width']>, string> = {
  page: 'max-w-none',
  wide: 'max-w-none',
  reading: 'max-w-[760px]',
}

export function PageContainer({ width = 'page', className = '', ...props }: PageContainerProps) {
  return <div className={`mx-auto w-full px-4 sm:px-4 lg:px-4 2xl:px-5 ${PAGE_CONTAINER_WIDTHS[width]} ${className}`} {...props} />
}

export function ResponsiveGrid({
  columns = 'two',
  className = '',
  children,
}: {
  columns?: 'two' | 'two-uneven' | 'three'
  className?: string
  children: ReactNode
}) {
  const columnClassName =
    columns === 'three'
      ? 'md:grid-cols-2 2xl:grid-cols-3'
      : columns === 'two-uneven'
        ? 'xl:grid-cols-[1.05fr_0.95fr]'
        : 'xl:grid-cols-2'

  return <div className={`grid gap-5 ${columnClassName} ${className}`}>{children}</div>
}

export function SectionCard({
  className = '',
  compact = false,
  shell = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { compact?: boolean; shell?: 'default' | 'task' }) {
  return (
    <Card
      className={`${shell === 'task' ? 'rounded-[12px]' : ''} ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} ${className}`}
      {...props}
    />
  )
}

export function StickyPageHeaderShell({
  className = '',
  contentClassName = '',
  scrolled = false,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  contentClassName?: string
  scrolled?: boolean
}) {
  return (
    <div className={`bg-ink sticky top-0 z-30 -mx-1 px-1 ${className}`} {...props}>
      <div
        className={`relative flex items-center justify-between gap-3 border-b border-white/[0.05] px-1 transition-[padding] duration-150 ease-out ${
          scrolled ? 'py-3' : 'py-2'
        } ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  )
}

export function ControlsPanelShell({
  className = '',
  emphasis = 'default',
  scrollable = false,
  bodyClassName = '',
  footer,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  emphasis?: 'default' | 'strong'
  scrollable?: boolean
  bodyClassName?: string
  footer?: ReactNode
}) {
  const shellClassName =
    emphasis === 'strong'
      ? 'overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#1E1E22] p-3 shadow-[0_28px_68px_rgba(0,0,0,0.3),0_12px_28px_rgba(0,0,0,0.18)] transition-[box-shadow,border-color,transform] duration-200 hover:border-white/[0.12] hover:-translate-y-[1px] hover:shadow-[0_38px_92px_rgba(0,0,0,0.36),0_16px_36px_rgba(0,0,0,0.22)]'
      : 'overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
  const ownsPanelLayout = scrollable || Boolean(footer)

  return (
    <div className={`${shellClassName} ${ownsPanelLayout ? 'flex max-h-[calc(100vh-32px)] min-h-0 flex-col' : ''} ${className}`} {...props}>
      {scrollable ? (
        <ControlsPanelBody className={bodyClassName}>{children}</ControlsPanelBody>
      ) : (
        children
      )}
      {footer ? <PanelFooter>{footer}</PanelFooter> : null}
    </div>
  )
}

export function ControlsPanelBody({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`theme-scrollbar min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1 ${className}`}
      {...props}
    />
  )
}

export function PanelFooter({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-3 border-t border-white/[0.05] pt-3 ${className}`}
      {...props}
    />
  )
}

export function PanelSection({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <section className={`grid gap-2.5 ${className}`} {...props} />
}

export function PanelSectionTitle({
  className = '',
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-[11px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.55)] ${className}`}
      {...props}
    />
  )
}

export function PanelRow({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex min-h-9 items-center justify-between gap-3 ${className}`}
      {...props}
    />
  )
}

export function PanelFieldRow({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <PanelRow className={className} {...props} />
}

export function PanelActionRow({
  as = 'div',
  className = '',
  ...props
}: (HTMLAttributes<HTMLDivElement> | ButtonHTMLAttributes<HTMLButtonElement>) & {
  as?: 'div' | 'button'
}) {
  const Component = as
  return (
    <Component
      className={`flex min-h-[42px] w-full items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5 text-left transition hover:border-white/[0.08] hover:bg-white/[0.028] disabled:pointer-events-none disabled:opacity-35 ${className}`}
      {...(props as any)}
    />
  )
}

export function PanelSubToggleRow({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`flex min-h-7 items-center justify-between gap-3 px-1 py-1 ${className}`}
      {...props}
    />
  )
}

export function PanelRowLabel({
  as = 'p',
  className = '',
  ...props
}: (HTMLAttributes<HTMLParagraphElement> | LabelHTMLAttributes<HTMLLabelElement>) & {
  as?: 'p' | 'label'
}) {
  const Component = as
  return (
    <Component
      className={`min-w-0 text-[12px] text-[rgba(255,255,255,0.85)] ${className}`}
      {...(props as any)}
    />
  )
}
