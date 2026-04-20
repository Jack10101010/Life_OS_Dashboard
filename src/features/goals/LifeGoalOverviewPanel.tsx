import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type WheelEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Pin, Zap } from 'lucide-react'
import type { FloatingPanelPosition } from '../../components/layout/OverlayPrimitives'
import { GoalDatePicker } from './GoalDatePicker'
import GoalRow from './components/GoalRow'
import {
  LifeGoal,
  LifeGoalCategoryDefinition,
  LifeGoalIcon,
  LifeGoalStatus,
  LifeGoalTask,
  LifeGoalTaskPriority,
  Task,
} from '../../types'
import { getLifeGoalTaskPriorityMeta, getPriorityScore } from './lib/taskDerivations'
import {
  formatDate,
  formatDateShortYear,
  formatGoalCardTitle,
  getLifeGoalAccentBarStyle,
  getLifeGoalAnchorText,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryChipTextStyle,
  getLifeGoalCategoryColor,
  getLifeGoalCategoryDotStyle,
  getLifeGoalProgress,
  getLifeGoalRuntimeTasks,
  getLifeGoalStatusMeta,
  getTodayIsoDate,
  getVisibleGoalOverviewOrder,
  isLifeGoalScheduled,
  isValidIsoDate,
  shiftIsoDate,
  toTitleCase,
} from './goalUtils'

type GoalOverviewViewMode = 'list' | 'board' | 'timeline'
type GoalOverviewGroupBy = 'none' | 'status' | 'category' | 'life-direction'
type GoalOverviewSortBy = 'manual' | 'due' | 'priority' | 'updated'
type GoalOverviewColumnKey =
  | 'category'
  | 'belongsTo'
  | 'due'
  | 'status'
  | 'completion'
  | 'milestones'
  | 'startDate'
  | 'targetDate'
  | 'priority'
type GoalOverviewColumns = Record<GoalOverviewColumnKey, boolean>
type GoalOverviewRowContentKey = 'icons' | 'why' | 'startDate' | 'targetDate' | 'dueAmount' | 'milestones' | 'directional'
type GoalOverviewRowContent = Record<GoalOverviewRowContentKey, boolean>
type GoalOverviewRowActionState = {
  pinnedGoalIds: string[]
  highlightedGoalIds: string[]
}
type GoalOverviewViewControls = {
  view: GoalOverviewViewMode
  groupBy: GoalOverviewGroupBy
  sortBy: GoalOverviewSortBy
  showNextTask: boolean
  showCompleted: boolean
  columns: GoalOverviewColumns
  rowContent: GoalOverviewRowContent
  columnOrder: GoalOverviewColumnKey[]
}

type LifeGoalOverviewPanelProps = {
  lifeGoals: LifeGoal[]
  categories: LifeGoalCategoryDefinition[]
  tasks: Task[]
  selectedGoalId: string | null
  viewControls: GoalOverviewViewControls
  onUpdateViewControls: (updater: (current: GoalOverviewViewControls) => GoalOverviewViewControls) => void
  onResetViewControls: () => void
  rowActions: GoalOverviewRowActionState
  onUpdateRowActions: (updater: (current: GoalOverviewRowActionState) => GoalOverviewRowActionState) => void
  onSelectGoal: (goalId: string) => void
  onUpdateLifeGoal: (goalId: string, updater: (goal: LifeGoal) => LifeGoal) => void
  onReorderLifeGoals: (updates: Array<{ goalId: string; order: number }>) => void
  onArchiveLifeGoal: (goalId: string) => void
  onSetLifeGoalAsTodayTask: (goal: LifeGoal, tasksOverride?: LifeGoalTask[]) => void
  onOpenComposer: (trigger?: HTMLElement | null) => void
  onCloseComposer: () => void
  onResetComposerDraft: () => void
  onOpenTaskPeek: (taskId: string, trigger?: HTMLElement | null) => void
  onOpenNewTaskPeek: (trigger?: HTMLElement | null) => void
  onOpenIconPicker: (goalId: string, trigger?: HTMLElement | null) => void
  onRequestDeleteGoal: (goalId: string) => void
  composerSlot: ReactNode
  composerOpen: boolean
  composerMode: 'create' | 'edit'
  containScrollWithinElement: (event: WheelEvent<HTMLDivElement>) => void
  renderLifeGoalIcon: (icon: LifeGoalIcon | null | undefined, className: string, size?: number) => ReactNode
}

type GoalMilestone = NonNullable<LifeGoal['milestones']>[number]

const GOALS_UTILITY_PANEL_SHELL_CLASSNAME =
  'overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
const GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME = 'text-[12px] text-[rgba(255,255,255,0.85)]'
const GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME = 'text-[11px] text-[rgba(255,255,255,0.55)]'
const GOALS_UTILITY_PANEL_SELECT_CLASSNAME =
  'h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]'
const GOAL_OVERVIEW_USE_TITLE_CASE = false
const goalStatusChipClassName =
  'inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.03] font-medium uppercase tracking-[0.08em] text-white/68'

function getOrderedGoalMilestones(goal: LifeGoal): GoalMilestone[] {
  return (goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
}

function renderCalendarAddIcon(size = 18) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 2.45V4.35M2.55 6.1H12.35M4.45 3.1H11.35C12.565 3.1 13.55 4.085 13.55 5.3V7.55M2.35 5.3C2.35 4.085 3.335 3.1 4.55 3.1M2.35 5.3V11.25C2.35 12.465 3.335 13.45 4.55 13.45H7.55"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.45 9.9V14.25M10.25 12.075H14.65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function getGoalRowEmoji(goal: LifeGoal) {
  if (goal.icon?.startsWith('emoji:')) {
    return goal.icon.slice('emoji:'.length) || '🎯'
  }

  if ((goal.goalType ?? 'outcome') === 'directional') return '🧭'

  const normalizedCategory = goal.category.trim().toLowerCase()
  if (normalizedCategory.includes('health')) return '🌿'
  if (normalizedCategory.includes('career') || normalizedCategory.includes('work')) return '💼'
  if (normalizedCategory.includes('finance') || normalizedCategory.includes('money')) return '💰'
  if (normalizedCategory.includes('home')) return '🏠'
  if (normalizedCategory.includes('mind')) return '🧠'
  if (normalizedCategory.includes('social') || normalizedCategory.includes('relationship')) return '🤝'
  return '🎯'
}

function getGoalRowDueDays(goal: LifeGoal) {
  if (!isValidIsoDate(goal.targetDate)) return undefined
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()
  const target = new Date(`${goal.targetDate}T00:00:00Z`).getTime()
  return Math.round((target - today) / 86400000)
}

