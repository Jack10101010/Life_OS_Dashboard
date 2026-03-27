import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { StatPill } from '../../components/ui/StatPill'
import { TagPill } from '../../components/ui/TagPill'
import { WeekHeatmap } from '../../components/tracker/WeekHeatmap'
import { getHabitTrackerActiveDatesInRange, getLiveTrackerStreak, getTrackerGoalProgress, isHabitTrackerActiveOnDate } from '../../lib/habitTrackerGoals'
import { getDayColor } from '../../lib/color'
import {
  WORKSPACE_RECORD_VERSION,
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspaceScratchpad,
  getWorkspaceBackupStorageKey,
  normalizeStoredWorkspaceRecord,
  readWorkspaceBackups,
  readWorkspaceRecord,
  saveWorkspaceRecord,
} from '../../lib/persistence/workspace'
import { readJsonStorage, writeJsonStorage } from '../../lib/persistence/storage'
import { getRollingMomentumMetrics, type RollingMomentumMetrics } from '../../lib/momentum'
import { BadHabitDefinition, DashboardFinanceSheet, DashboardScratchpad, DayEntry, DayEventEntry, DayEventTagEntry, HabitTracker, ScratchpadFreeNote, ScratchpadLineItem, Tag, Task, WeekEntry } from '../../types'
import { useDashboardState } from '../../hooks/useDashboardState'

const TASK_PANEL_WIDTH_STORAGE_KEY = 'life-dashboard:task-panel-expanded'
const TASK_PANEL_RESIZED_WIDTH_STORAGE_KEY = 'life-dashboard:task-panel-width'

