import { AnimatePresence, motion } from 'framer-motion'
import { ReactNode, RefObject, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type FloatingPanelPosition = {
  top: number
  left: number
  width: number
}

export function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

export function getFloatingPanelPosition(
  anchor: HTMLElement,
  {
    minWidth = 0,
    preferredWidth,
    estimatedHeight,
    respectAnchorWidth = true,
  }: { minWidth?: number; preferredWidth?: number; estimatedHeight: number; respectAnchorWidth?: boolean },
): FloatingPanelPosition {
  const rect = anchor.getBoundingClientRect()
  const viewportPadding = 16
  const gap = 8
  const anchorWidthFloor = respectAnchorWidth ? rect.width : 0
  const width = Math.min(
    Math.max(preferredWidth ?? rect.width, minWidth, anchorWidthFloor),
    window.innerWidth - viewportPadding * 2,
  )
  const left = Math.min(
    Math.max(viewportPadding, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - viewportPadding - width,
  )
  const availableBelow = window.innerHeight - viewportPadding - (rect.bottom + gap)
  const availableAbove = rect.top - gap - viewportPadding
  const canFitBelow = availableBelow >= estimatedHeight
  const canFitAbove = availableAbove >= estimatedHeight
  const preferAbove = !canFitBelow && canFitAbove
  const preferredTop = preferAbove ? rect.top - gap - estimatedHeight : rect.bottom + gap
  const minTop = viewportPadding
  const maxTop = Math.max(minTop, window.innerHeight - viewportPadding - estimatedHeight)
  const top = Math.min(Math.max(preferredTop, minTop), maxTop)

  return { top, left, width }
}

export function useOverlayScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [active])
}

export function useReturnFocusOnClose<T extends HTMLElement>(
  active: boolean,
  returnFocusRef: RefObject<T | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    if (active) return
    const target = returnFocusRef.current
    if (!target) return
    const frame = window.requestAnimationFrame(() => target.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [active, returnFocusRef, ...deps])
}

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  containerRef: RefObject<T | null>,
  {
    onEscape,
  }: {
    onEscape?: () => void
  } = {},
) {
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault()
          onEscape()
        }
        return
      }

      if (event.key !== 'Tab' || !containerRef.current) return

      const focusable = getFocusableElements(containerRef.current)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!activeElement || activeElement === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (!activeElement || activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [active, containerRef, onEscape])
}

export function OverlayRoot({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open || typeof document === 'undefined') return null
  return createPortal(<AnimatePresence>{children}</AnimatePresence>, document.body)
}

export function OverlayBackdrop({
  zIndexClassName,
  className,
  onClick,
}: {
  zIndexClassName: string
  className: string
  onClick?: () => void
}) {
  return (
    <motion.div
      className={`fixed inset-0 ${zIndexClassName} ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      onClick={onClick}
    />
  )
}

export function ModalSurface({
  zIndexClassName,
  containerClassName,
  panelClassName,
  onBackdropClick,
  children,
}: {
  zIndexClassName: string
  containerClassName?: string
  panelClassName: string
  onBackdropClick?: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      className={`fixed inset-0 ${zIndexClassName} ${containerClassName ?? 'grid place-items-center px-4 py-6 sm:px-6 sm:py-8'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      onClick={onBackdropClick}
    >
      <motion.div
        className={panelClassName}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.985 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export function DialogSurface(props: Parameters<typeof ModalSurface>[0]) {
  return <ModalSurface {...props} />
}

export function PopoverSurface({
  position,
  zIndexClassName,
  className,
  children,
}: {
  position: FloatingPanelPosition
  zIndexClassName: string
  className: string
  children: ReactNode
}) {
  return (
    <div
      className={`fixed ${zIndexClassName} ${className}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
    >
      {children}
    </div>
  )
}
