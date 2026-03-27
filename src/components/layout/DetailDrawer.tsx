import { AnimatePresence, motion } from 'framer-motion'
import { ReactNode, RefObject } from 'react'

export function DetailDrawer({
  open,
  title,
  description,
  subtitle,
  onClose,
  size = 'md',
  headerActions,
  bodyRef,
  children,
}: {
  open: boolean
  title: string
  description?: string
  subtitle: string
  onClose: () => void
  size?: 'md' | 'lg'
  headerActions?: ReactNode
  bodyRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}) {
  const widthClassName = size === 'lg' ? 'w-[min(940px,92vw)]' : 'w-[min(760px,88vw)]'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-20 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={`theme-popover fixed left-1/2 top-[7vh] z-30 max-h-[86vh] -translate-x-1/2 overflow-hidden rounded-[32px] border shadow-[0_35px_100px_rgba(15,23,42,0.22)] ${widthClassName}`}
            initial={{ y: 28, x: '-50%', opacity: 0.82, scale: 0.98 }}
            animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }}
            exit={{ y: 20, x: '-50%', opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
          >
            <div className="theme-border-subtle border-b px-7 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="theme-text-faint text-xs uppercase tracking-[0.22em]">{subtitle}</p>
                  <h3 className="theme-text-primary mt-2 text-2xl font-semibold">{title}</h3>
                  {description ? <p className="theme-text-muted mt-2 max-w-[680px] text-sm leading-6">{description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {headerActions}
                  <button
                    onClick={onClose}
                    className="theme-button-secondary rounded-full border px-3 py-1.5 text-sm transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div ref={bodyRef} className="max-h-[calc(86vh-92px)] overflow-y-auto overscroll-contain px-7 py-5">
              {children}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