export function DashboardPage({
  weeks,
  days,
  tags,
  tasks,
  habitTrackers,
  year,
  badHabitStreaks,
  showBadHabitTracking,
  onUpdateDay,
  onAddTask,
  onToggleTaskStarred,
  onToggleTaskImportant,
  onToggleTask,
  onDeleteTask,
  onOpenWeek,
  onGoToTrackerWeek,
  onOpenToday,
  onOpenFullNote,
  onOpenTracker,
  onOpenGoals,
  onOpenDay,
}: {
  weeks: WeekEntry[]
  days: DayEntry[]
  tags: Tag[]
  tasks: Task[]
  habitTrackers: HabitTracker[]
  year: number
  badHabitStreaks: Array<{ habit: BadHabitDefinition; streak: number; startsToday?: boolean; brokenToday?: boolean }>
  showBadHabitTracking: boolean
  onUpdateDay: (dayId: string, updater: (day: DayEntry) => DayEntry, options?: { skipCanonicalSave?: boolean }) => void
  onAddTask: (text: string) => void
  onToggleTaskStarred: (taskId: string) => void
  onToggleTaskImportant: (taskId: string) => void
  onToggleTask: (taskId: string) => void
  onDeleteTask: (taskId: string) => void
  onOpenWeek: (week: WeekEntry) => void
  onGoToTrackerWeek: (week: WeekEntry) => void
  onOpenToday: () => void
  onOpenFullNote: () => void
  onOpenTracker: () => void
  onOpenGoals: () => void
  onOpenDay: (day: DayEntry) => void
}) {
  const { currentWeek, todayEntry, moodTrend, topHabits, journalHighlights, recentWins } = useDashboardState({
    days,
    weeks,
  })
  const [taskDraft, setTaskDraft] = useState('')
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)
  const [taskPanelSearch, setTaskPanelSearch] = useState('')
  const [taskPanelFilter, setTaskPanelFilter] = useState<'all' | 'starred' | 'important' | 'open' | 'completed'>('all')
  const [taskPanelExpanded, setTaskPanelExpanded] = useState(() => readJsonStorage<boolean>(TASK_PANEL_WIDTH_STORAGE_KEY) ?? false)
  const [taskPanelWidth, setTaskPanelWidth] = useState<number | null>(() => readJsonStorage<number>(TASK_PANEL_RESIZED_WIDTH_STORAGE_KEY) ?? null)
  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(() => getCurrentFinanceMonthKey())
  const [scratchpadPanelHeight, setScratchpadPanelHeight] = useState<number | null>(null)
  const [scratchpadSaveState, setScratchpadSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [scratchpadRecoveryMessage, setScratchpadRecoveryMessage] = useState<string | null>(null)
  const [scratchpadBackupRefreshToken, setScratchpadBackupRefreshToken] = useState(0)
  const [renamingFreeNoteId, setRenamingFreeNoteId] = useState<string | null>(null)
  const [freeNoteTitleDraft, setFreeNoteTitleDraft] = useState('')
  const [financeFeedback, setFinanceFeedback] = useState<{
    itemId: string
    message: string
    tone: 'incoming' | 'outgoing'
  } | null>(null)
  const [quickAddEventOpen, setQuickAddEventOpen] = useState(false)
  const [quickAddEventDraft, setQuickAddEventDraft] = useState(() => createDashboardDayEventDraft())
  const [quickAddEventSelectedTagIds, setQuickAddEventSelectedTagIds] = useState<string[]>([])
  const [focusEditing, setFocusEditing] = useState(false)
  const [focusDraft, setFocusDraft] = useState('')
  const [lowStateModeActive, setLowStateModeActive] = useState(false)
  const [lowStateTimerSeconds, setLowStateTimerSeconds] = useState<number | null>(null)
  const quickNotesRef = useRef<HTMLTextAreaElement | null>(null)
  const focusInputRef = useRef<HTMLInputElement | null>(null)
  const scratchpadTextRef = useRef<HTMLTextAreaElement | null>(null)
  const scratchpadNotesRef = useRef<HTMLTextAreaElement | null>(null)
  const scratchpadContentRef = useRef<HTMLDivElement | null>(null)
  const freeNoteTitleInputRef = useRef<HTMLInputElement | null>(null)
  const financeFeedbackTimeoutRef = useRef<number | null>(null)
  const scratchpadSaveTimeoutRef = useRef<number | null>(null)
  const scratchpadSavedIndicatorTimeoutRef = useRef<number | null>(null)
  const scratchpadRecoveryMessageTimeoutRef = useRef<number | null>(null)
  const taskPanelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const initialWorkspaceRecord = useMemo(() => readWorkspaceRecord(), [])
  const [workspaceScratchpad, setWorkspaceScratchpad] = useState<DashboardScratchpad>(
    () => initialWorkspaceRecord?.workspace ?? createEmptyWorkspaceScratchpad(),
  )
  const lastSavedScratchpadKeyRef = useRef<string>('')
  const hydratedWorkspaceRef = useRef(false)
  const initializedWorkspaceHydrationRef = useRef(false)
  const lastRestoredScratchpadSnapshotRef = useRef<string | null>(null)
  const pendingScratchpadHydrationRef = useRef<{
    scratchpad: DashboardScratchpad
    serialized: string
  } | null>(null)
  const currentSignal = getCurrentSignal(moodTrend)
  const workspaceRecord = useMemo(
    () => (scratchpadBackupRefreshToken === 0 ? initialWorkspaceRecord : readWorkspaceRecord()),
    [initialWorkspaceRecord, scratchpadBackupRefreshToken],
  )
  const availableScratchpadBackups = useMemo(
    () => readWorkspaceBackups(),
    [scratchpadBackupRefreshToken],
  )
  const scratchpadRecoverySlots = useMemo(
    () =>
      [1, 2, 3].map((slot) => ({
        slot,
        backup: availableScratchpadBackups.find((item) => item.slot === slot) ?? null,
      })),
    [availableScratchpadBackups],
  )
  const sortedTasks = useMemo(() => getSortedDashboardTasks(tasks), [tasks])
  const visibleTasks = useMemo(() => sortedTasks.slice(0, 5), [sortedTasks])
  const panelTasks = useMemo(() => {
    const search = taskPanelSearch.trim().toLowerCase()
    return sortedTasks.filter((task) => {
      if (taskPanelFilter === 'starred' && !task.starred) return false
      if (taskPanelFilter === 'important' && !task.important) return false
      if (taskPanelFilter === 'open' && task.completed) return false
      if (taskPanelFilter === 'completed' && !task.completed) return false
      if (search && !task.text.toLowerCase().includes(search)) return false
      return true
    })
  }, [sortedTasks, taskPanelFilter, taskPanelSearch])
  const taskPanelWidthBounds = useMemo(
    () => getTaskPanelWidthBounds(typeof window === 'undefined' ? 1440 : window.innerWidth),
    [taskPanelOpen],
  )
  const resolvedTaskPanelWidth = useMemo(() => {
    const presetWidth = taskPanelExpanded ? taskPanelWidthBounds.expanded : taskPanelWidthBounds.default
    return clampTaskPanelWidth(taskPanelWidth ?? presetWidth, taskPanelWidthBounds)
  }, [taskPanelExpanded, taskPanelWidth, taskPanelWidthBounds])
  const activeGoals = useMemo(
    () =>
      habitTrackers
        .filter((tracker) => tracker.goal)
        .map((tracker) => ({
          tracker,
          progress: getTrackerGoalProgress(tracker, year),
        }))
        .filter(
          (item): item is { tracker: HabitTracker; progress: NonNullable<ReturnType<typeof getTrackerGoalProgress>> } =>
            item.progress != null && item.progress.active,
        )
        .slice(0, 3),
    [habitTrackers, year],
  )
  const scratchpadFreeNotes = useMemo(
    () => getScratchpadFreeNotes(workspaceScratchpad, 'workspace'),
    [workspaceScratchpad],
  )
  const activeFreeNoteId = useMemo(
    () => resolveActiveFreeNoteId(scratchpadFreeNotes, workspaceScratchpad.activeFreeNoteId),
    [scratchpadFreeNotes, workspaceScratchpad.activeFreeNoteId],
  )
  const activeFreeNote = useMemo(
    () => scratchpadFreeNotes.find((note) => note.id === activeFreeNoteId) ?? scratchpadFreeNotes[0],
    [activeFreeNoteId, scratchpadFreeNotes],
  )
  const dashboardExecution = todayEntry.dashboardExecution
  const executionStatusMeta = getExecutionStatusMeta(dashboardExecution.status)
  const executionActions: Array<{ status: DayEntry['dashboardExecution']['status']; label: string }> = [
    { status: 'started', label: 'Start' },
    { status: 'partial', label: 'Mark partial' },
    { status: 'complete', label: 'Mark complete' },
  ]
  const dayEventTags = useMemo(
    () => tags.filter((tag) => tag.isActive && tag.section === 'events' && tag.availableIn.includes('day')),
    [tags],
  )
  const dayActionEventTags = useMemo(
    () => tags.filter((tag) => tag.isActive && tag.section === 'actions' && tag.availableIn.includes('day')),
    [tags],
  )
  const dayMoodEventTags = useMemo(
    () => tags.filter((tag) => tag.isActive && tag.section === 'feelings' && tag.availableIn.includes('day')),
    [tags],
  )
  const lowStateNextAction = dashboardExecution.nextAction.trim() || dashboardExecution.minimumVersion.trim() || dashboardExecution.todayTask.trim()

  useEffect(() => {
    if (!focusEditing || !focusInputRef.current) return
    focusInputRef.current.focus()
    focusInputRef.current.select()
  }, [focusEditing])

  const startFocusEditing = () => {
    setFocusDraft(todayEntry.morningIntention)
    setFocusEditing(true)
  }

  const cancelFocusEditing = () => {
    setFocusEditing(false)
    setFocusDraft('')
  }

  const saveFocusEditing = () => {
    onUpdateDay(todayEntry.id, (current) => ({
      ...current,
      isLogged: true,
      morningIntention: focusDraft,
    }))
    setFocusEditing(false)
    setFocusDraft('')
  }

  const updateDashboardExecution = (updater: (current: DayEntry['dashboardExecution']) => DayEntry['dashboardExecution']) => {
    onUpdateDay(todayEntry.id, (current) => ({
      ...current,
      dashboardExecution: updater(current.dashboardExecution),
    }))
  }
  const resetQuickAddEvent = () => {
    setQuickAddEventDraft(createDashboardDayEventDraft())
    setQuickAddEventSelectedTagIds([])
  }
  const saveQuickAddEvent = () => {
    const trimmedTitle = quickAddEventDraft.title.trim()
    const trimmedDescription = quickAddEventDraft.description.trim()
    if (!trimmedTitle) return

    const selectedTags: DayEventTagEntry[] = quickAddEventSelectedTagIds
      .map((tagId) => tags.find((tag) => tag.id === tagId))
      .filter((tag): tag is Tag => tag != null)
      .map((tag, index) => ({
        id: `dash-day-event-tag-${Date.now().toString(36)}-${index}`,
        tagId: tag.id,
        section: tag.section,
        kind: tag.kind,
        polarity: tag.polarity,
      }))

    onUpdateDay(todayEntry.id, (current) => ({
      ...current,
      isLogged: true,
      dailyActions: [
        ...current.dailyActions,
        {
          id: createDashboardDayEventId(),
          title: trimmedTitle,
          description: trimmedDescription,
          time: quickAddEventDraft.time,
          tags: selectedTags,
        },
      ],
    }))

    resetQuickAddEvent()
    setQuickAddEventOpen(false)
  }

  useEffect(() => {
    if (!quickNotesRef.current) return
    resizeDashboardTextarea(quickNotesRef.current)
  }, [todayEntry.id, todayEntry.dashboardQuickNote])

  useEffect(() => {
    if (lowStateTimerSeconds == null) return
    if (lowStateTimerSeconds <= 0) return

    const timeoutId = window.setTimeout(() => {
      setLowStateTimerSeconds((current) => (current == null ? current : Math.max(current - 1, 0)))
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [lowStateTimerSeconds])

  useEffect(() => {
    if (!renamingFreeNoteId || !freeNoteTitleInputRef.current) return
    freeNoteTitleInputRef.current.focus()
    freeNoteTitleInputRef.current.select()
  }, [renamingFreeNoteId])

  useEffect(() => {
    if (initializedWorkspaceHydrationRef.current) {
      return
    }

    if (!workspaceRecord) {
      hydratedWorkspaceRef.current = true
      initializedWorkspaceHydrationRef.current = true
      return
    }

    const restoredSerialized = serializeScratchpad(workspaceRecord.workspace)
    const currentSerialized = serializeScratchpad(workspaceScratchpad)

    if (currentSerialized === restoredSerialized) {
      lastSavedScratchpadKeyRef.current = restoredSerialized
      hydratedWorkspaceRef.current = true
      initializedWorkspaceHydrationRef.current = true
      return
    }

    hydratedWorkspaceRef.current = true
    initializedWorkspaceHydrationRef.current = true
    lastRestoredScratchpadSnapshotRef.current = restoredSerialized
    pendingScratchpadHydrationRef.current = {
      scratchpad: workspaceRecord.workspace,
      serialized: restoredSerialized,
    }
    setWorkspaceScratchpad(workspaceRecord.workspace)
  }, [workspaceRecord])

  useEffect(() => {
    const serialized = serializeScratchpad(workspaceScratchpad)
    const pendingHydration = pendingScratchpadHydrationRef.current
    if (pendingHydration) {
      if (pendingHydration.serialized === serialized) {
        pendingScratchpadHydrationRef.current = null
      } else {
        setWorkspaceScratchpad(pendingHydration.scratchpad)
      }
    }
  }, [workspaceScratchpad])

  useEffect(() => {
    if (workspaceScratchpad.mode === 'structured') {
      setSelectedFinanceMonth(getPreferredFinanceMonthKey(workspaceScratchpad, getCurrentFinanceMonthKey()))
    }
  }, [workspaceScratchpad, workspaceScratchpad.mode])

  useEffect(() => {
    if (scratchpadTextRef.current) resizeDashboardTextarea(scratchpadTextRef.current, 160)
    if (scratchpadNotesRef.current) resizeDashboardTextarea(scratchpadNotesRef.current, 96)
  }, [activeFreeNote?.text, workspaceScratchpad.mode, selectedFinanceMonth, getFinanceSheetForMonth(workspaceScratchpad, selectedFinanceMonth).notes])

  useEffect(() => {
    if (renamingFreeNoteId && !scratchpadFreeNotes.some((note) => note.id === renamingFreeNoteId)) {
      setRenamingFreeNoteId(null)
      setFreeNoteTitleDraft('')
    }
  }, [renamingFreeNoteId, scratchpadFreeNotes])

  useEffect(() => {
    const contentNode = scratchpadContentRef.current
    if (!contentNode) return

    const updateHeight = () => {
      const nextHeight = Math.max(240, Math.ceil(contentNode.getBoundingClientRect().height))
      setScratchpadPanelHeight(nextHeight)
    }

    updateHeight()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      updateHeight()
    })
    observer.observe(contentNode)

    return () => observer.disconnect()
  }, [workspaceScratchpad.mode, selectedFinanceMonth])

  const currentFinanceSheet = useMemo(
    () => getFinanceSheetForMonth(workspaceScratchpad, selectedFinanceMonth),
    [workspaceScratchpad, selectedFinanceMonth],
  )
  const currentFinanceMonthLabel = useMemo(() => formatFinanceMonthLabel(selectedFinanceMonth), [selectedFinanceMonth])
  const scratchpadTotals = useMemo(
    () => ({
      incoming: getScratchpadTotal(currentFinanceSheet.moneyIn),
      outgoing: getScratchpadTotal(currentFinanceSheet.moneyOut),
    }),
    [currentFinanceSheet],
  )
  const sortedIncomingItems = useMemo(
    () => sortScratchpadLineItemsByDay(currentFinanceSheet.moneyIn, selectedFinanceMonth),
    [currentFinanceSheet.moneyIn, selectedFinanceMonth],
  )
  const activeIncomingItems = useMemo(
    () => sortedIncomingItems.filter((item) => !item.settled),
    [sortedIncomingItems],
  )
  const receivedItems = useMemo(
    () => sortedIncomingItems.filter((item) => item.settled),
    [sortedIncomingItems],
  )
  const sortedOutgoingItems = useMemo(
    () => sortScratchpadLineItemsByDay(currentFinanceSheet.moneyOut, selectedFinanceMonth),
    [currentFinanceSheet.moneyOut, selectedFinanceMonth],
  )
  const activeOutgoingItems = useMemo(
    () => sortedOutgoingItems.filter((item) => !item.settled),
    [sortedOutgoingItems],
  )
  const paidItems = useMemo(
    () => sortedOutgoingItems.filter((item) => item.settled),
    [sortedOutgoingItems],
  )
  const weeklyHabitMetrics = useMemo(
    () => getDashboardWeeklyHabitMetrics(habitTrackers, currentWeek.startDate, currentWeek.endDate, days),
    [currentWeek.endDate, currentWeek.startDate, days, habitTrackers],
  )
  const rollingMomentum = useMemo(
    () => getRollingMomentumMetrics(days, habitTrackers, todayEntry.date),
    [days, habitTrackers, todayEntry.date],
  )
  const todayHabitProgress = useMemo(
    () => getDashboardDayHabitMetrics(habitTrackers, todayEntry.date),
    [habitTrackers, todayEntry.date],
  )
  const momentumGuidance = useMemo(
    () => getMomentumGuidance(rollingMomentum),
    [rollingMomentum],
  )
  const weeklyHabitCounts = useMemo(
    () =>
      habitTrackers.map((tracker) => ({
        id: tracker.id,
        title: tracker.title,
        weekDots: getTrackerWeekDots(tracker, currentWeek.startDate, currentWeek.endDate, todayEntry.date),
        streak: getLiveTrackerStreak(tracker, year),
      })),
    [currentWeek.endDate, currentWeek.startDate, habitTrackers, todayEntry.date, year],
  )
  const currentWeekRangeLabel = useMemo(
    () => formatDashboardWeekRange(currentWeek.startDate, currentWeek.endDate),
    [currentWeek.endDate, currentWeek.startDate],
  )
  const weeklyInsight = useMemo(
    () => getWeeklyInsightMessage(habitTrackers, currentWeek.startDate, currentWeek.endDate, todayEntry.date),
    [currentWeek.endDate, currentWeek.startDate, habitTrackers, todayEntry.date],
  )
  const visibleWeeklyHabits = useMemo(() => weeklyHabitCounts.slice(0, 6), [weeklyHabitCounts])
  const recentMoodDots = useMemo(() => getRecentMoodDots(days, todayEntry.date), [days, todayEntry.date])
  const compactWeekDays = useMemo(
    () => getCompactWeekDayMarkers(currentWeek.startDate, currentWeek.endDate, days, todayEntry.date),
    [currentWeek.endDate, currentWeek.startDate, days, todayEntry.date],
  )
  const visibleWeeklyInsight = useMemo(
    () => (weeklyInsight === 'Keep the week moving with one useful action at a time.' ? '' : weeklyInsight),
    [weeklyInsight],
  )
  const lastBigWin = useMemo(
    () => getLatestWinEntry(days, currentWeek.startDate, currentWeek.endDate),
    [currentWeek.endDate, currentWeek.startDate, days],
  )
  const visibleWeeklyGoals = useMemo(
    () =>
      activeGoals.slice(0, 3).map(({ tracker, progress }) => ({
        id: tracker.id,
        title: tracker.title,
        percent: progress.target > 0 ? Math.min(Math.round((progress.current / progress.target) * 100), 100) : 0,
      })),
    [activeGoals],
  )
  const safeLowStateNextAction = lowStateNextAction || 'Take one small step: open your task or move your body'

  const showFinanceFeedback = (itemId: string, message: string, tone: 'incoming' | 'outgoing') => {
    setFinanceFeedback({ itemId, message, tone })
    if (financeFeedbackTimeoutRef.current) window.clearTimeout(financeFeedbackTimeoutRef.current)
    financeFeedbackTimeoutRef.current = window.setTimeout(() => {
      setFinanceFeedback(null)
      financeFeedbackTimeoutRef.current = null
    }, 950)
  }

  useEffect(() => {
    return () => {
      if (financeFeedbackTimeoutRef.current) window.clearTimeout(financeFeedbackTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (scratchpadRecoveryMessageTimeoutRef.current) window.clearTimeout(scratchpadRecoveryMessageTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const serialized = serializeScratchpad(workspaceScratchpad)
    const saveKey = serialized
    if (lastSavedScratchpadKeyRef.current === saveKey) return

    if (!hydratedWorkspaceRef.current) {
      return
    }

    const pendingHydration = pendingScratchpadHydrationRef.current
    if (pendingHydration && pendingHydration.serialized !== serialized) {
      return
    }

    setScratchpadSaveState('saving')
    if (scratchpadSaveTimeoutRef.current) window.clearTimeout(scratchpadSaveTimeoutRef.current)
    if (scratchpadSavedIndicatorTimeoutRef.current) window.clearTimeout(scratchpadSavedIndicatorTimeoutRef.current)

    scratchpadSaveTimeoutRef.current = window.setTimeout(() => {
      const saveResult = saveWorkspaceRecord({
        version: WORKSPACE_RECORD_VERSION,
        updatedAt: new Date().toISOString(),
        workspace: workspaceScratchpad,
      })
      if (saveResult.skipped) {
        setScratchpadSaveState('idle')
        scratchpadSaveTimeoutRef.current = null
        return
      }
      lastSavedScratchpadKeyRef.current = saveKey
      setScratchpadBackupRefreshToken((current) => current + 1)
      setScratchpadSaveState('saved')
      scratchpadSavedIndicatorTimeoutRef.current = window.setTimeout(() => {
        setScratchpadSaveState('idle')
        scratchpadSavedIndicatorTimeoutRef.current = null
      }, 1400)
      scratchpadSaveTimeoutRef.current = null
    }, 220)

    return () => {
      if (scratchpadSaveTimeoutRef.current) {
        window.clearTimeout(scratchpadSaveTimeoutRef.current)
        scratchpadSaveTimeoutRef.current = null
      }
    }
  }, [workspaceScratchpad])

  useEffect(() => {
    return () => {
      if (scratchpadSavedIndicatorTimeoutRef.current) window.clearTimeout(scratchpadSavedIndicatorTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    writeJsonStorage(TASK_PANEL_WIDTH_STORAGE_KEY, taskPanelExpanded)
  }, [taskPanelExpanded])

  useEffect(() => {
    if (taskPanelWidth == null) return
    writeJsonStorage(TASK_PANEL_RESIZED_WIDTH_STORAGE_KEY, taskPanelWidth)
  }, [taskPanelWidth])

  useEffect(() => {
    if (!taskPanelOpen) return

    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = taskPanelResizeRef.current
      if (!resizeState) return

      const bounds = getTaskPanelWidthBounds(window.innerWidth)
      const nextWidth = resizeState.startWidth + (resizeState.startX - event.clientX)
      const clampedWidth = clampTaskPanelWidth(nextWidth, bounds)
      setTaskPanelWidth(clampedWidth)
      setTaskPanelExpanded(clampedWidth >= bounds.expanded - 2)
    }

    const handleMouseUp = () => {
      if (!taskPanelResizeRef.current) return
      taskPanelResizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      taskPanelResizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [taskPanelOpen])

  const updateFinanceSheetForMonth = (monthKey: string, updater: (sheet: DashboardFinanceSheet) => DashboardFinanceSheet) =>
    setWorkspaceScratchpad((current) => {
      const sheet = getFinanceSheetForMonth(current, monthKey)
      return {
        ...current,
        financeSheets: {
          ...current.financeSheets,
          [monthKey]: updater(sheet),
        },
      }
    })

  const openFinanceMonth = (monthKey: string) => {
    setSelectedFinanceMonth(monthKey)
    setWorkspaceScratchpad((current) => ({
      ...current,
      financeSheets: current.financeSheets[monthKey]
        ? current.financeSheets
        : {
            ...current.financeSheets,
            [monthKey]: createEmptyFinanceSheet(),
          },
    }))
  }

  const updateScratchpadFreeNotes = (
    updater: (notes: ScratchpadFreeNote[]) => ScratchpadFreeNote[],
    nextActiveId?: string | null,
  ) =>
    setWorkspaceScratchpad((current) => {
      const currentNotes = getScratchpadFreeNotes(current, 'workspace')
      const updatedNotes = updater(currentNotes)
      const safeNotes = updatedNotes.length > 0 ? updatedNotes : [createScratchpadFreeNote(1)]
      const resolvedActiveId = resolveActiveFreeNoteId(
        safeNotes,
        nextActiveId === undefined ? current.activeFreeNoteId : nextActiveId,
      )
      const resolvedActiveNote = safeNotes.find((note) => note.id === resolvedActiveId) ?? safeNotes[0]

      return {
        ...current,
        text: resolvedActiveNote?.text ?? '',
        freeNotes: safeNotes,
        activeFreeNoteId: resolvedActiveNote?.id ?? null,
      }
    })

  const commitFreeNoteRename = (noteId: string) => {
    const trimmedTitle = freeNoteTitleDraft.trim()
    const noteIndex = scratchpadFreeNotes.findIndex((note) => note.id === noteId)
    const fallbackTitle = getScratchpadFreeNoteTitle(noteIndex >= 0 ? noteIndex : 0)

    updateScratchpadFreeNotes((notes) =>
      notes.map((note, index) =>
        note.id === noteId
          ? {
              ...note,
              title: trimmedTitle.length > 0 ? trimmedTitle : getScratchpadFreeNoteTitle(index),
            }
          : note,
      ),
    )

    setRenamingFreeNoteId(null)
    setFreeNoteTitleDraft(trimmedTitle.length > 0 ? trimmedTitle : fallbackTitle)
  }

  const startFreeNoteRename = (note: ScratchpadFreeNote) => {
    setRenamingFreeNoteId(note.id)
    setFreeNoteTitleDraft(note.title)
  }

  const createNewFreeNoteTab = () => {
    const newNote = createScratchpadFreeNote(scratchpadFreeNotes.length + 1)
    updateScratchpadFreeNotes((notes) => [...notes, newNote], newNote.id)
    setRenamingFreeNoteId(newNote.id)
    setFreeNoteTitleDraft(newNote.title)
  }

  const applyRecoveredScratchpad = (scratchpad: DashboardScratchpad, message: string) => {
    const restoredSerialized = serializeScratchpad(scratchpad)
    const saveResult = saveWorkspaceRecord({
      version: WORKSPACE_RECORD_VERSION,
      updatedAt: new Date().toISOString(),
      workspace: scratchpad,
    })

    lastSavedScratchpadKeyRef.current = restoredSerialized
    hydratedWorkspaceRef.current = true
    lastRestoredScratchpadSnapshotRef.current = restoredSerialized
    pendingScratchpadHydrationRef.current = {
      scratchpad,
      serialized: restoredSerialized,
    }

    if (scratchpad.mode === 'structured') {
      setSelectedFinanceMonth(getPreferredFinanceMonthKey(scratchpad, getCurrentFinanceMonthKey()))
    }

    setWorkspaceScratchpad(scratchpad)
    setScratchpadBackupRefreshToken((current) => current + 1)
    showScratchpadRecoveryMessage(message)
  }

  const forceRestoreScratchpadFromStorage = () => {
    const rawStoredString = typeof window === 'undefined' ? null : window.localStorage.getItem(WORKSPACE_STORAGE_KEY)

    const parsedStoredPayload = rawStoredString ? safeParseScratchpadPayload(rawStoredString) : null

    const restoredPayload = normalizeStoredWorkspaceRecord(parsedStoredPayload) ?? readWorkspaceRecord()

    if (!restoredPayload) {
      showScratchpadRecoveryMessage(`No stored data found for key ${WORKSPACE_STORAGE_KEY}`)
      return
    }

    applyRecoveredScratchpad(
      restoredPayload.workspace,
      `${getScratchpadRecoverySummary(restoredPayload.workspace, 'workspace')} from ${WORKSPACE_STORAGE_KEY}`,
    )
  }

  const showScratchpadRecoveryMessage = (message: string) => {
    setScratchpadRecoveryMessage(message)
    if (scratchpadRecoveryMessageTimeoutRef.current) window.clearTimeout(scratchpadRecoveryMessageTimeoutRef.current)
    scratchpadRecoveryMessageTimeoutRef.current = window.setTimeout(() => {
      setScratchpadRecoveryMessage(null)
      scratchpadRecoveryMessageTimeoutRef.current = null
    }, 3600)
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes finance-float-confirmation {
          0% { opacity: 0; transform: translateY(8px) scale(0.985); }
          14% { opacity: 1; transform: translateY(0) scale(1); }
          72% { opacity: 1; transform: translateY(-4px) scale(1); }
          100% { opacity: 0; transform: translateY(-12px) scale(0.995); }
        }
      `}</style>
      {lowStateModeActive ? (
        <div className="grid gap-6">
          <div className="mx-auto w-full max-w-[760px] rounded-[32px] border border-white/[0.08] bg-[#121316] px-6 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.34)] md:px-8 md:py-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-[#C8DCFF]">LOW STATE MODE</p>
                <h2 className="mt-4 text-[32px] font-semibold leading-tight text-white">
                  You don&apos;t need to fix everything. Just do one small thing.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLowStateModeActive(false)
                  setLowStateTimerSeconds(null)
                }}
                className="shrink-0 rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-2 text-sm text-white/82 transition hover:border-white/[0.16] hover:bg-white/[0.09] hover:text-white"
              >
                Exit
              </button>
            </div>

            <div className="mt-6 rounded-[28px] border border-[#78A7FF]/18 bg-[linear-gradient(180deg,#1A2130_0%,#14171C_100%)] px-5 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#BDD4FF]">Next action</p>
              <p className="mt-3 text-2xl leading-9 text-white">{safeLowStateNextAction}</p>
              {dashboardExecution.minimumVersion.trim() ? (
                <p className="mt-3 text-sm leading-6 text-white/72">Minimum version: {dashboardExecution.minimumVersion}</p>
              ) : null}
              <p className="mt-4 text-sm font-medium text-white/82">Action first. Clarity comes after.</p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    updateDashboardExecution((current) => ({ ...current, status: 'started' }))
                    setLowStateTimerSeconds(5 * 60)
                  }}
                  className="rounded-full border border-[#78A7FF]/30 bg-[#78A7FF]/18 px-4 py-2.5 text-sm text-[#E4EEFF] transition hover:border-[#78A7FF]/42 hover:bg-[#78A7FF]/22"
                >
                  Start 5-minute mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateDashboardExecution((current) => ({ ...current, status: 'started' }))
                    setLowStateTimerSeconds(60)
                  }}
                  className="rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
                >
                  Do 1 minute instead
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateDashboardExecution((current) => ({ ...current, status: 'partial' }))
                    setLowStateModeActive(false)
                    setLowStateTimerSeconds(null)
                  }}
                  className="rounded-full border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
                >
                  Mark partial progress
                </button>
              </div>

              {lowStateTimerSeconds != null ? (
                <div className="mt-6 rounded-[24px] border border-white/[0.08] bg-black/25 px-4 py-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/56">Timer</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-4xl font-semibold tracking-[0.06em] text-white tabular-nums">
                      {formatLowStateTimer(lowStateTimerSeconds)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateDashboardExecution((current) => ({ ...current, status: 'partial' }))
                          setLowStateModeActive(false)
                          setLowStateTimerSeconds(null)
                        }}
                        className="rounded-full border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-sm text-white/82 transition hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white"
                      >
                        Mark partial
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateDashboardExecution((current) => ({ ...current, status: 'complete' }))
                          setLowStateModeActive(false)
                          setLowStateTimerSeconds(null)
                        }}
                        className="rounded-full border border-[#4FDC94]/28 bg-[#4FDC94]/14 px-3 py-2 text-sm text-[#DBFBE7] transition hover:border-[#4FDC94]/38 hover:bg-[#4FDC94]/18"
                      >
                        Mark complete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="grid gap-4">
      <Card className="px-5 py-4.5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex flex-wrap items-end gap-x-5 gap-y-3">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <p className="theme-section-title">This Week</p>
                <span className="theme-metadata">Week {currentWeek.weekNumber}/52</span>
                <span className="theme-metadata">· {currentWeekRangeLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                {compactWeekDays.map((day) => (
                  <div key={day.date} className="flex flex-col items-center gap-1">
                    <span className="theme-metadata uppercase tracking-[0.18em]">{day.label}</span>
                    <span
                      className={`h-[10px] w-[22px] rounded-full border transition-colors ${
                        day.state === 'logged'
                          ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-text-muted-rgb))]'
                          : day.state === 'current'
                            ? 'border-[rgb(var(--theme-info-rgb))] bg-[rgb(var(--theme-info-rgb)/0.12)]'
                            : 'theme-border-subtle theme-inactive-tile'
                      }`}
                      style={
                        day.state === 'current'
                          ? { boxShadow: 'inset 0 0 0 1px rgb(var(--theme-info-rgb) / 0.34)' }
                          : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-start gap-2.5">
              <Button
                variant="soft"
                onClick={() => onOpenWeek(currentWeek)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white/76"
              >
                Open week
              </Button>
              <div className="theme-inner-section group relative self-start rounded-full px-2.5 py-1.5">
                <div className="flex items-center gap-1.5">
                {recentMoodDots.map((dot) => (
                  <span
                    key={dot.date}
                    className="block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: dot.color }}
                    aria-label={dot.label}
                    title={dot.label}
                  />
                ))}
                </div>
                <span className="theme-chart-tooltip pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 hidden whitespace-nowrap rounded-2xl px-3 py-2 text-xs group-hover:block">
                  Last 7 days mood
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-2 xl:gap-x-5 xl:grid-cols-[minmax(0,1fr)_minmax(560px,620px)] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <StatPill
                  className={`min-w-[132px] rounded-[18px] px-2.5 py-1.5 ${
                    weeklyHabitMetrics.loggedDaysCount === 7 ? 'border-[#34D399]/45 bg-[#34D399]/10' : ''
                  }`}
                  label="Days logged"
                  value={`${weeklyHabitMetrics.loggedDaysCount}/7`}
                />
                <StatPill className="min-w-[158px] rounded-[18px] px-2.5 py-1.5" label="Habit completion" value={`${weeklyHabitMetrics.completionPercent}%`} />
                <StatPill className="min-w-[132px] rounded-[18px] px-2.5 py-1.5" label="Momentum" value={rollingMomentum.label} />
              </div>
              <div className="mt-3 space-y-2.5">
                <div className="theme-inner-section max-w-[440px] rounded-[20px] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#34D399' }}>Last win</p>
                    <span className="theme-metadata">{lastBigWin?.dateLabel ?? ''}</span>
                  </div>
                  <p className="theme-body-secondary mt-2 line-clamp-2">
                    {lastBigWin?.text || 'No win logged yet'}
                  </p>
                </div>
                <div className="theme-subtle-block max-w-[440px] rounded-[20px] border px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: '#34D399' }}>Reminder for this week</p>
                  <div className="mt-1.5 h-[42px]" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="min-w-0 xl:w-full xl:max-w-[620px] xl:justify-self-end">
              <div className="grid auto-rows-fr gap-2 sm:grid-cols-[minmax(0,1fr)_232px]">
                <div className="theme-inner-section min-w-0 rounded-[20px] px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#34D399' }}>Habits completed this week</p>
                  <div className="mt-2.5 space-y-1.5">
                    {visibleWeeklyHabits.map((habit) => (
                      <div key={habit.id} className="grid grid-cols-[minmax(0,1fr)_112px_1px_34px] items-center gap-3 text-[15px] leading-6">
                        <span className="min-w-0 truncate whitespace-nowrap theme-text-secondary">{habit.title}</span>
                        <span className="grid grid-cols-7 justify-items-center gap-1">
                          {habit.weekDots.map((dot) => (
                            <span
                              key={dot.date}
                              className={`block h-[7px] w-[7px] rounded-full ${
                                dot.state === 'completed'
                                  ? 'bg-[rgb(var(--theme-heatmap-complete-rgb))]'
                                  : dot.state === 'inactive'
                                    ? 'bg-[rgb(var(--theme-heatmap-inactive-rgb))]'
                                  : dot.state === 'future'
                                    ? 'bg-[rgb(var(--theme-text-faint-rgb))]'
                                    : 'bg-[rgb(var(--theme-heatmap-empty-rgb))]'
                              }`}
                            />
                          ))}
                        </span>
                        <span className="h-4 w-px bg-[rgb(var(--theme-border-subtle-rgb))]" aria-hidden="true" />
                        <span className="group relative shrink-0 text-right">
                          <span
                            className={`cursor-default text-[13px] tabular-nums ${getHabitStreakClassName(habit.streak)}`}
                            style={getHabitStreakStyle(habit.streak)}
                            aria-label={`${habit.streak} day streak`}
                          >
                            {habit.streak}d
                          </span>
                          <span className="theme-chart-tooltip pointer-events-none absolute right-0 bottom-[calc(100%+8px)] z-20 hidden whitespace-nowrap rounded-2xl px-3.5 py-2.5 text-[13px] group-hover:block">
                            {habit.streak} day streak
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="theme-inner-section min-w-0 sm:min-w-[232px] rounded-[20px] px-3.5 py-3 pr-4">
                  <p className="text-[10px] uppercase tracking-[0.24em]" style={{ color: '#34D399' }}>Active goals</p>
                  <div className="mt-2.5 space-y-1.5">
                    {visibleWeeklyGoals.length > 0 ? (
                      visibleWeeklyGoals.map((goal) => (
                        <div key={goal.id} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3 text-[15px] leading-6">
                          <span className="min-w-0 flex-1 truncate whitespace-nowrap theme-text-secondary">{goal.title}</span>
                          <span className="flex shrink-0 items-center justify-end gap-1.5 text-right">
                            <span className="theme-metadata tabular-nums">{goal.percent}%</span>
                            <span
                              className={goal.percent >= 100 ? 'text-[#D6B25E]' : 'text-white/[0.2]'}
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                                <path d="M4 2.5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 .75.75V4h1a1 1 0 0 1 1 1c0 2.29-1.28 3.86-3.28 4.18A4.27 4.27 0 0 1 8.75 11v1.25h1.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5h1.5V11a4.27 4.27 0 0 1-2.97-1.82C2.28 8.86 1 7.29 1 5a1 1 0 0 1 1-1h1V2.5ZM2.5 5c0 1.45.67 2.35 1.78 2.63A4.34 4.34 0 0 1 4 6.1V5H2.5Zm9.5 0v1.1c0 .54-.1 1.05-.28 1.53 1.11-.28 1.78-1.18 1.78-2.63H12Z" />
                              </svg>
                            </span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="theme-body-secondary">No active goals</p>
                    )}
                  </div>
                </div>
              </div>
              {visibleWeeklyInsight ? <p className="theme-body-secondary mt-3 px-1">{visibleWeeklyInsight}</p> : null}
            </div>
          </div>
        </div>
      </Card>

          <Card className="px-5 py-4">
            <div className="flex min-h-[110px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 lg:flex-[1.2]">
                <h3 className="text-[30px] font-semibold leading-tight text-white">
                  {new Date(`${todayEntry.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
                {focusEditing ? (
                  <input
                    ref={focusInputRef}
                    value={focusDraft}
                    onChange={(event) => setFocusDraft(event.target.value)}
                    onBlur={cancelFocusEditing}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        saveFocusEditing()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelFocusEditing()
                      }
                    }}
                    placeholder="Set one clear intention for today."
                    className="mt-2 block w-full max-w-[620px] min-w-0 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[18px] font-medium leading-[1.45] text-white/94 outline-none placeholder:text-mist/56 focus:border-white/[0.14] focus:bg-white/[0.045]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startFocusEditing}
                    className="mt-2 inline-flex w-full max-w-[620px] min-w-0 cursor-pointer items-center text-left transition duration-150 hover:text-white/98 hover:underline hover:decoration-white/18 hover:underline-offset-[5px] sm:w-auto"
                  >
                    <span className={`block min-w-0 flex-1 truncate text-[18px] font-semibold leading-[1.42] ${todayEntry.morningIntention.trim() ? 'text-white/94' : 'text-mist/58'}`}>
                      {formatDayStripFocus(todayEntry.morningIntention)}
                    </span>
                  </button>
                )}
                <p className="mt-2.5 text-[12px] text-mist/68">{getDayStripMetaLine(todayEntry, todayHabitProgress, showBadHabitTracking)}</p>
              </div>

              <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:min-w-[248px] lg:flex-[0.95] lg:items-end">
                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  <Button
                    variant="primary"
                    onClick={onOpenToday}
                    className="text-[#0B1511]"
                    style={{
                      borderColor: 'rgba(34, 197, 94, 0.55)',
                      backgroundColor: '#22C55E',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = '#2BD06A'
                      event.currentTarget.style.borderColor = 'rgba(43, 208, 106, 0.7)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = '#22C55E'
                      event.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.55)'
                    }}
                  >
                    {todayEntry.isLogged ? 'Open Today' : 'Open Today'}
                  </Button>
                  <Button onClick={onOpenTracker}>Go to Tracker</Button>
                  <div className="group relative">
                    <button
                      type="button"
                      onClick={() => setQuickAddEventOpen(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.035] text-[18px] leading-none text-white/74 transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
                      aria-label="Quick add event"
                    >
                      +
                    </button>
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-20 hidden whitespace-nowrap rounded-2xl border border-white/[0.08] bg-[#141414]/95 px-3 py-2 text-xs text-white/76 shadow-[0_18px_40px_rgba(0,0,0,0.35)] group-hover:block">
                      Quick add event
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
      </div>

      <Card className="max-w-[540px] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Momentum — Last 7 Days</p>
          <span className={`rounded-full border px-3 py-1.5 text-xs ${getMomentumStatusPillClassName(rollingMomentum.label)}`}>
            {rollingMomentum.label}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-5">
          <MomentumRing score={rollingMomentum.score} />
          <div className="min-w-0 max-w-[500px] flex-1 self-center">
            <div className="space-y-1">
              <div className="space-y-0.5">
                <p className="text-sm leading-[1.32] text-white/84">{momentumGuidance.messagePrimary}</p>
                {momentumGuidance.messageSecondary ? (
                  <p className="text-sm leading-[1.3] text-white/68">{momentumGuidance.messageSecondary}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onOpenToday}
                className="cursor-pointer text-left text-xs leading-[1.28] text-mist/56 transition duration-150 hover:text-white/72 hover:underline hover:decoration-white/14 hover:underline-offset-[4px]"
              >
                {momentumGuidance.action}
              </button>
            </div>
            {rollingMomentum.strongDayRun >= 2 ? (
              <span className="mt-2 inline-flex rounded-full border border-[rgba(255,164,75,0.18)] bg-[rgba(255,164,75,0.1)] px-3 py-1 text-xs text-[#F7DEC0]">
                🔥 {rollingMomentum.strongDayRun}-day run
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <MomentumMicroMetric
            label="Consistency"
            tooltip="Days where 60% or more of habits were completed over the last 7 completed days."
            value={`${rollingMomentum.consistencyDays}/${rollingMomentum.consistencyWindowDays}`}
          />
          <MomentumMicroMetric
            label="Completion"
            tooltip="Average habit completion across the last 7 completed days."
            value={`${rollingMomentum.completionPercent}%`}
          />
          <MomentumMicroMetric
            label="Trend"
            tooltip="Direction based on recent momentum change across the last 7 completed days."
            value={rollingMomentum.trend}
            tone={
              rollingMomentum.trend === 'Improving'
                ? 'positive'
                : rollingMomentum.trend === 'Declining'
                  ? 'negative'
                  : 'neutral'
            }
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Goals &amp; Execution</p>
            <p className="mt-1 text-sm text-mist">One goal. One task. One honest next step.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLowStateModeActive(true)
                setLowStateTimerSeconds(null)
              }}
              className="rounded-full border border-[#78A7FF]/18 bg-[#78A7FF]/10 px-3 py-1.5 text-xs text-[#D8E6FF] transition hover:border-[#78A7FF]/28 hover:bg-[#78A7FF]/14"
            >
              I feel off
            </button>
            <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/72">
              {executionStatusMeta.label}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <div className="grid gap-4 max-w-[940px]">
            <div className="grid gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/48">Goal</span>
                  <input
                    value={dashboardExecution.goal}
                    onChange={(event) =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        goal: event.target.value,
                      }))
                    }
                    placeholder="What matters most right now?"
                    className="rounded-2xl border border-white/[0.06] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white/88 outline-none transition placeholder:text-white/34 focus:border-white/[0.12] focus:bg-[#202020]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/48">Why it matters</span>
                  <input
                    value={dashboardExecution.whyItMatters}
                    onChange={(event) =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        whyItMatters: event.target.value,
                      }))
                    }
                    placeholder="Keep the reason simple and sharp"
                    className="rounded-2xl border border-white/[0.06] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white/88 outline-none transition placeholder:text-white/34 focus:border-white/[0.12] focus:bg-[#202020]"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#78A7FF]/16 bg-[linear-gradient(180deg,rgba(120,167,255,0.1),rgba(255,255,255,0.025))] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[#9EC1FF]">Today&apos;s 1 Task</p>
                  <p className="mt-1 text-sm text-white/58">Strip the work down until starting feels obvious.</p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/72">
                  Done &gt; perfect
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-white/48">Task title</span>
                  <input
                    value={dashboardExecution.todayTask}
                    onChange={(event) =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        todayTask: event.target.value,
                      }))
                    }
                    placeholder="The one thing that moves the goal"
                    className="rounded-2xl border border-white/[0.06] bg-[#171A21] px-3 py-3 text-base text-white outline-none transition placeholder:text-white/30 focus:border-[#78A7FF]/28 focus:bg-[#1C2029]"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/48">Next action</span>
                    <textarea
                      rows={2}
                      value={dashboardExecution.nextAction}
                      onChange={(event) =>
                        updateDashboardExecution((current) => ({
                          ...current,
                          nextAction: event.target.value,
                        }))
                      }
                      placeholder="The smallest possible first move"
                      className="min-h-[82px] rounded-2xl border border-white/[0.06] bg-[#171A21] px-3 py-2.5 text-sm leading-6 text-white/88 outline-none transition placeholder:text-white/30 focus:border-[#78A7FF]/28 focus:bg-[#1C2029]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-white/48">Minimum version</span>
                    <textarea
                      rows={2}
                      value={dashboardExecution.minimumVersion}
                      onChange={(event) =>
                        updateDashboardExecution((current) => ({
                          ...current,
                          minimumVersion: event.target.value,
                        }))
                      }
                      placeholder="What counts in 5-15 minutes if energy is low?"
                      className="min-h-[82px] rounded-2xl border border-white/[0.06] bg-[#171A21] px-3 py-2.5 text-sm leading-6 text-white/88 outline-none transition placeholder:text-white/30 focus:border-[#78A7FF]/28 focus:bg-[#1C2029]"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {executionActions.map((action) => {
                  const active = dashboardExecution.status === action.status
                  return (
                    <button
                      key={action.status}
                      type="button"
                      onClick={() =>
                        updateDashboardExecution((current) => ({
                          ...current,
                          status: action.status,
                        }))
                      }
                      className={`rounded-full border px-3.5 py-2 text-sm transition ${
                        active
                          ? 'border-[#78A7FF]/34 bg-[#78A7FF]/14 text-[#D8E6FF]'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {action.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:max-w-[420px] xl:justify-self-end">
            <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.025] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/52">Excuse killer</p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-white/78">
                <div>
                  <p className="text-white/42">&ldquo;I need more clarity first.&rdquo;</p>
                  <p>Start small. Start now.</p>
                </div>
                <div>
                  <p className="text-white/42">&ldquo;I don&apos;t have enough time.&rdquo;</p>
                  <p>Do the minimum version and keep momentum alive.</p>
                </div>
                <div>
                  <p className="text-white/42">&ldquo;I should do it properly later.&rdquo;</p>
                  <p>Done &gt; perfect.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.025] p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/52">Supporting blocks</p>

              <div className="grid gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/42">Deep work</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        deepWorkDone: !current.deepWorkDone,
                      }))
                    }
                    className={`rounded-full border px-3 py-2 text-sm transition ${
                      dashboardExecution.deepWorkDone
                        ? 'border-[#4FDC94]/28 bg-[#4FDC94]/12 text-[#CFF8DE]'
                        : 'border-white/[0.08] bg-white/[0.03] text-white/74 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    {dashboardExecution.deepWorkDone ? 'Deep work done' : 'Mark deep work done'}
                  </button>
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/42">Movement</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: false, label: 'Not done' },
                    { value: true, label: 'Done' },
                  ].map((option) => {
                    const active = dashboardExecution.movementDone === option.value
                    return (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() =>
                          updateDashboardExecution((current) => ({
                            ...current,
                            movementDone: option.value,
                          }))
                        }
                        className={`rounded-full border px-3 py-2 text-sm transition ${
                          active
                            ? 'border-[#78A7FF]/28 bg-[#78A7FF]/12 text-[#D8E6FF]'
                            : 'border-white/[0.08] bg-white/[0.03] text-white/72 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-3">
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/42">Night reset</span>
                <label className="grid gap-2">
                  <span className="text-xs text-white/42">Short reflection</span>
                  <textarea
                    rows={2}
                    value={dashboardExecution.nightResetReflection}
                    onChange={(event) =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        nightResetReflection: event.target.value,
                      }))
                    }
                    placeholder="What needs to be honest tonight?"
                    className="min-h-[72px] rounded-2xl border border-white/[0.06] bg-[#171717] px-3 py-2.5 text-sm leading-6 text-white/86 outline-none transition placeholder:text-white/30 focus:border-white/[0.12] focus:bg-[#1D1D1D]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs text-white/42">Next task for tomorrow</span>
                  <input
                    value={dashboardExecution.nightResetNextTask}
                    onChange={(event) =>
                      updateDashboardExecution((current) => ({
                        ...current,
                        nightResetNextTask: event.target.value,
                      }))
                    }
                    placeholder="Leave tomorrow one obvious next step"
                    className="rounded-2xl border border-white/[0.06] bg-[#171717] px-3 py-2.5 text-sm text-white/88 outline-none transition placeholder:text-white/30 focus:border-white/[0.12] focus:bg-[#1D1D1D]"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tasks</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-mist/70">{Math.min(visibleTasks.length, 5)} visible</span>
                <button
                  type="button"
                  onClick={() => setTaskPanelOpen(true)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/74 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Open full list
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`group relative flex items-start gap-3 rounded-2xl border px-3 py-2.5 transition duration-150 ${
                      task.completed
                        ? 'border-white/[0.05] bg-white/[0.02] text-white/55 hover:border-white/[0.07] hover:bg-white/[0.025]'
                        : task.important
                          ? 'border-[#A94D45]/35 bg-[#2A1615]/40 text-white hover:border-[#C15E55]/45 hover:bg-[#301918]/46]'
                          : task.starred || index === 0
                            ? 'border-white/[0.12] bg-white/[0.045] text-white hover:border-white/[0.16] hover:bg-white/[0.06]'
                          : 'border-white/[0.08] bg-white/[0.03] text-white hover:border-white/[0.13] hover:bg-white/[0.05]'
                    }`}
                  >
                    {!task.completed && task.important ? <span className="mt-0.5 h-5 w-0.5 rounded-full bg-[#D06C61]" aria-hidden="true" /> : null}
                    <button
                      type="button"
                      onClick={() => onToggleTask(task.id)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                        task.completed ? 'border-[#4FDC94]/35 bg-[#4FDC94]/12 text-[#7CE7AE]' : 'border-white/18 text-white/45'
                      }`}
                      aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                    >
                      {task.completed ? '✓' : ''}
                    </button>
                    <div className="min-w-0 flex-1 overflow-hidden text-left">
                      <p
                        className={`text-sm transition-[color] duration-150 ${task.completed ? 'text-white/55 line-through' : task.important || task.starred || index === 0 ? 'font-medium text-white/92 group-hover:text-white' : 'text-white/84 group-hover:text-white/92'}`}
                        style={{
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitBoxOrient: 'vertical',
                          WebkitLineClamp: 2,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {task.text}
                      </p>
                    </div>
                    <div className="flex w-[68px] shrink-0 items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleTaskStarred(task.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none transition ${
                          task.starred
                            ? 'opacity-100 text-[#F2C46D]'
                            : 'opacity-0 text-white/35 group-hover:opacity-100 hover:text-white/72'
                        }`}
                        aria-label={task.starred ? 'Remove star' : 'Star task'}
                      >
                        ★
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleTaskImportant(task.id)}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] leading-none transition ${
                          task.important
                            ? 'opacity-100 text-[#F08A7B]'
                            : 'opacity-0 text-white/35 group-hover:opacity-100 hover:text-[#F08A7B]'
                        }`}
                        aria-label={task.important ? 'Remove important mark' : 'Mark task important'}
                      >
                        !
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-white/35 opacity-0 transition group-hover:opacity-100 hover:text-white/72"
                        aria-label="Delete task"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-mist">No focus tasks yet. Add one quick next step.</p>
              )}
            </div>
            <form
              className="mt-4 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const trimmed = taskDraft.trim()
                if (!trimmed) return
                onAddTask(trimmed)
                setTaskDraft('')
              }}
            >
              <input
                value={taskDraft}
                onChange={(event) => setTaskDraft(event.target.value)}
                placeholder="Add a focus task"
                className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2 text-sm text-white/88 outline-none transition placeholder:text-white/34 focus:border-white/[0.14] focus:bg-[#202020]"
              />
              <Button type="submit" variant="soft">
                Add
              </Button>
            </form>
          </Card>
        </div>

        <div className="grid gap-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Current signal</p>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold theme-text-primary">{currentSignal.label}</h3>
                <p className="mt-2 max-w-md text-sm text-mist">{currentSignal.copy}</p>
              </div>
              <div className="theme-surface-soft rounded-2xl border px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Momentum</p>
                <p className="mt-2 text-sm font-semibold theme-text-primary">{currentSignal.momentumDirection}</p>
              </div>
            </div>
            <div className="theme-chart-panel mt-4 h-32 rounded-[22px] border px-2 py-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={moodTrend}>
                  <CartesianGrid stroke="rgb(var(--theme-chart-grid-rgb))" vertical={false} />
                  <XAxis dataKey="name" stroke="rgb(var(--theme-chart-axis-rgb))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgb(var(--theme-chart-axis-rgb))" fontSize={12} domain={[0, 5]} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ stroke: 'rgb(var(--theme-chart-grid-rgb))', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'rgb(var(--theme-chart-tooltip-bg-rgb))',
                      border: '1px solid rgb(var(--theme-chart-tooltip-border-rgb))',
                      color: 'rgb(var(--theme-text-primary-rgb))',
                      borderRadius: '18px',
                      boxShadow: '0 16px 34px rgba(15, 23, 42, 0.16)',
                    }}
                    itemStyle={{ color: 'rgb(var(--theme-text-secondary-rgb))' }}
                    labelStyle={{ color: 'rgb(var(--theme-text-primary-rgb))' }}
                  />
                  <Area type="monotone" dataKey="am" stroke="rgb(var(--theme-info-rgb))" fill="rgb(var(--theme-info-rgb) / 0.18)" />
                  <Area type="monotone" dataKey="pm" stroke="rgb(var(--theme-warning-rgb))" fill="rgb(var(--theme-warning-rgb) / 0.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_0.95fr]">
          <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Year in weeks</p>
              <p className="mt-1 text-sm text-mist">Jump straight into the tracker from a compact weekly view.</p>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <WeekHeatmap weeks={weeks} mode="overall" onSelectWeek={onGoToTrackerWeek} compact showBadHabitMarkers={showBadHabitTracking} />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Habit consistency</p>
          <div className="mt-4 space-y-3">
            {topHabits.slice(0, 4).map((habit) => (
              <div key={habit.label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">{habit.label}</p>
                  <p className="text-sm text-mist">{habit.value}</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-glow" style={{ width: habit.value }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Bad habit streaks</p>
            <div className="mt-4 space-y-3">
              {showBadHabitTracking && badHabitStreaks.length > 0 ? (
                badHabitStreaks.map(({ habit, streak, startsToday, brokenToday }) => (
                  <div key={habit.id} className="flex items-end justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0">
                    <p className="text-sm text-white/84">{habit.name}</p>
                    <p className="text-sm font-semibold text-white">
                      {startsToday ? 'Starts today' : brokenToday ? '0 days' : `${streak} days`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-mist">No streaks visible yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Active goals</p>
                <p className="mt-1 text-sm text-mist">A compact view of what is currently in motion.</p>
              </div>
              <Button onClick={onOpenGoals}>Open goals</Button>
            </div>
            <div className="mt-4 space-y-3">
              {activeGoals.length > 0 ? (
                activeGoals.map(({ tracker, progress }) => {
                  const completion = progress.target > 0 ? Math.min((progress.current / progress.target) * 100, 100) : 0
                  return (
                    <div key={tracker.id} className="rounded-2xl border border-white/[0.05] bg-panelSoft/45 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{tracker.title}</p>
                          <p className="mt-1 text-xs text-mist">{progress.progressText}</p>
                        </div>
                        <span className="text-xs uppercase tracking-[0.18em] text-mist/70">{Math.round(completion)}%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-[#4FDC94]/80 transition-[width] duration-200" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-mist">No active goals yet. Set one on a habit heatmap to bring it in here.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Recent wins</p>
          <div className="mt-4 space-y-2.5">
            {recentWins.slice(0, 2).map((week) => (
              <div key={week.id} className="rounded-2xl border border-white/5 bg-panelSoft/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Week {week.weekNumber}</p>
                    <p className="mt-1 text-sm text-mist">{week.bigWin}</p>
                  </div>
                  <Button onClick={() => onOpenWeek(week)}>Open</Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {week.tags.map((tagId) => {
                    const tag = tags.find((item) => item.id === tagId)
                    return tag ? <TagPill key={tag.id} tag={tag} /> : null
                  })}
                </div>
              </div>
            ))}
            {recentWins.length === 0 ? <p className="text-sm text-mist">No wins logged yet.</p> : null}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Journal highlights</p>
          <div className="mt-4 space-y-3">
            {journalHighlights.map((day) => (
              <button
                key={day.id}
                type="button"
                onClick={() => onOpenDay(day)}
                className="w-full rounded-2xl border border-white/5 bg-panelSoft/50 p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
              >
                <p className="text-sm font-semibold text-white">
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="mt-2 line-clamp-3 text-sm text-mist">{day.journal || day.moodNote}</p>
              </button>
            ))}
            {journalHighlights.length === 0 ? <p className="text-sm text-mist">No journal highlights yet.</p> : null}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Quick Notes</p>
              <p className="mt-1 text-sm text-mist">Capture anything you need while working.</p>
            </div>
            <button type="button" onClick={onOpenFullNote} className="text-sm text-white/62 transition hover:text-white/82">
              Open full note
            </button>
          </div>
          <textarea
            ref={quickNotesRef}
            value={todayEntry.dashboardQuickNote}
            onChange={(event) =>
              onUpdateDay(todayEntry.id, (current) => ({
                ...current,
                isLogged: true,
                dashboardQuickNote: event.target.value,
              }))
            }
            onInput={(event) => resizeDashboardTextarea(event.currentTarget)}
            placeholder="Break down a task, plan, or think out loud..."
            className="mt-4 min-h-[140px] w-full resize-none overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/88 outline-none transition placeholder:text-white/34 focus:border-white/[0.12] focus:bg-white/[0.035]"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Scratchpad</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {scratchpadRecoveryMessage ? <p className="text-[11px] text-[#BDEFCF]">{scratchpadRecoveryMessage}</p> : null}
                <button
                  type="button"
                  onClick={forceRestoreScratchpadFromStorage}
                  className="text-[11px] text-white/54 transition hover:text-white/82"
                >
                  Restore workspace
                </button>
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!workspaceRecord) return
                        applyRecoveredScratchpad(
                        workspaceRecord.workspace,
                        `Restored saved workspace from ${workspaceRecord.updatedAt || 'storage'}`,
                        )
                      }}
                    disabled={!workspaceRecord}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                      workspaceRecord
                        ? 'border-white/[0.08] text-white/56 hover:border-white/[0.14] hover:text-white/84'
                        : 'border-white/[0.04] text-white/22'
                    }`}
                  >
                    Saved
                  </button>
                  {scratchpadRecoverySlots.map(({ slot, backup }) => (
                    <button
                      key={`backup-slot-${slot}`}
                      type="button"
                      onClick={() => {
                        if (!backup) return
                        applyRecoveredScratchpad(
                          backup.record.workspace,
                          `Restored workspace backup ${slot} from ${backup.record.updatedAt || 'storage'}`,
                        )
                      }}
                      disabled={!backup}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                        backup
                          ? 'border-white/[0.08] text-white/56 hover:border-white/[0.14] hover:text-white/84'
                          : 'border-white/[0.04] text-white/22'
                      }`}
                    >
                      B{slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setWorkspaceScratchpad((current) => ({ ...current, mode: 'free' }))}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                  workspaceScratchpad.mode === 'free' ? 'bg-white text-black' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceScratchpad((current) => ({ ...current, mode: 'structured' }))}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                  workspaceScratchpad.mode === 'structured' ? 'bg-white text-black' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                Finances
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceScratchpad((current) => ({ ...current, mode: 'todo' }))}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                  workspaceScratchpad.mode === 'todo' ? 'bg-white text-black' : 'text-white/65 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                To Do List
              </button>
            </div>
          </div>

          {workspaceScratchpad.mode === 'free' ? (
            <div className="relative z-10 mt-2 mb-[-12px] flex items-end justify-between gap-3 px-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
                {scratchpadFreeNotes.map((note) =>
                  renamingFreeNoteId === note.id ? (
                    <input
                      key={note.id}
                      ref={freeNoteTitleInputRef}
                      value={freeNoteTitleDraft}
                      onChange={(event) => setFreeNoteTitleDraft(event.target.value)}
                      onBlur={() => commitFreeNoteRename(note.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitFreeNoteRename(note.id)
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setRenamingFreeNoteId(null)
                          setFreeNoteTitleDraft('')
                        }
                      }}
                      className="h-9 min-w-[108px] rounded-[18px] border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-white/88 outline-none transition focus:border-white/[0.14] focus:bg-white/[0.045]"
                    />
                  ) : (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => {
                        if (note.id === activeFreeNoteId) {
                          startFreeNoteRename(note)
                          return
                        }

                        setRenamingFreeNoteId(null)
                        setFreeNoteTitleDraft('')
                        updateScratchpadFreeNotes((notes) => notes, note.id)
                      }}
                      className={`shrink-0 rounded-[18px] px-3.5 py-2 text-sm transition ${
                        note.id === activeFreeNoteId
                          ? 'bg-white/[0.02] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                          : 'text-white/52 hover:bg-white/[0.025] hover:text-white/80'
                      }`}
                    >
                      {note.title}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                onClick={createNewFreeNoteTab}
                className="shrink-0 rounded-[18px] px-3 py-2 text-sm text-white/50 transition hover:bg-white/[0.025] hover:text-white/80"
              >
                + New
              </button>
            </div>
          ) : null}

          <div
            className={`min-h-[240px] overflow-hidden transition-[height] duration-200 ease-out ${
              workspaceScratchpad.mode === 'free' ? 'mt-2' : 'mt-3'
            }`}
            style={scratchpadPanelHeight ? { height: scratchpadPanelHeight } : undefined}
          >
            <div ref={scratchpadContentRef} className="transition-opacity duration-150 ease-out">
              {workspaceScratchpad.mode === 'free' ? (
                <textarea
                  ref={scratchpadTextRef}
                  value={activeFreeNote?.text ?? ''}
                  onChange={(event) =>
                    updateScratchpadFreeNotes((notes) =>
                      notes.map((note) => (note.id === activeFreeNoteId ? { ...note, text: event.target.value } : note)),
                    )
                  }
                  onInput={(event) => resizeDashboardTextarea(event.currentTarget, 160)}
                  placeholder="Break down a task, plan, or think out loud..."
                  className="min-h-[160px] w-full resize-none overflow-hidden rounded-[24px] bg-white/[0.02] px-4 pt-7 pb-3 text-sm leading-7 text-white/88 outline-none transition placeholder:text-white/30 focus:bg-white/[0.03]"
                />
              ) : workspaceScratchpad.mode === 'todo' ? (
                <ScratchpadTodoSection
                  items={workspaceScratchpad.todoItems}
                  onAdd={() => setWorkspaceScratchpad((current) => ({ ...current, todoItems: [...current.todoItems, createScratchpadTodoItem()] }))}
                  onUpdateItem={(itemId, updater) =>
                    setWorkspaceScratchpad((current) => ({
                      ...current,
                      todoItems: current.todoItems.map((item) => (item.id === itemId ? updater(item) : item)),
                    }))
                  }
                  onRemoveItem={(itemId) =>
                    setWorkspaceScratchpad((current) => ({
                      ...current,
                      todoItems: current.todoItems.filter((item) => item.id !== itemId),
                    }))
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white/[0.02] px-3.5 py-2.5">
                <button
                  type="button"
                  onClick={() => openFinanceMonth(shiftFinanceMonthKey(selectedFinanceMonth, -1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-white/56 transition hover:bg-white/[0.04] hover:text-white/82"
                  aria-label="Open previous finance month"
                >
                  &lt;
                </button>
                <p className="text-sm font-medium text-white/84">{currentFinanceMonthLabel}</p>
                <button
                  type="button"
                  onClick={() => openFinanceMonth(shiftFinanceMonthKey(selectedFinanceMonth, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-white/56 transition hover:bg-white/[0.04] hover:text-white/82"
                  aria-label="Open next finance month"
                >
                  &gt;
                </button>
              </div>

                  <ScratchpadSection
                    title="Incoming"
                    monthKey={selectedFinanceMonth}
                    items={activeIncomingItems}
                    kind="active"
                    emptyText="Nothing incoming yet."
                    toggleVerb="received"
                    financeFeedback={financeFeedback}
                    onAdd={() => updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({ ...sheet, moneyIn: [...sheet.moneyIn, createScratchpadItem('in')] }))}
                    onToggleSettled={(item) => {
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyIn: sheet.moneyIn.map((entry) => (entry.id === item.id ? { ...entry, settled: !entry.settled } : entry)),
                      }))
                      showFinanceFeedback(
                        item.id,
                        `+${formatScratchpadCurrency(Number(normalizeScratchpadAmount(item.amount)) || 0)} received`,
                        'incoming',
                      )
                    }}
                    onUpdateItem={(itemId, field, value) =>
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyIn: sheet.moneyIn.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
                      }))
                    }
                    onRemoveItem={(itemId) =>
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyIn: sheet.moneyIn.filter((item) => item.id !== itemId),
                      }))
                    }
                  />

                  <ScratchpadSection
                    title="Outgoing"
                    monthKey={selectedFinanceMonth}
                    items={activeOutgoingItems}
                    kind="active"
                    emptyText="Nothing outgoing yet."
                    toggleVerb="paid"
                    financeFeedback={financeFeedback}
                    onAdd={() => updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({ ...sheet, moneyOut: [...sheet.moneyOut, createScratchpadItem('out')] }))}
                    onToggleSettled={(item) => {
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyOut: sheet.moneyOut.map((entry) => (entry.id === item.id ? { ...entry, settled: !entry.settled } : entry)),
                      }))
                      showFinanceFeedback(item.id, `${formatScratchpadCurrency(Number(normalizeScratchpadAmount(item.amount)) || 0)} paid`, 'outgoing')
                    }}
                    onUpdateItem={(itemId, field, value) =>
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyOut: sheet.moneyOut.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
                      }))
                    }
                    onRemoveItem={(itemId) =>
                      updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                        ...sheet,
                        moneyOut: sheet.moneyOut.filter((item) => item.id !== itemId),
                      }))
                    }
                  />

                  <div className="rounded-[22px] bg-white/[0.02] p-3.5">
                    <p className="text-[10px] uppercase tracking-[0.26em] text-mist/60">Summary</p>
                    <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                      <SummaryStat label="Total incoming" value={formatScratchpadCurrency(scratchpadTotals.incoming)} tone="positive" />
                      <SummaryStat label="Total outgoing" value={formatScratchpadCurrency(scratchpadTotals.outgoing)} tone="negative" />
                      <SummaryStat
                        label="Net value"
                        value={formatScratchpadCurrency(scratchpadTotals.incoming - scratchpadTotals.outgoing)}
                        tone={scratchpadTotals.incoming - scratchpadTotals.outgoing >= 0 ? 'positive' : 'negative'}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ScratchpadSection
                      title="Received"
                      monthKey={selectedFinanceMonth}
                      items={receivedItems}
                      kind="settled"
                      emptyText="Nothing received yet."
                      toggleVerb="received"
                      financeFeedback={financeFeedback}
                      onToggleSettled={(item) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyIn: sheet.moneyIn.map((entry) => (entry.id === item.id ? { ...entry, settled: !entry.settled } : entry)),
                        }))
                      }
                      onAdd={undefined}
                      onUpdateItem={(itemId, field, value) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyIn: sheet.moneyIn.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
                        }))
                      }
                      onRemoveItem={(itemId) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyIn: sheet.moneyIn.filter((item) => item.id !== itemId),
                        }))
                      }
                    />

                    <ScratchpadSection
                      title="Paid"
                      monthKey={selectedFinanceMonth}
                      items={paidItems}
                      kind="settled"
                      emptyText="Nothing paid yet."
                      toggleVerb="paid"
                      financeFeedback={financeFeedback}
                      onToggleSettled={(item) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyOut: sheet.moneyOut.map((entry) => (entry.id === item.id ? { ...entry, settled: !entry.settled } : entry)),
                        }))
                      }
                      onAdd={undefined}
                      onUpdateItem={(itemId, field, value) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyOut: sheet.moneyOut.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
                        }))
                      }
                      onRemoveItem={(itemId) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          moneyOut: sheet.moneyOut.filter((item) => item.id !== itemId),
                        }))
                      }
                    />
                  </div>

                  <div className="rounded-[22px] bg-white/[0.02] p-3.5">
                    <p className="text-[10px] uppercase tracking-[0.26em] text-mist/60">Notes</p>
                    <textarea
                      ref={scratchpadNotesRef}
                      value={currentFinanceSheet.notes}
                      onChange={(event) =>
                        updateFinanceSheetForMonth(selectedFinanceMonth, (sheet) => ({
                          ...sheet,
                          notes: event.target.value,
                        }))
                      }
                      onInput={(event) => resizeDashboardTextarea(event.currentTarget, 96)}
                      placeholder="Context, assumptions, next steps..."
                      className="mt-2.5 min-h-[96px] w-full resize-none overflow-hidden rounded-[20px] bg-white/[0.02] px-3.5 py-3 text-sm leading-6 text-white/80 outline-none transition placeholder:text-white/28 focus:bg-white/[0.03]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {taskPanelOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]" onClick={() => setTaskPanelOpen(false)} />
          <aside
            className="fixed right-0 top-0 z-50 flex h-screen min-w-[340px] flex-col border-l border-white/[0.08] bg-[#111111] shadow-[-20px_0_60px_rgba(0,0,0,0.38)] transition-[width] duration-200 ease-out"
            style={{ width: `${resolvedTaskPanelWidth}px` }}
          >
            <button
              type="button"
              aria-label="Resize task panel"
              onMouseDown={(event) => {
                taskPanelResizeRef.current = {
                  startX: event.clientX,
                  startWidth: resolvedTaskPanelWidth,
                }
                document.body.style.cursor = 'ew-resize'
                document.body.style.userSelect = 'none'
                event.preventDefault()
              }}
              className="absolute left-0 top-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize bg-transparent"
            >
              <span className="absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.08] transition hover:bg-white/[0.18]" />
            </button>
            <div className="border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Tasks</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Full task list</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextExpanded = !taskPanelExpanded
                      setTaskPanelExpanded(nextExpanded)
                      setTaskPanelWidth(nextExpanded ? taskPanelWidthBounds.expanded : taskPanelWidthBounds.default)
                    }}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    {taskPanelExpanded ? 'Default width' : 'Expand'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskPanelOpen(false)}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/72 transition hover:bg-white/[0.05] hover:text-white"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <input
                  value={taskPanelSearch}
                  onChange={(event) => setTaskPanelSearch(event.target.value)}
                  placeholder="Search tasks"
                  className="w-full rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white/88 outline-none transition placeholder:text-white/34 focus:border-white/[0.14] focus:bg-[#202020]"
                />
                <div className="flex flex-wrap gap-2">
                  {([
                    ['all', 'All'],
                    ['starred', 'Starred'],
                    ['important', 'Important'],
                    ['open', 'Open'],
                    ['completed', 'Completed'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTaskPanelFilter(value)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        taskPanelFilter === value
                          ? 'border-white/[0.14] bg-white/[0.08] text-white'
                          : 'border-white/[0.08] bg-white/[0.03] text-white/62 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              <div className="space-y-2.5">
                {panelTasks.length > 0 ? (
                  panelTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`group relative rounded-2xl border px-3 py-3 transition ${
                        task.completed
                          ? 'border-white/[0.05] bg-white/[0.02]'
                          : task.important
                            ? 'border-[#A94D45]/35 bg-[#2A1615]/40'
                            : task.starred
                              ? 'border-white/[0.12] bg-white/[0.045]'
                              : 'border-white/[0.08] bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleTask(task.id)}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                            task.completed ? 'border-[#4FDC94]/35 bg-[#4FDC94]/12 text-[#7CE7AE]' : 'border-white/18 text-white/45'
                          }`}
                          aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
                        >
                          {task.completed ? '✓' : ''}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className={`text-sm ${task.completed ? 'text-white/55 line-through' : 'text-white/86'}`}>{task.text}</p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onToggleTaskStarred(task.id)}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none transition ${
                                  task.starred ? 'text-[#F2C46D]' : 'text-white/35 hover:text-white/72'
                                }`}
                                aria-label={task.starred ? 'Remove star' : 'Star task'}
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                onClick={() => onToggleTaskImportant(task.id)}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] leading-none transition ${
                                  task.important ? 'text-[#F08A7B]' : 'text-white/35 hover:text-[#F08A7B]'
                                }`}
                                aria-label={task.important ? 'Remove important mark' : 'Mark task important'}
                              >
                                !
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTask(task.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-white/35 transition hover:text-white/72"
                                aria-label="Delete task"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[12px] text-white/42">
                            <span>{task.dueDate}</span>
                            {task.starred ? <span>• Focused</span> : null}
                            {task.important ? <span className="text-[#D58A82]">• Important</span> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-mist">No tasks match the current filter.</p>
                )}
              </div>
            </div>
          </aside>
        </>
      ) : null}
      {quickAddEventOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => {
              setQuickAddEventOpen(false)
              resetQuickAddEvent()
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[720px] rounded-[28px] border border-white/[0.08] bg-[#121212] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/70">Daily Event</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Quick Add Event</h3>
                  <p className="mt-1 text-sm text-mist">This saves straight into today&apos;s Day Events.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddEventOpen(false)
                    resetQuickAddEvent()
                  }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/70 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                <input
                  value={quickAddEventDraft.title}
                  onChange={(event) => setQuickAddEventDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Event title"
                  className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                />
                <input
                  type="time"
                  value={quickAddEventDraft.time}
                  onChange={(event) => setQuickAddEventDraft((current) => ({ ...current, time: event.target.value }))}
                  className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] focus:border-white/[0.14] focus:bg-[#202020]"
                />
              </div>

              <textarea
                value={quickAddEventDraft.description}
                onChange={(event) => setQuickAddEventDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description (optional)"
                className="mt-3 min-h-[96px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
              />

              <div className="mt-4 space-y-3 rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-3.5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mist/60">Tags</p>
                <DashboardEventTagPicker
                  title="Mood"
                  tags={dayMoodEventTags}
                  selectedIds={quickAddEventSelectedTagIds}
                  onToggle={(tagId) =>
                    setQuickAddEventSelectedTagIds((current) =>
                      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                    )
                  }
                />
                <DashboardEventTagPicker
                  title="Actions"
                  tags={dayActionEventTags}
                  selectedIds={quickAddEventSelectedTagIds}
                  onToggle={(tagId) =>
                    setQuickAddEventSelectedTagIds((current) =>
                      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                    )
                  }
                />
                <DashboardEventTagPicker
                  title="Events"
                  tags={dayEventTags}
                  selectedIds={quickAddEventSelectedTagIds}
                  onToggle={(tagId) =>
                    setQuickAddEventSelectedTagIds((current) =>
                      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                    )
                  }
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setQuickAddEventOpen(false)
                    resetQuickAddEvent()
                  }}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/72 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveQuickAddEvent}
                  className="rounded-full border border-[#78A7FF]/28 bg-[#78A7FF]/14 px-4 py-2.5 text-sm text-[#D8E6FF] transition hover:border-[#78A7FF]/38 hover:bg-[#78A7FF]/18"
                >
                  Save event
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
        </>
      )}
    </div>
  )
}

