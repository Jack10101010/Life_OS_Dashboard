import { HTMLAttributes, ReactNode } from 'react'
import { Card } from '../ui/Card'

type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  width?: 'page' | 'wide' | 'reading'
}

const PAGE_CONTAINER_WIDTHS: Record<NonNullable<PageContainerProps['width']>, string> = {
  page: 'max-w-[1440px]',
  wide: 'max-w-[1760px]',
  reading: 'max-w-[760px]',
}

export function PageContainer({ width = 'page', className = '', ...props }: PageContainerProps) {
  return <div className={`mx-auto w-full px-4 sm:px-5 lg:px-8 2xl:px-10 ${PAGE_CONTAINER_WIDTHS[width]} ${className}`} {...props} />
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

export function SectionCard({ className = '', compact = false, ...props }: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return <Card className={`${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'} ${className}`} {...props} />
}