export function LifeGoalOverviewPanel({
  lifeGoals,
  categories,
  tasks,
  selectedGoalId: _selectedGoalId,
  viewControls,
  onUpdateViewControls,
  onResetViewControls,
  rowActions,
  onUpdateRowActions,
  onSelectGoal,
  onUpdateLifeGoal,
  onReorderLifeGoals,
  onArchiveLifeGoal: _onArchiveLifeGoal,
  onSetLifeGoalAsTodayTask: _onSetLifeGoalAsTodayTask,
  onOpenComposer,
  onCloseComposer,
  onResetComposerDraft,
  onOpenTaskPeek: _onOpenTaskPeek,
  onOpenNewTaskPeek: _onOpenNewTaskPeek,
  onOpenIconPicker: _onOpenIconPicker,
  onRequestDeleteGoal: _onRequestDeleteGoal,
  composerSlot,
  composerOpen,
  composerMode,
  containScrollWithinElement,
  renderLifeGoalIcon,
}: LifeGoalOverviewPanelProps) {
  const safeLifeGoals = lifeGoals
  const safeLifeGoalCategories = categories ?? []
  const [goalOverviewControlsPanelOpen, setGoalOverviewControlsPanelOpen] = useState(false)
  const [goalOverviewCompletedOpen, setGoalOverviewCompletedOpen] = useState(false)
  const [goalOverviewHeaderControlsSticky, setGoalOverviewHeaderControlsSticky] = useState(false)
  const [goalOverviewHeaderControlsRight, setGoalOverviewHeaderControlsRight] = useState(12)
  const [goalOverviewFloatingOpacity, setGoalOverviewFloatingOpacity] = useState(0)
  const [goalOverviewDraggedColumn, setGoalOverviewDraggedColumn] = useState<Exclude<GoalOverviewColumnKey, 'milestones'> | null>(null)
  const [goalOverviewStatusMenuGoalId, setGoalOverviewStatusMenuGoalId] = useState<string | null>(null)
  const [goalOverviewActiveDateField, setGoalOverviewActiveDateField] = useState<{ goalId: string; field: 'startDate' | 'targetDate' } | null>(null)
  const [goalOverviewDatePanelPosition, setGoalOverviewDatePanelPosition] = useState<FloatingPanelPosition | null>(null)
  const [draggedLifeGoalId, setDraggedLifeGoalId] = useState<string | null>(null)
  const [dragOverLifeGoalId, setDragOverLifeGoalId] = useState<string | null>(null)
  const [goalOverviewDragPreviewOrder, setGoalOverviewDragPreviewOrder] = useState<string[] | null>(null)

  const goalOverviewPageRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewControlsPanelRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewStatusMenuRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewDatePanelRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewStartDateFieldRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const goalOverviewTargetDateFieldRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const suppressGoalOverviewRowClickRef = useRef(false)
  const goalOverviewControlsDismissUntilRef = useRef(0)
  const goalOverviewStatusDismissUntilRef = useRef(0)
  const goalOverviewDateDismissUntilRef = useRef(0)
  const goalOverviewHeaderControlsRef = useRef<HTMLDivElement | null>(null)
  const goalOverviewControlsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const goalOverviewFloatingControlsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const goalOverviewActiveDateTriggerRef = useRef<HTMLElement | null>(null)
  const goalOverviewPointerDragCleanupRef = useRef<(() => void) | null>(null)
  const goalOverviewPendingPointerDragRef = useRef<{ goalId: string; pointerId: number; startX: number; startY: number } | null>(null)
  const goalOverviewActivePointerDragRef = useRef<{ goalId: string; targetGoalId: string | null } | null>(null)

  const setGoalOverviewDraggingCursor = (active: boolean) => {
    document.body.style.cursor = active ? 'grabbing' : ''
    document.body.style.userSelect = active ? 'none' : ''
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = active ? 'none' : ''
  }

  useEffect(() => {
    if (viewControls.view !== 'list' || viewControls.groupBy !== 'none' || viewControls.sortBy !== 'manual') {
      goalOverviewPointerDragCleanupRef.current?.()
      goalOverviewPointerDragCleanupRef.current = null
      goalOverviewPendingPointerDragRef.current = null
      goalOverviewActivePointerDragRef.current = null
      setGoalOverviewDraggingCursor(false)
      setDraggedLifeGoalId(null)
      setDragOverLifeGoalId(null)
      setGoalOverviewDragPreviewOrder(null)
    }
  }, [viewControls.groupBy, viewControls.sortBy, viewControls.view])

  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      goalOverviewPointerDragCleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!goalOverviewControlsPanelOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        goalOverviewControlsPanelRef.current?.contains(target) ||
        goalOverviewControlsTriggerRef.current?.contains(target) ||
        goalOverviewFloatingControlsTriggerRef.current?.contains(target)
      ) {
        return
      }
      goalOverviewControlsDismissUntilRef.current = Date.now() + 220
      suppressGoalOverviewRowClickRef.current = true
      setGoalOverviewControlsPanelOpen(false)
      event.preventDefault()
      event.stopPropagation()
      window.setTimeout(() => {
        suppressGoalOverviewRowClickRef.current = false
      }, 240)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGoalOverviewControlsPanelOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewControlsPanelOpen])

  useEffect(() => {
    if (!goalOverviewStatusMenuGoalId) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const targetElement = target instanceof Element ? target : null
      const clickedStatusTrigger = targetElement?.closest('[data-goal-status-trigger="true"]')
      if (!goalOverviewStatusMenuRef.current?.contains(target) && !clickedStatusTrigger) {
        goalOverviewStatusDismissUntilRef.current = Date.now() + 220
        suppressGoalOverviewRowClickRef.current = true
        setGoalOverviewStatusMenuGoalId(null)
        event.preventDefault()
        event.stopPropagation()
        window.setTimeout(() => {
          suppressGoalOverviewRowClickRef.current = false
        }, 240)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGoalOverviewStatusMenuGoalId(null)
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewStatusMenuGoalId])

  useEffect(() => {
    if (!goalOverviewActiveDateField) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const activeFieldRef =
        goalOverviewActiveDateTriggerRef.current ??
        (goalOverviewActiveDateField.field === 'startDate'
          ? goalOverviewStartDateFieldRefs.current[goalOverviewActiveDateField.goalId]
          : goalOverviewTargetDateFieldRefs.current[goalOverviewActiveDateField.goalId])
      if (!activeFieldRef?.contains(target) && !goalOverviewDatePanelRef.current?.contains(target)) {
        goalOverviewDateDismissUntilRef.current = Date.now() + 220
        suppressGoalOverviewRowClickRef.current = true
        goalOverviewActiveDateTriggerRef.current = null
        setGoalOverviewActiveDateField(null)
        setGoalOverviewDatePanelPosition(null)
        event.preventDefault()
        event.stopPropagation()
        window.setTimeout(() => {
          suppressGoalOverviewRowClickRef.current = false
        }, 240)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        goalOverviewActiveDateTriggerRef.current = null
        setGoalOverviewActiveDateField(null)
        setGoalOverviewDatePanelPosition(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalOverviewActiveDateField])

  useEffect(() => {
    const updateHeaderControlsStickyState = () => {
      if (typeof document === 'undefined') return
      const slot = document.getElementById('goals-header-controls-slot')
      if (!slot) return
      const rect = slot.getBoundingClientRect()
      const nextRightOffset = Math.round(Math.max(12, window.innerWidth - rect.right))
      const slotBottom = rect.bottom
      const fadeRange = 48
      const opacity = Math.max(0, Math.min(1, (fadeRange - slotBottom) / fadeRange))
      setGoalOverviewHeaderControlsRight(nextRightOffset)
      setGoalOverviewFloatingOpacity(opacity)
      setGoalOverviewHeaderControlsSticky(opacity >= 1)
    }
    updateHeaderControlsStickyState()
    window.addEventListener('scroll', updateHeaderControlsStickyState, { passive: true })
    window.addEventListener('resize', updateHeaderControlsStickyState)
    return () => {
      window.removeEventListener('scroll', updateHeaderControlsStickyState)
      window.removeEventListener('resize', updateHeaderControlsStickyState)
    }
  }, [])

  useLayoutEffect(() => {
    if (!goalOverviewActiveDateField) return
    const updatePosition = () => {
      const activeFieldRef =
        goalOverviewActiveDateTriggerRef.current ??
        (goalOverviewActiveDateField.field === 'startDate'
          ? goalOverviewStartDateFieldRefs.current[goalOverviewActiveDateField.goalId]
          : goalOverviewTargetDateFieldRefs.current[goalOverviewActiveDateField.goalId])
      if (!activeFieldRef) return
      const nextPosition = getGoalOverviewDatePanelPositionFromRect(activeFieldRef.getBoundingClientRect())
      if (nextPosition) setGoalOverviewDatePanelPosition(nextPosition)
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [goalOverviewActiveDateField])

  const allOverviewGoals = safeLifeGoals.filter((goal) => !goal.archivedAt)
  const runtimeTasksByGoalId = useMemo(
    () => new Map(safeLifeGoals.map((goal) => [goal.id, getLifeGoalRuntimeTasks(goal, tasks)])),
    [safeLifeGoals, tasks],
  )
  const getGoalRuntimeTasks = (goal: LifeGoal) => runtimeTasksByGoalId.get(goal.id) ?? []
  const pinnedGoalIds = new Set(rowActions.pinnedGoalIds)
  const baseManualOverviewGoals = useMemo(
    () => [...allOverviewGoals].sort((left, right) => (left.order !== right.order ? left.order - right.order : 0)),
    [allOverviewGoals],
  )
  const activeOverviewGoals = allOverviewGoals.filter((goal) => goal.status !== 'complete')
  const completedOverviewGoals = allOverviewGoals.filter((goal) => goal.status === 'complete')
  const hasPrimaryContent =
    viewControls.view === 'board'
      ? activeOverviewGoals.length > 0 || (viewControls.showCompleted && completedOverviewGoals.length > 0)
      : activeOverviewGoals.length > 0

  const getGoalBelongsTo = (goal: LifeGoal) => {
    const parentDirections = safeLifeGoals.filter(
      (candidate) =>
        !candidate.archivedAt &&
        candidate.id !== goal.id &&
        (candidate.goalType ?? 'outcome') === 'directional' &&
        (candidate.relatedGoalIds ?? []).includes(goal.id),
    )
    if (parentDirections.length === 0) return null
    if (parentDirections.length === 1) return parentDirections[0].title
    return `${parentDirections[0].title} +${parentDirections.length - 1}`
  }

  const getGoalPriorityValue = (goal: LifeGoal) =>
    getGoalRuntimeTasks(goal).reduce((highest, task) => Math.max(highest, getPriorityScore(task)), 0)
  const getGoalPriorityLabel = (goal: LifeGoal) => {
    const priority = getGoalPriorityValue(goal)
    const priorityMeta = getLifeGoalTaskPriorityMeta(priority >= 3 ? 'high' : priority === 2 ? 'medium' : priority === 1 ? 'low' : 'none')
    return priorityMeta?.label ?? 'None'
  }

  const manualReorderEnabled = viewControls.view === 'list' && viewControls.groupBy === 'none' && viewControls.sortBy === 'manual'

  const moveGoalIdInOrder = (goalIds: string[], draggedGoalId: string, targetGoalId: string) => {
    const fromIndex = goalIds.indexOf(draggedGoalId)
    const toIndex = goalIds.indexOf(targetGoalId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return goalIds
    const nextIds = [...goalIds]
    const [movedGoalId] = nextIds.splice(fromIndex, 1)
    nextIds.splice(toIndex, 0, movedGoalId)
    return nextIds
  }

  const previewOverviewGoalMove = (draggedGoalId: string, targetGoalId: string) => {
    if (draggedGoalId === targetGoalId) return
    const manualOrderedGoals = (goalOverviewDragPreviewOrder ?? baseManualOverviewGoals.map((goal) => goal.id))
      .map((goalId) => allOverviewGoals.find((goal) => goal.id === goalId) ?? null)
      .filter((goal): goal is LifeGoal => goal !== null)
    const draggedGoal = manualOrderedGoals.find((goal) => goal.id === draggedGoalId)
    const targetGoal = manualOrderedGoals.find((goal) => goal.id === targetGoalId)
    if (!draggedGoal || !targetGoal) return
    const draggedIsCompleted = draggedGoal.status === 'complete'
    const targetIsCompleted = targetGoal.status === 'complete'
    const draggedIsPinned = pinnedGoalIds.has(draggedGoalId)
    const targetIsPinned = pinnedGoalIds.has(targetGoalId)
    if (draggedIsCompleted !== targetIsCompleted || draggedIsPinned !== targetIsPinned) return
    const reorderableGoalIds = manualOrderedGoals
      .filter((goal) => (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned)
      .map((goal) => goal.id)
    const reorderedSubsetIds = moveGoalIdInOrder(reorderableGoalIds, draggedGoalId, targetGoalId)
    if (reorderedSubsetIds === reorderableGoalIds) return
    let subsetCursor = 0
    const nextOrderedGoalIds = manualOrderedGoals.map((goal) =>
      (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned
        ? reorderedSubsetIds[subsetCursor++]
        : goal.id,
    )
    setGoalOverviewDragPreviewOrder(nextOrderedGoalIds)
  }

  const reorderOverviewGoals = (draggedGoalId: string, targetGoalId: string) => {
    if (draggedGoalId === targetGoalId) return
    const manualOrderedGoals = [...baseManualOverviewGoals]
    const draggedGoal = manualOrderedGoals.find((goal) => goal.id === draggedGoalId)
    const targetGoal = manualOrderedGoals.find((goal) => goal.id === targetGoalId)
    if (!draggedGoal || !targetGoal) return
    const draggedIsCompleted = draggedGoal.status === 'complete'
    const targetIsCompleted = targetGoal.status === 'complete'
    const draggedIsPinned = pinnedGoalIds.has(draggedGoalId)
    const targetIsPinned = pinnedGoalIds.has(targetGoalId)
    if (draggedIsCompleted !== targetIsCompleted || draggedIsPinned !== targetIsPinned) return
    const reorderableGoals = manualOrderedGoals.filter(
      (goal) => (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned,
    )
    const fromIndex = reorderableGoals.findIndex((goal) => goal.id === draggedGoalId)
    const toIndex = reorderableGoals.findIndex((goal) => goal.id === targetGoalId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
    const reorderedSubsetIds = moveGoalIdInOrder(reorderableGoals.map((goal) => goal.id), draggedGoalId, targetGoalId)
    const reorderedSubset = reorderedSubsetIds
      .map((goalId) => reorderableGoals.find((goal) => goal.id === goalId) ?? null)
      .filter((goal): goal is LifeGoal => goal !== null)
    let subsetCursor = 0
    const nextOrderedGoals = manualOrderedGoals.map((goal) =>
      (goal.status === 'complete') === draggedIsCompleted && pinnedGoalIds.has(goal.id) === draggedIsPinned
        ? reorderedSubset[subsetCursor++]
        : goal,
    )
    onReorderLifeGoals(
      nextOrderedGoals
        .map((goal, index) => (goal.order === index ? null : { goalId: goal.id, order: index }))
        .filter((item): item is { goalId: string; order: number } => item !== null),
    )
  }

  const isGoalOverviewInteractiveTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    return Boolean(target.closest('button, a, input, select, textarea, summary, [data-goal-row-interactive="true"], [contenteditable="true"]'))
  }

  const updateGoalOverviewPointerDragTarget = (clientX: number, clientY: number) => {
    const elementUnderPointer = document.elementFromPoint(clientX, clientY)
    const rowElement = elementUnderPointer instanceof Element ? elementUnderPointer.closest<HTMLElement>('[data-goal-overview-row-id]') : null
    const targetGoalId = rowElement?.dataset.goalOverviewRowId ?? null
    const activeDrag = goalOverviewActivePointerDragRef.current
    if (!activeDrag || !targetGoalId || targetGoalId === activeDrag.goalId) return
    const draggedPinned = pinnedGoalIds.has(activeDrag.goalId)
    const targetPinned = pinnedGoalIds.has(targetGoalId)
    const draggedGoal = safeLifeGoals.find((item) => item.id === activeDrag.goalId)
    const targetGoal = safeLifeGoals.find((item) => item.id === targetGoalId)
    if (!draggedGoal || !targetGoal) return
    if ((draggedGoal.status === 'complete') !== (targetGoal.status === 'complete')) return
    if (draggedPinned !== targetPinned) return
    if (goalOverviewActivePointerDragRef.current?.targetGoalId !== targetGoalId) {
      goalOverviewActivePointerDragRef.current = { ...activeDrag, targetGoalId }
      setDragOverLifeGoalId(targetGoalId)
    }
    previewOverviewGoalMove(activeDrag.goalId, targetGoalId)
  }

  const finishGoalOverviewPointerDrag = (commit: boolean) => {
    const activeDrag = goalOverviewActivePointerDragRef.current
    goalOverviewPointerDragCleanupRef.current?.()
    goalOverviewPointerDragCleanupRef.current = null
    goalOverviewPendingPointerDragRef.current = null
    goalOverviewActivePointerDragRef.current = null
    if (commit && activeDrag?.goalId && activeDrag.targetGoalId && activeDrag.goalId !== activeDrag.targetGoalId) {
      reorderOverviewGoals(activeDrag.goalId, activeDrag.targetGoalId)
    }
    setDraggedLifeGoalId(null)
    setDragOverLifeGoalId(null)
    setGoalOverviewDragPreviewOrder(null)
    setGoalOverviewDraggingCursor(false)
    window.setTimeout(() => {
      suppressGoalOverviewRowClickRef.current = false
    }, 0)
  }

  const beginGoalOverviewPointerDrag = (goalId: string) => {
    suppressGoalOverviewRowClickRef.current = true
    setGoalOverviewDraggingCursor(true)
    setDraggedLifeGoalId(goalId)
    setDragOverLifeGoalId(goalId)
    setGoalOverviewDragPreviewOrder(baseManualOverviewGoals.map((item) => item.id))
    goalOverviewActivePointerDragRef.current = { goalId, targetGoalId: goalId }
  }

  const startGoalOverviewPointerTracking = (goalId: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!manualReorderEnabled || event.button !== 0 || isGoalOverviewInteractiveTarget(event.target)) return
    const movementThreshold = 6
    document.body.style.userSelect = 'none'
    ;(document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none'
    goalOverviewPendingPointerDragRef.current = { goalId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const pendingDrag = goalOverviewPendingPointerDragRef.current
      if (!pendingDrag || moveEvent.pointerId !== pendingDrag.pointerId) return
      const deltaX = moveEvent.clientX - pendingDrag.startX
      const deltaY = moveEvent.clientY - pendingDrag.startY
      if (!goalOverviewActivePointerDragRef.current) {
        if (Math.hypot(deltaX, deltaY) < movementThreshold) return
        beginGoalOverviewPointerDrag(pendingDrag.goalId)
      }
      moveEvent.preventDefault()
      updateGoalOverviewPointerDragTarget(moveEvent.clientX, moveEvent.clientY)
    }
    const handlePointerUp = (upEvent: PointerEvent) => {
      const pendingDrag = goalOverviewPendingPointerDragRef.current
      if (!pendingDrag || upEvent.pointerId !== pendingDrag.pointerId) return
      finishGoalOverviewPointerDrag(Boolean(goalOverviewActivePointerDragRef.current))
    }
    goalOverviewPointerDragCleanupRef.current?.()
    goalOverviewPointerDragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  const getGoalOverviewDatePanelPositionFromRect = (anchorRect: DOMRect): FloatingPanelPosition | null => {
    const panelRect = goalOverviewDatePanelRef.current?.getBoundingClientRect()
    const panelHeight = Math.ceil(panelRect?.height ?? 432)
    const panelWidth = Math.ceil(panelRect?.width ?? 296)
    const panelGap = 6
    const viewportInset = 12
    const overviewBounds = goalOverviewPageRef.current?.getBoundingClientRect()
    if (!overviewBounds) return null
    const inset = 12
    const minLeft = Math.max(overviewBounds.left + inset, viewportInset)
    const maxLeft = Math.max(
      minLeft,
      Math.min(overviewBounds.right - inset - panelWidth, window.innerWidth - viewportInset - panelWidth),
    )
    const preferredLeft = anchorRect.right + panelGap
    const left = Math.min(Math.max(preferredLeft, minLeft), maxLeft)

    const minTop = Math.max(overviewBounds.top + inset, viewportInset)
    const maxTop = Math.max(
      minTop,
      Math.min(overviewBounds.bottom - inset - panelHeight, window.innerHeight - viewportInset - panelHeight),
    )
    const preferredBelowTop = anchorRect.top
    const preferredAboveTop = anchorRect.bottom - panelHeight
    let top = preferredBelowTop
    if (preferredBelowTop > maxTop && preferredAboveTop >= minTop) top = preferredAboveTop
    top = Math.min(Math.max(top, minTop), maxTop)
    return { top, left, width: panelWidth }
  }

  const openGoalOverviewDatePicker = (goalId: string, field: 'startDate' | 'targetDate', anchorElement?: HTMLElement | null) => {
    const goal = safeLifeGoals.find((item) => item.id === goalId)
    if (!goal) return
    const isTogglingClosed = goalOverviewActiveDateField?.goalId === goalId && goalOverviewActiveDateField.field === field
    setGoalOverviewActiveDateField((current) => (current?.goalId === goalId && current.field === field ? null : { goalId, field }))
    if (isTogglingClosed) {
      goalOverviewActiveDateTriggerRef.current = null
      setGoalOverviewDatePanelPosition(null)
      return
    }
    if (anchorElement) {
      goalOverviewActiveDateTriggerRef.current = anchorElement
      setGoalOverviewDatePanelPosition(null)
    }
  }

  const applyGoalOverviewDate = (goalId: string, field: 'startDate' | 'targetDate', value: string) => {
    onUpdateLifeGoal(goalId, (goal) => ({ ...goal, [field]: value, updatedAt: new Date().toISOString() }))
    goalOverviewActiveDateTriggerRef.current = null
    setGoalOverviewActiveDateField(null)
    setGoalOverviewDatePanelPosition(null)
  }

  const updateLifeGoalStatus = (goalId: string, status: LifeGoalStatus) => {
    onUpdateLifeGoal(goalId, (goal) => ({ ...goal, status, updatedAt: new Date().toISOString() }))
  }

  const scheduleLifeGoalFromList = (goalId: string) => {
    const today = getTodayIsoDate()
    const tomorrowDate = new Date(`${today}T00:00:00Z`)
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1)
    const tomorrow = tomorrowDate.toISOString().slice(0, 10)
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      status: 'not-started',
      startDate: isValidIsoDate(goal.startDate) && goal.startDate > today ? goal.startDate : tomorrow,
      updatedAt: new Date().toISOString(),
    }))
  }

  const sortOverviewGoals = (goals: LifeGoal[]) =>
    getVisibleGoalOverviewOrder(goals, {
      controls: viewControls,
      rowActions,
      baseManualGoals: allOverviewGoals,
      manualGoalIds: goalOverviewDragPreviewOrder,
      getPriorityValue: getGoalPriorityValue,
    })

  const getGroupLabel = (goal: LifeGoal) => {
    switch (viewControls.groupBy) {
      case 'status':
        return getLifeGoalStatusMeta(goal.status, goal.startDate).label
      case 'category':
        return goal.category.trim() || 'Uncategorized'
      case 'life-direction':
        return (goal.goalType ?? 'outcome') === 'directional' ? 'Life directions' : getGoalBelongsTo(goal) ?? 'Unlinked goals'
      case 'none':
      default:
        return ''
    }
  }

  const buildGroupedGoals = (goals: LifeGoal[]) => {
    const sorted = sortOverviewGoals(goals)
    if (viewControls.groupBy === 'none') return [{ label: null, goals: sorted }]
    const grouped = new Map<string, LifeGoal[]>()
    sorted.forEach((goal) => {
      const label = getGroupLabel(goal)
      if (!grouped.has(label)) grouped.set(label, [])
      grouped.get(label)!.push(goal)
    })
    return Array.from(grouped.entries()).map(([label, groupedGoals]) => ({ label, goals: groupedGoals }))
  }

  const activeGroupedGoals = buildGroupedGoals(activeOverviewGoals)
  const completedGroupedGoals = buildGroupedGoals(completedOverviewGoals)

  const togglePinnedGoal = (goalId: string) =>
    onUpdateRowActions((current) => ({
      ...current,
      pinnedGoalIds: current.pinnedGoalIds.includes(goalId)
        ? current.pinnedGoalIds.filter((id) => id !== goalId)
        : [...current.pinnedGoalIds, goalId],
    }))

  const toggleImportantGoal = (goalId: string) =>
    onUpdateLifeGoal(goalId, (goal) => ({
      ...goal,
      isPrimary: !goal.isPrimary,
      updatedAt: new Date().toISOString(),
    }))

  const reorderColumnBefore = (sourceColumn: Exclude<GoalOverviewColumnKey, 'milestones'>, targetColumn: Exclude<GoalOverviewColumnKey, 'milestones'>) =>
    onUpdateViewControls((current) => {
      const movableColumns = current.columnOrder.filter(
        (item): item is Exclude<GoalOverviewColumnKey, 'milestones'> => item !== 'milestones',
      )
      const sourceIndex = movableColumns.indexOf(sourceColumn)
      const targetIndex = movableColumns.indexOf(targetColumn)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current
      const reordered = [...movableColumns]
      const [removed] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, removed)
      return { ...current, columnOrder: reordered }
    })

  const renderPriorityIndicator = (goal: LifeGoal) => {
    const priority = getGoalPriorityValue(goal)
    if (priority <= 0) return null
    const activeBars = Math.min(priority, 3)
    return (
      <span className="inline-flex h-4 translate-x-[11px] items-end gap-[2px]" aria-label={`${getGoalPriorityLabel(goal)} priority`} title={`${getGoalPriorityLabel(goal)} priority`}>
        {[0, 1, 2].map((index) => (
          <span
            key={`priority-bar-${index}`}
            className={`w-[3px] rounded-full transition ${index < activeBars ? 'bg-white/50' : 'bg-white/14'}`}
            style={{ height: `${6 + index * 3}px` }}
          />
        ))}
      </span>
    )
  }

  const renderCompletionIndicator = (goal: LifeGoal) => {
    const progress = getLifeGoalProgress(goal, getGoalRuntimeTasks(goal))
    const segmentCount = 10
    const filledSegments = Math.round((progress.percent / 100) * segmentCount)
    const segmentStep = (Math.PI * 2) / segmentCount
    const innerRadius = 5.6
    const outerRadius = 8.4
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="relative inline-flex h-[22px] w-[22px] items-center justify-center shrink-0" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            {Array.from({ length: segmentCount }, (_, index) => {
              const angle = -(Math.PI / 2) + segmentStep * index
              const isFilled = index < filledSegments
              const x1 = 10 + Math.cos(angle) * innerRadius
              const y1 = 10 + Math.sin(angle) * innerRadius
              const x2 = 10 + Math.cos(angle) * outerRadius
              const y2 = 10 + Math.sin(angle) * outerRadius
              return (
                <line
                  key={`goal-completion-segment-${goal.id}-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isFilled ? 'rgb(var(--theme-accent-rgb) / 0.9)' : 'rgba(255,255,255,0.14)'}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )
            })}
          </svg>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-[rgba(255,255,255,0.78)]">{progress.percent}%</span>
      </span>
    )
  }

  const getGoalOverviewDueDisplay = (goal: LifeGoal) => {
    if (goal.status === 'complete' || !isValidIsoDate(goal.targetDate)) return null
    const daysUntilDue = Math.round(
      (new Date(`${goal.targetDate}T00:00:00Z`).getTime() - new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime()) / 86400000,
    )
    return {
      label:
        daysUntilDue < 0
          ? `Overdue ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}`
          : `${daysUntilDue}d`,
      className:
        daysUntilDue < 0
          ? 'text-[rgb(var(--theme-negative-rgb)/0.92)]'
          : daysUntilDue < 7
            ? 'text-[rgb(var(--theme-warning-rgb)/0.9)]'
            : 'text-[rgba(255,255,255,0.56)]',
    }
  }

  const columnMeta: Record<GoalOverviewColumnKey, { label: string; width: string; render: (goal: LifeGoal) => ReactNode }> = {
    priority: { label: 'Priority', width: '112px', render: (goal) => renderPriorityIndicator(goal) },
    category: {
      label: 'Category',
      width: '112px',
      render: (goal) => {
        const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
        return goal.category ? (
          <span
            className="inline-flex max-w-full items-center truncate rounded-full border px-2 py-[3px] text-[10px] font-medium uppercase leading-none tracking-[0.08em]"
            style={{ ...getLifeGoalCategoryChipStyle(categoryColor), ...getLifeGoalCategoryChipTextStyle(categoryColor) }}
          >
            <span className="truncate">{goal.category}</span>
          </span>
        ) : null
      },
    },
    belongsTo: {
      label: 'Supports',
      width: '112px',
      render: (goal) => {
        const belongsTo = getGoalBelongsTo(goal)
        return belongsTo ? (
          <span className="relative block overflow-hidden whitespace-nowrap pr-2 text-[12px] text-[rgba(255,255,255,0.62)]">
            <span className="block truncate">{belongsTo}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-6"
              style={{ background: 'linear-gradient(to right, rgba(0,0,0,0), rgb(var(--theme-surface-rgb)))' }}
            />
          </span>
        ) : null
      },
    },
    due: { label: 'Due', width: '112px', render: (goal) => {
      if (goal.status === 'complete') {
        return goal.targetDate ? <span className="block truncate text-[12px] text-[rgba(255,255,255,0.62)]">{formatDateShortYear(goal.targetDate)}</span> : null
      }
      const dueDisplay = getGoalOverviewDueDisplay(goal)
      return dueDisplay ? <span className={`block truncate text-[12px] ${dueDisplay.className}`}>{dueDisplay.label}</span> : null
    } },
    startDate: { label: 'Start date', width: '112px', render: () => null },
    targetDate: { label: 'Target date', width: '112px', render: () => null },
    milestones: { label: 'Milestones', width: '92px', render: (goal) => {
      const milestoneCount = getOrderedGoalMilestones(goal).length
      return milestoneCount > 0 ? <span className="truncate text-[12px] text-white/48">{milestoneCount}</span> : null
    } },
    status: {
      label: 'Status',
      width: '112px',
      render: (goal) => {
        const statusMeta = getLifeGoalStatusMeta(goal.status, goal.startDate)
        const statusLabel = statusMeta.label === 'Active' ? 'In progress' : statusMeta.label
        const isStatusMenuOpen = goalOverviewStatusMenuGoalId === goal.id
        const statusDotClassName =
          statusMeta.label === 'Active' ? 'bg-emerald-400' : statusMeta.label === 'Scheduled' ? 'bg-blue-400' : statusMeta.label === 'Completed' ? 'bg-emerald-500/70' : 'bg-white/30'
        const statusOptions = [
          { id: 'in-progress', label: 'In progress', dotClassName: 'bg-emerald-400', active: statusMeta.label === 'Active', onSelect: () => updateLifeGoalStatus(goal.id, 'in-motion') },
          { id: 'not-started', label: 'Not Started', dotClassName: 'bg-white/30', active: goal.status === 'not-started' && !isLifeGoalScheduled(goal.status, goal.startDate), onSelect: () => updateLifeGoalStatus(goal.id, 'not-started') },
          { id: 'scheduled', label: 'Scheduled', dotClassName: 'bg-blue-400', active: isLifeGoalScheduled(goal.status, goal.startDate), onSelect: () => scheduleLifeGoalFromList(goal.id) },
        ] as const
        return (
          <div className="relative flex max-w-full items-center">
            <button
              type="button"
              data-goal-status-trigger="true"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                setGoalOverviewStatusMenuGoalId((current) => (current === goal.id ? null : goal.id))
              }}
              onMouseDown={(event) => event.stopPropagation()}
              className="flex cursor-pointer items-center rounded-[10px] px-1.5 py-1 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/[0.12]"
            >
              <span className="flex items-center gap-[4px] whitespace-nowrap text-[12px] font-medium leading-[1.2] text-[rgba(255,255,255,0.62)]">
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClassName}`} />
                <span className="leading-[1.2]">{statusLabel}</span>
              </span>
            </button>
            {isStatusMenuOpen ? (
              <div
                ref={goalOverviewStatusMenuRef}
                className="absolute left-0 top-[calc(100%+6px)] z-[60] min-w-[148px] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb))] p-1.5 shadow-[0_14px_28px_rgba(15,23,42,0.24)]"
                onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
                onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
              >
                <div className="space-y-0.5">
                  {statusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation() }}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        option.onSelect()
                        setGoalOverviewStatusMenuGoalId(null)
                      }}
                      className={`flex w-full items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-[12px] leading-[1.2] transition ${
                        option.active ? 'bg-white/[0.06] text-white/86' : 'text-white/68 hover:bg-white/[0.035] hover:text-white/84'
                      }`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${option.dotClassName}`} />
                      <span className="truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )
      },
    },
    completion: { label: 'Completion', width: '92px', render: (goal) => <div className="flex items-center gap-1.5 whitespace-nowrap">{renderCompletionIndicator(goal)}</div> },
  }

  const renderListRow = (goal: LifeGoal) => {
    const progress = getLifeGoalProgress(goal, getGoalRuntimeTasks(goal))
    const isPinned = pinnedGoalIds.has(goal.id)
    const isImportant = Boolean(goal.isPrimary)
    const milestoneCount = getOrderedGoalMilestones(goal).length
    const renderedGoalTitle = GOAL_OVERVIEW_USE_TITLE_CASE ? toTitleCase(formatGoalCardTitle(goal.title)) : formatGoalCardTitle(goal.title)
    const nextTaskText = progress.nextTask?.text?.trim() ?? ''
    const why = goal.whyItMatters.trim() || goal.minimumVersion.trim() || 'No context yet.'
    const nextAction = nextTaskText || goal.minimumVersion.trim() || 'No next action yet'
    const categoryLabel = goal.category.trim() || ((goal.goalType ?? 'outcome') === 'directional' ? 'Directional' : 'Outcome')
    const progressLabel = milestoneCount > 0
      ? `${progress.completedTasks}/${progress.totalTasks} tasks · ${milestoneCount} milestone${milestoneCount === 1 ? '' : 's'}`
      : progress.totalTasks > 0
        ? `${progress.completedTasks}/${progress.totalTasks} tasks`
        : `${progress.percent}% complete`

    return (
      <div
        key={goal.id}
        data-goal-overview-row-id={goal.id}
        role="button"
        tabIndex={0}
        onPointerDown={manualReorderEnabled ? (event) => startGoalOverviewPointerTracking(goal.id, event) : undefined}
        onKeyDown={(event) => {
          if (
            suppressGoalOverviewRowClickRef.current ||
            draggedLifeGoalId !== null ||
            goalOverviewControlsPanelOpen ||
            goalOverviewStatusMenuGoalId !== null ||
            goalOverviewActiveDateField !== null ||
            Date.now() < goalOverviewControlsDismissUntilRef.current ||
            Date.now() < goalOverviewStatusDismissUntilRef.current ||
            Date.now() < goalOverviewDateDismissUntilRef.current
          ) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelectGoal(goal.id)
            onCloseComposer()
          }
        }}
        onClick={() => {
          if (
            suppressGoalOverviewRowClickRef.current ||
            draggedLifeGoalId !== null ||
            goalOverviewControlsPanelOpen ||
            goalOverviewStatusMenuGoalId !== null ||
            goalOverviewActiveDateField !== null ||
            Date.now() < goalOverviewControlsDismissUntilRef.current ||
            Date.now() < goalOverviewStatusDismissUntilRef.current ||
            Date.now() < goalOverviewDateDismissUntilRef.current
          ) {
            suppressGoalOverviewRowClickRef.current = false
            return
          }
          onSelectGoal(goal.id)
          onCloseComposer()
        }}
        className={`group relative w-full select-none text-left ${
          draggedLifeGoalId === goal.id
            ? 'z-10 opacity-95'
            : dragOverLifeGoalId === goal.id && draggedLifeGoalId && draggedLifeGoalId !== goal.id
              ? 'outline outline-1 outline-white/[0.14]'
              : ''
        }`}
      >
        <GoalRow
          emoji={getGoalRowEmoji(goal)}
          title={renderedGoalTitle}
          category={categoryLabel}
          why={why}
          nextAction={nextAction}
          progress={progress.percent}
          progressLabel={progressLabel}
          dueDays={getGoalRowDueDays(goal)}
          pinned={isPinned}
          highImpact={Boolean(goal.isPrimary)}
        />
        <div className="pointer-events-none absolute right-4 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              togglePinnedGoal(goal.id)
            }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            className={`pointer-events-auto inline-flex items-center justify-center p-1.5 transition ${isPinned ? 'text-amber-400/80' : 'text-white/48 hover:text-white/70'}`}
            aria-label={isPinned ? 'Unpin goal' : 'Pin goal'}
          >
            <Pin size={13} strokeWidth={1.85} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              toggleImportantGoal(goal.id)
            }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            className={`pointer-events-auto inline-flex items-center justify-center p-1.5 transition ${isImportant ? 'text-amber-400/80' : 'text-white/48 hover:text-white/70'}`}
            aria-label={isImportant ? 'Unmark important' : 'Mark important'}
          >
            <Zap size={13} strokeWidth={1.85} fill={isImportant ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    )
  }

  const renderGroupedList = (groups: Array<{ label: string | null; goals: LifeGoal[] }>) => (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.label ?? 'default'} className="space-y-2">
          {group.label ? <p className="px-4 text-[12px] font-medium tracking-[-0.01em] text-mist/48">{group.label}</p> : null}
          <div className="space-y-3">{group.goals.map((goal) => renderListRow(goal))}</div>
        </section>
      ))}
    </div>
  )

  const renderBoardCard = (goal: LifeGoal) => {
    const categoryColor = goal.category ? getLifeGoalCategoryColor(goal.category, safeLifeGoalCategories) : 'neutral'
    const milestoneCount = getOrderedGoalMilestones(goal).length
    return (
      <button key={goal.id} type="button" onClick={() => { onSelectGoal(goal.id); onCloseComposer() }} className="group relative rounded-[18px] border border-white/[0.04] bg-white/[0.014] px-4 py-3 text-left transition hover:bg-white/[0.02]">
        <span aria-hidden="true" className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full bg-[rgb(var(--goal-rail-rgb)/0.24)]" style={getLifeGoalAccentBarStyle(categoryColor)} />
        <div className="space-y-2 pl-2">
          <div className="flex min-w-0 items-center gap-2">
            {renderLifeGoalIcon(goal.icon, 'shrink-0 text-white/46', 14)}
            <p className="truncate text-[14px] font-medium tracking-[-0.01em] text-white/88">{formatGoalCardTitle(goal.title)}</p>
            {milestoneCount > 0 ? <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-[3px] text-[10px] text-white/36">{milestoneCount}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {goal.category ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium leading-none text-white/44" style={getLifeGoalCategoryChipStyle(categoryColor)}>
                <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                <span>{goal.category}</span>
              </span>
            ) : null}
            <span className={`${goalStatusChipClassName} h-[22px] px-2 py-0 text-[9px] opacity-85 ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>{getLifeGoalStatusMeta(goal.status, goal.startDate).label}</span>
          </div>
          <p className="truncate text-[12px] text-white/48">{getLifeGoalAnchorText(goal.whyItMatters) || 'No context yet.'}</p>
        </div>
      </button>
    )
  }

  const renderBoardView = () => {
    const columns = [
      { id: 'not-started', label: 'Not Started', goals: sortOverviewGoals(activeOverviewGoals.filter((goal) => goal.status === 'not-started' || goal.status === 'paused')) },
      { id: 'active', label: 'Active', goals: sortOverviewGoals(activeOverviewGoals.filter((goal) => goal.status === 'in-motion')) },
      ...(viewControls.showCompleted ? [{ id: 'completed', label: 'Completed', goals: sortOverviewGoals(completedOverviewGoals) }] : []),
    ]
    return (
      <div className={`grid gap-4 ${columns.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {columns.map((column) => (
          <section key={column.id} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] font-medium tracking-[-0.01em] text-mist/46">{column.label}</p>
              <span className="text-[11px] text-mist/36">{column.goals.length}</span>
            </div>
            <div className="space-y-2">{column.goals.length > 0 ? column.goals.map((goal) => renderBoardCard(goal)) : <div className="px-1 py-3 text-[12px] text-mist/38">No goals</div>}</div>
          </section>
        ))}
      </div>
    )
  }

  const renderTimelinePlaceholder = () => <div className="px-4 py-6 text-[13px] text-mist/52">Timeline view is reserved here next, using the same goal collection and control state.</div>
  const renderCompletedSection = () => {
    if (!viewControls.showCompleted || completedOverviewGoals.length === 0 || viewControls.view === 'board') return null
    return (
      <section className="border-t border-white/[0.05] pt-4">
        <button type="button" onClick={() => setGoalOverviewCompletedOpen((current) => !current)} className="flex w-full items-center justify-between px-4 pb-2 text-left">
          <span className="text-[12px] font-medium tracking-[-0.01em] text-white/70">Completed</span>
          <span className="text-[12px] text-mist/42">{goalOverviewCompletedOpen ? 'Hide' : completedOverviewGoals.length}</span>
        </button>
        {goalOverviewCompletedOpen ? renderGroupedList(completedGroupedGoals) : null}
      </section>
    )
  }
  const renderOverviewContent = () => {
    if (viewControls.view === 'board') return renderBoardView()
    if (viewControls.view === 'timeline') return renderTimelinePlaceholder()
    return <div className="space-y-3">{renderGroupedList(activeGroupedGoals)}</div>
  }

  const renderControlsPanel = () => (
    <AnimatePresence>
      {goalOverviewControlsPanelOpen ? (
        <motion.aside
          ref={goalOverviewControlsPanelRef}
          className={`absolute right-0 top-[calc(100%+10px)] z-[80] flex max-h-[calc(100vh-32px)] w-[344px] max-w-[calc(100vw-32px)] min-h-0 flex-col ${GOALS_UTILITY_PANEL_SHELL_CLASSNAME}`}
          initial={{ opacity: 0, x: 12, y: -6 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 12, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain pr-1" onWheel={containScrollWithinElement}>
            <section className="space-y-1.5">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['list', 'List'],
                  ['board', 'Board'],
                  ['timeline', 'Timeline'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, view: value as GoalOverviewViewMode }))} className={`inline-flex items-center justify-center gap-1.5 rounded-[14px] border px-2.5 py-1.5 text-[12px] font-medium transition ${viewControls.view === value ? 'border-white/[0.1] bg-white/[0.06] text-white/88' : 'border-white/[0.05] bg-white/[0.018] text-white/46 hover:border-white/[0.08] hover:text-white/76'}`}>{label}</button>
                ))}
              </div>
            </section>
            <section className="grid gap-2.5">
              {([
                ['Group', 'groupBy', ['none', 'status', 'category', 'life-direction']],
                ['Sort', 'sortBy', ['manual', 'due', 'priority', 'updated']],
              ] as const).map(([label, key, options]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label className={GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME}>{label}</label>
                  <div className="relative">
                    <select value={viewControls[key]} onChange={(event) => onUpdateViewControls((current) => ({ ...current, [key]: event.target.value }))} className={GOALS_UTILITY_PANEL_SELECT_CLASSNAME}>
                      {options.map((option) => <option key={option} value={option}>{option === 'manual' ? 'Manual (drag to reorder)' : option === 'life-direction' ? 'Life Direction' : option === 'due' ? 'Due date' : option === 'updated' ? 'Recently updated' : option[0].toUpperCase() + option.slice(1)}</option>)}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center">
                      <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              ))}
              {([
                ['Show next task', 'showNextTask'],
                ['Show completed', 'showCompleted'],
              ] as const).map(([label, key]) => (
                <div key={key} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.05] bg-white/[0.018] px-3 py-2.5">
                  <div><p className={GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME}>{label}</p></div>
                  <button type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, [key]: !current[key] }))} className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${viewControls[key] ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'}`}>
                    <span className={`h-full w-4 rounded-full bg-white/70 transition ${viewControls[key] ? 'translate-x-[14px]' : ''}`} />
                  </button>
                </div>
              ))}
            </section>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME}>Columns</p>
                <p className={GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME}>Visible in list view</p>
              </div>
              <div className="grid gap-1">
                {viewControls.columnOrder.filter((columnKey) => columnKey !== 'milestones' && columnKey !== 'due' && columnKey !== 'startDate' && columnKey !== 'targetDate').map((columnKey) => {
                  const label = columnMeta[columnKey].label
                  const isVisible = viewControls.columns[columnKey]
                  return (
                    <div key={columnKey} onDragOver={(event) => { if (!goalOverviewDraggedColumn || goalOverviewDraggedColumn === columnKey) return; event.preventDefault() }} onDrop={(event) => { event.preventDefault(); if (!goalOverviewDraggedColumn || goalOverviewDraggedColumn === columnKey) return; reorderColumnBefore(goalOverviewDraggedColumn, columnKey); setGoalOverviewDraggedColumn(null) }} className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'} ${goalOverviewDraggedColumn === columnKey ? 'bg-white/[0.03]' : ''}`}>
                      <div className="flex items-center gap-2">
                        <button type="button" draggable onDragStart={(event) => { event.stopPropagation(); setGoalOverviewDraggedColumn(columnKey) }} onDragEnd={() => setGoalOverviewDraggedColumn(null)} className={`inline-flex h-5 w-5 cursor-grab items-center justify-center rounded-[8px] text-[13px] leading-none transition hover:bg-white/[0.03] hover:text-white/62 active:cursor-grabbing ${isVisible ? 'text-white/45' : 'text-white/28'}`} aria-label={`Reorder ${label} column`}>⋮⋮</button>
                        <button type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, columns: { ...current.columns, [columnKey]: !current.columns[columnKey] } }))} className={`text-left text-[12px] transition ${GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}>{label}</button>
                      </div>
                      <button type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, columns: { ...current.columns, [columnKey]: !current.columns[columnKey] } }))} className={`inline-flex h-4 w-7 rounded-full border p-[2px] ${isVisible ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'}`}>
                        <span className={`h-full w-3 rounded-full bg-white/70 transition ${isVisible ? 'translate-x-[11px]' : ''}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
            <section className="space-y-2">
              <div className="flex items-center justify-between"><p className={GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME}>Row content</p></div>
              <div className="grid gap-1">
                {([
                  ['icons', 'Icons'],
                  ['why', 'Why'],
                  ['startDate', 'Start date'],
                  ['targetDate', 'Target date'],
                  ['dueAmount', 'Due (days)'],
                  ['milestones', 'Milestones'],
                  ['directional', 'Directional'],
                ] as const).map(([key, label]) => {
                  const rowContentKey = key as GoalOverviewRowContentKey
                  const isVisible = viewControls.rowContent[rowContentKey]
                  return (
                    <div key={rowContentKey} className={`flex w-full items-center justify-between rounded-[12px] px-2.5 py-2 transition ${isVisible ? 'hover:bg-white/[0.03]' : 'opacity-70'}`}>
                      <button type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, rowContent: { ...current.rowContent, [rowContentKey]: !current.rowContent[rowContentKey] } }))} className={`text-left text-[12px] transition ${GOALS_UTILITY_PANEL_SECONDARY_LABEL_CLASSNAME} hover:text-[rgba(255,255,255,0.7)]`}>{label}</button>
                      <button type="button" onClick={() => onUpdateViewControls((current) => ({ ...current, rowContent: { ...current.rowContent, [rowContentKey]: !current.rowContent[rowContentKey] } }))} className={`inline-flex h-5 w-9 rounded-full border p-[2px] transition ${isVisible ? 'border-white/[0.12] bg-white/[0.08]' : 'border-white/[0.06] bg-transparent'}`} aria-label={`${isVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>
                        <span className={`h-full w-4 rounded-full bg-white/70 transition ${isVisible ? 'translate-x-[14px]' : ''}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
            <div className="border-t border-white/[0.05] pt-3">
              <button type="button" onClick={() => { onResetViewControls(); setGoalOverviewCompletedOpen(false) }} className={`${GOALS_UTILITY_PANEL_PRIMARY_LABEL_CLASSNAME} transition hover:text-white/82`}>Reset</button>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )

  const goalsHeaderControlsSlot = typeof document !== 'undefined' ? document.getElementById('goals-header-controls-slot') : null
  const headerButtonClass = 'inline-flex items-center justify-center p-1 text-zinc-600 transition-colors hover:text-zinc-400'
  const floatingButtonClass = 'border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] hover:bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)]'

  return (
    <div ref={goalOverviewPageRef} className="relative mx-auto max-w-[1280px] space-y-3">
      {goalsHeaderControlsSlot
        ? createPortal(
            <div className="relative inline-flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  if (composerOpen && composerMode === 'create') {
                    onCloseComposer()
                    return
                  }
                  onResetComposerDraft()
                  onOpenComposer(event.currentTarget)
                }}
                className={`${headerButtonClass} text-[22px] font-semibold leading-none`}
                aria-label="Create goal"
              >
                +
              </button>
              <button
                ref={goalOverviewControlsTriggerRef}
                type="button"
                onClick={() => setGoalOverviewControlsPanelOpen((current) => !current)}
                className={headerButtonClass}
                aria-label="Open view controls"
                aria-expanded={goalOverviewControlsPanelOpen}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="5.5" cy="4.5" r="1.4" fill="currentColor" />
                  <circle cx="10.5" cy="8" r="1.4" fill="currentColor" />
                  <circle cx="7" cy="11.5" r="1.4" fill="currentColor" />
                </svg>
              </button>
              {!goalOverviewHeaderControlsSticky ? renderControlsPanel() : null}
            </div>,
            goalsHeaderControlsSlot,
          )
        : null}

      {typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={goalOverviewHeaderControlsRef}
              className="fixed z-[120] inline-flex items-center gap-2"
              style={{ top: 16, right: goalOverviewHeaderControlsRight, opacity: goalOverviewFloatingOpacity, pointerEvents: goalOverviewFloatingOpacity > 0 ? 'auto' : 'none' }}
            >
              <button
                ref={goalOverviewFloatingControlsTriggerRef}
                type="button"
                onClick={() => setGoalOverviewControlsPanelOpen((current) => !current)}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-white/50 transition hover:border-white/[0.07] hover:text-white/76 ${floatingButtonClass}`}
                aria-label="Open view controls"
                aria-expanded={goalOverviewControlsPanelOpen}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="5.5" cy="4.5" r="1.4" fill="currentColor" />
                  <circle cx="10.5" cy="8" r="1.4" fill="currentColor" />
                  <circle cx="7" cy="11.5" r="1.4" fill="currentColor" />
                </svg>
              </button>
              {goalOverviewHeaderControlsSticky ? renderControlsPanel() : null}
            </div>,
            document.body,
          )
        : null}

      {composerOpen && composerMode === 'create' ? (
        <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.42)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          {composerSlot}
        </div>
      ) : null}

      {goalOverviewActiveDateField && typeof document !== 'undefined'
        ? (
            <GoalDatePicker
              ref={goalOverviewDatePanelRef}
              value={
                safeLifeGoals.find((item) => item.id === goalOverviewActiveDateField.goalId)?.[goalOverviewActiveDateField.field] ?? ''
              }
              anchorPosition={goalOverviewDatePanelPosition}
              label={goalOverviewActiveDateField.field === 'startDate' ? 'Start Date' : 'Target Date'}
              onChange={(value) =>
                applyGoalOverviewDate(goalOverviewActiveDateField.goalId, goalOverviewActiveDateField.field, value)
              }
              onClose={() => {
                goalOverviewActiveDateTriggerRef.current = null
                setGoalOverviewActiveDateField(null)
                setGoalOverviewDatePanelPosition(null)
              }}
            />
          )
        : null}

      {allOverviewGoals.length === 0 && !composerOpen ? (
        <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.46)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-[15px] text-white/80">No goals yet</p>
          <p className="mt-1.5 text-[13px] text-white/48">Create one meaningful direction to start using the workspace.</p>
        </div>
      ) : null}

      {hasPrimaryContent ? (
        <div className={viewControls.view === 'list' ? 'space-y-3' : 'rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.54)] px-0 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]'}>
          {renderOverviewContent()}
          {renderCompletedSection()}
        </div>
      ) : allOverviewGoals.length > 0 ? (
        <div className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.46)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <p className="text-[15px] text-white/80">No active goals visible</p>
          <p className="mt-1.5 text-[13px] text-white/48">Turn on completed goals in View Controls to show archived progress here.</p>
        </div>
      ) : null}
    </div>
  )
}