function getCurrentSignal(moodTrend: Array<{ name: string; am: number | null; pm: number | null }>) {
  const recent = moodTrend
    .map((item) => {
      const values = [item.am, item.pm].filter((value): value is number => value != null)
      return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
    })
    .filter((value): value is number => value != null)

  if (recent.length < 2) {
    return {
      label: 'Still building signal',
      copy: 'A little more consistent logging will make the daily signal more useful here.',
      momentumDirection: 'Steady',
    }
  }

  const latest = recent[recent.length - 1]
  const previous = recent[recent.length - 2]
  const delta = latest - previous

  if (delta >= 0.4) {
    return {
      label: 'State is lifting',
      copy: 'Recent mood readings are moving upward. This is a good moment to protect momentum.',
      momentumDirection: 'Up',
    }
  }

  if (delta <= -0.4) {
    return {
      label: 'Signal is softening',
      copy: 'Recent mood readings dipped a little. Keep the next step small and stabilising.',
      momentumDirection: 'Down',
    }
  }

  return {
    label: 'Signal is steady',
    copy: 'Recent mood readings are holding fairly even. Use the day well without overcomplicating it.',
    momentumDirection: 'Steady',
  }
}

function getSortedDashboardTasks(tasks: Task[]) {
  const todayIso = new Date().toISOString().slice(0, 10)

  return [...tasks].sort((left, right) => {
    if (left.starred !== right.starred) return left.starred ? -1 : 1
    const leftPriority = getTaskPriority(left, todayIso)
    const rightPriority = getTaskPriority(right, todayIso)

    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    if (left.important !== right.important) return left.important ? -1 : 1
    if (left.completed !== right.completed) return left.completed ? 1 : -1
    if (left.dueDate !== right.dueDate) return left.dueDate.localeCompare(right.dueDate)
    if ((left.completedAt ?? '') !== (right.completedAt ?? '')) return (right.completedAt ?? '').localeCompare(left.completedAt ?? '')
    return left.text.localeCompare(right.text)
  })
}

