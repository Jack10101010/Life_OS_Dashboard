import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Download,
  FileText,
  Flame,
  Heart,
  LayoutDashboard,
  ListTodo,
  Pin,
  PinOff,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Upload,
  User,
  Plug,
} from 'lucide-react'
import type { PageId } from '../../types'

type GoalsView = 'life-overview' | 'directional-overview' | 'life-detail' | 'habit-goals'

export type SidebarTodayTask = {
  id: string
  text: string
  dueDate: string | null
  priority: 'none' | 'low' | 'medium' | 'high'
}

export type SidebarFocusTask = {
  id: string
  text: string
  dueDate: string | null
  priority: 'none' | 'low' | 'medium' | 'high'
  starred?: boolean
}

export type SidebarBadHabitStreak = {
  label: string
  streak: number
}

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  page?: PageId
  action?: 'today' | 'focus' | 'calendar' | 'patterns'
  children?: Array<{ id: string; label: string; icon: React.ElementType; page: PageId; goalsView?: GoalsView }>
}

type TodayViewMode = 'compact' | 'card'

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' },
  { id: 'today', label: 'Today', icon: Sun, action: 'today' },
  { id: 'focus', label: 'Focus', icon: Crosshair, action: 'focus' },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, page: 'tasks' },
  {
    id: 'goals',
    label: 'Goals',
    icon: Target,
    page: 'goals',
    children: [
      { id: 'outcome-goals', label: 'Outcome Goals', icon: Target, page: 'goals', goalsView: 'life-overview' },
      { id: 'directional-goals', label: 'Directional Goals', icon: Crosshair, page: 'goals', goalsView: 'directional-overview' },
      { id: 'habit-goals', label: 'Habit Goals', icon: Heart, page: 'goals', goalsView: 'habit-goals' },
    ],
  },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, action: 'calendar' },
  {
    id: 'patterns',
    label: 'Patterns',
    icon: Activity,
    action: 'patterns',
    children: [
      { id: 'tracker', label: 'Tracker', icon: Heart, page: 'tracker' },
      { id: 'habit-maps', label: 'Habit Maps', icon: BarChart3, page: 'habit-maps' },
    ],
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: BookOpen,
    page: 'journal-recordings',
    children: [{ id: 'your-days', label: 'Your Days', icon: FileText, page: 'your-days' }],
  },
  { id: 'insights', label: 'Insights', icon: Sparkles, page: 'analytics' },
]

function WorkspaceDropdown({
  open,
  onClose,
  onSelectSettings,
}: {
  open: boolean
  onClose: () => void
  onSelectSettings: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose])

  if (!open) return null

  const items = [
    { icon: Settings, label: 'Settings', hint: '⌘,' },
    { icon: Plug, label: 'Integrations', hint: '' },
    { icon: User, label: 'Account', hint: '' },
    { icon: Download, label: 'Import', hint: '' },
    { icon: Upload, label: 'Export', hint: '' },
  ]

  return (
    <div
      ref={ref}
      className="theme-surface-elevated absolute left-3 top-full mt-1.5 z-[60] w-[200px] rounded-xl border border-white/[0.06] py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-top-2 duration-150"
    >
      <div className="border-b border-zinc-800/60 px-3 py-2">
        <p className="text-[11px] font-semibold text-white">LifeOS</p>
        <p className="mt-0.5 text-[10px] text-white/45">Personal workspace</p>
      </div>
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            if (item.label === 'Settings') {
              onSelectSettings()
            }
            onClose()
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-white/75 transition-colors hover:bg-zinc-800/50 hover:text-white/92"
        >
          <item.icon className="h-3.5 w-3.5 text-white/50" />
          <span className="flex-1 text-left">{item.label}</span>
          {item.hint ? <span className="text-[10px] text-white/45">{item.hint}</span> : null}
        </button>
      ))}
    </div>
  )
}

