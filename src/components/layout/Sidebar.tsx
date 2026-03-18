import { FormEvent, useMemo, useState } from 'react'
import { PageId } from '../../types'
import { DEFAULT_SIDEBAR_ITEMS } from '../../lib/sidebar'
import { Button } from '../ui/Button'

export function Sidebar({
  currentPage,
  collapsed,
  pageOrder,
  pageLabels,
  onNavigate,
  onToggleCollapsed,
  onReorderPages,
  onRenamePage,
  currentStreak,
  momentumScore,
  onQuickAdd,
}: {
  currentPage: PageId
  collapsed: boolean
  pageOrder: PageId[]
  pageLabels: Record<PageId, string>
  onNavigate: (page: PageId) => void
  onToggleCollapsed: () => void
  onReorderPages: (nextOrder: PageId[]) => void
  onRenamePage: (page: PageId, label: string) => void
  currentStreak: number
  momentumScore: number
  onQuickAdd: () => void
}) {
  const [draggedPage, setDraggedPage] = useState<PageId | null>(null)
  const [renamingPage, setRenamingPage] = useState<PageId | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const items = useMemo(() => {
    const byId = new Map(DEFAULT_SIDEBAR_ITEMS.map((item) => [item.id, item]))
    const mergedOrder = [...pageOrder, ...DEFAULT_SIDEBAR_ITEMS.map((item) => item.id).filter((id) => !pageOrder.includes(id))]
    return mergedOrder
      .map((id) => byId.get(id))
      .filter((item): item is { id: PageId; label: string } => Boolean(item))
      .map((item) => ({
        ...item,
        label: pageLabels[item.id] ?? item.label,
      }))
  }, [pageLabels, pageOrder])

  if (collapsed) {
    return (
      <aside className="relative h-screen w-0">
        <button
          onClick={onToggleCollapsed}
          className="absolute left-4 top-6 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-[#2A2A2A] bg-[#171717] text-sm text-[#B0B0B0] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-[#242424] hover:text-white"
          aria-label="Expand sidebar"
        >
          &gt;
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex h-screen w-[260px] flex-col border-r border-[#262626] bg-[#171717] px-4 py-6 transition-[width] duration-200">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.32em] text-[#A8A8A8]">Life Dashboard</p>
          <button
            onClick={onToggleCollapsed}
            className="rounded-xl border border-[#2A2A2A] bg-[#1C1C1C] px-2.5 py-1.5 text-xs text-[#B0B0B0] transition hover:bg-[#242424] hover:text-white"
            aria-label="Collapse sidebar"
          >
            &lt;
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-white">Quiet signal, clearer weeks.</h1>
      </div>

      <nav className="space-y-1.5">
        {items.map((item) => {
          const active = currentPage === item.id
          const isRenaming = renamingPage === item.id

          const handleRenameSubmit = (event: FormEvent) => {
            event.preventDefault()
            const trimmed = renameValue.trim()
            if (!trimmed) return
            onRenamePage(item.id, trimmed)
            setRenamingPage(null)
          }

          return (
            <div key={item.id} className="relative">
              <button
                draggable
                onClick={() => onNavigate(item.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setRenamingPage(item.id)
                  setRenameValue(item.label)
                }}
                onDragStart={() => setDraggedPage(item.id)}
                onDragEnd={() => setDraggedPage(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedPage || draggedPage === item.id) return
                  const nextOrder = [...pageOrder]
                  const fromIndex = nextOrder.indexOf(draggedPage)
                  const toIndex = nextOrder.indexOf(item.id)
                  if (fromIndex === -1 || toIndex === -1) return
                  nextOrder.splice(fromIndex, 1)
                  nextOrder.splice(toIndex, 0, draggedPage)
                  onReorderPages(nextOrder)
                  setDraggedPage(null)
                }}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                  active ? 'bg-[#2A2A2A] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]' : 'text-[#A3A3A3] hover:bg-[#202020] hover:text-white'
                } ${draggedPage === item.id ? 'opacity-50' : ''}`}
              >
                {item.label}
                {active ? <span className="h-2 w-2 rounded-full bg-glow" /> : null}
              </button>

              {isRenaming ? (
                <form
                  onSubmit={handleRenameSubmit}
                  className="absolute left-[calc(100%+10px)] top-1/2 z-40 flex w-[220px] -translate-y-1/2 items-center gap-2 rounded-2xl border border-[#2A2A2A] bg-[#171717] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        onRenamePage(item.id, renameValue.trim())
                      }
                      setRenamingPage(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setRenamingPage(null)
                      }
                    }}
                    className="min-w-0 flex-1 rounded-xl border border-[#2A2A2A] bg-[#1D1D1D] px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl border border-[#2A2A2A] bg-[#222222] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2A2A2A]"
                  >
                    Save
                  </button>
                </form>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="mt-auto space-y-3 rounded-3xl border border-[#2A2A2A] bg-[#181818] p-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8D8D8D]">Alcohol-free streak</p>
          <p className="mt-2 text-2xl font-semibold text-white">{`${currentStreak} days`}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8D8D8D]">Momentum score</p>
          <p className="mt-2 text-2xl font-semibold text-white">{momentumScore}</p>
        </div>
        <Button variant="primary" className="w-full" onClick={onQuickAdd}>
          Quick add
        </Button>
      </div>
    </aside>
  )
}