function getTaskPriority(task: Task, todayIso: string) {
  if (task.dueDate < todayIso) return 0
  if (task.dueDate === todayIso) return 1
  return 2
}

function resizeDashboardTextarea(textarea: HTMLTextAreaElement, minHeight = 140) {
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(minHeight, textarea.scrollHeight)}px`
}

function createScratchpadItem(prefix: 'in' | 'out') {
  return {
    id: `scratch-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    day: '',
    amount: '',
    settled: false,
  }
}

function createScratchpadTodoItem() {
  return {
    id: `scratch-todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: '',
    completed: false,
  }
}

function createScratchpadFreeNote(index: number): ScratchpadFreeNote {
  return {
    id: `scratch-free-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: getScratchpadFreeNoteTitle(index - 1),
    text: '',
  }
}

function getScratchpadFreeNotes(
  scratchpad: { freeNotes?: ScratchpadFreeNote[]; text?: string },
  dayId: string,
): ScratchpadFreeNote[] {
  if (Array.isArray(scratchpad.freeNotes) && scratchpad.freeNotes.length > 0) {
    return scratchpad.freeNotes.map((note, index) => ({
      id: note.id,
      title: note.title?.trim().length ? note.title : getScratchpadFreeNoteTitle(index),
      text: note.text ?? '',
    }))
  }

  return [
    {
      id: `scratch-free-${dayId}`,
      title: 'Note 1',
      text: scratchpad.text ?? '',
    },
  ]
}

