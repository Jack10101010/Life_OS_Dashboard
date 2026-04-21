// @ts-nocheck
import * as React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ControlsPanelShell,
  PanelActionRow,
  PanelFieldRow,
  PanelRowLabel,
  PanelSection,
  PanelSectionTitle,
  PanelSubToggleRow,
} from '../../../components/layout/LayoutPrimitives'
import type { FloatingPanelPosition } from '../../../components/layout/OverlayPrimitives'
import { Button, IconButton } from '../../../components/ui/Button'
import Toggle from '../../../components/ui/Toggle'
import { LifeGoalVisionCard } from './LifeGoalVisionCard'
import GoalHero from '../../../components/goals/GoalHero'
import GoalInsights from '../../../components/goals/GoalInsights'
import GoalMilestonePanel from '../../../components/goals/GoalMilestonePanel'
import GoalRoadmap from '../../../components/goals/GoalRoadmap'
import GoalVision from '../../../components/goals/GoalVision'
import { GoalDatePicker } from '../GoalDatePicker'
import {
  formatDate,
  formatTaskDueDate,
  getLifeGoalCategoryColor,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryChipTextStyle,
  getLifeGoalCategoryDotStyle,
  getLifeGoalCategorySurfaceWashStyle,
  getLifeGoalMomentumState,
  getLifeGoalProgress,
  getLifeGoalStatusMeta,
  getSubtaskProgressSummary,
  getTodayIsoDate,
  isLifeGoalScheduled,
  isValidIsoDate,
} from '../goalUtils'
import { getLiveTrackerStreak, getTrackerGoalProgress } from '../../../lib/habitTrackerGoals'
import { getPriorityScore, getRelativeDueMeta, normalizeTaskTag } from '../lib/taskDerivations'

type LifeGoalDetailPageProps = Record<string, any>

const ATOMS_GOAL_DETAIL_FALLBACK_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"%3E%3Cdefs%3E%3CradialGradient id="a" cx="50%25" cy="40%25" r="75%25"%3E%3Cstop offset="0%25" stop-color="%236366F1" stop-opacity=".32"/%3E%3Cstop offset="45%25" stop-color="%231A1D26" stop-opacity=".9"/%3E%3Cstop offset="100%25" stop-color="%230A0B0F"/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width="960" height="540" fill="url(%23a)"/%3E%3C/svg%3E'

function GoalDetailControlsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4.25H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M2.5 11.75H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5.25" cy="4.25" r="1.35" fill="currentColor" />
      <circle cx="10.75" cy="8" r="1.35" fill="currentColor" />
      <circle cx="7.25" cy="11.75" r="1.35" fill="currentColor" />
    </svg>
  )
}

function getAtomsGoalEmoji(goal) {
  const icon = typeof goal?.icon === 'string' ? goal.icon.replace(/^emoji:\s*/i, '').trim() : ''
  return icon || '🎯'
}

function getAtomsGoalStatus(goal) {
  if (goal?.status === 'complete') return 'Completed'
  return goal?.status === 'paused' ? 'On Hold' : 'Active'
}

function getAtomsTaskCategory(task) {
  return task?.taskTag ? formatAtomsTaskTagLabel(task.taskTag) : task?.priority && task.priority !== 'none' ? `${task.priority} priority` : 'Goal task'
}