function TodayEmptyState({ mode }: { mode: TodayViewMode }) {
  if (mode === 'card') {
    return (
      <div className="rounded-lg border border-zinc-800/50 px-2.5 py-3 surface-2">
        <p className="text-[11px] text-white/70">No Today tasks wired yet.</p>
        <p className="mt-1 text-[10px] text-white/40">TODO: connect this block to existing task data.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg px-2 py-2 text-[11px] text-white/70 transition-colors hover:bg-zinc-800/25">
      No Today tasks wired yet.
    </div>
  )
}

function getTodayTaskMeta(task: SidebarTodayTask, todayIso: string) {
  if (!task.dueDate) return null
  if (task.dueDate < todayIso) return 'Overdue'
  if (task.dueDate === todayIso) return 'Due today'
  return null
}

function getFocusTaskMeta(task: SidebarFocusTask, todayIso: string) {
  if (task.starred) return 'Current focus'
  if (!task.dueDate) return task.priority === 'high' ? 'High priority' : null
  if (task.dueDate < todayIso) return 'Overdue'
  if (task.dueDate === todayIso) return 'Due today'
  return task.priority === 'high' ? 'High priority' : null
}

export function Sidebar({
  page,
  setPage,
  goalsView,
  setGoalsView,
  openToday,
  sidebarCollapsed,
  setSidebarCollapsed,
  todayTasks,
  todayTaskCount,
  focusTask,
  showBadHabitStreak,
  badHabitStreak,
  onCompleteTodayTask,
}: {
  page: PageId
  setPage: (page: PageId) => void
  goalsView: GoalsView
  setGoalsView: Dispatch<SetStateAction<GoalsView>>
  openToday: (openFullNote: boolean, setPage: (page: PageId) => void) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>
  todayTasks: SidebarTodayTask[]
  todayTaskCount: number
  focusTask: SidebarFocusTask | null
  showBadHabitStreak: boolean
  badHabitStreak: SidebarBadHabitStreak | null
  onCompleteTodayTask: (taskId: string) => void
}) {
  const [pinned, setPinned] = useState(!sidebarCollapsed)
  const [hoverExpanded, setHoverExpanded] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [goalsOpen, setGoalsOpen] = useState(page === 'goals')
  const [patternsOpen, setPatternsOpen] = useState(page === 'tracker' || page === 'habit-maps')
  const [journalOpen, setJournalOpen] = useState(page === 'journal-recordings' || page === 'your-days')
  const [todayViewMode, setTodayViewMode] = useState<TodayViewMode>('compact')
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isExpanded = !sidebarCollapsed || hoverExpanded
  const sidebarWidth = isExpanded ? 'lg:w-[260px]' : 'lg:w-[60px]'
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    if (!sidebarCollapsed) {
      setHoverExpanded(false)
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    if (page === 'goals') {
      setGoalsOpen(true)
    }
    if (page === 'tracker' || page === 'habit-maps') {
      setPatternsOpen(true)
    }
    if (page === 'journal-recordings' || page === 'your-days') {
      setJournalOpen(true)
    }
  }, [page])

  const activeId = useMemo(() => {
    if (page === 'analytics') return 'insights'
    if (page === 'journal-recordings' || page === 'your-days') return 'journal'
    if (page === 'tracker' || page === 'habit-maps') return 'patterns'
    return page
  }, [page])

  const handleMouseEnter = () => {
    if (sidebarCollapsed && !pinned) {
      hoverTimeoutRef.current = setTimeout(() => {
        setHoverExpanded(true)
      }, 200)
    }
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoverExpanded(false)
    setWorkspaceOpen(false)
  }

  const toggleExpanded = () => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false)
      setPinned(true)
    } else {
      setSidebarCollapsed(true)
      setPinned(false)
    }
    setHoverExpanded(false)
  }

  const togglePin = () => {
    if (pinned) {
      setPinned(false)
      setSidebarCollapsed(true)
    } else {
      setPinned(true)
      setSidebarCollapsed(false)
    }
  }

  const handleNavClick = (item: NavItem) => {
    if (item.id === 'goals') {
      if (page === 'goals') {
        setGoalsOpen((current) => !current)
      } else {
        setPage('goals')
        setGoalsView('life-overview')
        setGoalsOpen(true)
      }
      return
    }

    if (item.id === 'patterns') {
      setPatternsOpen((current) => !current)
      return
    }

    if (item.id === 'journal' && item.children) {
      setPage('journal-recordings')
      setJournalOpen((current) => !current)
      return
    }

    if (item.action === 'today') {
      openToday(false, setPage)
      return
    }

    if (item.action === 'focus' || item.action === 'calendar') {
      return
    }

    if (item.page) {
      setPage(item.page)
    }
  }

  const handleOpenTaskList = () => {
    setPage('tasks')
  }

  const handleGoalChildClick = (nextGoalsView: GoalsView) => {
    setPage('goals')
    setGoalsView(nextGoalsView)
    setGoalsOpen(true)
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`surface-1 relative z-20 flex h-auto w-full flex-col border-b border-zinc-800/60 transition-all duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:self-start lg:border-b-0 lg:border-r ${sidebarWidth} ${hoverExpanded && sidebarCollapsed ? 'shadow-2xl shadow-black/60' : ''}`}
    >
      <div className="relative px-3 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => isExpanded && setWorkspaceOpen((current) => !current)}
            className={`group flex items-center gap-2.5 transition-colors ${isExpanded ? 'rounded-lg px-1.5 py-1.5 hover:bg-zinc-800/30' : 'w-full justify-center px-0 py-1.5'}`}
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            {isExpanded ? (
              <div className="flex flex-col items-start">
                <span className="text-[13px] font-semibold leading-none text-white">LifeOS</span>
                <span className="mt-0.5 text-[9px] text-white/45">Personal</span>
              </div>
            ) : null}
          </button>

          {isExpanded ? (
            <div className="flex items-center gap-0.5">
              <button
                onClick={togglePin}
                className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-zinc-800/30 hover:text-white/80"
                title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
              </button>
              <button
                onClick={toggleExpanded}
                className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-zinc-800/30 hover:text-white/80"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <button
              onClick={toggleExpanded}
              className="absolute right-1.5 top-4 rounded-md p-1 text-white/50 transition-colors hover:bg-zinc-800/30 hover:text-white/80"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <WorkspaceDropdown
          open={workspaceOpen && isExpanded}
          onClose={() => setWorkspaceOpen(false)}
          onSelectSettings={() => setPage('settings')}
        />
      </div>

      <div className="mx-3 h-px bg-zinc-800/40" />

      <div className="sidebar-scroll flex-1 overflow-x-hidden overflow-y-auto px-2 py-2">
        <nav className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeId === item.id
            const Icon = item.icon
            const hasChildren = Boolean(item.children?.length)
            const childrenOpen =
              item.id === 'goals'
                ? goalsOpen
                : item.id === 'patterns'
                  ? patternsOpen
                  : item.id === 'journal'
                    ? journalOpen
                    : false

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleNavClick(item)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg border transition-all duration-200 ${isExpanded ? 'px-2.5 py-[7px]' : 'justify-center px-0 py-[7px]'} ${isActive ? 'border-zinc-700/40 bg-zinc-800/30 text-white' : 'border-transparent text-white/75 hover:bg-zinc-800/20 hover:text-white/92'}`}
                  title={!isExpanded ? item.label : undefined}
                >
                  {isActive ? <div className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r-full bg-emerald-400/80" /> : null}

                  <div className="relative flex-shrink-0">
                    <Icon className={`h-[15px] w-[15px] transition-colors ${isActive ? 'text-[rgb(var(--theme-accent-rgb)/0.9)]' : 'text-white/50 group-hover:text-white/78'}`} />
                  </div>

                  {isExpanded ? (
                    <>
                      <span className={`flex-1 truncate text-left text-[12px] font-medium ${isActive ? 'text-white' : ''}`}>
                        {item.label}
                      </span>
                      {hasChildren ? (
                        <ChevronRight
                          className={`h-3 w-3 text-white/50 transition-transform duration-200 ${childrenOpen ? 'rotate-90' : ''}`}
                        />
                      ) : null}
                    </>
                  ) : null}
                </button>

                {hasChildren && childrenOpen && isExpanded ? (
                  <div className="animate-in slide-in-from-top-1 fade-in mt-0.5 ml-[22px] space-y-0.5 border-l border-zinc-800/40 pl-2.5 duration-150">
                    {item.children!.map((child) => {
                      const childActive =
                        child.page === 'goals'
                          ? page === 'goals' && goalsView === child.goalsView
                          : page === child.page
                      return (
                        <button
                          key={child.id}
                          onClick={() =>
                            child.page === 'goals' && child.goalsView
                              ? handleGoalChildClick(child.goalsView)
                              : setPage(child.page)
                          }
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${childActive ? 'bg-zinc-800/30 text-white' : 'text-white/75 hover:bg-zinc-800/20 hover:text-white/92'}`}
                        >
                          <child.icon className="h-3 w-3" />
                          <span>{child.label}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        {isExpanded ? <div className="mx-1 my-3 h-px bg-zinc-800/30" /> : null}

        {isExpanded ? (
          <div className="space-y-4">
            <div className="px-1">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sun className="h-3 w-3 text-white/50" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">Today</span>
                  <span className="ml-1 text-[9px] text-white/45">{todayTaskCount}</span>
                </div>

                <button
                  onClick={() => setTodayViewMode((current) => current === 'compact' ? 'card' : 'compact')}
                  className="rounded-md p-1 text-white/50 transition-colors hover:bg-zinc-800/20 hover:text-white/80"
                  title={todayViewMode === 'compact' ? 'Switch to card view' : 'Switch to compact view'}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </button>
              </div>

              {todayTasks.length === 0 ? (
                <TodayEmptyState mode={todayViewMode} />
              ) : todayViewMode === 'card' ? (
                <div className="space-y-1.5">
                  {todayTasks.slice(0, 3).map((task) => {
                    const meta = getTodayTaskMeta(task, todayIso)
                    return (
                      <div key={task.id} className="rounded-lg border border-zinc-800/50 px-2.5 py-2.5 surface-2">
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => onCompleteTodayTask(task.id)}
                            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.18] text-white/75 transition-colors hover:border-white/[0.3] hover:text-white"
                            aria-label={`Complete ${task.text}`}
                          >
                            <Check className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={handleOpenTaskList}
                            className="min-w-0 flex-1 text-left"
                            title={task.text}
                          >
                            <p className="line-clamp-2 text-[11px] leading-snug text-white/75 transition-colors hover:text-white/92">
                              {task.text}
                            </p>
                            {meta ? <p className="mt-1 text-[9px] text-white/45">{meta}</p> : null}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {todayTasks.slice(0, 5).map((task) => {
                    const meta = getTodayTaskMeta(task, todayIso)
                    return (
                      <div
                        key={task.id}
                        className="flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-zinc-800/25"
                      >
                        <button
                          onClick={() => onCompleteTodayTask(task.id)}
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.18] text-white/75 transition-colors hover:border-white/[0.3] hover:text-white"
                          aria-label={`Complete ${task.text}`}
                        >
                          <Check className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={handleOpenTaskList} className="min-w-0 flex-1 text-left" title={task.text}>
                          <p className="truncate text-[11px] text-white/75 transition-colors hover:text-white/92">
                            {task.text}
                          </p>
                          {meta ? <p className="mt-0.5 text-[9px] text-white/45">{meta}</p> : null}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <button className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] text-white/50 transition-colors hover:bg-zinc-800/15 hover:text-white/80">
                <Plus className="h-3 w-3" />
                <span>Quick add</span>
              </button>
            </div>

            <div className="px-1">
              <div className="mb-2 flex items-center gap-1.5">
                <Crosshair className="h-3 w-3 text-white/50" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">Focus</span>
              </div>
              {focusTask ? (
                <button
                  onClick={handleOpenTaskList}
                  className="group w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-zinc-800/15"
                  title={focusTask.text}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse" />
                    <span className="text-[9px] font-medium text-white/45">{getFocusTaskMeta(focusTask, todayIso) ?? 'In focus'}</span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-snug text-white/75 transition-colors group-hover:text-white/92">
                    {focusTask.text}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Target className="h-2.5 w-2.5 text-white/50" />
                    <span className="text-[9px] text-white/45">Open in Tasks</span>
                  </div>
                </button>
              ) : (
                <div className="group cursor-pointer rounded-lg px-2.5 py-2 transition-colors hover:bg-zinc-800/15">
                  <div className="mb-1 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-blue-400/60 animate-pulse" />
                    <span className="text-[9px] font-medium text-white/45">No focus task</span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-snug text-white/70 transition-colors group-hover:text-white/90">
                    No current focus task selected.
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Target className="h-2.5 w-2.5 text-white/50" />
                    <span className="text-[9px] text-white/45">Set one from Tasks</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <div className="mx-2 mb-2 h-px bg-zinc-800/30" />

            <div className="flex justify-center py-1.5" title="Today">
              <div className="relative">
                <Sun className="h-3.5 w-3.5 text-white/50" />
              </div>
            </div>

            <div className="flex justify-center py-1.5" title="Focus">
              <div className="relative">
                <Crosshair className="h-3.5 w-3.5 text-white/50" />
                <div className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blue-400/50 animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </div>

      {showBadHabitStreak && badHabitStreak ? (
        <div className="px-2 pb-3 pt-1">
          <div className="mx-1 mb-2 h-px bg-zinc-800/30" />

          {isExpanded ? (
            <div className="flex items-center justify-between px-2.5 py-2">
              <div className="flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-amber-400/60" />
                <span className="text-[10px] text-white/75">
                  <span className="font-semibold text-amber-400/60">{badHabitStreak.streak}</span> day streak
                </span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-2.5 w-2.5 text-emerald-400/50" />
                <span className="text-[10px] text-emerald-400/50">{badHabitStreak.label}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-1.5" title={`${badHabitStreak.streak} day streak · ${badHabitStreak.label}`}>
              <Flame className="h-3.5 w-3.5 text-amber-400/50" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