function resolveActiveFreeNoteId(notes: ScratchpadFreeNote[], activeId: string | null | undefined) {
  if (activeId && notes.some((note) => note.id === activeId)) return activeId
  const populatedNote = notes.find((note, index) => scratchpadFreeNoteHasContent(note, index))
  if (populatedNote) return populatedNote.id
  return notes[0]?.id ?? null
}

function getScratchpadFreeNoteTitle(index: number) {
  return `Note ${index + 1}`
}

function countCompletedEntriesWithinRange(tracker: HabitTracker, startDate: string, endDate: string) {
  return Object.values(tracker.entries).reduce((count, entry) => {
    if (!entry.completed) return count
    if (entry.date < startDate || entry.date > endDate) return count
    return count + 1
  }, 0)
}

function getTrackerWeekDots(tracker: HabitTracker, startDate: string, endDate: string, todayDate: string) {
  const activeDateSet = new Set(getHabitTrackerActiveDatesInRange(tracker, startDate, endDate))
  return getDateRangeInclusive(startDate, endDate).map((date) => {
    const entry = tracker.entries[date]
    const isActive = activeDateSet.has(date)

    let state: 'completed' | 'missed' | 'future' | 'inactive' = 'missed'
    if (!isActive) state = 'inactive'
    else if (date > todayDate) state = 'future'
    else if (entry?.completed) state = 'completed'

    return { date, state }
  })
}