function formatAtomsTaskTagLabel(tag) {
  const normalized = normalizeTaskTag(tag)
  if (!normalized) return 'Goal task'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

function getAtomsTaskTagLabel(task) {
  const normalized = task?.taskTag ? normalizeTaskTag(task.taskTag) : ''
  if (!normalized) return undefined
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

function getAtomsTaskEstimate(task) {
  if (task?.dueDate) return formatTaskDueDate(task.dueDate)
  return 'Next action'
}

function getAtomsRoadmapTaskSubtitle(task) {
  const dueDate = typeof task?.dueDate === 'string' ? task.dueDate.trim() : task?.dueDate
  if (dueDate) return getAtomsRoadmapDueSubtitle(dueDate)
  const category = getAtomsTaskCategory(task)
  return category === 'Goal task' ? null : { text: category, tone: 'default' }
}

function getAtomsRoadmapDueSubtitle(dueDate) {
  const today = new Date(`${getTodayIsoDate()}T00:00:00Z`)
  const target = new Date(`${dueDate}T00:00:00Z`)
  const dayDiff = Math.round((target.getTime() - today.getTime()) / 86400000)

  if (dayDiff < 0) {
    const overdueDays = Math.abs(dayDiff)
    return {
      text: formatTaskDueDate(dueDate),
      tone: 'overdue',
      suffix: `${overdueDays}d`,
    }
  }

  if (dayDiff === 0) {
    return {
      text: 'Today',
      tone: 'today',
    }
  }

  if (dayDiff <= 2) {
    return {
      text: `Due in ${dayDiff}d`,
      tone: 'upcoming',
    }
  }

  if (dayDiff <= 3) {
    return {
      text: `Due in ${dayDiff}d`,
      tone: 'default',
    }
  }

  return {
    text: formatTaskDueDate(dueDate),
    tone: 'default',
  }
}

function getAtomsLastActivity(progress) {
  if (progress?.lastCompletedTask?.completedAt) return `Last progressed ${formatDate(progress.lastCompletedTask.completedAt)}`
  return 'No recent progress yet'
}

function getAtomsVisionImageUrl(goal) {
  const image = goal?.visionImages?.[0]
  if (typeof image === 'string' && image.trim()) return image
  if (image && typeof image === 'object') return image.url ?? image.src ?? image.dataUrl ?? ATOMS_GOAL_DETAIL_FALLBACK_IMAGE
  return ATOMS_GOAL_DETAIL_FALLBACK_IMAGE
}

function getAtomsVisionText(goal) {
  return goal?.visionStatement?.trim() || goal?.whyItMatters?.trim() || 'A clear picture of what this goal is moving toward.'
}

function createAtomsMilestoneId() {
  return `life-goal-milestone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function createAtomsMilestoneDraft(title = '') {
  return {
    title,
    description: '',
    targetDate: null,
    showTargetDateInRoadmap: false,
    completed: false,
  }
}

function normalizeAtomsMilestoneDraft(draft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    targetDate: draft.targetDate && isValidIsoDate(draft.targetDate) ? draft.targetDate : null,
    showTargetDateInRoadmap: Boolean(draft.targetDate && draft.showTargetDateInRoadmap),
    completed: Boolean(draft.completed),
  }
}

function reindexAtomsMilestones(milestones) {
  return milestones.map((milestone, index) => ({
    ...milestone,
    targetDate: milestone.targetDate && isValidIsoDate(milestone.targetDate) ? milestone.targetDate : null,
    completedAt: milestone.completed ? milestone.completedAt ?? new Date().toISOString() : null,
    order: index,
  }))
}

function useAtomsMilestonePanel({ selectedLifeGoal, onUpdateLifeGoal }) {
  const [panelState, setPanelState] = React.useState({
    mode: null,
    milestoneId: null,
    draft: createAtomsMilestoneDraft(),
  })

  const close = React.useCallback(() => {
    setPanelState((current) => ({
      ...current,
      mode: null,
      milestoneId: null,
    }))
  }, [])

  const openCreate = React.useCallback(() => {
    const nextIndex = (selectedLifeGoal?.milestones ?? []).length + 1
    setPanelState({
      mode: 'create',
      milestoneId: null,
      draft: createAtomsMilestoneDraft(`Milestone ${nextIndex}`),
    })
  }, [selectedLifeGoal?.milestones])

  const openEdit = React.useCallback((milestoneId) => {
    const milestone = (selectedLifeGoal?.milestones ?? []).find((item) => item.id === milestoneId)
    if (!milestone) return
    setPanelState({
      mode: 'edit',
      milestoneId,
      draft: {
        title: milestone.title,
        description: milestone.description ?? '',
        targetDate: milestone.targetDate ?? null,
        showTargetDateInRoadmap: Boolean(milestone.showTargetDateInRoadmap),
        completed: Boolean(milestone.completed),
      },
    })
  }, [selectedLifeGoal?.milestones])

  const setDraft = React.useCallback((draft) => {
    setPanelState((current) => ({
      ...current,
      draft,
    }))
  }, [])

  const submit = React.useCallback(() => {
    if (!selectedLifeGoal || selectedLifeGoal.goalType !== 'outcome' || !panelState.mode) return
    const draft = normalizeAtomsMilestoneDraft(panelState.draft)
    if (!draft.title) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => {
      const currentMilestones = (goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
      const nextMilestones =
        panelState.mode === 'create'
          ? [
              ...currentMilestones,
              {
                id: createAtomsMilestoneId(),
                ...draft,
                completedAt: draft.completed ? new Date().toISOString() : null,
                order: currentMilestones.length,
              },
            ]
          : currentMilestones.map((milestone) =>
              milestone.id === panelState.milestoneId
                ? {
                    ...milestone,
                    ...draft,
                    completedAt: draft.completed
                      ? milestone.completedAt ?? new Date().toISOString()
                      : null,
                  }
                : milestone,
            )

      return {
        ...goal,
        milestones: reindexAtomsMilestones(nextMilestones),
        updatedAt: new Date().toISOString(),
      }
    })
    close()
  }, [close, onUpdateLifeGoal, panelState.draft, panelState.milestoneId, panelState.mode, selectedLifeGoal])

  const remove = React.useCallback(() => {
    if (!selectedLifeGoal || !panelState.milestoneId) return
    if (!window.confirm('Delete this milestone? Tasks assigned to it will move to Unassigned tasks.')) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      milestones: reindexAtomsMilestones((goal.milestones ?? []).filter((milestone) => milestone.id !== panelState.milestoneId)),
      updatedAt: new Date().toISOString(),
    }))
    close()
  }, [close, onUpdateLifeGoal, panelState.milestoneId, selectedLifeGoal])

  const move = React.useCallback((direction: 'up' | 'down') => {
    if (!selectedLifeGoal || !panelState.milestoneId) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => {
      const currentMilestones = (goal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
      const currentIndex = currentMilestones.findIndex((milestone) => milestone.id === panelState.milestoneId)
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentMilestones.length) return goal

      const nextMilestones = currentMilestones.slice()
      const currentMilestone = nextMilestones[currentIndex]
      nextMilestones[currentIndex] = nextMilestones[nextIndex]
      nextMilestones[nextIndex] = currentMilestone

      return {
        ...goal,
        milestones: reindexAtomsMilestones(nextMilestones),
        updatedAt: new Date().toISOString(),
      }
    })
  }, [onUpdateLifeGoal, panelState.milestoneId, selectedLifeGoal])

  const setCompleted = React.useCallback((completed: boolean) => {
    if (!selectedLifeGoal || !panelState.milestoneId) return

    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      milestones: reindexAtomsMilestones((goal.milestones ?? []).map((milestone) =>
        milestone.id === panelState.milestoneId
          ? {
              ...milestone,
              completed,
              completedAt: completed ? milestone.completedAt ?? new Date().toISOString() : null,
            }
          : milestone,
      )),
      updatedAt: new Date().toISOString(),
    }))
    setPanelState((current) => ({
      ...current,
      draft: {
        ...current.draft,
        completed,
      },
    }))
  }, [onUpdateLifeGoal, panelState.milestoneId, selectedLifeGoal])

  const milestone = panelState.milestoneId
    ? (selectedLifeGoal?.milestones ?? []).find((item) => item.id === panelState.milestoneId) ?? null
    : null

  return {
    mode: panelState.mode,
    milestoneId: panelState.milestoneId,
    draft: panelState.draft,
    milestone,
    openCreate,
    openEdit,
    close,
    setDraft,
    submit,
    remove,
    moveUp: () => move('up'),
    moveDown: () => move('down'),
    complete: () => setCompleted(true),
    restore: () => setCompleted(false),
  }
}

function getAtomsRoadmapMilestones(goal, milestones, tasks, nextTask) {
  const nextTaskId = nextTask?.id ?? null
  const toRoadmapStep = (task) => {
    const subtitle = getAtomsRoadmapTaskSubtitle(task)
    const subtaskSummary = getSubtaskProgressSummary(task.subtasks ?? [])
    return {
      id: task.id,
      taskId: task.id,
      title: task.text?.trim() || 'Untitled task',
      tagLabel: getAtomsTaskTagLabel(task),
      highPriority: task.priority === 'high',
      subtaskTotalCount: subtaskSummary.total,
      subtaskCompletedCount: subtaskSummary.completed,
      subtaskRingStates: (task.subtasks ?? []).slice(0, 3).map((subtask) => Boolean(subtask.completed)),
      status: task.completed ? 'completed' : task.id === nextTaskId ? 'current' : 'upcoming',
      subtitle: subtitle?.text,
      subtitleTone: subtitle?.tone,
      subtitleDot: subtitle?.dot,
      subtitleSuffix: subtitle?.suffix,
    }
  }

  if (!milestones?.length) {
    return [
      {
        id: 'goal-tasks',
        label: 'Execution',
        editable: false,
        steps: tasks.map(toRoadmapStep),
      },
    ]
  }

  const milestoneIds = new Set(milestones.map((milestone) => milestone.id))
  const milestoneGroups = milestones.map((milestone, index) => {
    const milestoneTasks = tasks.filter((task) => task.milestoneId === milestone.id)

    return {
      id: milestone.id,
      label: milestone.title?.trim() || `Milestone ${index + 1}`,
      editable: true,
      completed: Boolean(milestone.completed),
      metadata: milestone.targetDate && milestone.showTargetDateInRoadmap ? formatDate(milestone.targetDate) : undefined,
      steps: milestoneTasks.map(toRoadmapStep),
    }
  })

  const unassignedTasks = tasks.filter((task) => !task.milestoneId || !milestoneIds.has(task.milestoneId))
  if (unassignedTasks.length === 0) return milestoneGroups

  return [
    ...milestoneGroups,
    {
      id: 'goal-tasks-unassigned',
      label: 'Unassigned tasks',
      editable: false,
      steps: unassignedTasks.map(toRoadmapStep),
    },
  ]
}

function getAtomsRoadmapNextTask(milestones, tasks) {
  const milestoneIds = new Set((milestones ?? []).map((milestone) => milestone.id))

  for (const milestone of milestones ?? []) {
    const nextMilestoneTask = tasks.find((task) => task.milestoneId === milestone.id && !task.completed)
    if (nextMilestoneTask) return nextMilestoneTask
  }

  const hasMilestoneTasks = tasks.some((task) => milestoneIds.has(task.milestoneId))
  if (hasMilestoneTasks) return null

  return tasks.find((task) => !task.completed) ?? null
}

function getAtomsInsightTrend(goal, progress) {
  if (goal?.status === 'complete') return 'ahead'
  if ((progress?.plannedTasks?.length ?? 0) === 0 && (progress?.completedTaskItems?.length ?? 0) === 0) return 'behind'
  return 'on-track'
}

function getAtomsChartData(tasks) {
  const today = new Date()
  return Array.from({ length: 8 }, (_, index) => {
    const bucketStart = new Date(today)
    bucketStart.setDate(today.getDate() - (7 - index) * 4)
    const bucketEnd = new Date(bucketStart)
    bucketEnd.setDate(bucketStart.getDate() + 3)

    return tasks.filter((task) => {
      if (!task.completedAt) return false
      const completedAt = new Date(task.completedAt)
      return completedAt >= bucketStart && completedAt <= bucketEnd
    }).length
  })
}

export const LifeGoalDetailPage = React.memo(function LifeGoalDetailPage(props: LifeGoalDetailPageProps) {
  const {
    selectedLifeGoal,
    lifeGoalCategories,
    selectedLifeGoalProgress,
    selectedGoalAnchorText,
    selectedGoalDetailContentVisibility,
    selectedGoalIsOutcome,
    selectedGoalIsDirectional,
    selectedLifeGoalMilestones,
    selectedShowMilestoneProgressView,
    selectedGoalRelatedGoals,
    selectedGoalLinkedDirectionalTasks,
    selectedGoalSupportingHabits,
    selectedGoalParentGoals,
    selectedGoalDirectionalMetrics,
    selectedGoalCategory,
    selectedGoalCategoryColor,
    selectedGoalRuntimeTasks,
    goalRuntimeTaskMap,
    goalDetailOrigin,
    taskPeekRightOffset = 0,
    year,
    inlineLifeGoalEditingField,
    lifeGoalDraft,
    lifeGoalIconFieldRef,
    lifeGoalTitleInputRef,
    lifeGoalWhyTextareaRef,
    dragOverVisionImageIndex,
    draggedVisionImageIndex,
    editGoalActionsButtonRef,
    editGoalActionsMenuOpen,
    editGoalActionsMenuRef,
    prefersReducedMotion,
    roadmapCompletedOpen,
    roadmapHighPriorityFocus,
    selectedLifeGoalCanUploadVisionImages,
    selectedLifeGoalShowVisionEditUI,
    selectedLifeGoalVisionCollapsed,
    selectedLifeGoalVisionEditMode,
    selectedLifeGoalVisionEditShowsImages,
    selectedLifeGoalVisionEditShowsStatement,
    selectedLifeGoalVisionEditorOpen,
    selectedLifeGoalVisionMode,
    selectedLifeGoalVisionShowsImagesInDisplay,
    selectedLifeGoalVisionShowsStatementInDisplay,
    visionDropActive,
    visionImageInteractiveOptions,
    visionUploadInputRef,
    goalStatusChipClassName,
    LIFE_GOAL_ICON_MAP,
    renderLifeGoalOverviewPage,
    onUpdateLifeGoal,
    onArchiveLifeGoal,
    onChangeGoalsView,
    onSelectLifeGoal,
    onOpenDashboard,
    onOpenTasks,
    openEditLifeGoalComposer,
    openNewTaskPeek,
    openSelectedLifeGoalVisionEditor,
    openTaskPeek,
    requestDeleteLifeGoal,
    updateSelectedLifeGoalVisionStatement,
    commitInlineLifeGoalField,
    cancelInlineLifeGoalField,
    primeInlineLifeGoalDraft,
    handleTaskRowKeyDown,
    onOpenHabitTracker,
    applySelectedLifeGoalVisionEditMode,
    appendSelectedLifeGoalVisionImages,
    removeSelectedLifeGoalVisionImage,
    renderVisionImageLayout,
    reorderSelectedLifeGoalVisionImages,
    setDragOverVisionImageIndex,
    setDraggedVisionImageIndex,
    setEditGoalActionsMenuOpen,
    setInlineLifeGoalEditingField,
    setInlineLifeGoalIconGoalId,
    setLifeGoalDraft,
    setLifeGoalIconPickerOpen,
    setLifeGoalIconPickerQuery,
    setLifeGoalIconPickerTab,
    setRoadmapCompletedOpen,
    setRoadmapHighPriorityFocus,
    setSelectedLifeGoalVisionEditMode,
    setVisionDropActive,
    setVisionPreviewImage,
  } = props
  const [directionalHeaderEditPanelOpen, setDirectionalHeaderEditPanelOpen] = React.useState(false)
  const directionalHeaderEditPanelRef = React.useRef<HTMLDivElement | null>(null)
  const directionalHeaderEditButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const [goalDetailCategoryMenuOpen, setGoalDetailCategoryMenuOpen] = React.useState(false)
  const [goalDetailControlsPanelOpen, setGoalDetailControlsPanelOpen] = React.useState(false)
  const [goalDetailRoadmapControlsPanelOpen, setGoalDetailRoadmapControlsPanelOpen] = React.useState(false)
  const [goalDetailRoadmapViewSelection, setGoalDetailRoadmapViewSelection] = React.useState<'roadmap' | 'milestones' | 'notes' | 'tasks'>('roadmap')
  const [goalDetailRoadmapShowMilestones, setGoalDetailRoadmapShowMilestones] = React.useState(true)
  const [goalDetailRoadmapShowTags, setGoalDetailRoadmapShowTags] = React.useState(false)
  const [goalDetailRoadmapSubtaskDisplayMode, setGoalDetailRoadmapSubtaskDisplayMode] = React.useState<'chip' | 'rings'>('chip')
  const [isHeroExpanded, setIsHeroExpanded] = React.useState(true)
  const [goalDetailFooterMenuOpen, setGoalDetailFooterMenuOpen] = React.useState(false)
  const [goalDetailDatePickerField, setGoalDetailDatePickerField] = React.useState<'startDate' | 'targetDate' | null>(null)
  const [goalDetailDatePanelPosition, setGoalDetailDatePanelPosition] = React.useState<FloatingPanelPosition | null>(null)
  const goalDetailControlsPanelRef = React.useRef<HTMLElement | null>(null)
  const goalDetailControlsTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const goalDetailRoadmapControlsPanelRef = React.useRef<HTMLElement | null>(null)
  const goalDetailRoadmapControlsTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const goalDetailFooterMenuRef = React.useRef<HTMLDivElement | null>(null)
  const goalDetailFooterMenuButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const goalDetailCategoryMenuRef = React.useRef<HTMLDivElement | null>(null)
  const goalDetailCategoryButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const goalDetailDatePanelRef = React.useRef<HTMLDivElement | null>(null)
  const goalDetailStartDateButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const goalDetailTargetDateButtonRef = React.useRef<HTMLButtonElement | null>(null)
  const atomsMilestonePanel = useAtomsMilestonePanel({ selectedLifeGoal, onUpdateLifeGoal })
  const getRuntimeTasksForGoal = React.useCallback(
    (goal) => goalRuntimeTaskMap?.get(goal.id) ?? [],
    [goalRuntimeTaskMap],
  )

  React.useEffect(() => {
    if (!goalDetailControlsPanelOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedDatePicker = goalDetailDatePanelRef.current?.contains(target)
      const clickedDateTrigger =
        goalDetailStartDateButtonRef.current?.contains(target) ||
        goalDetailTargetDateButtonRef.current?.contains(target)
      const clickedFooterMenu =
        goalDetailFooterMenuRef.current?.contains(target) ||
        goalDetailFooterMenuButtonRef.current?.contains(target)

      if (goalDetailFooterMenuOpen && !clickedFooterMenu) {
        setGoalDetailFooterMenuOpen(false)
      }

      if (goalDetailDatePickerField && !clickedDatePicker && !clickedDateTrigger) {
        setGoalDetailDatePickerField(null)
        setGoalDetailDatePanelPosition(null)
      }

      if (
        goalDetailControlsPanelRef.current?.contains(target) ||
        goalDetailControlsTriggerRef.current?.contains(target) ||
        clickedDatePicker ||
        clickedFooterMenu
      ) {
        return
      }
      setGoalDetailControlsPanelOpen(false)
      setGoalDetailFooterMenuOpen(false)
      setGoalDetailDatePickerField(null)
      setGoalDetailDatePanelPosition(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGoalDetailControlsPanelOpen(false)
        setGoalDetailFooterMenuOpen(false)
        setGoalDetailDatePickerField(null)
        setGoalDetailDatePanelPosition(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalDetailControlsPanelOpen, goalDetailDatePickerField, goalDetailFooterMenuOpen])

  React.useEffect(() => {
    if (!goalDetailCategoryMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        goalDetailCategoryMenuRef.current?.contains(target) ||
        goalDetailCategoryButtonRef.current?.contains(target)
      ) {
        return
      }
      setGoalDetailCategoryMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGoalDetailCategoryMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalDetailCategoryMenuOpen])

  React.useEffect(() => {
    if (!goalDetailRoadmapControlsPanelOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        goalDetailRoadmapControlsPanelRef.current?.contains(target) ||
        goalDetailRoadmapControlsTriggerRef.current?.contains(target)
      ) {
        return
      }
      setGoalDetailRoadmapControlsPanelOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGoalDetailRoadmapControlsPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [goalDetailRoadmapControlsPanelOpen])

  React.useEffect(() => {
    if (!directionalHeaderEditPanelOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        !directionalHeaderEditPanelRef.current?.contains(target) &&
        !directionalHeaderEditButtonRef.current?.contains(target)
      ) {
        setDirectionalHeaderEditPanelOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDirectionalHeaderEditPanelOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [directionalHeaderEditPanelOpen])

  if (!selectedLifeGoal || !selectedLifeGoalProgress) {
    return renderLifeGoalOverviewPage()
  }

  const anchorText = selectedGoalAnchorText
  const showDetailIcon = selectedGoalDetailContentVisibility.icon
  const showDetailCategory = selectedGoalDetailContentVisibility.category
  const showDetailStatus = selectedGoalDetailContentVisibility.status
  const showDetailVision = selectedGoalDetailContentVisibility.vision
  const isOutcomeGoal = selectedGoalIsOutcome
  const isDirectionalGoal = selectedGoalIsDirectional
  const parentOverviewGoalsView = isDirectionalGoal ? 'directional-overview' : 'life-overview'
  const todayIsoDate = getTodayIsoDate()
  const relatedGoals = selectedGoalRelatedGoals
  const linkedDirectionalTasks = selectedGoalLinkedDirectionalTasks
  const supportingHabits = selectedGoalSupportingHabits
  const parentGoals = selectedGoalParentGoals
  const {
    activeRelatedGoalsCount,
    completedRelatedGoalsCount,
    pausedRelatedGoalsCount,
    visibleRelatedGoals,
    hiddenRelatedGoalsCount,
    visibleParentGoals,
    hiddenParentGoalsCount,
    visibleDirectionalTasks,
    hiddenDirectionalTasksCount,
    recentDirectionalActionCount,
    visibleSupportingHabits,
    hiddenSupportingHabitsCount,
  } = selectedGoalDirectionalMetrics
  const goalHeaderChipClassName =
    'inline-flex h-6 shrink-0 items-center justify-center rounded-full border px-2.5 text-[10px] uppercase tracking-[0.14em] leading-none border-white/[0.06]'
  const embeddedEditPanelShellClassName =
    'overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.22)]'
  const embeddedEditPanelLabelClassName = 'text-[12px] text-[rgba(255,255,255,0.85)]'
  const embeddedEditPanelSelectClassName =
    'h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]'
  const embeddedEditPanelRowClassName = 'flex items-center justify-between gap-3'
  const availableDirectionalCategoryOptions = React.useMemo(() => {
    const values = Array.from(new Set([...(lifeGoalCategories ?? []).map((item) => item.name), selectedLifeGoal.category].filter(Boolean)))
    return values
  }, [lifeGoalCategories, selectedLifeGoal.category])
  const updateDirectionalField = React.useCallback(
    <K extends keyof typeof selectedLifeGoal>(field: K, value: (typeof selectedLifeGoal)[K]) => {
      onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
        ...goal,
        [field]: value,
        updatedAt: new Date().toISOString(),
      }))
    },
    [onUpdateLifeGoal, selectedLifeGoal.id],
  )
  const startInlineTitleEdit = React.useCallback(() => {
    primeInlineLifeGoalDraft(selectedLifeGoal)
    setInlineLifeGoalEditingField('title')
  }, [primeInlineLifeGoalDraft, selectedLifeGoal, setInlineLifeGoalEditingField])
  const startInlineWhyEdit = React.useCallback(() => {
    primeInlineLifeGoalDraft(selectedLifeGoal)
    setInlineLifeGoalEditingField('why')
  }, [primeInlineLifeGoalDraft, selectedLifeGoal, setInlineLifeGoalEditingField])
  const startInlineIconEdit = React.useCallback((trigger: HTMLButtonElement) => {
    primeInlineLifeGoalDraft(selectedLifeGoal)
    lifeGoalIconFieldRef.current = trigger
    setLifeGoalIconPickerQuery('')
    setLifeGoalIconPickerTab(selectedLifeGoal.icon?.startsWith('emoji:') ? 'emojis' : 'icons')
    setInlineLifeGoalIconGoalId(selectedLifeGoal.id)
    setLifeGoalIconPickerOpen(true)
  }, [
    primeInlineLifeGoalDraft,
    selectedLifeGoal,
    lifeGoalIconFieldRef,
    setLifeGoalIconPickerQuery,
    setLifeGoalIconPickerTab,
    setInlineLifeGoalIconGoalId,
    setLifeGoalIconPickerOpen,
  ])
  const handleInlineIconMouseDown = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    startInlineIconEdit(event.currentTarget)
  }, [startInlineIconEdit])
  const handleInlineIconKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      startInlineIconEdit(event.currentTarget)
    }
  }, [startInlineIconEdit])
  const inlineEditableIconControl = !showDetailIcon ? null : selectedLifeGoal.icon?.startsWith('emoji:') ? (
    <button
      type="button"
      onMouseDown={handleInlineIconMouseDown}
      onKeyDown={handleInlineIconKeyDown}
      className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none"
    >
      {selectedLifeGoal.icon.slice(6)}
    </button>
  ) : selectedLifeGoal.icon && LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon] ? (
    <button
      type="button"
      onMouseDown={handleInlineIconMouseDown}
      onKeyDown={handleInlineIconKeyDown}
      className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-white/52"
    >
      {(() => {
        const Icon = LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon].Icon
        return <Icon size={16} className="text-white/52" />
      })()}
    </button>
  ) : (
    <button
      type="button"
      onMouseDown={handleInlineIconMouseDown}
      onKeyDown={handleInlineIconKeyDown}
      className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] text-white/26 transition hover:text-white/52"
      aria-label="Select icon"
    >
      +
    </button>
  )
  const inlineEditableTitle = (
    <div className="flex min-w-0 items-center gap-2">
      {inlineEditableIconControl}
      <input
        ref={lifeGoalTitleInputRef}
        value={lifeGoalDraft.title}
        onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
        onBlur={() => commitInlineLifeGoalField(selectedLifeGoal, 'title')}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commitInlineLifeGoalField(selectedLifeGoal, 'title')
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancelInlineLifeGoalField(selectedLifeGoal, 'title')
          }
        }}
        placeholder="Goal title"
        spellCheck={true}
        className="min-w-0 w-full bg-transparent px-0 py-0 text-[20px] font-semibold leading-tight text-white outline-none placeholder:text-white/30"
      />
    </div>
  )
  const inlineEditableWhy = (
    <textarea
      ref={lifeGoalWhyTextareaRef}
      value={lifeGoalDraft.whyItMatters}
      onChange={(event) => {
        setLifeGoalDraft((current) => ({ ...current, whyItMatters: event.target.value }))
        event.currentTarget.style.height = 'auto'
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`
      }}
      onBlur={() => commitInlineLifeGoalField(selectedLifeGoal, 'whyItMatters')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelInlineLifeGoalField(selectedLifeGoal, 'whyItMatters')
        }
      }}
      placeholder="Why it matters..."
      spellCheck={true}
      className="min-h-[72px] w-full resize-none bg-transparent px-0 py-0 text-[13px] leading-6 text-white/70 outline-none placeholder:text-white/28"
    />
  )
  const inlineTitleDisplay = (
    <div className="inline-flex min-w-0 items-center gap-2">
      {showDetailIcon && selectedLifeGoal.icon?.startsWith('emoji:') ? (
        <button
          type="button"
          onMouseDown={handleInlineIconMouseDown}
          onKeyDown={handleInlineIconKeyDown}
          className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none"
        >
          {selectedLifeGoal.icon.slice(6)}
        </button>
      ) : showDetailIcon && selectedLifeGoal.icon && LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon] ? (
        <button
          type="button"
          onMouseDown={handleInlineIconMouseDown}
          onKeyDown={handleInlineIconKeyDown}
          className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-white/52"
        >
          {(() => {
            const Icon = LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon].Icon
            return <Icon size={16} className="text-white/52" />
          })()}
        </button>
      ) : showDetailIcon ? (
        <button
          type="button"
          onMouseDown={handleInlineIconMouseDown}
          onKeyDown={handleInlineIconKeyDown}
          className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[14px] text-white/26 transition hover:text-white/52"
          aria-label="Select icon"
        >
          +
        </button>
      ) : null}
      <button type="button" onClick={startInlineTitleEdit} className="min-w-0 truncate text-left">
        {selectedLifeGoal.title}
      </button>
    </div>
  )
  const inlineWhyDisplay = (
    <button type="button" onClick={startInlineWhyEdit} className="w-full text-left">
      <div className="min-h-[72px] text-[13px] leading-6 text-white/70">
        {selectedLifeGoal.whyItMatters.trim() || <span className="text-white/30">Why it matters...</span>}
      </div>
    </button>
  )
  const renderGoalTypeInfoChip = React.useCallback((label: string, tooltip: string, chipClassName: string) => (
    <span className={`group/typeinfo relative ${goalHeaderChipClassName} ${chipClassName}`}>
      <span>{label}</span>
      <span className="theme-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[240px] -translate-x-1/2 whitespace-normal rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium leading-4 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/typeinfo:block group-hover/typeinfo:translate-y-0 group-hover/typeinfo:opacity-100">
        {tooltip}
      </span>
    </span>
  ), [goalHeaderChipClassName])
  const renderParentGoalChips = React.useCallback(() => (
    <>
      {visibleParentGoals.map((goal) => (
        <button
          key={`parent-chip-${goal.id}`}
          type="button"
          onClick={() => onSelectLifeGoal(goal.id)}
          className={`${goalHeaderChipClassName} border-white/[0.05] bg-white/[0.02] text-white/52 transition hover:border-white/[0.08] hover:text-white/74`}
          title={goal.title}
        >
          <span className="text-white/28">Belongs to:</span>
          <span className="text-white/48">{goal.title}</span>
        </button>
      ))}
      {hiddenParentGoalsCount > 0 ? (
        <span className={`${goalHeaderChipClassName} border-white/[0.05] bg-white/[0.018] text-white/40`}>
          +{hiddenParentGoalsCount}
        </span>
      ) : null}
    </>
  ), [goalHeaderChipClassName, hiddenParentGoalsCount, onSelectLifeGoal, visibleParentGoals])
  const linkedGoalsSection = (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.02] px-5 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Related goals</p>
        <p className="mt-1 text-sm text-mist">Goals linked with this goal.</p>
      </div>

      <div className="mt-4 space-y-2">
        {relatedGoals.length > 0 ? (
          <>
            {visibleRelatedGoals.map((goal) => {
              const dueMeta = goal.targetDate && isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
              return (
                <button
                  key={`linked-goal-${goal.id}`}
                  type="button"
                  onClick={() => onSelectLifeGoal(goal.id)}
                  className="flex w-full items-center justify-between rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white/84">{goal.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {goal.category ? <p className="text-[12px] text-mist/56">{goal.category}</p> : null}
                      {goal.targetDate ? (
                        <p className={`text-[12px] ${dueMeta?.toneClassName ?? 'text-mist/56'}`}>
                          {dueMeta ? `${dueMeta.label} · ${formatDate(goal.targetDate)}` : formatDate(goal.targetDate)}
                        </p>
                      ) : null}
                      <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                        {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/36">Open</span>
                </button>
              )
            })}
            {hiddenRelatedGoalsCount > 0 ? (
              <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                +{hiddenRelatedGoalsCount} more
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
  const directionalSectionShellClassName = 'rounded-[24px] border border-white/[0.05] bg-white/[0.02] px-5 py-4'
  const directionalWhyBody = inlineLifeGoalEditingField === 'why' ? inlineEditableWhy : inlineWhyDisplay
  const directionalCreed = anchorText
  const directionalNextAction =
    selectedLifeGoalProgress.nextTask ??
    linkedDirectionalTasks.find((task) => !task.completed) ??
    null
  const directionalMomentumItems = [
    { label: 'Active goals', value: String(activeRelatedGoalsCount), hint: 'Currently carrying the direction' },
    { label: 'Completed goals', value: String(completedRelatedGoalsCount), hint: 'Already turned into reality' },
    { label: 'Recent actions', value: String(recentDirectionalActionCount), hint: 'Completed in the last 14 days' },
    { label: 'Consistency', value: 'Soon', hint: 'Alignment signals can plug in here later' },
  ] as const
  const directionalOverflowMenu = (
    <div className="relative">
      <button
        ref={editGoalActionsButtonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={editGoalActionsMenuOpen}
        onClick={() => setEditGoalActionsMenuOpen((current) => !current)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.018] text-sm text-white/58 transition hover:border-white/[0.08] hover:text-white/82"
      >
        •••
      </button>
      {editGoalActionsMenuOpen ? (
        <div
          ref={editGoalActionsMenuRef}
          className="theme-popover absolute right-0 top-[calc(100%+8px)] z-40 min-w-[176px] overflow-hidden rounded-[18px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
        >
          <button
            type="button"
            onClick={(event) => {
              setEditGoalActionsMenuOpen(false)
              openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)
            }}
            className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-white/76 transition hover:bg-white/[0.05] hover:text-white/92"
          >
            Edit Goal
          </button>
          <button
            type="button"
            onClick={() => {
              setEditGoalActionsMenuOpen(false)
              if (!window.confirm('Archive this goal? It will be removed from the active Life Goals workspace.')) return
              onArchiveLifeGoal(selectedLifeGoal.id)
              onChangeGoalsView(parentOverviewGoalsView)
            }}
            className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-white/76 transition hover:bg-white/[0.05] hover:text-white/92"
          >
            Archive Goal
          </button>
          <button
            type="button"
            onClick={() => {
              setEditGoalActionsMenuOpen(false)
              requestDeleteLifeGoal(selectedLifeGoal.id, 'detail')
            }}
            className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-[rgb(var(--theme-negative-rgb)/0.88)] transition hover:bg-[rgb(var(--theme-negative-rgb)/0.12)] hover:text-[rgb(var(--theme-negative-rgb)/0.98)]"
          >
            Delete Goal
          </button>
        </div>
      ) : null}
    </div>
  )
  const directionalIdentitySection = (
    <div className={directionalSectionShellClassName}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <h3 className="theme-page-title min-w-0">
              {inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
            </h3>
            {directionalCreed ? (
              <p className="mt-1 truncate text-[13px] text-white/48">{directionalCreed}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {showDetailStatus ? (
            <span
              className={`${goalHeaderChipClassName} ${
                getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).badgeClassName
              }`}
            >
              {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate)
                ? 'Scheduled'
                : getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).label}
            </span>
          ) : null}
          {showDetailCategory && selectedGoalCategory ? (
            <span
              className={`${goalHeaderChipClassName} gap-1.5 text-white/70`}
              style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
              {selectedGoalCategory}
            </span>
          ) : null}
          {directionalOverflowMenu}
        </div>
      </div>
    </div>
  )
  const directionalWhySection = (
    <div className={directionalSectionShellClassName}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Why this matters</p>
      <div className="mt-3 max-w-[52rem] text-[14px] leading-7 text-white/76">
        {directionalWhyBody}
      </div>
      {directionalCreed && selectedLifeGoal.whyItMatters.trim() && directionalCreed !== selectedLifeGoal.whyItMatters.trim() ? (
        <div className="mt-4 max-w-[32rem] rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-mist/46">Anchor</p>
          <p className="mt-1 text-[13px] leading-6 text-white/52">{directionalCreed}</p>
        </div>
      ) : null}
    </div>
  )
  const visionEditImagesContent = React.useMemo(
    () =>
      selectedLifeGoal.visionImages.length > 0
      ? renderVisionImageLayout(selectedLifeGoal.visionImages, {
          draggableState: {
            enabled: true,
            draggedIndex: draggedVisionImageIndex,
            dragOverIndex: dragOverVisionImageIndex,
            onDragStart: (index) => {
              setDraggedVisionImageIndex(index)
              setDragOverVisionImageIndex(null)
            },
            onDragOver: (event, index) => {
              event.preventDefault()
              if (dragOverVisionImageIndex !== index) {
                setDragOverVisionImageIndex(index)
              }
            },
            onDrop: (event, index) => {
              event.preventDefault()
              if (draggedVisionImageIndex !== null) {
                reorderSelectedLifeGoalVisionImages(draggedVisionImageIndex, index)
              }
              setDraggedVisionImageIndex(null)
              setDragOverVisionImageIndex(null)
            },
            onDragEnd: () => {
              setDraggedVisionImageIndex(null)
              setDragOverVisionImageIndex(null)
            },
          },
          fitMode: 'contain',
          removable: true,
          onRemove: removeSelectedLifeGoalVisionImage,
          interactive: visionImageInteractiveOptions,
        })
      : null,
    [
      selectedLifeGoal.visionImages,
      renderVisionImageLayout,
      draggedVisionImageIndex,
      dragOverVisionImageIndex,
      reorderSelectedLifeGoalVisionImages,
      removeSelectedLifeGoalVisionImage,
      visionImageInteractiveOptions,
      setDraggedVisionImageIndex,
      setDragOverVisionImageIndex,
    ],
  )
  const visionDisplayContent = React.useMemo(() => (
    <div
      className={`mt-2 w-full ${
        selectedLifeGoalVisionShowsStatementInDisplay && !selectedLifeGoalVisionShowsImagesInDisplay
          ? 'flex min-h-[280px] flex-1 flex-col'
          : ''
      }`}
    >
      {selectedLifeGoalVisionShowsImagesInDisplay && selectedLifeGoal.visionImages.length > 0 ? (
        <div className="space-y-3">
          {renderVisionImageLayout(selectedLifeGoal.visionImages, {
            displayStyle: 'minimal',
            fitMode: 'contain',
            onOpenPreview: setVisionPreviewImage,
            interactive: visionImageInteractiveOptions,
          })}

          {selectedLifeGoalVisionMode === 'images-statement' && selectedLifeGoal.visionStatement.trim() ? (
            <div className="space-y-2 px-2 pb-1 pt-0.5 text-center sm:space-y-2.5">
              <div className="mx-auto h-px w-[34%] max-w-[220px] min-w-[120px] bg-white/[0.08]" />
              <p
                className="mx-auto max-w-[34rem] text-[18px] font-medium leading-[1.58] tracking-[0.012em] text-white/86 [text-shadow:0_0_18px_rgba(var(--theme-accent-rgb),0.08)] sm:text-[19px]"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {selectedLifeGoal.visionStatement.trim()}
              </p>
            </div>
          ) : null}
        </div>
      ) : selectedLifeGoalVisionShowsStatementInDisplay ? (
        <div className="flex h-full w-full flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(255,255,255,0.016)_34%,rgba(255,255,255,0)_72%)] px-6 py-8 text-center sm:px-10 sm:py-10">
          <div className="w-full max-w-[46rem]">
            <p className="mx-auto max-w-[30rem] text-center text-[28px] leading-[1.45] tracking-[-0.02em] text-white/88 sm:text-[34px]">
              {selectedLifeGoal.visionStatement.trim()}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  ), [
    selectedLifeGoalVisionShowsStatementInDisplay,
    selectedLifeGoalVisionShowsImagesInDisplay,
    selectedLifeGoal.visionImages,
    renderVisionImageLayout,
    setVisionPreviewImage,
    visionImageInteractiveOptions,
    selectedLifeGoalVisionMode,
    selectedLifeGoal.visionStatement,
  ])
  const handleVisionUploadClick = React.useCallback(() => {
    if (!selectedLifeGoalCanUploadVisionImages) return
    visionUploadInputRef.current?.click()
  }, [selectedLifeGoalCanUploadVisionImages, visionUploadInputRef])
  const handleAtomsVisionFileSelected = React.useCallback(async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImages: dataUrl ? [dataUrl] : [],
      updatedAt: new Date().toISOString(),
    }))
  }, [onUpdateLifeGoal, selectedLifeGoal.id])
  const handleAtomsVisionImageRemove = React.useCallback(() => {
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImages: [],
      updatedAt: new Date().toISOString(),
    }))
  }, [onUpdateLifeGoal, selectedLifeGoal.id])
  const directionalMomentumState = React.useMemo(
    () => (isDirectionalGoal ? getLifeGoalMomentumState(selectedLifeGoal, selectedLifeGoalProgress) : null),
    [isDirectionalGoal, selectedLifeGoal, selectedLifeGoalProgress],
  )
  const directionalWhyExcerpt = React.useMemo(() => {
    const trimmed = selectedLifeGoal.whyItMatters.trim()
    if (!trimmed) return ''
    return trimmed.length > 180 ? `${trimmed.slice(0, 177).trim()}...` : trimmed
  }, [selectedLifeGoal.whyItMatters])
  const directionalNotesExcerpt = React.useMemo(() => {
    const plainText = (selectedLifeGoal.notes ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!plainText) return ''
    return plainText.length > 180 ? `${plainText.slice(0, 177).trim()}...` : plainText
  }, [selectedLifeGoal.notes])
  const directionalTaskRows = React.useMemo(
    () => visibleDirectionalTasks.filter((task) => !task.completed).slice(0, 5),
    [visibleDirectionalTasks],
  )
  const directionalHeaderEditPanel = React.useMemo(() => (
    <div ref={directionalHeaderEditPanelRef} className={`w-[344px] max-w-[calc(100vw-32px)] ${embeddedEditPanelShellClassName}`}>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/74">Edit Goal</p>
          {directionalOverflowMenu}
        </div>
        <div className="grid gap-2.5">
          <div className={embeddedEditPanelRowClassName}>
            <label className={embeddedEditPanelLabelClassName}>Status</label>
            <div className="relative">
              <select
                value={selectedLifeGoal.status}
                onChange={(event) => updateDirectionalField('status', event.target.value)}
                className={embeddedEditPanelSelectClassName}
              >
                <option value="not-started" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">Not Started</option>
                <option value="in-motion" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">Active</option>
                <option value="paused" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">Paused</option>
                <option value="complete" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">Completed</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
              </span>
            </div>
          </div>
          <div className={embeddedEditPanelRowClassName}>
            <label className={embeddedEditPanelLabelClassName}>Category</label>
            <div className="relative">
              <select
                value={selectedLifeGoal.category}
                onChange={(event) => updateDirectionalField('category', event.target.value)}
                className={embeddedEditPanelSelectClassName}
              >
                <option value="" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">None</option>
                {availableDirectionalCategoryOptions.map((category) => (
                  <option key={`directional-header-category-${category}`} value={category} className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
                    {category}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
              </span>
            </div>
          </div>
          <div className={embeddedEditPanelRowClassName}>
            <label className={embeddedEditPanelLabelClassName}>Start Date</label>
            <input
              type="date"
              value={selectedLifeGoal.startDate || ''}
              onChange={(event) => updateDirectionalField('startDate', event.target.value)}
              className={embeddedEditPanelSelectClassName}
            />
          </div>
          <div className={embeddedEditPanelRowClassName}>
            <label className={embeddedEditPanelLabelClassName}>Target Date</label>
            <input
              type="date"
              value={selectedLifeGoal.targetDate || ''}
              onChange={(event) => updateDirectionalField('targetDate', event.target.value)}
              className={embeddedEditPanelSelectClassName}
            />
          </div>
          <div className={embeddedEditPanelRowClassName}>
            <label className={embeddedEditPanelLabelClassName}>Type</label>
            <div className={`${embeddedEditPanelSelectClassName} flex items-center justify-between`}>
              <span>Directional</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.05] pt-3">
          <button
            type="button"
            onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            className="text-left text-[12px] text-[rgba(255,255,255,0.55)] transition hover:text-[rgba(255,255,255,0.7)]"
          >
            Open full editor
          </button>
        </div>
      </div>
    </div>
  ), [
    availableDirectionalCategoryOptions,
    directionalOverflowMenu,
    embeddedEditPanelLabelClassName,
    embeddedEditPanelRowClassName,
    embeddedEditPanelSelectClassName,
    embeddedEditPanelShellClassName,
    openEditLifeGoalComposer,
    selectedLifeGoal,
    updateDirectionalField,
  ])
  const directionalIdentityBand = React.useMemo(() => {
    const today = new Date()
    const activeDates = new Set<string>()
    for (const task of linkedDirectionalTasks) {
      if (task.completed && task.completedAt) activeDates.add(task.completedAt.slice(0, 10))
    }
    for (const goal of visibleRelatedGoals) {
      for (const task of getRuntimeTasksForGoal(goal)) {
        if (task.completed && task.completedAt) activeDates.add(task.completedAt.slice(0, 10))
      }
    }
    const cells = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (13 - i))
      return d.toISOString().slice(0, 10)
    })

    const momentumTone = directionalMomentumState?.tone
    const momentumTimeText =
      directionalMomentumState?.label && directionalMomentumState.label !== 'none'
        ? directionalMomentumState.label.replace(' ago', '')
        : null
    const momentumStateWord =
      momentumTone === 'active' ? 'Active' : momentumTone === 'warming' ? 'Cooling' : momentumTimeText ? 'Stalled' : null
    const momentumLabelText = momentumStateWord
      ? momentumTimeText ? `${momentumStateWord} · ${momentumTimeText}` : momentumStateWord
      : null
    const momentumLabelClass =
      momentumTone === 'active'
        ? 'text-[rgb(var(--theme-accent-rgb)/0.72)]'
        : momentumTone === 'warming'
          ? 'text-white/46'
          : 'text-white/26'

    return (
      <section
        className="overflow-hidden rounded-[28px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.86)] px-6 py-5 shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
        style={showDetailCategory && selectedGoalCategory ? getLifeGoalCategorySurfaceWashStyle(selectedGoalCategoryColor, true) : undefined}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h3 className="theme-page-title min-w-0">
                {inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
              </h3>
              {directionalCreed ? (
                <p className="mt-1 text-[13px] leading-6 text-white/48">{directionalCreed}</p>
              ) : null}
            </div>
            {momentumLabelText ? (
              <span className={`mt-1.5 shrink-0 text-[10px] uppercase tracking-[0.14em] ${momentumLabelClass}`}>
                {momentumLabelText}
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex items-center gap-1">
            {cells.map((dateStr, i) => {
              const isActive = activeDates.has(dateStr)
              const prevActive = i > 0 && activeDates.has(cells[i - 1])
              const nextActive = i < 13 && activeDates.has(cells[i + 1])
              const isStreak = isActive && (prevActive || nextActive)
              return (
                <div
                  key={dateStr}
                  title={dateStr}
                  className={`h-[5px] w-[10px] rounded-[2px] ${
                    isStreak
                      ? 'bg-[rgb(var(--theme-accent-rgb)/0.88)]'
                      : isActive
                        ? 'bg-[rgb(var(--theme-accent-rgb)/0.46)]'
                        : 'bg-white/[0.06]'
                  }`}
                />
              )
            })}
            <span className="ml-3 text-[11px] text-white/36">
              {activeDates.size > 0
                ? `${activeDates.size} day${activeDates.size === 1 ? '' : 's'} active`
                : 'No activity'}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-white/32">
            {activeDates.size >= 7 ? 'Steady movement'
              : activeDates.size >= 3 ? 'Some movement'
              : activeDates.size >= 1 ? 'Inconsistent'
              : 'No recent movement'}
          </p>

          {parentGoals.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {renderParentGoalChips()}
            </div>
          ) : null}
        </div>
      </section>
    )
  }, [
    directionalCreed,
    directionalMomentumState,
    inlineEditableTitle,
    inlineLifeGoalEditingField,
    inlineTitleDisplay,
    linkedDirectionalTasks,
    parentGoals.length,
    renderParentGoalChips,
    selectedGoalCategory,
    selectedGoalCategoryColor,
    showDetailCategory,
    getRuntimeTasksForGoal,
    visibleRelatedGoals,
  ])
  const directionalCurrentFocusBlock = React.useMemo(() => {
    const focusBorderClass =
      directionalMomentumState?.tone === 'active'
        ? 'border-[rgb(var(--theme-accent-rgb)/0.10)]'
        : directionalMomentumState?.tone === 'warming'
          ? 'border-white/[0.05]'
          : 'border-white/[0.03]'
    return (
    <section className={`rounded-[24px] border bg-[rgb(var(--theme-surface-elevated-rgb)/0.74)] px-6 py-6 ${focusBorderClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Current focus</p>
        <Button variant="soft" onClick={(event) => openNewTaskPeek(event.currentTarget)} className="px-3 py-1.5 text-[13px]">
          + Add task
        </Button>
      </div>

      {selectedLifeGoalProgress.nextTask ? (
        <button
          type="button"
          onClick={(event) => openTaskPeek(selectedLifeGoalProgress.nextTask!.id, event.currentTarget)}
          className="mt-4 flex w-full items-stretch gap-3 rounded-[20px] border border-[rgb(var(--theme-accent-rgb)/0.12)] px-4 py-5 text-left transition hover:border-[rgb(var(--theme-accent-rgb)/0.18)]"
        >
          <span aria-hidden="true" className="w-[3px] shrink-0 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.72)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mist/44">Next step</p>
            <p className="mt-2 text-[22px] font-medium leading-[1.28] text-white/90">{selectedLifeGoalProgress.nextTask.text}</p>
            {selectedLifeGoalProgress.nextTask.dueDate ? (
              <span className="mt-3 inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.018] px-2.5 py-1 text-[11px] text-white/58">
                {formatTaskDueDate(selectedLifeGoalProgress.nextTask.dueDate)}
              </span>
            ) : null}
          </div>
        </button>
      ) : (
        <div className="mt-4 rounded-[20px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
          <p className="text-sm text-white/54">No next step set</p>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Direction tasks</p>
          {hiddenDirectionalTasksCount > 0 ? (
            <span className="text-[11px] text-white/34">+{hiddenDirectionalTasksCount} more</span>
          ) : null}
        </div>
        <div className="divide-y divide-white/[0.04] rounded-[18px] border border-white/[0.05] bg-white/[0.018]">
          {directionalTaskRows.length > 0 ? directionalTaskRows.map((task) => {
            const dueMeta = task.dueDate ? formatTaskDueDate(task.dueDate) : null
            return (
              <button
                key={`direction-task-row-${task.id}`}
                type="button"
                onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.018]"
                title="Open task"
              >
                <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/[0.16] bg-transparent" />
                <p className="min-w-0 flex-1 truncate text-[14px] text-white/82">{task.text}</p>
                {dueMeta ? (
                  <span className="shrink-0 text-[11px] text-white/40">{dueMeta}</span>
                ) : null}
              </button>
            )
          }) : (
            <div className="px-4 py-4">
              <p className="text-sm text-white/46">No active steps</p>
            </div>
          )}
        </div>
      </div>
    </section>
    )
  }, [
    directionalMomentumState?.tone,
    directionalTaskRows,
    hiddenDirectionalTasksCount,
    openNewTaskPeek,
    openTaskPeek,
    selectedLifeGoalProgress.nextTask,
  ])
  const directionalSupportingGoalsColumn = React.useMemo(() => (
    <section className="rounded-[24px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.72)] px-3 py-3">
      <p className="px-1 pt-1 text-[11px] uppercase tracking-[0.16em] text-mist/52">Supporting goals</p>

      <div className="mt-2 divide-y divide-white/[0.04] rounded-[16px] border border-white/[0.05] bg-white/[0.018]">
        {visibleRelatedGoals.length > 0 ? visibleRelatedGoals.map((goal) => {
          const isComplete = goal.status === 'complete'
          const runtimeTasks = getRuntimeTasksForGoal(goal)
          const goalProgress = getLifeGoalProgress(goal, runtimeTasks)
          const percent = goalProgress.totalTasks > 0 ? Math.max(2, Math.min(100, Math.round((goalProgress.completedTasks / goalProgress.totalTasks) * 100))) : 0
          const lastCompletedAt = runtimeTasks
            .filter((t) => t.completed && t.completedAt)
            .map((t) => t.completedAt as string)
            .sort()
            .at(-1)
          const recencyDays = lastCompletedAt
            ? Math.floor((Date.now() - new Date(lastCompletedAt).getTime()) / 86400000)
            : null
          const recencyLabel = recencyDays === null ? null
            : recencyDays === 0 ? 'Today'
            : recencyDays === 1 ? 'Yesterday'
            : `${recencyDays}d ago`
          const recencyClass = recencyDays === null ? ''
            : recencyDays <= 2 ? 'text-[rgb(var(--theme-accent-rgb)/0.76)]'
            : recencyDays <= 7 ? 'text-white/54'
            : 'text-white/38'
          const goalIcon = goal.icon?.startsWith('emoji:')
            ? goal.icon.slice(6)
            : goal.icon && LIFE_GOAL_ICON_MAP[goal.icon]
              ? (() => {
                  const Icon = LIFE_GOAL_ICON_MAP[goal.icon].Icon
                  return <Icon size={13} className="text-white/48" />
                })()
              : selectedGoalCategory
                ? <span className="h-2.5 w-2.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                : <span className="h-2.5 w-2.5 rounded-full bg-white/20" />

          return (
            <button
              key={`direction-support-goal-${goal.id}`}
              type="button"
              onClick={() => onSelectLifeGoal(goal.id)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.02] ${isComplete ? 'opacity-40' : ''}`}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[14px] leading-none">
                {goalIcon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[14px] text-white/82">{goal.title}</p>
                  {recencyLabel ? (
                    <span className={`shrink-0 text-[11px] ${recencyClass}`}>{recencyLabel}</span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-[rgb(var(--theme-accent-rgb)/0.78)] transition-[width]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] text-white/36">
                    {goalProgress.completedTasks}/{goalProgress.totalTasks || 0}
                  </span>
                </div>
              </div>
            </button>
          )
        }) : (
          <div className="px-4 py-4">
            <p className="text-sm text-white/54">No supporting goals linked yet</p>
          </div>
        )}

        <button
          type="button"
          onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12px] uppercase tracking-[0.14em] text-white/46 transition hover:bg-white/[0.02] hover:text-white/70"
        >
          <span className="text-[14px] leading-none">+</span>
          Link goal
        </button>
      </div>
    </section>
  ), [
    getRuntimeTasksForGoal,
    LIFE_GOAL_ICON_MAP,
    goalStatusChipClassName,
    onSelectLifeGoal,
    openEditLifeGoalComposer,
    selectedGoalCategory,
    selectedGoalCategoryColor,
    selectedLifeGoal,
    visibleRelatedGoals,
  ])
  const directionalSupportRail = React.useMemo(() => {
    const paceWord =
      recentDirectionalActionCount === 0 ? 'Stalled'
      : recentDirectionalActionCount <= 2 ? 'Slow'
      : recentDirectionalActionCount <= 5 ? 'Active'
      : 'Pushing'
    const paceClass =
      recentDirectionalActionCount === 0 ? 'text-white/40'
      : recentDirectionalActionCount <= 2 ? 'text-white/58'
      : recentDirectionalActionCount <= 5 ? 'text-white/78'
      : 'text-[rgb(var(--theme-accent-rgb)/0.88)]'
    const lastPushClass =
      directionalMomentumState?.tone === 'active'
        ? 'text-[rgb(var(--theme-accent-rgb)/0.82)]'
        : directionalMomentumState?.tone === 'warming'
          ? 'text-white/62'
          : 'text-white/38'

    return (
      <div className="rounded-[22px] border border-white/[0.05] bg-[rgb(var(--theme-surface-elevated-rgb)/0.66)]">
        {/* Signals */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/34">Signals</p>
          <p className="mt-2.5 text-[13px] text-white/68">
            {activeRelatedGoalsCount} active · {completedRelatedGoalsCount} done
          </p>
          <p className={`mt-1 text-[12px] ${lastPushClass}`}>
            {directionalMomentumState?.label && directionalMomentumState.label !== 'none'
              ? `Last push: ${directionalMomentumState.label}`
              : 'No recent movement'}
          </p>
        </div>

        {/* Pace */}
        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/34">Pace</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className={`text-[16px] font-medium leading-none ${paceClass}`}>{paceWord}</span>
            {recentDirectionalActionCount > 0 ? (
              <span className="text-[11px] text-white/34">{recentDirectionalActionCount} this fortnight</span>
            ) : null}
          </div>
        </div>

        {/* Notes */}
        <div className="border-t border-white/[0.04] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/34">Notes</p>
          <p className="mt-1.5 text-[13px] leading-6 text-white/52">
            {directionalNotesExcerpt || 'No notes yet.'}
          </p>
        </div>

        {/* Habits */}
        {visibleSupportingHabits.length > 0 ? (
          <div className="border-t border-white/[0.04] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/34">Habits</p>
            <div className="mt-2.5 space-y-2.5">
              {visibleSupportingHabits.map((tracker) => {
                const streak = getLiveTrackerStreak(tracker, year)
                const progress = tracker.goal ? getTrackerGoalProgress(tracker, year) : null
                return (
                  <button
                    key={`direction-rail-habit-${tracker.id}`}
                    type="button"
                    onClick={() => onOpenHabitTracker(tracker.id)}
                    className="flex w-full items-start gap-2 text-left transition hover:text-white/86"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-white/72">{tracker.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {progress?.progressText ?? (streak > 0 ? `${streak}d streak` : 'No goal set')}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    )
  }, [
    activeRelatedGoalsCount,
    completedRelatedGoalsCount,
    directionalMomentumState?.label,
    directionalMomentumState?.tone,
    directionalNotesExcerpt,
    onOpenHabitTracker,
    recentDirectionalActionCount,
    visibleSupportingHabits,
    year,
  ])
  const directionalMomentumSection = React.useMemo(() => isDirectionalGoal ? (
    <div className={directionalSectionShellClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Momentum</p>
          <p className="mt-1 text-sm text-mist/72">Signals that show whether this direction is being lived right now.</p>
        </div>
        {pausedRelatedGoalsCount > 0 ? (
          <span className="rounded-full border border-white/[0.05] bg-white/[0.018] px-3 py-1 text-[11px] text-white/46">
            {pausedRelatedGoalsCount} paused
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {directionalMomentumItems.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mist/46">{item.label}</p>
            <p className="mt-2 text-[20px] font-medium leading-none text-white/86">{item.value}</p>
            <p className="mt-2 text-[12px] leading-5 text-white/44">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  ) : null, [
    activeRelatedGoalsCount,
    completedRelatedGoalsCount,
    directionalMomentumItems,
    directionalSectionShellClassName,
    isDirectionalGoal,
    pausedRelatedGoalsCount,
  ])
  const directionalNextStepSection = (
    <div className={directionalSectionShellClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Next step</p>
          <p className="mt-1 text-sm text-mist/72">What keeps this direction alive in practice right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="soft"
            onClick={(event) => openNewTaskPeek(event.currentTarget)}
            className="px-3 py-1.5 text-[13px]"
          >
            Add quick task
          </Button>
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.018] px-3 py-1.5 text-[13px] text-white/34"
          >
            Ask AI for next steps
          </button>
        </div>
      </div>
      {directionalNextAction ? (
        <button
          type="button"
          onClick={(event) =>
            'id' in directionalNextAction && directionalNextAction.id
              ? openTaskPeek(directionalNextAction.id, event.currentTarget)
              : openNewTaskPeek(event.currentTarget)
          }
          className="mt-4 flex w-full items-stretch gap-3 rounded-[18px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-left transition hover:border-white/[0.09] hover:bg-white/[0.028]"
        >
          <span aria-hidden="true" className="w-[2px] shrink-0 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.54)]" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-mist/44">Current focus</p>
            <p className="mt-2 text-[18px] font-medium leading-[1.3] text-white/88">{directionalNextAction.text}</p>
          </div>
        </button>
      ) : (
        <div className="mt-4 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
          <p className="text-sm text-white/78">No next step set</p>
          <p className="mt-1 text-sm text-mist">Add one practical action so this direction has something alive to pull forward.</p>
        </div>
      )}
    </div>
  )
  const supportingGoalsSection = React.useMemo(() => isDirectionalGoal ? (
    <div className={directionalSectionShellClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/52">Supporting goals</p>
          <p className="mt-1 text-sm text-mist/72">Outcome goals that make this direction real in lived practice.</p>
        </div>
        <button
          type="button"
          onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
          className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
        >
          Link supporting goal
        </button>
      </div>

      <div className="mt-4 space-y-2.5">
        {relatedGoals.length > 0 ? (
          <>
            {visibleRelatedGoals.map((goal) => {
              const dueMeta = goal.targetDate && isValidIsoDate(goal.targetDate) ? getRelativeDueMeta(goal.targetDate) : null
              const goalProgress = getLifeGoalProgress(goal, getRuntimeTasksForGoal(goal))
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => onSelectLifeGoal(goal.id)}
                  className="flex w-full items-start justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/84">{goal.title}</p>
                    {goal.whyItMatters.trim() ? (
                      <p className="mt-1 line-clamp-1 text-[12px] text-white/42">{goal.whyItMatters.trim()}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`${goalStatusChipClassName} h-5 px-2 py-0 text-[9px] ${getLifeGoalStatusMeta(goal.status, goal.startDate).badgeClassName}`}>
                        {getLifeGoalStatusMeta(goal.status, goal.startDate).label}
                      </span>
                      {goalProgress.totalTasks > 0 ? (
                        <span className="text-[12px] text-mist/56">
                          {goalProgress.completedTasks}/{goalProgress.totalTasks} tasks
                        </span>
                      ) : null}
                      {goal.targetDate ? (
                        <span className={`text-[12px] ${dueMeta?.toneClassName ?? 'text-mist/56'}`}>
                          {dueMeta ? `${dueMeta.label} · ${formatDate(goal.targetDate)}` : formatDate(goal.targetDate)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-white/36">Open</span>
                </button>
              )
            })}
            {hiddenRelatedGoalsCount > 0 ? (
              <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                +{hiddenRelatedGoalsCount} more
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
            <p className="text-sm text-white/78">No supporting goals linked yet</p>
            <p className="mt-1 text-sm text-mist">Link the outcome goals that turn this direction into real movement.</p>
          </div>
        )}
      </div>
    </div>
  ) : null, [
    directionalSectionShellClassName,
    getRuntimeTasksForGoal,
    goalStatusChipClassName,
    hiddenRelatedGoalsCount,
    isDirectionalGoal,
    onSelectLifeGoal,
    openEditLifeGoalComposer,
    relatedGoals.length,
    selectedGoalCategoryColor,
    selectedLifeGoal,
    visibleRelatedGoals,
  ])
  const supportingHabitsSection = React.useMemo(() => isDirectionalGoal ? (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Supporting habits</p>
        <p className="mt-1 text-sm text-mist">Simple repeatable behaviors linked to this goal.</p>
      </div>

      <div className="mt-4 space-y-2.5">
        {visibleSupportingHabits.length > 0 ? (
          <>
            {visibleSupportingHabits.map((tracker) => {
              const streak = getLiveTrackerStreak(tracker, year)
              const progress = tracker.goal ? getTrackerGoalProgress(tracker, year) : null

              return (
                <button
                  key={`supporting-habit-${tracker.id}`}
                  type="button"
                  onClick={() => onOpenHabitTracker(tracker.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.026]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-6 text-white/78">{tracker.title}</p>
                    <p className="mt-1 text-[12px] text-mist/54">
                      {progress?.progressText ?? (streak > 0 ? `${streak} day streak` : 'No goal set')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.02] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/46">
                    Habit
                  </span>
                </button>
              )
            })}
            {hiddenSupportingHabitsCount > 0 ? (
              <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                +{hiddenSupportingHabitsCount} more
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
            <p className="text-sm text-white/68">No supporting habits yet</p>
            <p className="mt-1 text-sm text-mist">Linked habits will appear here when they support this goal.</p>
          </div>
        )}
      </div>
    </div>
  ) : null, [
    hiddenSupportingHabitsCount,
    isDirectionalGoal,
    onOpenHabitTracker,
    visibleSupportingHabits,
    year,
  ])
  const atomsVisionBrightness =
    typeof selectedLifeGoal.visionImageBrightness === 'number'
      ? selectedLifeGoal.visionImageBrightness
      : 0.7
  const updateAtomsVisionBrightness = React.useCallback((value: number) => {
    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
      ...goal,
      visionImageBrightness: value,
      updatedAt: new Date().toISOString(),
    }))
  }, [onUpdateLifeGoal, selectedLifeGoal.id])
  const [atomsShowIcon, setAtomsShowIcon] = React.useState(Boolean(selectedGoalDetailContentVisibility.icon))
  const [atomsShowCategory, setAtomsShowCategory] = React.useState(Boolean(selectedGoalDetailContentVisibility.category))
  const [atomsShowStatus, setAtomsShowStatus] = React.useState(Boolean(selectedGoalDetailContentVisibility.status))
  const useAtomsGoalDetail = isOutcomeGoal

  if (useAtomsGoalDetail) {
    const atomsNextTask = getAtomsRoadmapNextTask(selectedLifeGoalMilestones, selectedGoalRuntimeTasks)
    const atomsRoadmapMilestones = getAtomsRoadmapMilestones(
      selectedLifeGoal,
      selectedLifeGoalMilestones,
      selectedGoalRuntimeTasks,
      atomsNextTask,
    )
    const atomsChartData = getAtomsChartData(selectedGoalRuntimeTasks)
    const atomsLastActivity = getAtomsLastActivity(selectedLifeGoalProgress)
    const atomsCategoryOptions = Array.from(
      new Set([
        selectedLifeGoal.category,
        ...(lifeGoalCategories ?? []).map((category) => (typeof category === 'string' ? category : category.name)),
      ].filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right))
    const updateAtomsCategory = (category: string) => {
      onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
        ...goal,
        category,
        updatedAt: new Date().toISOString(),
      }))
      setGoalDetailCategoryMenuOpen(false)
    }
    const atomsHeroEmojiContent = (
      <button
        type="button"
        onClick={(event) => startInlineIconEdit(event.currentTarget)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-3xl leading-none transition hover:bg-white/[0.035]"
        aria-label="Change goal icon"
      >
        {selectedLifeGoal.icon?.startsWith('emoji:') ? (
          selectedLifeGoal.icon.slice(6)
        ) : selectedLifeGoal.icon && LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon] ? (
          (() => {
            const Icon = LIFE_GOAL_ICON_MAP[selectedLifeGoal.icon].Icon
            return <Icon size={24} className="text-white/70" />
          })()
        ) : (
          getAtomsGoalEmoji(selectedLifeGoal)
        )}
      </button>
    )
    const atomsHeroTitleContent =
      inlineLifeGoalEditingField === 'title' ? (
        <input
          ref={lifeGoalTitleInputRef}
          value={lifeGoalDraft.title}
          onChange={(event) => setLifeGoalDraft((current) => ({ ...current, title: event.target.value }))}
          onBlur={() => commitInlineLifeGoalField(selectedLifeGoal, 'title')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitInlineLifeGoalField(selectedLifeGoal, 'title')
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelInlineLifeGoalField(selectedLifeGoal, 'title')
            }
          }}
          placeholder="Goal title"
          spellCheck={true}
          className="min-w-0 flex-1 bg-transparent px-0 py-0 text-2xl font-bold tracking-tight text-slate-100 outline-none placeholder:text-slate-500"
        />
      ) : (
        <button
          type="button"
          onClick={startInlineTitleEdit}
          className="min-w-0 flex-1 truncate text-left text-2xl font-bold tracking-tight text-slate-100 transition hover:text-white"
        >
          {selectedLifeGoal.title}
        </button>
      )
    const atomsHeroChips = (
      <>
        {isDirectionalGoal
          ? renderGoalTypeInfoChip(
              'Directional',
              'Long-term life direction. Not something to complete.',
              'border-white/[0.08] bg-white/[0.04] text-white/72',
            )
          : null}
        {renderParentGoalChips()}
        {atomsShowCategory && selectedGoalCategory ? (
          <span className="relative inline-flex">
            <button
              ref={goalDetailCategoryButtonRef}
              type="button"
              onClick={() => setGoalDetailCategoryMenuOpen((current) => !current)}
              className={`${goalHeaderChipClassName} gap-1.5 transition hover:brightness-125`}
              style={{ ...getLifeGoalCategoryChipStyle(selectedGoalCategoryColor), ...getLifeGoalCategoryChipTextStyle(selectedGoalCategoryColor) }}
              aria-haspopup="menu"
              aria-expanded={goalDetailCategoryMenuOpen}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
              {selectedGoalCategory}
            </button>
            {goalDetailCategoryMenuOpen ? (
              <div
                ref={goalDetailCategoryMenuRef}
                role="menu"
                className="theme-popover absolute right-0 top-[calc(100%+8px)] z-[60] min-w-[176px] overflow-hidden rounded-[16px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => updateAtomsCategory('')}
                  className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-white/46 transition hover:bg-white/[0.05] hover:text-white/78"
                >
                  No category
                </button>
                {atomsCategoryOptions.map((category) => {
                  const categoryColor =
                    category === selectedGoalCategory
                      ? selectedGoalCategoryColor
                      : getLifeGoalCategoryColor(category, (lifeGoalCategories ?? []).filter((item) => typeof item !== 'string'))
                  return (
                    <button
                      key={`atoms-hero-category-${category}`}
                      type="button"
                      role="menuitem"
                      onClick={() => updateAtomsCategory(category)}
                      className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm transition hover:bg-white/[0.05]"
                      style={getLifeGoalCategoryChipTextStyle(categoryColor)}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(categoryColor)} />
                      <span>{category}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </span>
        ) : null}
      </>
    )
    const highPriorityTaskIds = new Set(
      selectedGoalRuntimeTasks
        .filter((task) => getPriorityScore(task) === 3)
        .map((task) => task.id),
    )
    const displayAtomsRoadmapMilestones = roadmapHighPriorityFocus
      ? atomsRoadmapMilestones.map((milestone) => ({
          ...milestone,
          steps: milestone.steps.filter((step) => step.taskId && highPriorityTaskIds.has(step.taskId)),
        }))
      : atomsRoadmapMilestones
    const atomsPanelMilestone = atomsMilestonePanel.milestone
    const atomsPanelMilestones = (selectedLifeGoal.milestones ?? []).slice().sort((left, right) => left.order - right.order)
    const atomsPanelMilestoneIndex = atomsMilestonePanel.milestoneId
      ? atomsPanelMilestones.findIndex((milestone) => milestone.id === atomsMilestonePanel.milestoneId)
      : -1
    const atomsPanelMilestoneTasks = atomsMilestonePanel.milestoneId
      ? selectedGoalRuntimeTasks.filter((task) => task.milestoneId === atomsMilestonePanel.milestoneId)
      : []
    const atomsPanelTaskCounts = {
      total: atomsPanelMilestoneTasks.length,
      completed: atomsPanelMilestoneTasks.filter((task) => Boolean(task.completed || task.completedAt)).length,
      active: atomsPanelMilestoneTasks.filter((task) => !task.completed && !task.completedAt).length,
    }
    const atomsPanelEffectiveCompleted =
      Boolean(atomsPanelMilestone?.completed) ||
      (atomsPanelTaskCounts.total > 0 && atomsPanelTaskCounts.active === 0)
    const handleRoadmapViewChange = (value: 'roadmap' | 'milestones' | 'notes' | 'tasks') => {
      setGoalDetailRoadmapViewSelection(value)
    }
    const resetGoalDetailRoadmapControls = () => {
      setRoadmapCompletedOpen(false)
      setRoadmapHighPriorityFocus(false)
      setGoalDetailRoadmapShowMilestones(true)
      setGoalDetailRoadmapShowTags(false)
      setGoalDetailRoadmapSubtaskDisplayMode('chip')
      setGoalDetailRoadmapViewSelection('roadmap')
    }
    const roadmapControlsPanel = (
      <div className="relative inline-flex items-center">
        <IconButton
          ref={goalDetailRoadmapControlsTriggerRef}
          onClick={() => setGoalDetailRoadmapControlsPanelOpen((current) => !current)}
          variant="muted"
          size="sm"
          ariaLabel={goalDetailRoadmapControlsPanelOpen ? 'Close roadmap controls' : 'Open roadmap controls'}
          aria-expanded={goalDetailRoadmapControlsPanelOpen}
          icon={<GoalDetailControlsIcon />}
        />
        <AnimatePresence>
          {goalDetailRoadmapControlsPanelOpen ? (
            <motion.aside
              ref={goalDetailRoadmapControlsPanelRef}
              className="absolute right-0 top-[calc(100%+10px)] z-[50] w-[320px] max-w-[calc(100vw-32px)]"
              initial={{ opacity: 0, x: 12, y: -6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 12, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <ControlsPanelShell
                emphasis="strong"
                scrollable
                footer={
                  <Button type="button" variant="panel-link" onClick={resetGoalDetailRoadmapControls}>
                    Reset
                  </Button>
                }
              >
                <PanelSection>
                  <PanelSectionTitle>
                    Roadmap
                  </PanelSectionTitle>
                  <PanelActionRow>
                    <PanelRowLabel>Show completed tasks</PanelRowLabel>
                    <Toggle
                      checked={roadmapCompletedOpen}
                      onChange={() => setRoadmapCompletedOpen((current) => !current)}
                      role="switch"
                      aria-checked={roadmapCompletedOpen}
                    />
                  </PanelActionRow>
                  <PanelActionRow>
                    <PanelRowLabel>Show milestones</PanelRowLabel>
                    <Toggle
                      checked={goalDetailRoadmapShowMilestones}
                      onChange={setGoalDetailRoadmapShowMilestones}
                      disabled={!isOutcomeGoal}
                      role="switch"
                      aria-checked={goalDetailRoadmapShowMilestones}
                    />
                  </PanelActionRow>
                  <PanelActionRow>
                    <PanelRowLabel>High priority only</PanelRowLabel>
                    <Toggle
                      checked={roadmapHighPriorityFocus}
                      onChange={() => setRoadmapHighPriorityFocus((current) => !current)}
                      role="switch"
                      aria-checked={roadmapHighPriorityFocus}
                    />
                  </PanelActionRow>
                  <PanelActionRow>
                    <Button
                      type="button"
                      variant="panel-link"
                      className="-mx-1 justify-start px-1 text-left"
                      onClick={() => {
                        atomsMilestonePanel.openCreate()
                        setGoalDetailRoadmapControlsPanelOpen(false)
                      }}
                    >
                      Add milestone
                    </Button>
                  </PanelActionRow>
                </PanelSection>
                <PanelSection>
                  <PanelSectionTitle>
                    Sub-toggles
                  </PanelSectionTitle>
                  <PanelSubToggleRow>
                    <PanelRowLabel className="text-[12px] text-[rgba(255,255,255,0.68)]">Show task tags</PanelRowLabel>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={goalDetailRoadmapShowTags}
                      onClick={() => setGoalDetailRoadmapShowTags((current) => !current)}
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition ${
                        goalDetailRoadmapShowTags
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[rgb(var(--theme-accent-rgb)/0.14)]'
                          : 'border-white/[0.08] bg-white/[0.025]'
                      }`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full bg-white/70 transition ${
                          goalDetailRoadmapShowTags ? 'translate-x-[14px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                  </PanelSubToggleRow>
                  <PanelSubToggleRow>
                    <PanelRowLabel className="text-[12px] text-[rgba(255,255,255,0.68)]">Subtask display</PanelRowLabel>
                    <div className="inline-flex rounded-full border border-white/[0.07] bg-white/[0.025] p-0.5">
                      {(['chip', 'rings'] as const).map((mode) => (
                        <button
                          key={`subtask-display-${mode}`}
                          type="button"
                          onClick={() => setGoalDetailRoadmapSubtaskDisplayMode(mode)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] transition ${
                            goalDetailRoadmapSubtaskDisplayMode === mode
                              ? 'bg-white/[0.08] text-white/78'
                              : 'text-white/42 hover:text-white/64'
                          }`}
                        >
                          {mode === 'chip' ? 'Chip' : 'Rings'}
                        </button>
                      ))}
                    </div>
                  </PanelSubToggleRow>
                </PanelSection>
                <PanelSection>
                  <PanelSectionTitle>
                    View
                  </PanelSectionTitle>
                  <PanelFieldRow>
                    <label className="text-[12px] text-[rgba(255,255,255,0.85)]">Mode</label>
                    <div className="relative">
                      <select
                        value={goalDetailRoadmapViewSelection}
                        onChange={(event) => handleRoadmapViewChange(event.target.value as 'roadmap' | 'milestones' | 'notes' | 'tasks')}
                        className="h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]"
                      >
                        <option value="roadmap" className="bg-[#1E1E22] text-white">Roadmap</option>
                        {selectedShowMilestoneProgressView ? (
                          <option value="milestones" className="bg-[#1E1E22] text-white">Milestones</option>
                        ) : null}
                        <option value="notes" className="bg-[#1E1E22] text-white">Notes</option>
                        <option value="tasks" className="bg-[#1E1E22] text-white">Tasks</option>
                      </select>
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                        <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                      </span>
                    </div>
                  </PanelFieldRow>
                </PanelSection>
              </ControlsPanelShell>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    )
    const openGoalDetailDatePicker = (
      field: 'startDate' | 'targetDate',
      event: React.MouseEvent<HTMLButtonElement>,
    ) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const width = Math.max(rect.width, 360)
      setGoalDetailDatePickerField(field)
      setGoalDetailDatePanelPosition({
        top: rect.bottom + 8,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
        width,
      })
    }
    const applyGoalDetailDate = (value: string) => {
      if (!goalDetailDatePickerField) return
      onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
        ...goal,
        [goalDetailDatePickerField]: value,
        updatedAt: new Date().toISOString(),
      }))
      setGoalDetailDatePickerField(null)
      setGoalDetailDatePanelPosition(null)
    }
    const closeGoalDetailDatePicker = () => {
      setGoalDetailDatePickerField(null)
      setGoalDetailDatePanelPosition(null)
    }
    const goalDetailDatePicker = goalDetailDatePickerField ? (
      <GoalDatePicker
        ref={goalDetailDatePanelRef}
        value={selectedLifeGoal[goalDetailDatePickerField] || ''}
        anchorPosition={goalDetailDatePanelPosition}
        label={goalDetailDatePickerField === 'startDate' ? 'Start date' : 'Target date'}
        navigationStyle="bordered"
        onChange={applyGoalDetailDate}
        onClose={closeGoalDetailDatePicker}
      />
    ) : null
    const resetGoalDetailControls = () => {
      setAtomsShowIcon(Boolean(selectedGoalDetailContentVisibility.icon))
      setAtomsShowCategory(Boolean(selectedGoalDetailContentVisibility.category))
      setAtomsShowStatus(Boolean(selectedGoalDetailContentVisibility.status))
    }

    return (
      <motion.div
        key={`atoms-${selectedLifeGoal.id}`}
        className="w-full space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        <div>
          <button
            type="button"
            onClick={() => onChangeGoalsView(parentOverviewGoalsView)}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to Directional Goals
          </button>
        </div>

        <div className="rounded-[28px] border border-[#1E2028] bg-[#12141A] p-6 shadow-[0_1px_14px_rgba(0,0,0,0.24)]">
          <GoalHero
            title={selectedLifeGoal.title}
            emoji={getAtomsGoalEmoji(selectedLifeGoal)}
            titleContent={atomsHeroTitleContent}
            emojiContent={atomsHeroEmojiContent}
            status={getAtomsGoalStatus(selectedLifeGoal)}
            showEmoji={atomsShowIcon}
            showStatus={atomsShowStatus}
            isHighImpact={Boolean(selectedLifeGoal.isPrimary)}
            progress={selectedLifeGoalProgress.percent}
            isExpanded={isHeroExpanded}
            nextTask={{
              title:
                selectedLifeGoal.status === 'complete'
                  ? 'Goal complete'
                  : atomsNextTask?.text ?? 'No next task currently planned',
              category: atomsNextTask ? getAtomsTaskCategory(atomsNextTask) : selectedGoalCategory || 'Goal task',
              estimatedTime: atomsNextTask ? getAtomsTaskEstimate(atomsNextTask) : 'Plan next action',
            }}
            lastProgressed={atomsLastActivity}
            onToggleHighImpact={() =>
              onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                ...goal,
                isPrimary: !Boolean(goal.isPrimary),
                updatedAt: new Date().toISOString(),
              }))
            }
            onToggleStatus={() =>
              onUpdateLifeGoal(selectedLifeGoal.id, (goal) =>
                goal.status === 'complete'
                  ? goal
                  : {
                      ...goal,
                      status: goal.status === 'paused' ? 'in-motion' : 'paused',
                      updatedAt: new Date().toISOString(),
                    },
              )
            }
            actions={
              <>
                {atomsHeroChips}
                <div className="relative inline-flex items-center">
                  <IconButton
                    ref={goalDetailControlsTriggerRef}
                    onClick={() =>
                      setGoalDetailControlsPanelOpen((current) => {
                        if (current) {
                          closeGoalDetailDatePicker()
                        }
                        return !current
                      })
                    }
                    variant="muted"
                    ariaLabel={goalDetailControlsPanelOpen ? 'Close goal detail controls' : 'Open goal detail controls'}
                    aria-expanded={goalDetailControlsPanelOpen}
                    icon={<GoalDetailControlsIcon />}
                  />
                  <AnimatePresence>
                    {goalDetailControlsPanelOpen ? (
                      <motion.aside
                        ref={goalDetailControlsPanelRef}
                        className="absolute right-0 top-[calc(100%+10px)] z-[50] w-[320px] max-w-[calc(100vw-32px)]"
                        initial={{ opacity: 0, x: 12, y: -6 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0, x: 12, y: -6 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                      >
                        <ControlsPanelShell
                          emphasis="strong"
                          scrollable
                          footer={
                            <div className="flex w-full items-center justify-between gap-3">
                              <Button type="button" variant="panel-link" onClick={resetGoalDetailControls}>
                                Reset
                              </Button>
                              <div className="relative">
                                <button
                                  ref={goalDetailFooterMenuButtonRef}
                                  type="button"
                                  aria-haspopup="menu"
                                  aria-expanded={goalDetailFooterMenuOpen}
                                  onClick={() => setGoalDetailFooterMenuOpen((current) => !current)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[13px] leading-none text-white/42 transition hover:bg-white/[0.035] hover:text-white/70"
                                  aria-label="More goal actions"
                                >
                                  •••
                                </button>
                                {goalDetailFooterMenuOpen ? (
                                  <div
                                    ref={goalDetailFooterMenuRef}
                                    role="menu"
                                    className="theme-popover absolute bottom-[calc(100%+8px)] right-0 z-[60] min-w-[168px] overflow-hidden rounded-[16px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setGoalDetailFooterMenuOpen(false)
                                        if (!window.confirm('Archive this goal? It will be removed from the active Life Goals workspace.')) return
                                        onArchiveLifeGoal(selectedLifeGoal.id)
                                        onChangeGoalsView(parentOverviewGoalsView)
                                      }}
                                      className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-white/74 transition hover:bg-white/[0.05] hover:text-white/92"
                                    >
                                      Archive Goal
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setGoalDetailFooterMenuOpen(false)
                                        if (!window.confirm('Delete this goal? This action cannot be undone.')) return
                                        requestDeleteLifeGoal(selectedLifeGoal.id, 'detail')
                                      }}
                                      className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-[rgb(var(--theme-negative-rgb)/0.88)] transition hover:bg-[rgb(var(--theme-negative-rgb)/0.12)] hover:text-[rgb(var(--theme-negative-rgb)/0.98)]"
                                    >
                                      Delete Goal
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          }
                        >
                          <PanelSection>
                            <PanelSectionTitle>
                              Goal Details
                            </PanelSectionTitle>
                            <PanelFieldRow>
                              <label className="text-[12px] text-[rgba(255,255,255,0.85)]">Category</label>
                              <div className="relative">
                                <select
                                  value={selectedLifeGoal.category || ''}
                                  onChange={(event) =>
                                    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                                      ...goal,
                                      category: event.target.value,
                                      updatedAt: new Date().toISOString(),
                                    }))
                                  }
                                  className="h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]"
                                >
                                  <option value="" className="bg-[#1E1E22] text-white">None</option>
                                  {atomsCategoryOptions.map((category) => (
                                    <option key={`atoms-category-${category}`} value={category} className="bg-[#1E1E22] text-white">
                                      {category}
                                    </option>
                                  ))}
                                </select>
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                                </span>
                              </div>
                            </PanelFieldRow>
                            <PanelFieldRow>
                              <label className="text-[12px] text-[rgba(255,255,255,0.85)]">Start date</label>
                              <button
                                ref={goalDetailStartDateButtonRef}
                                type="button"
                                onClick={(event) => openGoalDetailDatePicker('startDate', event)}
                                className="h-9 w-[154px] rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 text-left text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]"
                              >
                                {selectedLifeGoal.startDate ? formatDate(selectedLifeGoal.startDate) : 'No date'}
                              </button>
                            </PanelFieldRow>
                            <PanelFieldRow>
                              <label className="text-[12px] text-[rgba(255,255,255,0.85)]">Target date</label>
                              <button
                                ref={goalDetailTargetDateButtonRef}
                                type="button"
                                onClick={(event) => openGoalDetailDatePicker('targetDate', event)}
                                className="h-9 w-[154px] rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 text-left text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]"
                              >
                                {selectedLifeGoal.targetDate ? formatDate(selectedLifeGoal.targetDate) : 'No date'}
                              </button>
                            </PanelFieldRow>
                            <PanelFieldRow>
                              <label className="text-[12px] text-[rgba(255,255,255,0.85)]">Status</label>
                              <div className="relative">
                                <select
                                  value={selectedLifeGoal.status === 'complete' ? 'complete' : selectedLifeGoal.status === 'paused' ? 'paused' : 'in-motion'}
                                  onChange={(event) =>
                                    onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                                      ...goal,
                                      status: event.target.value,
                                      updatedAt: new Date().toISOString(),
                                    }))
                                  }
                                  className="h-9 w-[154px] appearance-none rounded-[14px] border border-white/[0.1] bg-white/[0.06] px-3 pr-9 text-[13px] text-[rgba(255,255,255,0.75)] outline-none transition hover:border-white/[0.12] hover:bg-white/[0.08]"
                                >
                                  <option value="in-motion" className="bg-[#1E1E22] text-white">Active</option>
                                  <option value="paused" className="bg-[#1E1E22] text-white">On Hold</option>
                                  <option value="complete" className="bg-[#1E1E22] text-white">Completed</option>
                                </select>
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                                  <ChevronRight className="h-3.5 w-3.5 rotate-90 text-white/26" aria-hidden="true" />
                                </span>
                              </div>
                            </PanelFieldRow>
                          </PanelSection>
                          <PanelSection>
                            <PanelSectionTitle>
                              Presentation
                            </PanelSectionTitle>
                            <PanelActionRow>
                              <PanelRowLabel>Show icon/emoji</PanelRowLabel>
                              <Toggle
                                checked={atomsShowIcon}
                                onChange={setAtomsShowIcon}
                                role="switch"
                                aria-checked={atomsShowIcon}
                              />
                            </PanelActionRow>
                            <PanelActionRow>
                              <PanelRowLabel>Show category</PanelRowLabel>
                              <Toggle
                                checked={atomsShowCategory}
                                onChange={setAtomsShowCategory}
                                role="switch"
                                aria-checked={atomsShowCategory}
                              />
                            </PanelActionRow>
                            <PanelActionRow>
                              <PanelRowLabel>Show status</PanelRowLabel>
                              <Toggle
                                checked={atomsShowStatus}
                                onChange={setAtomsShowStatus}
                                role="switch"
                                aria-checked={atomsShowStatus}
                              />
                            </PanelActionRow>
                          </PanelSection>
                        </ControlsPanelShell>
                      </motion.aside>
                    ) : null}
	                  </AnimatePresence>
	                </div>
	                <IconButton
	                  onClick={() => setIsHeroExpanded((current) => !current)}
	                  variant="muted"
	                  size="sm"
	                  ariaLabel={isHeroExpanded ? 'Collapse goal summary' : 'Expand goal summary'}
	                  aria-expanded={isHeroExpanded}
	                  icon={<ChevronDown className={`h-4 w-4 text-white/64 transition-transform duration-200 ${isHeroExpanded ? 'rotate-180' : ''}`} />}
	                />
	              </>
	            }
            onNextTaskClick={
              atomsNextTask
                ? (event) => openTaskPeek(atomsNextTask.id, event.currentTarget)
                : undefined
            }
          />
        </div>

        <div className="grid h-[clamp(720px,115vh,900px)] min-h-0 items-stretch gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#1E2028] bg-[#12141A] p-6 shadow-[0_1px_14px_rgba(0,0,0,0.24)]">
            <GoalRoadmap
              milestones={displayAtomsRoadmapMilestones}
              completedCount={selectedLifeGoalProgress.completedTasks}
              totalCount={selectedLifeGoalProgress.totalTasks}
              lastActivity={atomsLastActivity}
              showMilestones={goalDetailRoadmapShowMilestones}
              showTaskTags={goalDetailRoadmapShowTags}
              subtaskDisplayMode={goalDetailRoadmapSubtaskDisplayMode}
              showCompletedTasks={roadmapCompletedOpen}
              onAddTask={(event) => openNewTaskPeek(event.currentTarget)}
              onAddTaskToMilestone={(milestone, event) =>
                openNewTaskPeek(event.currentTarget, {
                  milestoneId: milestone.id,
                  milestoneTitle: milestone.label,
                })
              }
              onStepClick={(taskId, event) => openTaskPeek(taskId, event.currentTarget)}
              onMilestoneClick={atomsMilestonePanel.openEdit}
              headerActions={roadmapControlsPanel}
            />
          </div>

          <div className="flex h-full min-h-0 flex-col gap-6">
            <div className="flex min-h-0 flex-1 flex-col rounded-[28px] border border-[#1E2028] bg-[#12141A] p-6 shadow-[0_1px_14px_rgba(0,0,0,0.24)]">
              <input
                ref={visionUploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  if (!event.target.files?.length) return
                  await handleAtomsVisionFileSelected(event.target.files)
                  event.target.value = ''
                }}
              />
              <GoalVision
                imageUrl={getAtomsVisionImageUrl(selectedLifeGoal)}
                text={getAtomsVisionText(selectedLifeGoal)}
                canUploadImage={selectedLifeGoalCanUploadVisionImages}
                hasImage={selectedLifeGoal.visionImages.length > 0}
                onUploadImage={handleVisionUploadClick}
                onRemoveImage={handleAtomsVisionImageRemove}
                onTextChange={(value) =>
                  onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                    ...goal,
                    visionStatement: value,
                    updatedAt: new Date().toISOString(),
                  }))
                }
                imageClassName="min-h-[300px] max-h-[380px]"
                imageFit="contain"
                imageBrightness={atomsVisionBrightness}
                imageSaturation={0.98}
                imageOpacityClassName="opacity-90"
                imageOverlayBackground="linear-gradient(180deg, transparent 0%, rgba(10,11,15,0.22) 100%)"
                onImageBrightnessChange={updateAtomsVisionBrightness}
              />
            </div>

            <div className="shrink-0 rounded-[28px] border border-[#1E2028] bg-[#12141A] p-6 shadow-[0_1px_14px_rgba(0,0,0,0.24)]">
              <GoalInsights
                percentComplete={selectedLifeGoalProgress.percent}
                tasksCompleted={selectedLifeGoalProgress.completedTasks}
                tasksRemaining={selectedLifeGoalProgress.plannedTasks.length}
                lastActivity={atomsLastActivity}
                chartData={atomsChartData}
                trend={getAtomsInsightTrend(selectedLifeGoal, selectedLifeGoalProgress)}
              />
            </div>
          </div>
        </div>
        {goalDetailDatePicker}
        <GoalMilestonePanel
          open={Boolean(atomsMilestonePanel.mode)}
          mode={atomsMilestonePanel.mode}
          draft={atomsMilestonePanel.draft}
          milestone={atomsPanelMilestone}
          goalTitle={selectedLifeGoal.title}
          taskCounts={atomsPanelTaskCounts}
          isEffectivelyCompleted={atomsPanelEffectiveCompleted}
          onDraftChange={atomsMilestonePanel.setDraft}
          onSubmit={atomsMilestonePanel.submit}
          onDelete={atomsMilestonePanel.mode === 'edit' ? atomsMilestonePanel.remove : undefined}
          onComplete={atomsMilestonePanel.mode === 'edit' ? atomsMilestonePanel.complete : undefined}
          onRestore={atomsMilestonePanel.mode === 'edit' ? atomsMilestonePanel.restore : undefined}
          onAddTask={
            atomsPanelMilestone
              ? (event) => {
                  openNewTaskPeek(event.currentTarget, {
                    milestoneId: atomsPanelMilestone.id,
                    milestoneTitle:
                      atomsMilestonePanel.draft.title.trim() ||
                      atomsPanelMilestone.title?.trim() ||
                      'Milestone',
                  })
                  atomsMilestonePanel.close()
                }
              : undefined
          }
          onMoveUp={atomsMilestonePanel.moveUp}
          onMoveDown={atomsMilestonePanel.moveDown}
          onClose={atomsMilestonePanel.close}
          canMoveUp={atomsPanelMilestoneIndex > 0}
          canMoveDown={atomsPanelMilestoneIndex >= 0 && atomsPanelMilestoneIndex < atomsPanelMilestones.length - 1}
          rightOffset={taskPeekRightOffset}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      key={selectedLifeGoal.id}
      className="w-full space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      <div className="flex min-w-0 items-center gap-2 px-1 text-sm">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="truncate text-white/46 transition hover:text-white/72"
        >
          Life Dashboard
        </button>
        <span className="text-zinc-500">/</span>
        {goalDetailOrigin === 'tasks' ? (
          <>
            <button
              type="button"
              onClick={onOpenTasks}
              className="truncate text-white/46 transition hover:text-white/72"
            >
              Priorities &amp; Tasks
            </button>
            <span className="text-zinc-500">/</span>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => onChangeGoalsView(parentOverviewGoalsView)}
          className="truncate text-white/46 transition hover:text-white/72"
        >
          Goals
        </button>
        <span className="text-zinc-500">/</span>
        <span className="truncate text-zinc-500">{selectedLifeGoal.title}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeGoalsView(parentOverviewGoalsView)}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to {isDirectionalGoal ? 'Directional Goals' : 'Outcome Goals'}
          </button>
          <span className={`${goalHeaderChipClassName} border-white/[0.08] bg-white/[0.03] text-white/75`}>
            Direction
          </span>
        </div>
        <div className="relative flex items-center justify-end">
          <button
            ref={directionalHeaderEditButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={directionalHeaderEditPanelOpen}
            onClick={() => setDirectionalHeaderEditPanelOpen((current) => !current)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.018] px-3.5 text-sm text-white/66 transition hover:border-white/[0.08] hover:text-white/88"
          >
            Edit Goal
          </button>
          {directionalHeaderEditPanelOpen ? (
            <div className="absolute right-0 top-[calc(100%+10px)] z-20">
              {directionalHeaderEditPanel}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        {directionalIdentityBand}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.92fr)_280px]">
          {directionalCurrentFocusBlock}
          {directionalSupportingGoalsColumn}
          {directionalSupportRail}
        </div>

        {showDetailVision ? (
          <LifeGoalVisionCard
            isCollapsed={selectedLifeGoalVisionCollapsed}
            isEditing={selectedLifeGoalShowVisionEditUI}
            isEditorOpen={selectedLifeGoalVisionEditorOpen}
            editMode={selectedLifeGoalVisionEditMode}
            canUploadImages={selectedLifeGoalCanUploadVisionImages}
            visionDropActive={visionDropActive}
            visionStatementLength={selectedLifeGoal.visionStatement.length}
            uploadInputRef={visionUploadInputRef}
            onOpenEditor={openSelectedLifeGoalVisionEditor}
            onSelectEditMode={setSelectedLifeGoalVisionEditMode}
            onVisionFilesSelected={appendSelectedLifeGoalVisionImages}
            onUploadClick={handleVisionUploadClick}
            onDropActiveChange={setVisionDropActive}
            onDropFiles={appendSelectedLifeGoalVisionImages}
            onVisionStatementChange={updateSelectedLifeGoalVisionStatement}
            onApplyEditMode={applySelectedLifeGoalVisionEditMode}
            editImagesContent={visionEditImagesContent}
            displayContent={visionDisplayContent}
            showEditImages={selectedLifeGoalVisionEditShowsImages}
            showEditStatement={selectedLifeGoalVisionEditShowsStatement}
            visionStatement={selectedLifeGoal.visionStatement}
          />
        ) : null}
      </div>
    </motion.div>
  )
})
