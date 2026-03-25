import { FormEvent, useMemo, useState } from 'react'
import { BadHabitDefinition, PageId } from '../../types'
import { DEFAULT_SIDEBAR_ITEMS } from '../../lib/sidebar'

export function Sidebar({
  currentPage,
  collapsed,
  pageOrder,
  pageLabels,
  onNavigate,
  onToggleCollapsed,
  onReorderPages,
  onRenamePage,
  badHabitStreaks,
  showBadHabitTracking,
}: {
  currentPage: PageId
  collapsed: boolean
  pageOrder: PageId[]
  pageLabels: Record<PageId, string>
  onNavigate: (page: PageId) => void
  onToggleCollapsed: () => void
  onReorderPages: (nextOrder: PageId[]) => void
  onRenamePage: (page: PageId, label: string) => void
  badHabitStreaks: Array<{ habit: BadHabitDefinition; streak: number; startsToday?: boolean; brokenToday?: boolean }>
  showBadHabitTracking: boolean
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
  const settingsItem = items.find((item) => item.id === 'settings') ?? null
  const primaryItems = items.filter((item) => item.id !== 'settings')

  if (collapsed) {
    return (
      <aside className="relative h-0 shrink-0 lg:h-screen lg:w-0">
        <button
          onClick={onToggleCollapsed}
          className="fixed left-4 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-[#2A2A2A] bg-[#171717] text-sm text-[#B0B0B0] shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-[#242424] hover:text-white lg:absolute lg:left-4 lg:top-6"
          aria-label="Expand sidebar"
        >
          &gt;
        </button>
      </aside>
    )
  }

  return (
      <aside className="flex h-auto w-full shrink-0 flex-col border-b border-[#262626] bg-[#171717] px-3.5 py-5 transition-[width] duration-200 sm:px-5 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[224px] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r xl:w-[236px] 2xl:w-[248px]">
      <div className="mb-7">
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
        <h1 className="mt-2.5 text-[26px] font-semibold leading-[1.1] text-white">Quiet signal, clearer weeks.</h1>
      </div>

      <nav className="grid gap-1 sm:grid-cols-2 lg:block lg:space-y-1">
        {primaryItems.map((item) => {
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
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-[#232323] text-white shadow-[0_8px_22px_rgba(0,0,0,0.16),inset_0_0_0_1px_rgba(255,255,255,0.035)]'
                    : 'text-[#8F8F8F] hover:bg-[#1D1D1D] hover:text-[#E6E6E6]'
                } ${draggedPage === item.id ? 'opacity-50' : ''}`}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                    active ? 'bg-glow opacity-100' : 'bg-white/20 opacity-0'
                  }`}
                />
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

      <div className="mt-6 lg:mt-auto">
        {settingsItem ? (
          <div className="mb-3">
            <button
              onClick={() => onNavigate(settingsItem.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                setRenamingPage(settingsItem.id)
                setRenameValue(settingsItem.label)
              }}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                currentPage === settingsItem.id
                  ? 'bg-[#232323] text-white shadow-[0_8px_22px_rgba(0,0,0,0.16),inset_0_0_0_1px_rgba(255,255,255,0.035)]'
                  : 'text-[#8F8F8F] hover:bg-[#1D1D1D] hover:text-[#E6E6E6]'
              }`}
            >
              <span className="min-w-0 truncate">{settingsItem.label}</span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                  currentPage === settingsItem.id ? 'bg-glow opacity-100' : 'bg-white/20 opacity-0'
                }`}
              />
            </button>
          </div>
        ) : null}

        {showBadHabitTracking ? (
          <div className="space-y-3 rounded-3xl border border-[#2A2A2A] bg-[#181818] p-4">
            {badHabitStreaks.map(({ habit, streak, startsToday, brokenToday }) => (
              <div key={habit.id}>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8D8D8D]">{getBadHabitStreakLabel(habit.name)}</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {startsToday ? 'Starts today' : brokenToday ? '0 days' : `${streak} days`}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function getBadHabitStreakLabel(name: string) {
  const normalized = name.trim().toLowerCase()
  if (normalized === 'alcohol') return 'Alcohol-free streak'
  if (normalized === 'nicotine') return 'Nicotine-free streak'
  return `${name} streak`
}