function getDashboardWeeklyHabitMetrics(
  habitTrackers: HabitTracker[],
  startDate: string,
  endDate: string,
  days: DayEntry[],
) {
  const loggedDaysCount = days.filter((day) => day.date >= startDate && day.date <= endDate && day.isLogged).length

  const totals = habitTrackers.reduce(
    (sum, tracker) => {
      const eligibleDates = getHabitTrackerActiveDatesInRange(tracker, startDate, endDate)
      const completedCount = eligibleDates.reduce((count, date) => (tracker.entries[date]?.completed ? count + 1 : count), 0)

      return {
        expectedActions: sum.expectedActions + eligibleDates.length,
        completedActions: sum.completedActions + completedCount,
      }
    },
    { expectedActions: 0, completedActions: 0 },
  )

  const completionPercent =
    totals.expectedActions > 0 ? Math.round((totals.completedActions / totals.expectedActions) * 100) : 0

  return {
    loggedDaysCount,
    completionPercent,
  }
}

function getDashboardDayHabitMetrics(habitTrackers: HabitTracker[], date: string) {
  return habitTrackers.reduce(
    (totals, tracker) => {
      if (!isHabitTrackerActiveOnDate(tracker, date)) {
        return totals
      }

      return {
        total: totals.total + 1,
        completed: totals.completed + (tracker.entries[date]?.completed ? 1 : 0),
      }
    },
    { completed: 0, total: 0 },
  )
}

function getWeeklyInsightMessage(
  habitTrackers: HabitTracker[],
  startDate: string,
  endDate: string,
  todayDate: string,
) {
  const elapsedDates = getDateRangeInclusive(startDate, endDate).filter((date) => date <= todayDate)

  if (elapsedDates.length <= 2) {
    return 'New week - time to get to work.'
  }

  const laggingHabit = habitTrackers.find((tracker) => {
    const eligibleDateSet = new Set(getHabitTrackerActiveDatesInRange(tracker, startDate, endDate))
    const eligibleElapsedDates = elapsedDates.filter((date) => eligibleDateSet.has(date))
    if (eligibleElapsedDates.length < 3) return false

    const completedCount = eligibleElapsedDates.reduce((count, date) => (tracker.entries[date]?.completed ? count + 1 : count), 0)
    return completedCount === 0
  })

  if (laggingHabit) {
    return `${laggingHabit.title} hasn't been logged in ${elapsedDates.length} days.`
  }

  const allOnTrack = habitTrackers.every((tracker) => {
    const eligibleDateSet = new Set(getHabitTrackerActiveDatesInRange(tracker, startDate, endDate))
    const eligibleElapsedDates = elapsedDates.filter((date) => eligibleDateSet.has(date))
    if (eligibleElapsedDates.length === 0) return true
    return eligibleElapsedDates.every((date) => tracker.entries[date]?.completed)
  })

  if (allOnTrack) {
    return 'All habits on track. Keep it going.'
  }

  return 'Keep the week moving with one useful action at a time.'
}

function formatDashboardWeekRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()

  if (sameMonth) {
    return `${start.toLocaleDateString('en-IE', { month: 'short', timeZone: 'UTC' })} ${start.getUTCDate()}-${end.getUTCDate()}`
  }

  return `${start.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', timeZone: 'UTC' })}-${end.toLocaleDateString('en-IE', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}

function getHabitStreakClassName(streak: number) {
  if (streak >= 21) return 'font-semibold text-[#BEECCF]'
  if (streak >= 14) return 'font-medium text-[#C9E9D4]'
  return 'font-normal text-white/24'
}

function getHabitStreakStyle(streak: number) {
  if (streak >= 21) {
    return {
      textShadow: '0 0 10px rgba(47,163,107,0.14)',
    }
  }

  return undefined
}

function getDateRangeInclusive(startDate: string, endDate: string) {
  const dates: string[] = []
  const cursor = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

function getRecentMoodDots(days: DayEntry[], todayDate: string) {
  return days
    .filter((day) => day.date <= todayDate)
    .slice(-7)
    .map((day) => {
      return {
        date: day.date,
        color: getDayColor(day, 'mood'),
        label: `${day.date}${day.isLogged ? '' : ' Not logged'}`,
      }
    })
}

function getLatestWinEntry(days: DayEntry[], weekStartDate: string, weekEndDate: string) {
  const normalizeWinDays = (entries: DayEntry[]) =>
    [...entries]
      .filter((day) => day.bigWin.trim().length > 0)
      .sort((left, right) => right.date.localeCompare(left.date))

  const currentWeekWins = normalizeWinDays(days.filter((day) => day.date >= weekStartDate && day.date <= weekEndDate))
  const fallbackWins = normalizeWinDays(days)
  const winner = currentWeekWins[0] ?? fallbackWins[0] ?? null

  if (!winner) return null

  return {
    text: winner.bigWin.trim(),
    dateLabel: new Date(`${winner.date}T00:00:00Z`).toLocaleDateString('en-IE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }),
  }
}

function getMomentumStatusPillClassName(label: RollingMomentumMetrics['label']) {
  if (label === 'High Momentum') return 'border-[rgb(var(--theme-accent-rgb)/0.3)] bg-[rgb(var(--theme-accent-rgb)/0.12)] theme-text-primary'
  if (label === 'Strong') return 'border-[rgb(var(--theme-accent-rgb)/0.22)] bg-[rgb(var(--theme-accent-rgb)/0.1)] theme-text-secondary'
  if (label === 'Building') return 'border-[rgb(var(--theme-warning-rgb)/0.28)] bg-[rgb(var(--theme-warning-rgb)/0.12)] theme-text-primary'
  return 'border-[rgb(var(--theme-negative-rgb)/0.24)] bg-[rgb(var(--theme-negative-rgb)/0.1)] theme-text-primary'
}

function MomentumMicroMetric({
  label,
  tooltip,
  value,
  tone = 'neutral',
}: {
  label: string
  tooltip: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative'
}) {
  const valueClassName =
    tone === 'positive'
      ? 'text-[rgb(var(--theme-accent-rgb))]'
      : tone === 'negative'
        ? 'text-[rgb(var(--theme-negative-rgb))]'
        : 'theme-text-primary'

  return (
    <div className="theme-surface-soft rounded-[18px] border px-3 py-[9px]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] theme-text-faint">{label}</p>
        <MetricInfoTooltip text={tooltip} />
      </div>
      <p className={`mt-1.5 text-[15px] font-medium leading-none ${valueClassName}`}>{value}</p>
    </div>
  )
}

function MetricInfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span className="theme-icon-button inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] transition">
        i
      </span>
      <span className="theme-chart-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 hidden w-[220px] -translate-x-1/2 rounded-2xl px-3 py-2 text-[11px] leading-5 group-hover:block">
        {text}
      </span>
    </span>
  )
}

function MomentumRing({ score }: { score: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const progress = Math.max(0, Math.min(100, score))
  const offset = circumference - (progress / 100) * circumference
  const color = getMomentumRingColor(progress)

  return (
    <div className="flex shrink-0 flex-col items-center">
      <div className="relative flex h-[92px] w-[92px] items-center justify-center">
        <svg className="h-[90px] w-[90px] -rotate-90" viewBox="0 0 92 92" aria-hidden="true">
          <circle cx="46" cy="46" r={radius} fill="none" stroke="rgb(var(--theme-border-subtle-rgb))" strokeWidth="8.25" />
          <circle
            cx="46"
            cy="46"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8.25"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center -translate-y-[1px]">
          <span className="text-[20px] font-semibold tracking-[-0.02em] theme-text-primary">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

function getMomentumRingColor(score: number) {
  if (score < 40) return 'rgb(var(--theme-negative-rgb))'
  if (score < 70) return 'rgb(var(--theme-warning-rgb))'
  return 'rgb(var(--theme-accent-rgb))'
}

function getMomentumGuidance(metrics: RollingMomentumMetrics) {
  if (metrics.trend === 'Declining' || metrics.label === 'Low') {
    return {
      messagePrimary: 'Momentum is low.',
      messageSecondary: 'Keep it simple — focus on one solid win today.',
      action: metrics.completionPercent < 35 ? '→ Start with your easiest win' : '→ Lock in one clean day',
    }
  }

  if (metrics.label === 'Building' && metrics.trend === 'Improving') {
    return {
      messagePrimary: "You're building momentum.",
      messageSecondary: "Stay consistent — you're closer than you think.",
      action: metrics.completionPercent >= 55 ? '→ Complete your first habit now' : '→ Start with your easiest win',
    }
  }

  if (metrics.label === 'Building') {
    return {
      messagePrimary: "You're hovering.",
      messageSecondary: 'One focused day today will move this forward.',
      action: '→ Complete your first habit now',
    }
  }

  if (metrics.label === 'Strong' || metrics.label === 'High Momentum') {
    return {
      messagePrimary: "You're in form.",
      messageSecondary: "Take advantage of it — protect the chain.",
      action: metrics.strongDayRun >= 2 ? '→ Protect the run with one clean day' : '→ Lean into your strongest habit first',
    }
  }

  return {
    messagePrimary: 'Momentum is steady.',
    messageSecondary: 'Keep the basics tight and let the score follow.',
    action: '→ Complete your first habit now',
  }
}

function formatDayStripFocus(intention: string) {
  const trimmed = intention.trim()
  if (!trimmed) return 'Set one clear intention for today.'

  const normalized = trimmed
    .replace(/^i will\s+/i, '')
    .replace(/^i'?m going to\s+/i, '')
    .replace(/^im going to\s+/i, '')
    .trim()

  const displayBase = normalized || trimmed
  const maxLength = 72

  if (displayBase.length <= maxLength) return displayBase

  const truncated = displayBase.slice(0, maxLength - 3)
  const lastSpace = truncated.lastIndexOf(' ')
  const safeCut = lastSpace >= Math.max(20, Math.floor((maxLength - 3) * 0.55)) ? truncated.slice(0, lastSpace) : truncated

  return `${safeCut.trim()}...`
}

function getDayStripMetaLine(
  day: DayEntry,
  habitProgress: { completed: number; total: number },
  showBadHabitTracking: boolean,
) {
  const parts = [
    showBadHabitTracking ? (day.drank ? 'alcohol logged' : 'clean day') : null,
    `${habitProgress.completed}/${habitProgress.total} habits`,
    day.isLogged ? 'logged' : 'not logged yet',
  ].filter((value): value is string => Boolean(value))

  return parts.join(' • ')
}

function getCompactWeekDayMarkers(startDate: string, endDate: string, days: DayEntry[], todayDate: string) {
  const dayMap = new Map(days.map((day) => [day.date, day]))

  return getDateRangeInclusive(startDate, endDate).map((date) => {
    const day = dayMap.get(date)
    const weekdayLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IE', { weekday: 'short', timeZone: 'UTC' }).slice(0, 1)

    let state: 'logged' | 'current' | 'future' | 'empty' = 'empty'
    if (date === todayDate) state = 'current'
    else if (date > todayDate) state = 'future'
    else if (day?.isLogged) state = 'logged'

    return {
      date,
      label: weekdayLabel,
      state,
    }
  })
}

function getScratchpadTotal(items: Array<{ amount: string; settled?: boolean }>) {
  return items.reduce((sum, item) => {
    if (item.settled) return sum
    const value = Number(item.amount)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
}

function financeSheetHasContent(sheet: DashboardFinanceSheet) {
  return (
    sheet.notes.trim().length > 0 ||
    sheet.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    sheet.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0)
  )
}

function formatScratchpadCurrency(value: number) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function getCurrentFinanceMonthKey() {
  return new Date().toISOString().slice(0, 7)
}

function createEmptyFinanceSheet(): DashboardFinanceSheet {
  return {
    moneyIn: [],
    moneyOut: [],
    notes: '',
  }
}

function getFinanceSheetForMonth(scratchpad: { financeSheets?: Record<string, DashboardFinanceSheet> }, monthKey: string): DashboardFinanceSheet {
  return scratchpad.financeSheets?.[monthKey] ?? createEmptyFinanceSheet()
}

function getPreferredFinanceMonthKey(scratchpad: DashboardScratchpad, date: string) {
  const currentMonthKey = date.slice(0, 7)
  const currentMonthSheet = scratchpad.financeSheets[currentMonthKey]
  if (currentMonthSheet && financeSheetHasContent(currentMonthSheet)) return currentMonthKey

  const populatedMonthKey = Object.entries(scratchpad.financeSheets)
    .filter(([, sheet]) => financeSheetHasContent(sheet))
    .sort(([left], [right]) => right.localeCompare(left))[0]?.[0]

  return populatedMonthKey ?? currentMonthKey
}

type ScratchpadStoragePayload = {
  date: string
  scratchpad: DashboardScratchpad
  updatedAt: string
}

function getScratchpadStorageKey(date: string) {
  return `life-dashboard:scratchpad:${date}`
}

function getScratchpadBackupStorageKey(date: string, slot: number) {
  return `${getScratchpadStorageKey(date)}:backup:${slot}`
}

function safeParseScratchpadPayload(raw: string) {
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    console.warn('[scratchpad-debug] parseFailed', error)
    return null
  }
}

function readScratchpadStorage(date: string) {
  const stored = readJsonStorage<unknown>(getScratchpadStorageKey(date))
  return normalizeScratchpadStoragePayload(stored, date)
}

function writeScratchpadStorage(payload: ScratchpadStoragePayload) {
  writeJsonStorage(getScratchpadStorageKey(payload.date), payload)
}

function readScratchpadBackups(date: string) {
  if (typeof window === 'undefined') return []

  return [1, 2, 3]
    .map((slot) => {
      const key = getScratchpadBackupStorageKey(date, slot)
      const raw = window.localStorage.getItem(key)
      const parsed = raw ? safeParseScratchpadPayload(raw) : null
      const payload = normalizeScratchpadStoragePayload(parsed, date)
      if (!raw || !payload) return null
      return { slot, key, raw, payload }
    })
    .filter((backup): backup is { slot: number; key: string; raw: string; payload: ScratchpadStoragePayload } => backup != null)
}

function writeScratchpadStorageWithBackups(payload: ScratchpadStoragePayload) {
  if (typeof window === 'undefined') {
    writeScratchpadStorage(payload)
    return { skipped: false as const }
  }

  const storageKey = getScratchpadStorageKey(payload.date)
  const nextHasContent = scratchpadHasContent(payload.scratchpad)
  const existingRaw = window.localStorage.getItem(storageKey)
  const existingPayload = existingRaw ? normalizeScratchpadStoragePayload(safeParseScratchpadPayload(existingRaw), payload.date) : null
  const existingHasContent = existingPayload ? scratchpadHasContent(existingPayload.scratchpad) : false

  if (!nextHasContent && existingHasContent) {
    console.warn('[scratchpad-debug] saveSkipped', {
      reason: 'Prevented overwrite of meaningful scratchpad data with placeholder or empty state.',
      date: payload.date,
      storageKey,
    })
    return { skipped: true as const }
  }

  if (existingRaw && existingPayload && existingHasContent) {
    for (let slot = 3; slot >= 2; slot -= 1) {
      const previous = window.localStorage.getItem(getScratchpadBackupStorageKey(payload.date, slot - 1))
      if (previous) window.localStorage.setItem(getScratchpadBackupStorageKey(payload.date, slot), previous)
      else window.localStorage.removeItem(getScratchpadBackupStorageKey(payload.date, slot))
    }
    window.localStorage.setItem(getScratchpadBackupStorageKey(payload.date, 1), existingRaw)
  }

  writeScratchpadStorage(payload)
  return { skipped: false as const }
}

function serializeScratchpad(scratchpad: DashboardScratchpad) {
  return JSON.stringify(scratchpad)
}

function scratchpadHasContent(scratchpad: DashboardScratchpad) {
  return (
    scratchpad.text.trim().length > 0 ||
    scratchpad.freeNotes.some((note, index) => scratchpadFreeNoteHasContent(note, index)) ||
    scratchpad.notes.trim().length > 0 ||
    scratchpad.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    scratchpad.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    Object.values(scratchpad.financeSheets).some(
      (sheet) =>
        sheet.notes.trim().length > 0 ||
        sheet.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
        sheet.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0),
    ) ||
    scratchpad.todoItems.some((item) => item.text.trim().length > 0 || item.completed)
  )
}

function getViewedScratchpadEntry(days: DayEntry[], fallbackEntry: DayEntry) {
  const fallbackDate = fallbackEntry.date
  const datedEntries = [...days]
    .filter((day) => day.date <= fallbackDate)
    .sort((left, right) => right.date.localeCompare(left.date))

  const storedScratchpadEntry = datedEntries.find((day) => {
    if (scratchpadHasContent(day.dashboardScratchpad)) return true
    const storedPayload = readScratchpadStorage(day.date)
    return storedPayload ? scratchpadHasContent(storedPayload.scratchpad) : false
  })

  return storedScratchpadEntry ?? fallbackEntry
}

function scratchpadFreeNoteHasContent(note: ScratchpadFreeNote, index: number) {
  const title = note.title.trim()
  return note.text.trim().length > 0 || (title.length > 0 && title !== getScratchpadFreeNoteTitle(index))
}

function normalizeScratchpadStoragePayload(raw: unknown, date: string): ScratchpadStoragePayload | null {
  if (!raw || typeof raw !== 'object') return null

  const payload = raw as {
    date?: unknown
    updatedAt?: unknown
    scratchpad?: unknown
    text?: unknown
    freeNotes?: unknown
    activeFreeNoteId?: unknown
    moneyIn?: unknown
    moneyOut?: unknown
    notes?: unknown
    todoItems?: unknown
    financeSheets?: unknown
    mode?: unknown
  }

  const normalizedScratchpad = normalizeStoredScratchpad(mergeStoredScratchpadSources(payload), date)
  if (!scratchpadHasContent(normalizedScratchpad)) return null

  return {
    date: typeof payload.date === 'string' && payload.date.length > 0 ? payload.date : date,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
    scratchpad: normalizedScratchpad,
  }
}

function normalizeStoredScratchpad(raw: unknown, date: string): DashboardScratchpad {
  const scratchpad = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const defaultMonthKey = date.slice(0, 7)
  const normalizedFreeNotes = normalizeStoredFreeNotes(scratchpad.freeNotes, scratchpad.text, date)
  const normalizedFinanceSheets = normalizeStoredFinanceSheets(scratchpad, defaultMonthKey)
  const normalizedTodoItems = normalizeStoredTodoItems(scratchpad.todoItems)

  const inferredMode =
    scratchpad.mode === 'structured' || scratchpad.mode === 'todo' || scratchpad.mode === 'free'
      ? scratchpad.mode
      : Object.keys(normalizedFinanceSheets).length > 0
        ? 'structured'
        : normalizedTodoItems.some((item) => item.text.trim().length > 0 || item.completed)
          ? 'todo'
          : 'free'

  return {
    mode: inferredMode,
    text: typeof scratchpad.text === 'string' ? scratchpad.text : '',
    freeNotes: normalizedFreeNotes,
    activeFreeNoteId: normalizeStoredActiveFreeNoteId(scratchpad.activeFreeNoteId, normalizedFreeNotes),
    moneyIn: normalizeStoredLineItems(scratchpad.moneyIn, 'in'),
    moneyOut: normalizeStoredLineItems(scratchpad.moneyOut, 'out'),
    notes: typeof scratchpad.notes === 'string' ? scratchpad.notes : '',
    todoItems: normalizedTodoItems,
    financeSheets: normalizedFinanceSheets,
  }
}

function mergeStoredScratchpadSources(payload: {
  scratchpad?: unknown
  mode?: unknown
  text?: unknown
  freeNotes?: unknown
  activeFreeNoteId?: unknown
  moneyIn?: unknown
  moneyOut?: unknown
  notes?: unknown
  todoItems?: unknown
  financeSheets?: unknown
}) {
  const nested =
    payload.scratchpad && typeof payload.scratchpad === 'object'
      ? (payload.scratchpad as Record<string, unknown>)
      : {}

  return {
    mode: pickStoredField(nested.mode, payload.mode),
    text: pickStoredField(nested.text, payload.text),
    freeNotes: pickStoredCollection(nested.freeNotes, payload.freeNotes),
    activeFreeNoteId: pickStoredField(nested.activeFreeNoteId, payload.activeFreeNoteId),
    moneyIn: pickStoredCollection(nested.moneyIn, payload.moneyIn),
    moneyOut: pickStoredCollection(nested.moneyOut, payload.moneyOut),
    notes: pickStoredField(nested.notes, payload.notes),
    todoItems: pickStoredCollection(nested.todoItems, payload.todoItems),
    financeSheets: pickStoredCollection(nested.financeSheets, payload.financeSheets),
  }
}

function pickStoredField(primary: unknown, fallback: unknown) {
  if (typeof primary === 'string' && primary.trim().length === 0 && typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback
  }
  return primary ?? fallback
}

function pickStoredCollection(primary: unknown, fallback: unknown) {
  if (Array.isArray(primary)) return primary.length > 0 ? primary : Array.isArray(fallback) ? fallback : primary
  if (primary && typeof primary === 'object') {
    return Object.keys(primary as Record<string, unknown>).length > 0 ? primary : fallback
  }
  return fallback ?? primary
}

function normalizeStoredFreeNotes(raw: unknown, legacyText: unknown, date: string): ScratchpadFreeNote[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((note, index) => {
      const safeNote = note && typeof note === 'object' ? (note as Record<string, unknown>) : {}
      return {
        id:
          typeof safeNote.id === 'string' && safeNote.id.length > 0
            ? safeNote.id
            : `scratch-free-${date}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        title:
          typeof safeNote.title === 'string' && safeNote.title.trim().length > 0
            ? safeNote.title.trim()
            : getScratchpadFreeNoteTitle(index),
        text: typeof safeNote.text === 'string' ? safeNote.text : '',
      }
    })
  }

  return [
    {
      id: `scratch-free-${date}`,
      title: 'Note 1',
      text: typeof legacyText === 'string' ? legacyText : '',
    },
  ]
}

