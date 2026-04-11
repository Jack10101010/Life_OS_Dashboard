import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BadHabitDefinition, LifeGoal, PageId } from '../../types'
import { DEFAULT_SIDEBAR_ITEMS } from '../../lib/sidebar'

type GoalSidebarSection =
  | {
      id: 'life-overview' | 'directional-overview'
      label: string
      selected: boolean
      categoryType: 'outcome' | 'directional'
      categories: string[]
      categoriesExpanded: boolean
    }
  | {
      id: 'habit-goals'
      label: string
      selected: boolean
    }

export function Sidebar({
  currentPage,
  collapsed,
  pageOrder,
  pageLabels,
  lifeGoals,
  goalsView,
  outcomeGoalCategoryFilter,
  directionalGoalCategoryFilter,
  selectedGoalType,
  onNavigate,
  onSetGoalsView,
  onSetOutcomeGoalCategoryFilter,
  onSetDirectionalGoalCategoryFilter,
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
  lifeGoals: LifeGoal[]
  goalsView: 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'
  outcomeGoalCategoryFilter: string | null
  directionalGoalCategoryFilter: string | null
  selectedGoalType?: 'outcome' | 'directional' | null
  onNavigate: (page: PageId) => void
  onSetGoalsView: (view: 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals') => void
  onSetOutcomeGoalCategoryFilter: (category: string | null) => void
  onSetDirectionalGoalCategoryFilter: (category: string | null) => void
  onToggleCollapsed: () => void
  onReorderPages: (nextOrder: PageId[]) => void
  onRenamePage: (page: PageId, label: string) => void
  badHabitStreaks: Array<{ habit: BadHabitDefinition; streak: number; startsToday?: boolean; brokenToday?: boolean }>
  showBadHabitTracking: boolean
}) {
  const [draggedPage, setDraggedPage] = useState<PageId | null>(null)
  const [renamingPage, setRenamingPage] = useState<PageId | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [goalsExpanded, setGoalsExpanded] = useState(currentPage === 'goals')
  const [outcomeCategoriesExpanded, setOutcomeCategoriesExpanded] = useState(true)
  const [directionalCategoriesExpanded, setDirectionalCategoriesExpanded] = useState(true)
  const items = useMemo(() => {
    const byId = new Map(DEFAULT_SIDEBAR_ITEMS.map((item) => [item.id, item]))
    const mergedOrder = [...pageOrder, ...DEFAULT_SIDEBAR_ITEMS.map((item) => item.id).filter((id) => !pageOrder.includes(id))]
    const orderedItems = mergedOrder
      .map((id) => byId.get(id))
      .filter((item): item is { id: PageId; label: string } => Boolean(item))
      .map((item) => ({
        ...item,
        label: pageLabels[item.id] ?? item.label,
      }))
    const analyticsItem = orderedItems.find((item) => item.id === 'analytics') ?? null
    const tasksItem = orderedItems.find((item) => item.id === 'tasks') ?? null
    const notesItem = orderedItems.find((item) => item.id === 'notes') ?? null

    const relabeledItems = orderedItems.map((item) =>
      item.id === 'tasks'
        ? { ...item, label: 'Priorities & Tasks' }
        : item.id === 'notes'
          ? { ...item, label: 'Notes & Reflections' }
          : item,
    )

    if (!analyticsItem || !tasksItem || !notesItem) {
      return relabeledItems
    }

    const withoutTaskBlock = relabeledItems.filter(
      (item) => item.id !== 'analytics' && item.id !== 'tasks' && item.id !== 'notes',
    )
    const analyticsInsertionIndex = relabeledItems.findIndex((item) => item.id === 'analytics')
    const nextItems = [...withoutTaskBlock]
    nextItems.splice(
      Math.max(0, analyticsInsertionIndex),
      0,
      analyticsItem,
      { ...tasksItem, label: 'Priorities & Tasks' },
      { ...notesItem, label: 'Notes & Reflections' },
    )

    return nextItems
  }, [pageLabels, pageOrder])
  const settingsItem = items.find((item) => item.id === 'settings') ?? null
  const primaryItems = items.filter((item) => item.id !== 'settings')
  const goalCategoriesByType = useMemo(() => {
    const collect = (goalType: 'outcome' | 'directional') =>
      [...new Set(
        lifeGoals
          .filter((goal) => !goal.archivedAt && (goal.goalType ?? 'outcome') === goalType)
          .map((goal) => goal.category.trim())
          .filter(Boolean),
      )].sort((left, right) => left.localeCompare(right))

    return {
      outcome: collect('outcome'),
      directional: collect('directional'),
    }
  }, [lifeGoals])
  const goalSections: GoalSidebarSection[] = [
    {
      id: 'life-overview',
      label: 'Outcome Goals',
      categoryType: 'outcome',
      categories: goalCategoriesByType.outcome,
      categoriesExpanded: outcomeCategoriesExpanded,
      selected:
        goalsView === 'life-overview' ||
        (goalsView === 'life-detail' && (selectedGoalType ?? 'outcome') === 'outcome'),
    },
    {
      id: 'directional-overview',
      label: 'Directional Goals',
      categoryType: 'directional',
      categories: goalCategoriesByType.directional,
      categoriesExpanded: directionalCategoriesExpanded,
      selected:
        goalsView === 'directional-overview' ||
        (goalsView === 'life-detail' && selectedGoalType === 'directional'),
    },
    { id: 'habit-goals', label: 'Habit Goals', selected: goalsView === 'habit-goals' },
  ]

  useEffect(() => {
    setGoalsExpanded(currentPage === 'goals')
  }, [currentPage])

  if (collapsed) {
    return (
      <aside className="relative h-0 shrink-0 lg:h-screen lg:w-0">
        <button
          onClick={onToggleCollapsed}
          className="theme-button-secondary fixed left-4 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-xl border text-sm shadow-[0_10px_30px_rgba(15,23,42,0.14)] transition lg:absolute lg:left-4 lg:top-6"
          aria-label="Expand sidebar"
        >
          &gt;
        </button>
      </aside>
    )
  }

  return (
      <aside className="theme-sidebar-surface flex h-auto w-full shrink-0 flex-col border-b px-3.5 py-5 transition-[width] duration-200 sm:px-5 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[224px] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r xl:w-[236px] 2xl:w-[248px]">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <p className="theme-text-faint text-[13px] font-semibold uppercase tracking-[0.28em]">Life Dashboard</p>
          <button
            onClick={onToggleCollapsed}
            className="theme-button-secondary rounded-xl border px-2.5 py-1.5 text-xs transition"
            aria-label="Collapse sidebar"
          >
            &lt;
          </button>
        </div>
        <div className="mt-4 h-px bg-[linear-gradient(90deg,rgb(var(--theme-border-subtle-rgb)/0.72)_0%,rgb(var(--theme-border-subtle-rgb)/0.18)_78%,transparent_100%)]" />
      </div>

      <nav className="grid gap-2 sm:grid-cols-2 lg:block lg:space-y-2">
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
              {item.id === 'goals' ? (
                <div className="space-y-0.5">
                  <button
                    draggable
                    onClick={() => {
                      if (currentPage === 'goals') {
                        setGoalsExpanded((current) => !current)
                        return
                      }
                      onSetGoalsView('life-overview')
                      onNavigate('goals')
                      setGoalsExpanded(true)
                    }}
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
                    className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                      goalsExpanded
                        ? 'border-transparent bg-transparent theme-text-primary'
                        : active
                          ? 'theme-nav-item-active'
                          : 'theme-nav-item border-transparent'
                    } ${draggedPage === item.id ? 'opacity-50' : ''}`}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    {goalsExpanded ? null : (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                          active ? 'bg-glow opacity-100' : 'bg-line opacity-0'
                        }`}
                      />
                    )}
                  </button>

                  <div
                    className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                      goalsExpanded ? 'mt-0.5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0">
                      <div className="space-y-0.5 pb-1 pl-6 pr-0.5">
                        {goalSections.map((goalSection) => {
                          const selected = currentPage === 'goals' && goalSection.selected
                          return (
                            <div key={goalSection.id} className="space-y-0.5">
                              <div className="flex min-w-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (goalSection.id === 'life-overview') onSetOutcomeGoalCategoryFilter(null)
                                    if (goalSection.id === 'directional-overview') onSetDirectionalGoalCategoryFilter(null)
                                    onSetGoalsView(goalSection.id as 'life-overview' | 'directional-overview' | 'habit-goals')
                                    onNavigate('goals')
                                  }}
                                  className="theme-nav-item flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left text-xs transition"
                                >
                                  <span className={`mt-[1px] h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-glow opacity-100' : 'bg-line opacity-35'}`} />
                                  <span
                                    className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${selected ? 'theme-text-primary font-medium' : 'theme-text-muted'}`}
                                    title={goalSection.label}
                                  >
                                    {goalSection.label}
                                  </span>
                                </button>
                                {'categoryType' in goalSection && goalSection.categories.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (goalSection.categoryType === 'outcome') {
                                        setOutcomeCategoriesExpanded((current) => !current)
                                      } else {
                                        setDirectionalCategoriesExpanded((current) => !current)
                                      }
                                    }}
                                    className="theme-nav-item inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[11px] theme-text-muted transition"
                                    aria-label={goalSection.categoriesExpanded ? 'Collapse categories' : 'Expand categories'}
                                  >
                                    <span className={`transition-transform duration-150 ${goalSection.categoriesExpanded ? 'rotate-90' : ''}`}>&gt;</span>
                                  </button>
                                ) : null}
                              </div>

                              {'categoryType' in goalSection && goalSection.categories.length > 0 ? (
                                <div
                                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out ${
                                    goalSection.categoriesExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                  }`}
                                >
                                  <div className="min-h-0">
                                    <div className="ml-3 border-l border-white/[0.05] pl-3">
                                      {goalSection.categories.map((category) => {
                                        const categorySelected =
                                          goalSection.categoryType === 'outcome'
                                            ? outcomeGoalCategoryFilter === category && goalsView === 'life-overview'
                                            : directionalGoalCategoryFilter === category && goalsView === 'directional-overview'
                                        return (
                                          <button
                                            key={`${goalSection.id}-${category}`}
                                            type="button"
                                            onClick={() => {
                                              if (goalSection.categoryType === 'outcome') {
                                                onSetOutcomeGoalCategoryFilter(category)
                                              } else {
                                                onSetDirectionalGoalCategoryFilter(category)
                                              }
                                              onSetGoalsView(goalSection.id as 'life-overview' | 'directional-overview')
                                              onNavigate('goals')
                                            }}
                                            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
                                          >
                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${categorySelected ? 'bg-glow opacity-90' : 'bg-line opacity-30'}`} />
                                            <span className={`min-w-0 truncate text-[12px] ${categorySelected ? 'theme-text-primary' : 'theme-text-muted'}`}>
                                              {category}
                                            </span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              <div
                className="space-y-1 rounded-[20px] transition"
              >
                <button
                  draggable
                  onClick={() => {
                    onNavigate(item.id)
                  }}
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
                  className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                    active
                      ? 'theme-nav-item-active'
                      : 'theme-nav-item border-transparent'
                  } ${draggedPage === item.id ? 'opacity-50' : ''}`}
                  >
                    <span className="min-w-0 truncate">{item.label}</span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                        active ? 'bg-glow opacity-100' : 'bg-line opacity-0'
                      }`}
                    />
                  </button>
                </div>
              )}

              {isRenaming ? (
                <form
                  onSubmit={handleRenameSubmit}
                  className="theme-popover absolute left-[calc(100%+10px)] top-1/2 z-40 flex w-[220px] -translate-y-1/2 items-center gap-2 rounded-2xl border p-2 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
                >
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    spellCheck={true}
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
                    className="theme-input min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="theme-button-secondary rounded-xl border px-3 py-2 text-xs font-semibold transition"
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
              className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-3 text-left text-sm font-medium transition ${
                currentPage === settingsItem.id
                  ? 'theme-nav-item-active'
                  : 'theme-nav-item border-transparent'
              }`}
            >
              <span className="min-w-0 truncate">{settingsItem.label}</span>
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${
                  currentPage === settingsItem.id ? 'bg-glow opacity-100' : 'bg-line opacity-0'
                }`}
              />
            </button>
          </div>
        ) : null}

        {showBadHabitTracking ? (
          <div className="theme-surface-soft space-y-3 rounded-3xl border p-4">
            {badHabitStreaks.map(({ habit, streak, startsToday, brokenToday }) => (
              <div key={habit.id}>
                <p className="theme-text-faint text-[11px] uppercase tracking-[0.22em]">{getBadHabitStreakLabel(habit.name)}</p>
                <p className="theme-text-primary mt-2 text-2xl font-semibold">
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
