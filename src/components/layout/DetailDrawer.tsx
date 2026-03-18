import { AnimatePresence, motion } from 'framer-motion'
import { ReactNode } from 'react'

export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  size = 'md',
  headerActions,
  children,
}: {
  open: boolean
  title: string
  subtitle: string
  onClose: () => void
  size?: 'md' | 'lg'
  headerActions?: ReactNode
  children: ReactNode
}) {
  const widthClassName = size === 'lg' ? 'w-[min(1080px,92vw)]' : 'w-[min(760px,88vw)]'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-20 bg-black/78 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className={`fixed left-1/2 top-[7vh] z-30 max-h-[86vh] -translate-x-1/2 overflow-hidden rounded-[32px] border border-[#2B2B2B] bg-[#0D0D0D] shadow-[0_35px_100px_rgba(0,0,0,0.62)] ${widthClassName}`}
            initial={{ y: 28, x: '-50%', opacity: 0.82, scale: 0.98 }}
            animate={{ y: 0, x: '-50%', opacity: 1, scale: 1 }}
            exit={{ y: 20, x: '-50%', opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
          >
            <div className="border-b border-[#232323] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8B8B8B]">{subtitle}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {headerActions}
                  <button
                    onClick={onClose}
                    className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[calc(86vh-92px)] overflow-y-auto bg-[#0D0D0D] px-6 py-5">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