function normalizeStoredActiveFreeNoteId(raw: unknown, notes: ScratchpadFreeNote[]) {
  if (typeof raw === 'string' && notes.some((note) => note.id === raw)) return raw
  return resolveActiveFreeNoteId(notes, null)
}

function normalizeStoredLineItems(raw: unknown, prefix: 'in' | 'out') {
  if (!Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const safeItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id:
        typeof safeItem.id === 'string' && safeItem.id.length > 0
          ? safeItem.id
          : `scratch-${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: typeof safeItem.name === 'string' ? safeItem.name : '',
      day: typeof safeItem.day === 'string' ? safeItem.day : '',
      amount: safeItem.amount != null ? String(safeItem.amount) : '',
      settled: typeof safeItem.settled === 'boolean' ? safeItem.settled : false,
    }
  })
}

function normalizeStoredTodoItems(raw: unknown) {
  if (!Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const safeItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id:
        typeof safeItem.id === 'string' && safeItem.id.length > 0
          ? safeItem.id
          : `scratch-todo-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      text: typeof safeItem.text === 'string' ? safeItem.text : '',
      completed: typeof safeItem.completed === 'boolean' ? safeItem.completed : false,
    }
  })
}

function normalizeStoredFinanceSheets(raw: Record<string, unknown>, defaultMonthKey: string): Record<string, DashboardFinanceSheet> {
  const normalizedLegacyMoneyIn = normalizeStoredLineItems(raw.moneyIn, 'in')
  const normalizedLegacyMoneyOut = normalizeStoredLineItems(raw.moneyOut, 'out')
  const normalizedLegacyNotes = typeof raw.notes === 'string' ? raw.notes : ''

  if (raw.financeSheets && typeof raw.financeSheets === 'object' && !Array.isArray(raw.financeSheets)) {
    return Object.fromEntries(
      Object.entries(raw.financeSheets as Record<string, unknown>).map(([monthKey, sheet]) => [
        monthKey,
        normalizeStoredFinanceSheet(sheet),
      ]),
    )
  }

  if (
    normalizedLegacyMoneyIn.length > 0 ||
    normalizedLegacyMoneyOut.length > 0 ||
    normalizedLegacyNotes.trim().length > 0
  ) {
    return {
      [defaultMonthKey]: {
        moneyIn: normalizedLegacyMoneyIn,
        moneyOut: normalizedLegacyMoneyOut,
        notes: normalizedLegacyNotes,
      },
    }
  }

  return {}
}

function normalizeStoredFinanceSheet(raw: unknown): DashboardFinanceSheet {
  const sheet = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    moneyIn: normalizeStoredLineItems(sheet.moneyIn, 'in'),
    moneyOut: normalizeStoredLineItems(sheet.moneyOut, 'out'),
    notes: typeof sheet.notes === 'string' ? sheet.notes : '',
  }
}


function getScratchpadRecoverySummary(scratchpad: DashboardScratchpad, dayId: string) {
  const notes = getScratchpadFreeNotes(scratchpad, dayId)
  const financeSheets = Object.values(scratchpad.financeSheets).filter((sheet) => financeSheetHasContent(sheet))
  const todoItems = scratchpad.todoItems.filter((item) => item.text.trim().length > 0 || item.completed)
  return `Recovered ${notes.length} notes, ${financeSheets.length} finance ${financeSheets.length === 1 ? 'sheet' : 'sheets'}, ${todoItems.length} todo ${todoItems.length === 1 ? 'item' : 'items'}`
}

function shiftFinanceMonthKey(monthKey: string, delta: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, (month ?? 1) - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatFinanceMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, (month ?? 1) - 1, 1)).toLocaleDateString('en-IE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function getFinanceDayOptions(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, month ?? 1, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, index) => formatFinanceDayLabel(monthKey, index + 1)).filter(Boolean) as string[]
}

function getTodayFinanceDayLabel(monthKey: string) {
  const today = new Date()
  const todayMonthKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`
  if (todayMonthKey !== monthKey) return ''
  return formatFinanceDayLabel(monthKey, today.getUTCDate())
}

function normalizeFinanceDayValue(monthKey: string, rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const validOptions = getFinanceDayOptions(monthKey)
  if (validOptions.includes(trimmed)) return trimmed

  const dayMatch = trimmed.match(/(\d{1,2})$/)
  if (!dayMatch) return ''

  const day = Number(dayMatch[1])
  return formatFinanceDayLabel(monthKey, day)
}

function formatFinanceDayLabel(monthKey: string, day: number) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || day < 1) return ''

  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return ''

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return `${weekdays[date.getUTCDay()]} ${formatOrdinalDay(day)}`
}

function formatOrdinalDay(day: number) {
  const remainderTen = day % 10
  const remainderHundred = day % 100

  if (remainderTen === 1 && remainderHundred !== 11) return `${day}st`
  if (remainderTen === 2 && remainderHundred !== 12) return `${day}nd`
  if (remainderTen === 3 && remainderHundred !== 13) return `${day}rd`
  return `${day}th`
}

function sortScratchpadLineItemsByDay(items: ScratchpadLineItem[], monthKey: string) {
  return [...items].sort((left, right) => {
    const leftDay = getSortableFinanceDayNumber(monthKey, left.day)
    const rightDay = getSortableFinanceDayNumber(monthKey, right.day)

    if (leftDay == null && rightDay == null) return 0
    if (leftDay == null) return 1
    if (rightDay == null) return -1
    return leftDay - rightDay
  })
}

function getSortableFinanceDayNumber(monthKey: string, rawValue: string) {
  const normalized = normalizeFinanceDayValue(monthKey, rawValue)
  if (!normalized) return null

  const dayMatch = normalized.match(/(\d{1,2})(?:st|nd|rd|th)$/)
  if (!dayMatch) return null

  const day = Number(dayMatch[1])
  return Number.isFinite(day) ? day : null
}

function FinanceDayPicker({
  monthKey,
  value,
  options,
  onChange,
}: {
  monthKey: string
  value: string
  options: string[]
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null)
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const normalizedValue = normalizeFinanceDayValue(monthKey, value)
  const todayLabel = getTodayFinanceDayLabel(monthKey)

  useEffect(() => {
    if (!open) return

    const targetLabel = todayLabel || normalizedValue || ''
    if (!targetLabel) return

    const target = optionRefs.current[targetLabel]
    target?.scrollIntoView({ block: 'center' })
  }, [monthKey, normalizedValue, open, todayLabel])

  return (
    <div className="relative w-[150px] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-2.5 py-1.5 text-sm text-white/72 outline-none transition hover:bg-white/[0.04] focus:border-white/[0.12] focus:bg-white/[0.04]"
        aria-label="Day"
      >
        <span className="truncate">{normalizedValue || 'No day'}</span>
        <span className="ml-2 text-white/38">▾</span>
      </button>
      {open ? (
        <div
          ref={listRef}
          className="absolute left-0 top-[calc(100%+6px)] z-20 max-h-56 w-full overflow-y-auto overscroll-contain rounded-[14px] border border-white/[0.08] bg-[#171717] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
        >
          <button
            ref={selectedButtonRef}
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition ${
              normalizedValue === '' ? 'bg-white/[0.06] text-white' : 'text-white/72 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <span>No day</span>
          </button>
          {options.map((option) => {
            const isToday = option === todayLabel
            const isSelected = option === normalizedValue
            return (
              <button
                key={option}
                ref={(node) => {
                  optionRefs.current[option] = node
                }}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition ${
                  isSelected ? 'bg-white/[0.06] text-white' : isToday ? 'text-[#C9E5D1] hover:bg-white/[0.04]' : 'text-white/72 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span className="truncate">{option}</span>
                {isToday ? <span className="ml-3 shrink-0 text-[10px] text-[#8FD3A9]/80">Today</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function ScratchpadSection({
  title,
  monthKey,
  items,
  kind,
  emptyText,
  toggleVerb,
  financeFeedback,
  onAdd,
  onToggleSettled,
  onUpdateItem,
  onRemoveItem,
}: {
  title: string
  monthKey: string
  items: Array<{ id: string; name: string; day: string; amount: string; settled: boolean }>
  kind: 'active' | 'settled'
  emptyText: string
  toggleVerb: 'received' | 'paid'
  financeFeedback: { itemId: string; message: string; tone: 'incoming' | 'outgoing' } | null
  onAdd?: () => void
  onToggleSettled: (item: { id: string; name: string; day: string; amount: string; settled: boolean }) => void
  onUpdateItem: (itemId: string, field: 'name' | 'day' | 'amount' | 'settled', value: string | boolean) => void
  onRemoveItem: (itemId: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftItemId, setDraftItemId] = useState<string | null>(null)
  const [revealedSettledId, setRevealedSettledId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftDay, setDraftDay] = useState('')
  const [draftAmount, setDraftAmount] = useState('')
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const editRowRef = useRef<HTMLDivElement | null>(null)
  const dayOptions = useMemo(() => getFinanceDayOptions(monthKey), [monthKey])

  useEffect(() => {
    const emptyItem = items.find((item) => item.name.trim().length === 0 && item.day.trim().length === 0 && item.amount.trim().length === 0)
    if (emptyItem) {
      setEditingId(emptyItem.id)
      setDraftItemId(emptyItem.id)
      setDraftName(emptyItem.name)
      setDraftDay(normalizeFinanceDayValue(monthKey, emptyItem.day))
      setDraftAmount(emptyItem.amount)
      return
    }

    if (editingId && !items.some((item) => item.id === editingId)) {
      setEditingId(null)
      setDraftItemId(null)
      setDraftName('')
      setDraftDay('')
      setDraftAmount('')
    }

    if (revealedSettledId && !items.some((item) => item.id === revealedSettledId)) {
      setRevealedSettledId(null)
    }
  }, [editingId, items, revealedSettledId])

  useEffect(() => {
    if (!editingId || !nameInputRef.current) return
    nameInputRef.current.focus()
    nameInputRef.current.select()
  }, [editingId])

  useEffect(() => {
    if (!editingId) return

    const handlePointerDown = (event: MouseEvent) => {
      if (editRowRef.current?.contains(event.target as Node)) return
      if (draftItemId === editingId) return
      saveEditing(editingId)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [draftAmount, draftDay, draftName, draftItemId, editingId])

  const startEditing = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) return
    setEditingId(itemId)
    setDraftItemId(null)
    setDraftName(item.name)
    setDraftDay(normalizeFinanceDayValue(monthKey, item.day))
    setDraftAmount(item.amount)
  }

  const stopEditing = () => {
    setEditingId(null)
    setDraftItemId(null)
    setDraftName('')
    setDraftDay('')
    setDraftAmount('')
  }

  const saveEditing = (itemId: string, overrides?: { name?: string; day?: string; amount?: string }) => {
    const nextName = overrides?.name ?? draftName
    const nextDay = overrides?.day ?? draftDay
    const nextAmount = overrides?.amount ?? draftAmount
    const normalizedAmount = normalizeScratchpadAmount(nextAmount)
    onUpdateItem(itemId, 'name', nextName.trim())
    onUpdateItem(itemId, 'day', nextDay.trim())
    onUpdateItem(itemId, 'amount', normalizedAmount)
    stopEditing()
  }

  const cancelEditing = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (item && item.name.trim().length === 0 && item.day.trim().length === 0 && item.amount.trim().length === 0) {
      onRemoveItem(itemId)
      return
    }
    stopEditing()
  }

  return (
    <div className="rounded-[22px] bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-mist/58">{title}</p>
      </div>
      <div className="mt-2 space-y-1">
        {items.length > 0 ? (
          items.map((item) => {
            const canEdit = kind === 'active'
            const isEditing = canEdit && (editingId === item.id || item.name.trim().length === 0 || item.amount.trim().length === 0)
            const isNewDraftRow = draftItemId === item.id
            const showFloatingConfirmation = kind === 'active' && financeFeedback?.itemId === item.id
            const displayDay = normalizeFinanceDayValue(monthKey, item.day)
            const amountTone =
              title === 'Incoming' || title === 'Received'
                ? item.settled
                  ? 'text-[#A1B8A8]/58 opacity-72'
                  : 'text-[#98CFAF] group-hover:text-[#AADCBD]'
                : item.settled
                  ? 'text-[#C99A92]/55 opacity-72'
                  : 'text-[#CFA198] group-hover:text-[#DEB0A7]'

            return isEditing ? (
              <div
                key={item.id}
                ref={editRowRef}
                className="rounded-[15px] bg-white/[0.03] px-3 py-2 transition"
              >
                <div
                  className="flex items-center gap-2.5"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      saveEditing(item.id)
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelEditing(item.id)
                    }
                  }}
                >
                  <input
                    ref={nameInputRef}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Name"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white/88 outline-none placeholder:text-white/28"
                  />
                  <FinanceDayPicker
                    monthKey={monthKey}
                    value={draftDay}
                    options={dayOptions}
                    onChange={(nextDay) => {
                      setDraftDay(nextDay)
                      if (!isNewDraftRow) {
                        saveEditing(item.id, { day: nextDay })
                      }
                    }}
                  />
                  <div className="flex w-[146px] shrink-0 items-center justify-end gap-4 pl-2">
                    <input
                      inputMode="decimal"
                      value={draftAmount}
                      onChange={(event) => setDraftAmount(event.target.value)}
                      placeholder="0.00"
                      className="w-[88px] bg-transparent text-right text-sm text-white/70 outline-none placeholder:text-white/24"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="flex h-7 items-center justify-center text-xs text-white/42 transition hover:text-white/68"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : kind === 'settled' ? (
              <button
                type="button"
                key={item.id}
                onClick={() => setRevealedSettledId((current) => (current === item.id ? null : item.id))}
                className="flex w-full items-center gap-3 rounded-[15px] bg-white/[0.015] px-3 py-2.5 text-left transition hover:bg-white/[0.024]"
              >
                <span className="min-w-0 flex-1 truncate pr-3 text-sm text-white/62 line-through decoration-white/[0.22] decoration-[1px]">
                  {item.name}
                </span>
                <div className="flex shrink-0 items-center justify-end gap-2.5">
                  <span className={`text-right text-[13px] tracking-[0.01em] ${amountTone}`}>
                    {formatScratchpadCurrency(Number(normalizeScratchpadAmount(item.amount)) || 0)}
                  </span>
                  {revealedSettledId === item.id ? (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setRevealedSettledId(null)
                          onToggleSettled(item)
                        }}
                        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[#8FD3A94A] bg-[#8FD3A91A] text-[11px] leading-none text-[#A7DEBD] transition duration-150 hover:border-[#8FD3A96A] hover:bg-[#8FD3A926] hover:text-[#C2E8CF]"
                        aria-label={`Move ${title.toLowerCase()} item back to active`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setRevealedSettledId(null)
                          onRemoveItem(item.id)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center text-[13px] text-white/28 transition hover:text-white/56"
                        aria-label={`Delete ${title.toLowerCase()} item`}
                      >
                        🗑
                      </button>
                    </>
                  ) : null}
                </div>
              </button>
            ) : (
              <button
                key={item.id}
                type="button"
                onClick={() => startEditing(item.id)}
                className="group relative flex w-full items-center gap-3 rounded-[15px] px-3 py-2.5 text-left transition duration-150 hover:bg-white/[0.03]"
              >
                <span
                  className={`min-w-0 flex-1 truncate pr-2 text-sm transition-[color,opacity,text-decoration-color] duration-150 ${
                    item.settled ? 'text-[#AFC3B6]/60 line-through decoration-[#8FD3A966] decoration-[1px]' : 'text-white/87'
                  }`}
                >
                  {item.name}
                </span>
                <span className="w-[150px] shrink-0 truncate text-sm leading-none text-white/58">{displayDay || ''}</span>
                <div className="flex w-[118px] shrink-0 items-center justify-end gap-2.5">
                  <span
                    className={`w-[88px] text-right text-[13px] tracking-[0.01em] transition-[color,opacity] duration-150 ${amountTone}`}
                  >
                    {formatScratchpadCurrency(Number(normalizeScratchpadAmount(item.amount)) || 0)}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onToggleSettled(item)
                    }}
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[11px] leading-none transition duration-150 ${
                      item.settled
                        ? 'border-[#8FD3A94A] bg-[#8FD3A91A] text-[#A7DEBD]'
                        : 'border-white/10 text-white/18 group-hover:border-[#8FD3A944] group-hover:text-[#8FD3A9]/70'
                    }`}
                    aria-label={
                      item.settled
                        ? `Move ${title.toLowerCase()} item back to active`
                        : `Mark ${title.toLowerCase()} item ${toggleVerb}`
                    }
                  >
                    ✓
                  </button>
                </div>
                {showFloatingConfirmation ? (
                  <span
                    className={`pointer-events-none absolute right-7 top-1/2 whitespace-nowrap text-[11px] ${
                      financeFeedback?.tone === 'incoming' ? 'text-[#9FD8B4]' : 'text-[#D2A49B]'
                    }`}
                    style={{
                      animation: 'finance-float-confirmation 900ms ease-out forwards',
                    }}
                  >
                    {financeFeedback?.message}
                  </span>
                ) : null}
              </button>
            )
          })
        ) : (
          <p className="text-sm text-mist/72">{emptyText}</p>
        )}
        {onAdd ? (
          <div className="flex min-h-[30px] items-center justify-end pr-[30px]">
            <button type="button" onClick={onAdd} className="text-xs text-white/56 transition hover:text-white/82">
              + Add item
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function normalizeScratchpadAmount(value: string) {
  return value.trim().replace(',', '.')
}

function ScratchpadTodoSection({
  items,
  onAdd,
  onUpdateItem,
  onRemoveItem,
}: {
  items: Array<{ id: string; text: string; completed: boolean }>
  onAdd: () => void
  onUpdateItem: (itemId: string, updater: (item: { id: string; text: string; completed: boolean }) => { id: string; text: string; completed: boolean }) => void
  onRemoveItem: (itemId: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')

  useEffect(() => {
    const emptyItem = items.find((item) => item.text.trim().length === 0)
    if (emptyItem) {
      setEditingId(emptyItem.id)
      setDraftText(emptyItem.text)
      return
    }

    if (editingId && !items.some((item) => item.id === editingId)) {
      setEditingId(null)
      setDraftText('')
    }
  }, [editingId, items])

  const startEditing = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (!item) return
    setEditingId(itemId)
    setDraftText(item.text)
  }

  const stopEditing = () => {
    setEditingId(null)
    setDraftText('')
  }

  const saveEditing = (itemId: string) => {
    onUpdateItem(itemId, (item) => ({ ...item, text: draftText.trim() }))
    stopEditing()
  }

  const cancelEditing = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId)
    if (item && item.text.trim().length === 0) {
      onRemoveItem(itemId)
      return
    }
    stopEditing()
  }

  return (
    <div className="mt-4 rounded-[22px] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-mist/65">To Do List</p>
        <button type="button" onClick={onAdd} className="text-xs text-white/58 transition hover:text-white/82">
          + Add item
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.map((item) => {
            const isEditing = editingId === item.id || item.text.trim().length === 0

            return isEditing ? (
              <div key={item.id} className="rounded-[18px] bg-white/[0.03] px-3 py-3 transition">
                <div
                  className="flex items-center gap-3"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      saveEditing(item.id)
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      cancelEditing(item.id)
                    }
                  }}
                >
                  <span className="flex h-4.5 w-4.5 shrink-0 rounded-full border border-white/18" />
                  <input
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    placeholder="To-do item"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white/88 outline-none placeholder:text-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditing(item.id)}
                    className="text-xs text-white/52 transition hover:text-white/78"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelEditing(item.id)}
                    className="text-xs text-white/46 transition hover:text-white/72"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="group flex items-center gap-3 rounded-[18px] px-3 py-2.5 transition hover:bg-white/[0.035]">
                <button
                  type="button"
                  onClick={() => onUpdateItem(item.id, (current) => ({ ...current, completed: !current.completed }))}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition ${
                    item.completed ? 'border-[#4FDC94]/35 bg-[#4FDC94]/12 text-[#7CE7AE]' : 'border-white/18 text-white/40'
                  }`}
                  aria-label={item.completed ? 'Mark checklist item incomplete' : 'Mark checklist item complete'}
                >
                  {item.completed ? '✓' : ''}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${item.completed ? 'text-white/48 line-through' : 'text-white/84'}`}>{item.text}</span>
                <div className="flex w-[92px] shrink-0 items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => startEditing(item.id)}
                    className="text-xs text-white/48 opacity-0 transition group-hover:opacity-100 hover:text-white/74"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="text-xs text-white/42 opacity-0 transition group-hover:opacity-100 hover:text-white/72"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-mist/72">Nothing here yet.</p>
        )}
      </div>
    </div>
  )
}

function getTaskPanelWidthBounds(viewportWidth: number) {
  const midpointWidth = Math.round(viewportWidth * 0.5)
  const minimumWidth = Math.max(340, Math.round(viewportWidth * 0.36))
  const clampBounds = { min: minimumWidth, max: midpointWidth }

  return {
    min: minimumWidth,
    default: clampTaskPanelWidth(Math.round(viewportWidth * 0.38), clampBounds),
    expanded: midpointWidth,
    max: midpointWidth,
  }
}

function getExecutionStatusMeta(status: DayEntry['dashboardExecution']['status']) {
  switch (status) {
    case 'started':
      return { label: 'In motion' }
    case 'partial':
      return { label: 'Partial progress' }
    case 'complete':
      return { label: 'Complete' }
    default:
      return { label: 'Ready to start' }
  }
}

function formatLowStateTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function clampTaskPanelWidth(width: number, bounds: { min: number; max: number }) {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)))
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone: 'positive' | 'negative' | 'neutral' }) {
  const valueColor =
    tone === 'positive' ? 'text-[#8FD3A9]' : tone === 'negative' ? 'text-[#D79A9A]' : 'text-white/82'

  return (
    <div className="rounded-[18px] bg-white/[0.03] px-3.5 py-2.5 text-right">
      <p className="text-[10px] uppercase tracking-[0.26em] text-mist/56">{label}</p>
      <p className={`mt-1.5 text-sm font-medium ${valueColor}`}>{value}</p>
    </div>
  )
}

function DashboardEventTagPicker({
  title,
  tags,
  selectedIds,
  onToggle,
}: {
  title: string
  tags: Tag[]
  selectedIds: string[]
  onToggle: (tagId: string) => void
}) {
  if (tags.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/42">{title}</p>
        <p className="text-sm text-white/34">No tags available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/42">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selectedIds.includes(tag.id)

          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggle(tag.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? 'border-white/[0.18] bg-white/[0.09] text-white'
                  : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white/84'
              }`}
            >
              {tag.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function createDashboardDayEventDraft() {
  return {
    title: '',
    description: '',
    time: '',
  }
}

function createDashboardDayEventId() {
  return `dashboard-day-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
