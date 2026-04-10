// @ts-nocheck
import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ResponsiveGrid, SectionCard } from '../../../components/layout/LayoutPrimitives'
import { Button } from '../../../components/ui/Button'
import { GoalProgressTimelineChart } from './GoalProgressTimelineChart'
import { LifeGoalFocusCard } from './LifeGoalFocusCard'
import { LifeGoalNotesEditor } from './LifeGoalNotesEditor'
import { LifeGoalRoadmapPanel } from './LifeGoalRoadmapPanel'
import { LifeGoalVisionCard } from './LifeGoalVisionCard'
import { GoalDatePicker } from '../GoalDatePicker'
import {
  formatDate,
  formatTaskDueDate,
  getLifeGoalCategoryChipStyle,
  getLifeGoalCategoryDotStyle,
  getLifeGoalCategorySurfaceWashStyle,
  getLifeGoalMomentumState,
  getLifeGoalProgress,
  getLifeGoalStatusMeta,
  getMilestoneTaskProgress,
  getTodayIsoDate,
  isLifeGoalScheduled,
  isValidIsoDate,
} from '../goalUtils'
import { getLiveTrackerStreak, getTrackerGoalProgress } from '../../../lib/habitTrackerGoals'
import { getLifeGoalTaskPriorityMeta, getPriorityScore, getRelativeDueMeta, getRoadmapTagGroups, getRoadmapTaskVisualState, normalizeTaskTags } from '../lib/taskDerivations'

type LifeGoalDetailPageProps = Record<string, any>

export const LifeGoalDetailPage = React.memo(function LifeGoalDetailPage(props: LifeGoalDetailPageProps) {
  const {
    selectedLifeGoal,
    lifeGoalCategories,
    selectedLifeGoalProgress,
    selectedGoalAnchorText,
    selectedGoalDetailContentVisibility,
    selectedGoalIsOutcome,
    selectedGoalIsDirectional,
    selectedGoalMilestonesEnabled,
    selectedLifeGoalMilestones,
    selectedCurrentMilestone,
    selectedCompletedMilestoneCount,
    selectedRoadmapPanelView,
    selectedShowMilestoneProgressView,
    selectedMilestoneOptions,
    selectedMilestoneDateTarget,
    selectedRoadmapSections,
    selectedGoalRoadmapDerived,
    selectedGoalRelatedGoals,
    selectedGoalLinkedDirectionalTasks,
    selectedGoalSupportingHabits,
    selectedGoalParentGoals,
    selectedGoalDirectionalMetrics,
    selectedGoalCategory,
    selectedGoalCategoryColor,
    selectedGoalRuntimeTasks,
    year,
    selectedRoadmapPanelActions,
    selectedRoadmapPanelUiState,
    selectedRoadmapTaskId,
    inlineLifeGoalEditingField,
    lifeGoalDetailTab,
    lifeGoalDraft,
    lifeGoalIconFieldRef,
    lifeGoalTitleInputRef,
    lifeGoalWhyTextareaRef,
    milestoneDatePanelPosition,
    milestoneDatePanelRef,
    milestoneDatePickerMilestoneId,
    completeNextVisualState,
    dragOverTaskId,
    draggedTaskId,
    dragOverVisionImageIndex,
    draggedVisionImageIndex,
    editGoalActionsButtonRef,
    editGoalActionsMenuOpen,
    editGoalActionsMenuRef,
    habitDraftByTaskId,
    lifeGoalActionFeedback,
    nextTaskVisualState,
    prefersReducedMotion,
    roadmapArrivalCueActive,
    roadmapCompletedOpen,
    roadmapHighPriorityFocus,
    roadmapOrganizationMode,
    roadmapTaskRowRefs,
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
    taskListSortMode,
    taskMomentumTransition,
    visibleGoalStartCueTaskId,
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
    onSetLifeGoalAsTodayTask,
    openEditLifeGoalComposer,
    openMilestonePeek,
    openNewTaskPeek,
    openSelectedLifeGoalVisionEditor,
    openTaskPeek,
    requestDeleteLifeGoal,
    restoreTask,
    updateSelectedLifeGoalNotes,
    updateSelectedLifeGoalVisionStatement,
    commitInlineLifeGoalField,
    cancelInlineLifeGoalField,
    primeInlineLifeGoalDraft,
    handleCompleteNextWithFeedback,
    handleTaskRowKeyDown,
    completeLifeGoal,
    createHabitFromTask,
    onOpenGlobalTasks,
    onOpenHabitTracker,
    addSelectedLifeGoalMilestone,
    applySelectedLifeGoalVisionEditMode,
    applySelectedMilestoneDate,
    appendSelectedLifeGoalVisionImages,
    removeSelectedLifeGoalVisionImage,
    renderSubtaskProgressDots,
    renderVisionImageLayout,
    reorderGoalTask,
    reorderSelectedLifeGoalVisionImages,
    setDragOverTaskId,
    setDraggedTaskId,
    setDragOverVisionImageIndex,
    setDraggedVisionImageIndex,
    setEditGoalActionsMenuOpen,
    setHabitDraftByTaskId,
    setInlineLifeGoalEditingField,
    setInlineLifeGoalIconGoalId,
    setLifeGoalActionFeedback,
    setLifeGoalDetailTab,
    setLifeGoalDraft,
    setLifeGoalIconPickerOpen,
    setLifeGoalIconPickerQuery,
    setLifeGoalIconPickerTab,
    setMilestoneDatePanelPosition,
    setMilestoneDatePickerMilestoneId,
    setRoadmapCompletedOpen,
    setRoadmapHighPriorityFocus,
    setRoadmapOrganizationMode,
    setSelectedLifeGoalVisionEditMode,
    setSelectedRoadmapTaskId,
    setTaskListSortMode,
    setVisionDropActive,
    setVisionPreviewImage,
  } = props
  const [directionalHeaderEditPanelOpen, setDirectionalHeaderEditPanelOpen] = React.useState(false)
  const directionalHeaderEditPanelRef = React.useRef<HTMLDivElement | null>(null)
  const directionalHeaderEditButtonRef = React.useRef<HTMLButtonElement | null>(null)

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
  const showDetailWhy = selectedGoalDetailContentVisibility.why
  const showDetailVision = selectedGoalDetailContentVisibility.vision
  const showDetailMetrics = selectedGoalDetailContentVisibility.metrics
  const isOutcomeGoal = selectedGoalIsOutcome
  const isDirectionalGoal = selectedGoalIsDirectional
  const parentOverviewGoalsView = isDirectionalGoal ? 'directional-overview' : 'life-overview'
  const milestonesEnabled = selectedGoalMilestonesEnabled
  const goalMilestones = selectedLifeGoalMilestones
  const currentMilestone = selectedCurrentMilestone
  const completedMilestoneCount = selectedCompletedMilestoneCount
  const roadmapPanelView = selectedRoadmapPanelView
  const showMilestoneProgressView = selectedShowMilestoneProgressView
  const milestoneOptions = selectedMilestoneOptions
  const milestoneDateTarget = selectedMilestoneDateTarget
  const isRoadmapMode = !isDirectionalGoal && (lifeGoalDetailTab === 'tasks' || lifeGoalDetailTab === 'roadmap')
  const roadmapSections = selectedRoadmapSections
  const roadmapRemainingCount = selectedGoalRoadmapDerived.roadmapRemainingCount
  const roadmapHasHighPriorityTasks = selectedGoalRoadmapDerived.roadmapHasHighPriorityTasks
  const roadmapHasTaggedTasks = selectedGoalRoadmapDerived.roadmapHasTaggedTasks
  const sortedUpcomingTasks = selectedGoalRoadmapDerived.sortedUpcomingTasks
  const sortedCompletedTasks = selectedGoalRoadmapDerived.sortedCompletedTasks
  const sortedPlannedTasks = selectedGoalRoadmapDerived.sortedPlannedTasks
  const explicitlyAssignedTasksByMilestone = selectedGoalRoadmapDerived.explicitlyAssignedTasksByMilestone
  const roadmapTasksGroupedByMilestone = selectedGoalRoadmapDerived.roadmapTasksGroupedByMilestone
  const goalReadyToComplete = selectedGoalRoadmapDerived.goalReadyToComplete
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
  const roadmapGeometry = {
    timelineX: 12,
    nodeColumnWidth: 24,
    contentInset: 36,
    lineWidth: 1,
    lineOpacity: 0.36,
    smallNodeDiameter: 8,
    currentNodeDiameter: 14,
    connectorReach: 24,
    currentMilestoneTickReach: 24,
  } as const
  const roadmapLineOpacity = roadmapGeometry.lineOpacity
  const roadmapLineColor = `rgb(var(--theme-accent-rgb) / ${roadmapLineOpacity})`
  const roadmapLineWidth = roadmapGeometry.lineWidth
  const roadmapSmallNodeDiameter = roadmapGeometry.smallNodeDiameter
  const roadmapCurrentNodeDiameter = roadmapGeometry.currentNodeDiameter
  const roadmapNodeGridTemplate = `${roadmapGeometry.nodeColumnWidth}px minmax(0, 1fr)`
  const roadmapContentInsetStyle = React.useMemo(
    () => ({ paddingLeft: `${roadmapGeometry.contentInset}px` }),
    [roadmapGeometry.contentInset],
  )
  const roadmapRailLeftStyle = React.useMemo(
    () => ({ left: `${roadmapGeometry.timelineX}px` }),
    [roadmapGeometry.timelineX],
  )
  const roadmapConnectorLeft = roadmapGeometry.timelineX - roadmapGeometry.contentInset
  const roadmapConnectorWidth = roadmapGeometry.contentInset - roadmapGeometry.timelineX
  const roadmapConnectorCurveOffset = Math.max(8, Math.round(roadmapConnectorWidth * 0.46))
  const roadmapMilestoneConnectorPath = (() => {
    const x = roadmapLineWidth / 2
    const centerY = 50
    const curveStartY = centerY - roadmapConnectorCurveOffset
    const curveEndY = centerY + roadmapConnectorCurveOffset
    return `M ${x} 0 L ${x} ${curveStartY} Q ${x} ${centerY} ${roadmapConnectorWidth} ${centerY} Q ${x} ${centerY} ${x} ${curveEndY} L ${x} 100`
  })()
  const renderRoadmapNodeCutout = React.useCallback((diameter: number, surfaceRgb = 'var(--theme-surface-elevated-rgb)') => (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-[-1] -translate-x-1/2 -translate-y-1/2"
      style={{
        width: `${roadmapLineWidth + 1}px`,
        height: `${diameter}px`,
        background: `rgb(${surfaceRgb} / 0.98)`,
      }}
    />
  ), [roadmapLineWidth])
  const renderGoalTypeInfoChip = React.useCallback((label: string, tooltip: string, chipClassName: string) => (
    <span className={`group/typeinfo relative ${goalHeaderChipClassName} ${chipClassName}`}>
      <span>{label}</span>
      <span className="theme-tooltip pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-[240px] -translate-x-1/2 whitespace-normal rounded-xl border px-2.5 py-1.5 text-left text-[11px] font-medium leading-4 opacity-0 shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 ease-out group-hover/typeinfo:block group-hover/typeinfo:translate-y-0 group-hover/typeinfo:opacity-100">
        {tooltip}
      </span>
    </span>
  ), [goalHeaderChipClassName])
  const renderRoadmapTaskGroups = React.useCallback((
    tasks: LifeGoalTask[],
    keyPrefix: string,
    options: { groupedByTag?: boolean } | undefined,
    renderTask: (task: LifeGoalTask, meta: { groupIndex: number; taskIndex: number }) => any,
  ) => {
    const groups = options?.groupedByTag ? getRoadmapTagGroups(tasks) : [{ label: null, tasks }]

    return groups.map((group, groupIndex) => {
      const shouldShowGroupHeader = Boolean(options?.groupedByTag && group.tasks.length > 0)

      return (
        <div key={`${keyPrefix}-${groupIndex}-${group.label ?? 'default'}`} className={groupIndex > 0 ? (shouldShowGroupHeader ? 'pt-4' : 'pt-1') : ''}>
          {shouldShowGroupHeader ? (
            <div className="flex items-center justify-between gap-3 pb-2" style={roadmapContentInsetStyle}>
              <p className="text-[10px] uppercase tracking-[0.18em] text-mist/42">{group.label ?? 'untagged'}</p>
              <p className="text-[10px] tracking-[0.08em] text-mist/30">
                {group.tasks.filter((task) => task.completed).length}/{group.tasks.length}
              </p>
            </div>
          ) : null}
          {group.tasks.map((task, taskIndex) => renderTask(task, { groupIndex, taskIndex }))}
        </div>
      )
    })
  }, [roadmapContentInsetStyle])
  const renderPriorityChip = React.useCallback((task: LifeGoalTask) => {
    const priorityMeta = getLifeGoalTaskPriorityMeta(task.priority)
    if (!priorityMeta) return null

    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] leading-none ${priorityMeta.chipClassName}`}>
        {priorityMeta.label}
      </span>
    )
  }, [])
  const roadmapHeaderControlBaseClass =
    'inline-flex items-center rounded-full border border-white/[0.045] bg-white/[0.018] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-white/50 transition hover:border-white/[0.08] hover:text-white/70'
  const roadmapHeaderControlActiveClass =
    'inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-white/76 transition hover:border-white/[0.1] hover:text-white/84'
  const renderTaskTags = React.useCallback((task: LifeGoalTask) => {
    const tags = normalizeTaskTags(task.tags)
    if (tags.length === 0) return null

    const visibleTags = tags.slice(0, 3)
    const overflowCount = tags.length - visibleTags.length

    return (
      <>
        {visibleTags.map((tag) => (
          <span
            key={`${task.id}-${tag}`}
            className="inline-flex items-center rounded-full border border-white/[0.055] bg-white/[0.022] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-white/50"
          >
            {tag}
          </span>
        ))}
        {overflowCount > 0 ? (
          <span
            title={tags.join(' · ')}
            className="inline-flex items-center rounded-full border border-white/[0.05] bg-white/[0.018] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] leading-none text-white/42"
          >
            +{overflowCount}
          </span>
        ) : null}
      </>
    )
  }, [])
  const renderRoadmapPanelTaskRow = React.useCallback((task: LifeGoalTask, section: 'current' | 'upcoming') => {
    const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
    const visualState = getRoadmapTaskVisualState(task, section, roadmapHighPriorityFocus)
    const isCompressed = section === 'upcoming' && roadmapHighPriorityFocus && getPriorityScore(task) !== 3

    if (section === 'current') {
      return (
        <button
          key={task.id}
          ref={(element) => {
            roadmapTaskRowRefs.current[task.id] = element
          }}
          data-goal-task-id={task.id}
          type="button"
          onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
          onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
          draggable
          onDragStart={() => setDraggedTaskId(task.id)}
          onDragOver={(event) => {
            event.preventDefault()
            if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
            setDraggedTaskId(null)
            setDragOverTaskId(null)
          }}
          onDragEnd={() => {
            setDraggedTaskId(null)
            setDragOverTaskId(null)
          }}
          className={`group relative grid w-full items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.1)] bg-white/[0.012] py-[14px] text-left transition duration-200 ease-out hover:bg-white/[0.02] hover:border-[rgb(var(--theme-accent-rgb)/0.14)] ${
            dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
          } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
            roadmapArrivalCueActive ? 'goal-current-arrival' : ''
          } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
            taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
          }`}
          style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
        >
          <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
            {renderRoadmapNodeCutout(roadmapCurrentNodeDiameter)}
            <span className="roadmap-current-node-pulse absolute h-[20px] w-[20px] rounded-full bg-[rgb(var(--theme-accent-rgb)/0.18)] blur-[6px]" />
            <span
              className={`relative flex items-center justify-center rounded-full border transition-transform duration-200 ease-out group-hover:scale-110 ${
                getPriorityScore(task) === 3
                  ? 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.9)] shadow-[0_0_8px_rgb(var(--theme-accent-rgb)/0.08)]'
                  : 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.8)] shadow-[0_0_6px_rgb(var(--theme-accent-rgb)/0.06)]'
              }`}
            >
              <span
                className={`rounded-full border ${
                  getPriorityScore(task) === 3
                    ? 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.94)]'
                    : 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.86)]'
                }`}
              />
            </span>
          </span>
          <div className="min-w-0 px-1 pb-3 pr-10 pt-0.5">
            <div className="min-w-0">
              <AnimatePresence initial={false}>
                {roadmapArrivalCueActive ? (
                  <motion.p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/56"
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    Start here
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {taskMomentumTransition?.nextTaskId === task.id ? (
                  <motion.p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    Next step ready
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {visibleGoalStartCueTaskId === task.id ? (
                  <motion.p
                    className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    Goal started • 1 step ready
                  </motion.p>
                ) : null}
              </AnimatePresence>
              <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
              <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                <div className="min-w-0 text-left pb-[2px]">
                  <div className="flex flex-wrap items-center gap-2">
                    {task.dueDate ? (
                      <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                        {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                      </p>
                    ) : null}
                    {renderPriorityChip(task)}
                    {renderTaskTags(task)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {task.subtasks.length > 0 ? (
            <div className="pointer-events-none absolute bottom-4 right-3.5 flex items-center justify-end">
              {renderSubtaskProgressDots(task.subtasks)}
            </div>
          ) : null}
        </button>
      )
    }

    return (
      <button
        key={task.id}
        ref={(element) => {
          roadmapTaskRowRefs.current[task.id] = element
        }}
        data-goal-task-id={task.id}
        type="button"
        onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
        onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
        draggable
        onDragStart={() => setDraggedTaskId(task.id)}
        onDragOver={(event) => {
          event.preventDefault()
          if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
          setDraggedTaskId(null)
          setDragOverTaskId(null)
        }}
        onDragEnd={() => {
          setDraggedTaskId(null)
          setDragOverTaskId(null)
        }}
        className={`group relative grid w-full items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
          isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
        } ${
          dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
        } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
          taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
        } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
        style={{
          ...visualState.rowStyle,
          gridTemplateColumns: roadmapNodeGridTemplate,
          opacity:
            visualState.opacity *
            (roadmapArrivalCueActive ? 0.78 : 1) *
            (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
        }}
      >
        <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
          {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
          <span className={`h-2 w-2 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
        </span>
        <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
          <div className="min-w-0">
            <AnimatePresence initial={false}>
              {taskMomentumTransition?.nextTaskId === task.id ? (
                <motion.p
                  className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  Next step ready
                </motion.p>
              ) : null}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {visibleGoalStartCueTaskId === task.id ? (
                <motion.p
                  className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  Goal started • 1 step ready
                </motion.p>
              ) : null}
            </AnimatePresence>
            <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
            <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
              <div className="min-w-0 text-left pb-[2px]">
                <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                  {task.dueDate ? (
                    <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                      {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                    </p>
                  ) : null}
                  {!isCompressed ? renderPriorityChip(task) : null}
                  {!isCompressed ? renderTaskTags(task) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        {task.subtasks.length > 0 ? (
          <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
            {renderSubtaskProgressDots(task.subtasks)}
          </div>
        ) : null}
      </button>
    )
  }, [
    dragOverTaskId,
    draggedTaskId,
    handleTaskRowKeyDown,
    openTaskPeek,
    renderPriorityChip,
    renderRoadmapNodeCutout,
    renderSubtaskProgressDots,
    renderTaskTags,
    reorderGoalTask,
    roadmapArrivalCueActive,
    roadmapCurrentNodeDiameter,
    roadmapHighPriorityFocus,
    roadmapNodeGridTemplate,
    roadmapSmallNodeDiameter,
    roadmapTaskRowRefs,
    selectedLifeGoal.id,
    setDragOverTaskId,
    setDraggedTaskId,
    taskMomentumTransition,
    visibleGoalStartCueTaskId,
  ])
  const renderTaskSortControl = React.useCallback(() => (
    <div className="inline-flex min-w-[132px] items-center justify-between gap-3 rounded-full border border-white/[0.045] bg-white/[0.018] px-2.5 py-[5px]">
      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/38">Sort</span>
      <div className="relative">
        <select
          value={taskListSortMode}
          onChange={(event) => setTaskListSortMode(event.target.value as LifeGoalTaskListSort)}
          className="appearance-none bg-transparent pr-4 text-right text-[10px] uppercase tracking-[0.14em] text-white/60 outline-none"
        >
          <option value="default" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
            Default
          </option>
          <option value="due" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
            Due
          </option>
          <option value="priority" className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
            Priority
          </option>
        </select>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-white/26">▾</span>
      </div>
    </div>
  ), [taskListSortMode, setTaskListSortMode])
  const roadmapMilestoneStructuredContent = React.useMemo(() =>
    roadmapTasksGroupedByMilestone.length > 0 ? (
      <div className="pb-4">
        {(() => {
          let upcomingMilestoneVisualIndex = 0
          return roadmapTasksGroupedByMilestone.map(({ milestone, tasks }, groupIndex) => {
          const isCurrentGroup = milestone.id === currentMilestone?.id
          const isUpcomingGroup = !isCurrentGroup
          const isNextUpcomingGroup = isUpcomingGroup && upcomingMilestoneVisualIndex === 0
          const incompleteGroupTasks = tasks.filter((task) => !task.completed)
          if (incompleteGroupTasks.length === 0) return null
          if (isUpcomingGroup) {
            upcomingMilestoneVisualIndex += 1
          }

          return (
            <div key={`roadmap-milestone-group-${milestone.id}`} className={groupIndex > 0 ? 'pt-5' : ''}>
              <div className="relative" style={roadmapContentInsetStyle}>
                {isCurrentGroup ? (
                  <p className="pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.88)] [text-shadow:0_0_8px_rgb(var(--theme-accent-rgb)/0.24)]">
                    You are here
                  </p>
                ) : null}
              </div>
              <div className="relative pb-3" style={roadmapContentInsetStyle}>
                <div className="relative flex flex-wrap items-center gap-2">
                  {isUpcomingGroup ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-0 top-0 z-[2]"
                        style={{
                          left: `${roadmapConnectorLeft}px`,
                          width: `${roadmapLineWidth + 1}px`,
                          background: 'rgb(var(--theme-surface-rgb) / 1)',
                        }}
                      />
                      <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 z-[3] h-full"
                        style={{
                          left: `${roadmapConnectorLeft}px`,
                          width: `${roadmapConnectorWidth}px`,
                        }}
                        viewBox={`0 0 ${roadmapConnectorWidth} 100`}
                        preserveAspectRatio="none"
                      >
                        <path
                          d={roadmapMilestoneConnectorPath}
                          fill="none"
                          stroke={roadmapLineColor}
                          strokeWidth={roadmapLineWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          shapeRendering="geometricPrecision"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    </>
                  ) : null}
                  {isCurrentGroup ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 h-px -translate-y-1/2"
                      style={{
                        left: `${roadmapConnectorLeft}px`,
                        width: `${roadmapGeometry.currentMilestoneTickReach}px`,
                        background: roadmapLineColor,
                        height: `${roadmapLineWidth}px`,
                      }}
                    />
                  ) : null}
                  {isUpcomingGroup ? (
                    <button
                      type="button"
                      onClick={() => openMilestonePeek(milestone.id)}
                      className={`flex w-full flex-wrap items-center gap-2 rounded-[14px] border px-[14px] py-[10px] text-left transition ${
                        isNextUpcomingGroup
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.25)] bg-white/[0.02] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)] hover:border-[rgb(var(--theme-accent-rgb)/0.32)]'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.024]'
                      }`}
                    >
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/88">
                        {milestone.title}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                          isNextUpcomingGroup
                            ? 'border-white/[0.06] bg-white/[0.02] text-white/48 opacity-70'
                            : 'border-white/[0.05] bg-white/[0.016] text-white/42 opacity-70'
                        }`}
                      >
                        {isNextUpcomingGroup ? 'Next milestone' : 'Upcoming milestone'}
                      </span>
                      {milestone.targetDate ? (
                        <span className={`text-[12px] ${getRelativeDueMeta(milestone.targetDate)?.toneClassName ?? 'text-mist/50'}`}>
                          {getRelativeDueMeta(milestone.targetDate)?.label ?? formatDate(milestone.targetDate)}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <div
                      className={`flex w-full flex-wrap items-center gap-2 ${
                      isUpcomingGroup
                        ? `rounded-[14px] border px-[14px] py-[10px] ${
                            isNextUpcomingGroup
                              ? 'border-[rgb(var(--theme-accent-rgb)/0.25)] bg-white/[0.02] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]'
                              : 'border-white/[0.07] bg-white/[0.02]'
                          }`
                        : ''
                      }`}
                    >
                      <p className={`text-[11px] uppercase tracking-[0.18em] ${isCurrentGroup ? 'text-white/78' : 'font-medium text-white/88'}`}>
                        {milestone.title}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                          isCurrentGroup
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.05)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                            : isNextUpcomingGroup
                              ? 'border-white/[0.06] bg-white/[0.02] text-white/48 opacity-70'
                              : 'border-white/[0.05] bg-white/[0.016] text-white/42 opacity-70'
                        }`}
                      >
                        {isCurrentGroup ? 'Current milestone' : isNextUpcomingGroup ? 'Next milestone' : 'Upcoming milestone'}
                      </span>
                      {milestone.targetDate ? (
                        <span className={`text-[12px] ${getRelativeDueMeta(milestone.targetDate)?.toneClassName ?? 'text-mist/50'}`}>
                          {getRelativeDueMeta(milestone.targetDate)?.label ?? formatDate(milestone.targetDate)}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className={`space-y-0.5 ${isUpcomingGroup ? 'mt-2' : ''}`}>
                {incompleteGroupTasks.map((task) =>
                  renderRoadmapPanelTaskRow(task, task.id === roadmapSections.current?.id ? 'current' : 'upcoming'),
                )}
              </div>
            </div>
          )
        })
        })()}
      </div>
    ) : null,
  [
    currentMilestone,
    openMilestonePeek,
    renderRoadmapPanelTaskRow,
    roadmapConnectorLeft,
    roadmapConnectorWidth,
    roadmapContentInsetStyle,
    roadmapGeometry.currentMilestoneTickReach,
    roadmapLineColor,
    roadmapLineWidth,
    roadmapMilestoneConnectorPath,
    roadmapSections.current?.id,
    roadmapTasksGroupedByMilestone,
  ])
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
  const detailHeaderRelationshipChips = (
    <>
      {isDirectionalGoal
        ? renderGoalTypeInfoChip(
            'Direction',
            'Long-term life direction. Not something to complete.',
            'border-white/[0.08] bg-white/[0.04] text-white/76',
          )
        : renderGoalTypeInfoChip(
            'Outcome',
            'An outcome goal is a destination with a clear finish. Use tasks for the execution steps to reach it.',
            'border-white/[0.08] bg-white/[0.03] text-white/75',
          )}
      {renderParentGoalChips()}
    </>
  )
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
  const roadmapNotesContent = React.useMemo(
    () => <LifeGoalNotesEditor goalId={selectedLifeGoal.id} value={selectedLifeGoal.notes ?? ''} onChange={updateSelectedLifeGoalNotes} />,
    [selectedLifeGoal.id, selectedLifeGoal.notes, updateSelectedLifeGoalNotes],
  )
  const handleVisionUploadClick = React.useCallback(() => {
    if (!selectedLifeGoalCanUploadVisionImages) return
    visionUploadInputRef.current?.click()
  }, [selectedLifeGoalCanUploadVisionImages, visionUploadInputRef])
  const handleFocusToday = React.useCallback(() => {
    onSetLifeGoalAsTodayTask(selectedLifeGoal)
    setLifeGoalActionFeedback('Focused for today.')
  }, [onSetLifeGoalAsTodayTask, selectedLifeGoal, setLifeGoalActionFeedback])
  const handleCompleteGoal = React.useCallback(() => {
    completeLifeGoal(selectedLifeGoal.id)
  }, [completeLifeGoal, selectedLifeGoal.id])
  const primaryFocusAction = React.useMemo(
    () => (goalReadyToComplete ? handleCompleteGoal : selectedLifeGoalProgress.nextTask ? handleCompleteNextWithFeedback : undefined),
    [goalReadyToComplete, handleCompleteGoal, selectedLifeGoalProgress.nextTask, handleCompleteNextWithFeedback],
  )
  const focusCategoryChip = React.useMemo(
    () =>
      showDetailCategory && selectedGoalCategory ? (
        <span
          className={`${goalHeaderChipClassName} gap-1.5 text-white/70`}
          style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
          {selectedGoalCategory}
        </span>
      ) : null,
    [showDetailCategory, selectedGoalCategory, selectedGoalCategoryColor, goalHeaderChipClassName],
  )
  const focusStatusChip = React.useMemo(
    () =>
      showDetailStatus ? (
        <span
          className={`${goalHeaderChipClassName} ${
            getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).badgeClassName
          }`}
        >
          {isLifeGoalScheduled(selectedLifeGoal.status, selectedLifeGoal.startDate)
            ? 'Scheduled'
            : getLifeGoalStatusMeta(selectedLifeGoal.status, selectedLifeGoal.startDate).label}
        </span>
      ) : null,
    [showDetailStatus, goalHeaderChipClassName, selectedLifeGoal.status, selectedLifeGoal.startDate],
  )
  const focusWhyContent = React.useMemo(
    () => (showDetailWhy ? (inlineLifeGoalEditingField === 'why' ? inlineEditableWhy : inlineWhyDisplay) : null),
    [showDetailWhy, inlineLifeGoalEditingField, inlineEditableWhy, inlineWhyDisplay],
  )
  const focusTitleContent = React.useMemo(
    () => (inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay),
    [inlineLifeGoalEditingField, inlineEditableTitle, inlineTitleDisplay],
  )
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
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/26">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4.5 6.5L8 10L11.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
    for (const task of selectedLifeGoal.tasks) {
      if (task.completed && task.completedAt) activeDates.add(task.completedAt.slice(0, 10))
    }
    for (const task of linkedDirectionalTasks) {
      if (task.completed && task.completedAt) activeDates.add(task.completedAt.slice(0, 10))
    }
    for (const goal of visibleRelatedGoals) {
      for (const task of goal.tasks) {
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
    selectedLifeGoal.tasks,
    showDetailCategory,
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
          className="mt-4 flex w-full items-stretch gap-3 rounded-[20px] border border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.04)] px-4 py-5 text-left transition hover:border-[rgb(var(--theme-accent-rgb)/0.18)] hover:bg-[rgb(var(--theme-accent-rgb)/0.06)]"
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
            // Tasks sourced from linkedDirectionalTasks (global Task type) have linkedDirectionId.
            // Tasks sourced from selectedLifeGoal.tasks (LifeGoalTask) do not — open via peek.
            const isEmbeddedGoalTask = !('linkedDirectionId' in task)
            return (
              <button
                key={`direction-task-row-${task.id}`}
                type="button"
                onClick={(event) => isEmbeddedGoalTask ? openTaskPeek(task.id, event.currentTarget) : onOpenGlobalTasks()}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.018]"
                title={isEmbeddedGoalTask ? 'Open task' : 'Open in global tasks'}
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
    onOpenGlobalTasks,
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
          const goalProgress = getLifeGoalProgress(goal, goal.tasks)
          const percent = goalProgress.totalTasks > 0 ? Math.max(2, Math.min(100, Math.round((goalProgress.completedTasks / goalProgress.totalTasks) * 100))) : 0
          const lastCompletedAt = goal.tasks
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
              const goalProgress = getLifeGoalProgress(goal, goal.tasks)
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
  const outcomeMilestoneContent = React.useMemo(
    () =>
    isOutcomeGoal && milestonesEnabled ? (
      goalMilestones.length > 0 ? (
        <div className="space-y-2">
          {goalMilestones.length > 1 ? (
            <div className="mb-1 flex items-center gap-2 px-1 pb-2">
              {goalMilestones.map((milestone, index) => {
                const isCurrentMilestone = currentMilestone?.id === milestone.id && !milestone.completed
                return (
                  <span
                    key={`milestone-progress-${milestone.id}`}
                    title={milestone.title.trim() || `Milestone ${index + 1}`}
                    className={`inline-flex h-2.5 w-2.5 rounded-full border transition ${
                      milestone.completed
                        ? 'border-[rgb(var(--theme-accent-rgb)/0.36)] bg-[rgb(var(--theme-accent-rgb)/0.74)]'
                        : isCurrentMilestone
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.34)] bg-[rgb(var(--theme-accent-rgb)/0.18)] shadow-[0_0_0_2px_rgb(var(--theme-accent-rgb)/0.06)]'
                          : 'border-white/[0.18] bg-transparent'
                    }`}
                  />
                )
              })}
            </div>
          ) : null}
          {goalMilestones.map((milestone, milestoneIndex) => {
            const isCurrentMilestone = currentMilestone?.id === milestone.id && !milestone.completed
            const milestoneDueMeta = milestone.targetDate ? getRelativeDueMeta(milestone.targetDate) : null
            const milestoneDescriptionPreview = milestone.description.trim()
            const milestoneTasks = explicitlyAssignedTasksByMilestone.get(milestone.id) ?? []
            const milestoneTaskProgress = getMilestoneTaskProgress(milestoneTasks)
            return (
              <div
                key={milestone.id}
                onClick={() => openMilestonePeek(milestone.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openMilestonePeek(milestone.id)
                  }
                }}
                role="button"
                tabIndex={0}
                className={`w-full cursor-pointer rounded-[20px] border px-4 py-3.5 text-left transition ${
                  isCurrentMilestone
                    ? 'border-[rgb(var(--theme-accent-rgb)/0.08)] bg-[rgb(var(--theme-accent-rgb)/0.022)] hover:border-[rgb(var(--theme-accent-rgb)/0.12)]'
                    : 'border-white/[0.05] bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.026]'
                }`}
              >
                <div className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 items-center justify-center">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-medium transition ${
                        milestone.completed
                          ? 'border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-[rgb(var(--theme-accent-rgb)/0.82)]'
                          : isCurrentMilestone
                            ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.04)] text-white/84'
                            : 'border-white/[0.12] bg-white/[0.02] text-white/46'
                      }`}
                    >
                      {milestone.completed ? '✓' : milestoneIndex + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`min-w-0 flex-1 text-[15px] font-medium leading-6 ${milestone.completed ? 'text-white/54 line-through' : 'text-white/88'}`}>
                        {milestone.title.trim() || `Milestone ${milestoneIndex + 1}`}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                            milestone.completed
                              ? 'border-white/[0.06] bg-white/[0.025] text-white/44'
                              : isCurrentMilestone
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.06)] text-[rgb(var(--theme-accent-rgb)/0.74)]'
                                : 'border-white/[0.06] bg-white/[0.018] text-white/42'
                          }`}
                        >
                          {milestone.completed ? 'Completed' : isCurrentMilestone ? 'Current' : 'Upcoming'}
                        </span>
                        {milestone.targetDate ? (
                          <span className={`text-[12px] ${milestoneDueMeta?.toneClassName ?? 'text-mist/56'}`}>
                            {milestoneDueMeta ? `${milestoneDueMeta.compactLabel} · ` : ''}
                            {formatDate(milestone.targetDate)}
                          </span>
                        ) : null}
                        {milestoneTaskProgress.percent != null ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                              milestoneTaskProgress.percent === 100
                                ? 'border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-rgb)/0.08)] text-[rgb(var(--theme-accent-rgb)/0.72)]'
                                : milestoneTaskProgress.percent > 0
                                  ? 'border-white/[0.08] bg-white/[0.03] text-white/56'
                                  : 'border-white/[0.05] bg-white/[0.016] text-white/40'
                            }`}
                          >
                            {milestoneTaskProgress.percent}% complete
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {milestoneDescriptionPreview ? (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-white/58">{milestoneDescriptionPreview}</p>
                    ) : null}
                    {milestoneTaskProgress.percent != null ? (
                      <p className="mt-1 text-[12px] text-mist/56">
                        {milestoneTaskProgress.completed}/{milestoneTaskProgress.total} tasks complete
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
          <button
            type="button"
            onClick={addSelectedLifeGoalMilestone}
            className="group flex w-full items-center gap-3 rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.012] px-4 py-3.5 text-left transition hover:border-white/[0.14] hover:bg-white/[0.02]"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-[15px] text-white/44 transition group-hover:text-white/64">
              +
            </span>
            <span className="text-[15px] font-medium text-white/54 transition group-hover:text-white/74">Add milestone</span>
          </button>
        </div>
      ) : (
        <div className="pt-1" style={roadmapContentInsetStyle}>
          <p className="text-sm text-white/68">No milestones yet</p>
          <button
            type="button"
            onClick={addSelectedLifeGoalMilestone}
            className="mt-2 inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/56 transition hover:border-white/[0.1] hover:text-white/78"
          >
            + Add first milestone
          </button>
        </div>
      )
    ) : null,
    [
      isOutcomeGoal,
      milestonesEnabled,
      goalMilestones,
      currentMilestone,
      explicitlyAssignedTasksByMilestone,
      roadmapContentInsetStyle,
      addSelectedLifeGoalMilestone,
      openMilestonePeek,
    ],
  )
  const milestoneDatePicker =
    milestoneDatePickerMilestoneId && milestoneDateTarget
      ? (
          <GoalDatePicker
            ref={milestoneDatePanelRef}
            value={milestoneDateTarget.targetDate}
            anchorPosition={milestoneDatePanelPosition}
            navigationStyle="bordered"
            onChange={applySelectedMilestoneDate}
            onClose={() => {
              setMilestoneDatePickerMilestoneId(null)
              setMilestoneDatePanelPosition(null)
            }}
          />
        )
      : null
  const roadmapSortControl = React.useMemo(() => renderTaskSortControl(), [renderTaskSortControl])
  const roadmapPanelData = React.useMemo(
    () => ({
      plannedTaskCount: selectedLifeGoalProgress.plannedTasks.length,
      completedCount: selectedLifeGoalProgress.completedTaskItems.length,
      remainingCount: roadmapRemainingCount,
      lastCompletedText: selectedLifeGoalProgress.lastCompletedTask?.text ?? null,
      roadmapLineColor,
      roadmapLineWidth,
      roadmapTimelineX: roadmapGeometry.timelineX,
      roadmapContentInset: roadmapGeometry.contentInset,
      milestoneSummaryText:
        goalMilestones.length > 0
          ? `${completedMilestoneCount}/${goalMilestones.length} milestones complete`
          : 'Milestones enabled',
      notesContent: roadmapNotesContent,
      sortControl: roadmapSortControl,
      emptyMessage: roadmapSections.completed.length > 0 ? 'All roadmap tasks are complete.' : 'No upcoming tasks yet. Add the next concrete step.',
      milestoneContent: outcomeMilestoneContent,
      completedContent: roadmapSections.completed.length > 0 ? (
        <div className="pb-4">
          {renderRoadmapTaskGroups(sortedCompletedTasks, 'completed', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
            const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
            const visualState = getRoadmapTaskVisualState(task, 'completed', roadmapHighPriorityFocus)
            const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
            return (
              <button
                key={task.id}
                ref={(element) => {
                  roadmapTaskRowRefs.current[task.id] = element
                }}
                data-goal-task-id={task.id}
                type="button"
                onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                className={`group grid w-full items-start gap-x-3 rounded-[12px] text-left transition-all duration-200 ease-out hover:bg-white/[0.014] ${
                  isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
                } ${
                  visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''
                } ${
                  taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                }`}
                style={{
                  gridTemplateColumns: roadmapNodeGridTemplate,
                  opacity:
                    visualState.opacity *
                    (roadmapArrivalCueActive ? 0.78 : 1) *
                    (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                }}
              >
                <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-4 w-4 items-center justify-center justify-self-center">
                  {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
                  <span className="h-2 w-2 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.5)] transition-transform duration-200 ease-out group-hover:scale-110" />
                </span>
                <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
                  <AnimatePresence initial={false}>
                    {visibleGoalStartCueTaskId === task.id ? (
                      <motion.p
                        className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                      >
                        Goal started • 1 step ready
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                  <p className={`${isCompressed ? 'text-[13px] leading-5' : 'text-[14px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                  <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                    <div className="min-w-0 text-left pb-[2px]">
                      <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                        {task.dueDate ? (
                          <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                            {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                          </p>
                        ) : null}
                        {!isCompressed ? renderPriorityChip(task) : null}
                        {!isCompressed ? renderTaskTags(task) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {task.subtasks.length > 0 ? (
                  <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
                    {renderSubtaskProgressDots(task.subtasks, 'completed')}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null,
      currentContent: roadmapMilestoneStructuredContent ? (
        roadmapMilestoneStructuredContent
      ) : roadmapSections.current ? (
        <div className="pb-4">
          {renderRoadmapTaskGroups([roadmapSections.current], 'panel-current', undefined, (task) => {
            const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
            const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
            return (
              <div key={task.id}>
                <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.96)] [text-shadow:0_0_10px_rgb(var(--theme-accent-rgb)/0.42),0_0_18px_rgb(var(--theme-accent-rgb)/0.18)]" style={roadmapContentInsetStyle}>
                  You are here
                </p>
                <button
                  ref={(element) => {
                    roadmapTaskRowRefs.current[task.id] = element
                  }}
                  data-goal-task-id={task.id}
                  type="button"
                  onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                  onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                  draggable
                  onDragStart={() => setDraggedTaskId(task.id)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                    setDraggedTaskId(null)
                    setDragOverTaskId(null)
                  }}
                  onDragEnd={() => {
                    setDraggedTaskId(null)
                    setDragOverTaskId(null)
                  }}
                  className={`group relative grid w-full items-start gap-x-3 gap-y-1 rounded-none border border-[rgb(var(--theme-accent-rgb)/0.14)] bg-white/[0.014] py-[18px] text-left transition duration-200 ease-out hover:bg-white/[0.022] hover:border-[rgb(var(--theme-accent-rgb)/0.18)] ${
                    dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id
                      ? 'bg-white/[0.03]'
                      : ''
                  } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                    roadmapArrivalCueActive ? 'goal-current-arrival' : ''
                  } ${taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''} ${
                    taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''
                  }`}
                  style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                >
                  <span aria-hidden="true" className="relative z-[3] mt-[2px] flex h-[18px] w-[18px] items-center justify-center justify-self-center">
                    {renderRoadmapNodeCutout(roadmapCurrentNodeDiameter)}
                    <span className="roadmap-current-node-pulse absolute h-[20px] w-[20px] rounded-full bg-[rgb(var(--theme-accent-rgb)/0.22)] blur-[6px]" />
                    <span
                      className={`relative flex items-center justify-center rounded-full border transition-transform duration-200 ease-out group-hover:scale-110 ${
                        getPriorityScore(task) === 3
                          ? 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.92)] shadow-[0_0_8px_rgb(var(--theme-accent-rgb)/0.1)]'
                          : 'h-[14px] w-[14px] border-[rgb(var(--theme-accent-rgb)/0.84)] shadow-[0_0_6px_rgb(var(--theme-accent-rgb)/0.08)]'
                      }`}
                    >
                      <span
                        className={`rounded-full border ${
                          getPriorityScore(task) === 3
                            ? 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.96)]'
                            : 'h-[8px] w-[8px] border-[rgb(var(--theme-accent-rgb)/0.88)]'
                        }`}
                      />
                    </span>
                  </span>
                  <div className="min-w-0 px-1 pb-4 pr-10 pt-0.5">
                    <div className="min-w-0">
                      <AnimatePresence initial={false}>
                        {roadmapArrivalCueActive ? (
                          <motion.p
                            className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/56"
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                          >
                            Start here
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                      <AnimatePresence initial={false}>
                        {taskMomentumTransition?.nextTaskId === task.id ? (
                          <motion.p
                            className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                          >
                            Next step ready
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                      <AnimatePresence initial={false}>
                        {visibleGoalStartCueTaskId === task.id ? (
                          <motion.p
                            className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                          >
                            Goal started • 1 step ready
                          </motion.p>
                        ) : null}
                      </AnimatePresence>
                      <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                      <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                        <div className="min-w-0 text-left pb-[2px]">
                          <div className="flex flex-wrap items-center gap-2">
                            {task.dueDate ? (
                              <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                              </p>
                            ) : null}
                            {renderPriorityChip(task)}
                            {renderTaskTags(task)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {task.subtasks.length > 0 ? (
                    <div className="pointer-events-none absolute bottom-4 right-3.5 flex items-center justify-end">
                      {renderSubtaskProgressDots(task.subtasks)}
                    </div>
                  ) : null}
                </button>
              </div>
            )
          })}
        </div>
      ) : null,
      upcomingContent: roadmapMilestoneStructuredContent ? null : roadmapSections.upcoming.length > 0 ? (
        <div>
          <p className="pb-2 text-[11px] uppercase tracking-[0.16em] text-mist/56" style={roadmapContentInsetStyle}>Next · {roadmapSections.upcoming.length}</p>
          {renderRoadmapTaskGroups(sortedUpcomingTasks, 'panel-upcoming', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
            const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
            const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
            const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
            return (
              <button
                key={task.id}
                ref={(element) => {
                  roadmapTaskRowRefs.current[task.id] = element
                }}
                data-goal-task-id={task.id}
                type="button"
                onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                draggable
                onDragStart={() => setDraggedTaskId(task.id)}
                onDragOver={(event) => {
                  event.preventDefault()
                  if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (draggedTaskId) reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                  setDraggedTaskId(null)
                  setDragOverTaskId(null)
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null)
                  setDragOverTaskId(null)
                }}
                className={`group relative grid w-full items-start gap-x-3 rounded-[14px] text-left transition-all duration-200 ease-out hover:bg-white/[0.015] ${
                  isCompressed ? 'gap-y-0 py-[1px]' : 'gap-y-1 py-[10px]'
                } ${
                  dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.028]' : ''
                } ${visibleGoalStartCueTaskId === task.id ? 'goal-start-highlight' : ''} ${
                  taskMomentumTransition?.nextTaskId === task.id ? 'goal-next-task-activate' : ''
                } ${taskMomentumTransition?.completedTaskId === task.id ? 'goal-task-complete-flash' : ''}`}
                style={{
                  ...visualState.rowStyle,
                  gridTemplateColumns: roadmapNodeGridTemplate,
                  opacity:
                    visualState.opacity *
                    (roadmapArrivalCueActive ? 0.78 : 1) *
                    (taskMomentumTransition?.completedTaskId === task.id ? 0.75 : 1),
                }}
              >
                <span aria-hidden="true" className="relative z-[3] justify-self-center mt-[2px] flex h-4 w-4 items-center justify-center">
                  {renderRoadmapNodeCutout(roadmapSmallNodeDiameter)}
                  <span className={`h-2 w-2 rounded-full border border-white/[0.26] bg-transparent transition-transform duration-200 ease-out group-hover:scale-110 ${getPriorityScore(task) === 3 ? 'shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.08)]' : ''}`} />
                </span>
                <div className={`min-w-0 border-b border-white/[0.02] pr-8 transition-all duration-200 ease-out ${isCompressed ? 'pb-0' : 'pb-[10px]'}`}>
                  <div className="min-w-0">
                    <AnimatePresence initial={false}>
                      {taskMomentumTransition?.nextTaskId === task.id ? (
                        <motion.p
                          className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/62"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                        >
                          Next step ready
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {visibleGoalStartCueTaskId === task.id ? (
                        <motion.p
                          className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/64"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                        >
                          Goal started • 1 step ready
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                    <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                      <div className="min-w-0 text-left pb-[2px]">
                        <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                          {task.dueDate ? (
                            <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                              {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                            </p>
                          ) : null}
                          {!isCompressed ? renderPriorityChip(task) : null}
                          {!isCompressed ? renderTaskTags(task) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {task.subtasks.length > 0 ? (
                  <div className="pointer-events-none absolute bottom-[16px] right-4 flex items-center justify-end">
                    {renderSubtaskProgressDots(task.subtasks)}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null,
    }),
    [
      selectedLifeGoalProgress.plannedTasks.length,
      selectedLifeGoalProgress.completedTaskItems.length,
      selectedLifeGoalProgress.lastCompletedTask?.text,
      roadmapRemainingCount,
      roadmapLineColor,
      roadmapLineWidth,
      roadmapGeometry.timelineX,
      roadmapGeometry.contentInset,
      goalMilestones.length,
      completedMilestoneCount,
      roadmapNotesContent,
      roadmapSortControl,
      roadmapSections.completed.length,
      outcomeMilestoneContent,
      sortedCompletedTasks,
      roadmapOrganizationMode,
      roadmapHighPriorityFocus,
      visibleGoalStartCueTaskId,
      taskMomentumTransition,
      roadmapNodeGridTemplate,
      roadmapArrivalCueActive,
      roadmapSmallNodeDiameter,
      roadmapCurrentNodeDiameter,
      roadmapMilestoneStructuredContent,
      roadmapSections.current,
      roadmapSections.upcoming.length,
      sortedUpcomingTasks,
      roadmapContentInsetStyle,
      dragOverTaskId,
      draggedTaskId,
      selectedLifeGoal.id,
      renderRoadmapTaskGroups,
      renderRoadmapNodeCutout,
      renderPriorityChip,
      renderTaskTags,
      renderSubtaskProgressDots,
      openTaskPeek,
      handleTaskRowKeyDown,
      setDraggedTaskId,
      setDragOverTaskId,
      reorderGoalTask,
      roadmapTaskRowRefs,
    ],
  )
  const directionalActivitySection = React.useMemo(() => isDirectionalGoal ? (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/50">Activity</p>
          <p className="mt-1 text-sm text-mist">Linked global tasks supporting this direction.</p>
          <p className="mt-1 text-[12px] text-mist/52">Linked tasks are managed from the Dashboard task list.</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {visibleDirectionalTasks.length > 0 ? (
          <>
            {visibleDirectionalTasks.map((task) => (
              (() => {
                const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                return (
                  <button
                    key={`direction-task-${task.id}`}
                    type="button"
                    onClick={onOpenGlobalTasks}
                    className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-left transition hover:border-white/[0.08] hover:bg-white/[0.026]"
                    title="Open in global tasks"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-6 ${task.completed ? 'text-white/52 line-through' : 'text-white/78'}`}>
                        {task.text}
                      </p>
                      {task.dueDate ? (
                        <p className="mt-1 text-[12px] text-mist/54">
                          {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-0.5">
                      {task.important ? (
                        <span className="inline-flex items-center rounded-full border border-[#A94D45]/28 bg-[#2A1615]/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#D58A82]">
                          Important
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })()
            ))}
            {hiddenDirectionalTasksCount > 0 ? (
              <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-3 text-sm text-mist">
                +{hiddenDirectionalTasksCount} more
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
            <p className="text-sm text-white/68">No linked tasks yet</p>
            <p className="mt-1 text-sm text-mist">Linked tasks will appear here when they support this direction.</p>
            <p className="mt-1 text-[12px] text-mist/52">Create and edit linked tasks from the Dashboard.</p>
          </div>
        )}
      </div>
    </div>
  ) : null, [
    hiddenDirectionalTasksCount,
    isDirectionalGoal,
    onOpenGlobalTasks,
    visibleDirectionalTasks,
  ])
  const tasksTabContent = React.useMemo(() => lifeGoalDetailTab === 'tasks' ? (
    <div className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Tasks</p>
          <p className="mt-1 text-sm text-mist">Keep the next steps visible and mark them honestly.</p>
        </div>
        {roadmapSortControl}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Upcoming tasks</p>
          {sortedPlannedTasks.length > 0 ? (
            sortedPlannedTasks.map((task, index) => {
              const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
              const visualState = getRoadmapTaskVisualState(task, index === 0 ? 'current' : 'upcoming', false)
              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border px-3.5 py-2.5 ${
                    index === 0
                      ? 'border-white/[0.16] bg-white/[0.045]'
                      : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                  style={{ ...visualState.rowStyle, opacity: visualState.opacity }}
                >
                  <button
                    type="button"
                    onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                    className="flex w-full items-start justify-between gap-3 text-left transition"
                  >
                    <div className="min-w-0">
                      {index === 0 ? (
                        <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
                          Next
                        </span>
                      ) : null}
                      <span className={`mt-1 block leading-6 ${index === 0 ? 'text-[15px] font-medium' : 'text-sm'} ${visualState.titleClassName}`}>{task.text}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">{renderTaskTags(task)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pl-2">
                      {renderSubtaskProgressDots(task.subtasks)}
                      <div className="flex items-center gap-2">
                        {task.dueDate ? (
                          <span className={`text-xs ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                            {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                          </span>
                        ) : null}
                        {renderPriorityChip(task)}
                      </div>
                    </div>
                  </button>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHabitDraftByTaskId((current) => ({
                        ...current,
                        [task.id]: current[task.id] ?? task.text,
                      }))
                    }
                    className="text-xs uppercase tracking-[0.16em] text-white/46 transition hover:text-white/72"
                  >
                    Make this a habit
                  </button>
                </div>
                {habitDraftByTaskId[task.id] !== undefined ? (
                  <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-3 py-3">
                    <input
                      value={habitDraftByTaskId[task.id]}
                      onChange={(event) =>
                        setHabitDraftByTaskId((current) => ({
                          ...current,
                          [task.id]: event.target.value,
                        }))
                      }
                      spellCheck={true}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                      placeholder="Habit name"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setHabitDraftByTaskId((current) => {
                            const next = { ...current }
                            delete next[task.id]
                            return next
                          })
                        }
                      >
                        Cancel
                      </Button>
                      <Button variant="soft" onClick={() => createHabitFromTask(selectedLifeGoal, task)}>
                        Create and link habit
                      </Button>
                    </div>
                  </div>
                ) : null}
                </div>
              )
            })
          ) : (
            <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
              No upcoming tasks yet. Add the next concrete step.
            </p>
          )}

          <div className="pt-1">
            <button
              type="button"
              onClick={(event) => openNewTaskPeek(event.currentTarget)}
              className="inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/62 transition hover:border-white/[0.12] hover:text-white/82"
            >
              + Add task
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-mist/62">Completed tasks</p>
          {sortedCompletedTasks.length > 0 ? (
            sortedCompletedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={(event) => openTaskPeek(task.id, event.currentTarget)}
                    className="text-left"
                  >
                    <span className="text-sm leading-6 text-white/62 line-through">{task.text}</span>
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">{renderTaskTags(task)}</div>
                </div>
                <div className="shrink-0 text-right">
                  {task.subtasks.length > 0 ? <div className="mb-1 flex justify-end">{renderSubtaskProgressDots(task.subtasks, 'completed')}</div> : null}
                  {task.dueDate ? (
                    <p className={`text-xs ${getRelativeDueMeta(task.dueDate)?.toneClassName ?? 'text-mist/62'}`}>
                      {(() => {
                        const dueMeta = getRelativeDueMeta(task.dueDate)
                        return dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)
                      })()}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs uppercase tracking-[0.16em] text-mist/72">
                    {task.completedAt ? formatDate(task.completedAt.slice(0, 10)) : 'Done'}
                  </p>
                  <button
                    type="button"
                    onClick={() => restoreTask(selectedLifeGoal.id, task.id)}
                    className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.66)] transition hover:text-[rgb(var(--theme-info-rgb)/0.9)]"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-mist">
              Completed tasks will collect here as proof of progress.
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null, [
    createHabitFromTask,
    habitDraftByTaskId,
    lifeGoalDetailTab,
    onOpenGlobalTasks,
    openNewTaskPeek,
    openTaskPeek,
    renderPriorityChip,
    renderSubtaskProgressDots,
    renderTaskTags,
    restoreTask,
    roadmapSortControl,
    selectedLifeGoal,
    setHabitDraftByTaskId,
    sortedCompletedTasks,
    sortedPlannedTasks,
  ])

  const roadmapTabContent = React.useMemo(() => lifeGoalDetailTab === 'roadmap' ? (
    <div
      className="rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-5 py-5"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault()
          openNewTaskPeek(event.currentTarget as HTMLElement)
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-mist/68">Roadmap</p>
          <p className="mt-1 text-sm text-mist">A clean view of the path from the current task to the goal.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {roadmapSortControl}
          {roadmapHasTaggedTasks ? (
            <button
              type="button"
              onClick={() => setRoadmapOrganizationMode((current) => (current === 'default' ? 'tag' : 'default'))}
              className={`${
                roadmapOrganizationMode === 'tag'
                  ? roadmapHeaderControlActiveClass
                  : roadmapHeaderControlBaseClass
              }`}
            >
              {roadmapOrganizationMode === 'tag' ? 'View · By tag' : 'View · Default'}
            </button>
          ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
          {roadmapHasHighPriorityTasks ? (
            <button
              type="button"
              onClick={() => setRoadmapHighPriorityFocus((current) => !current)}
              className={`${
                roadmapHighPriorityFocus
                  ? 'inline-flex items-center rounded-full border border-[rgb(var(--theme-accent-rgb)/0.12)] bg-[rgb(var(--theme-accent-rgb)/0.06)] px-2.5 py-[5px] text-[10px] uppercase tracking-[0.14em] text-[rgb(var(--theme-accent-rgb)/0.72)] transition hover:border-[rgb(var(--theme-accent-rgb)/0.16)] hover:text-[rgb(var(--theme-accent-rgb)/0.82)]'
                  : roadmapHeaderControlBaseClass
              }`}
            >
              Focus · High priority
            </button>
          ) : null}
          </div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-mist/54">
            {selectedLifeGoalProgress.completedTaskItems.length} completed
            <span className="px-1.5 text-white/24">·</span>
            {roadmapRemainingCount} remaining
          </p>
        </div>
      </div>

      {selectedGoalRuntimeTasks.length > 0 ? (
        <div className="relative mt-5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px"
            style={{
              ...roadmapRailLeftStyle,
              backgroundColor:
                roadmapSections.current
                  ? roadmapLineColor
                  : 'rgb(var(--theme-border-subtle-rgb) / 0.16)',
              width: `${roadmapLineWidth}px`,
            }}
          />

          <div className="space-y-7">
            {roadmapSections.completed.length > 0 ? (
              <section>
                <button
                  type="button"
                  onClick={() => setRoadmapCompletedOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 pb-3 text-left text-[11px] uppercase tracking-[0.18em] text-mist/52 transition hover:text-white/66"
                  style={roadmapContentInsetStyle}
                >
                  <span>Completed ({roadmapSections.completed.length})</span>
                  <span className="text-white/34">{roadmapCompletedOpen ? '−' : '+'}</span>
                </button>
                {roadmapCompletedOpen ? renderRoadmapTaskGroups(sortedCompletedTasks, 'completed', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                  const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                  const visualState = getRoadmapTaskVisualState(task, 'completed', roadmapHighPriorityFocus)
                  const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                  return (
                    <div
                      key={task.id}
                      className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-white/[0.035] transition-all duration-200 ease-out last:border-b-0 ${
                        isCompressed ? 'gap-y-0 py-1.5' : 'gap-y-1 py-2.5'
                      } ${
                        selectedRoadmapTaskId === task.id ? 'bg-white/[0.012]' : ''
                      }`}
                      style={{ opacity: visualState.opacity }}
                    >
                      <span aria-hidden="true" className={`pt-0.5 text-[16px] leading-none ${visualState.markerClassName}`}>
                        ●
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          setSelectedRoadmapTaskId(task.id)
                          openTaskPeek(task.id, event.currentTarget)
                        }}
                        className="relative min-w-0 text-left"
                      >
                        <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                          <div className={`flex items-end justify-between gap-3 pr-8 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                            <div className="min-w-0 text-left pb-[2px]">
                              <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                                <p className={`text-[12px] ${task.dueDate ? dueMeta?.toneClassName ?? visualState.metaClassName : visualState.metaClassName}`}>
                                  {task.dueDate ? (dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)) : 'Completed'}
                                </p>
                                {!isCompressed ? renderPriorityChip(task) : null}
                                {!isCompressed ? renderTaskTags(task) : null}
                              </div>
                            </div>
                            {task.completedAt ? (
                              <span className="shrink-0 text-[12px] text-mist/56">{formatDate(task.completedAt.slice(0, 10))}</span>
                            ) : null}
                          </div>
                        {task.subtasks.length > 0 ? (
                          <div className="pointer-events-none absolute bottom-[8px] right-2.5 flex items-center justify-end">
                            {renderSubtaskProgressDots(task.subtasks, 'completed')}
                          </div>
                        ) : null}
                      </button>
                      <div className="flex justify-end pt-0.5">
                        <button
                          type="button"
                          onClick={() => restoreTask(selectedLifeGoal.id, task.id)}
                          className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.66)] transition hover:text-[rgb(var(--theme-info-rgb)/0.9)]"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  )
                }) : null}
              </section>
            ) : null}

            {roadmapSections.current ? (
              <section>
                <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Current</p>
                {renderRoadmapTaskGroups([roadmapSections.current], 'current', undefined, (task) => {
                  const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                  const isSelected = selectedRoadmapTaskId === task.id
                  const visualState = getRoadmapTaskVisualState(task, 'current', roadmapHighPriorityFocus)
                  return (
                    <div key={task.id}>
                      <p className="pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--theme-accent-rgb)/0.74)]" style={roadmapContentInsetStyle}>
                        You are here
                      </p>
                      <button
                        type="button"
                        onClick={(event) => {
                          setSelectedRoadmapTaskId(task.id)
                          openTaskPeek(task.id, event.currentTarget)
                        }}
                        onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                        draggable
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onDragOver={(event) => {
                          event.preventDefault()
                          if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          if (draggedTaskId) {
                            reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                          }
                          setDraggedTaskId(null)
                          setDragOverTaskId(null)
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null)
                          setDragOverTaskId(null)
                        }}
                        className={`relative grid w-full items-start gap-x-3 gap-y-1 border-b border-white/[0.04] py-[18px] text-left transition hover:border-white/[0.07] ${
                          isSelected ? 'bg-white/[0.018]' : 'bg-white/[0.012]'
                        } ${
                          dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                        }`}
                        style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                      >
                        <span aria-hidden="true" className={`pt-0.5 text-[18px] leading-none ${visualState.markerClassName}`}>
                          ◎
                        </span>
                        <div className="min-w-0 pr-8">
                          <p className={`text-[15px] font-medium ${visualState.titleClassName}`}>{task.text}</p>
                          <div className="mt-1 flex min-h-[18px] items-end justify-between gap-3">
                            <div className="min-w-0 text-left pb-[2px]">
                              <div className="flex flex-wrap items-center gap-2">
                                {task.dueDate ? (
                                  <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                    {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                  </p>
                                ) : null}
                                {renderPriorityChip(task)}
                                {renderTaskTags(task)}
                              </div>
                            </div>
                          </div>
                        </div>
                        {task.subtasks.length > 0 ? (
                          <div className="pointer-events-none absolute bottom-3 right-2.5 flex items-center justify-end">
                            {renderSubtaskProgressDots(task.subtasks)}
                          </div>
                        ) : null}
                      </button>
                    </div>
                  )
                })}
              </section>
            ) : null}

            {roadmapSections.upcoming.length > 0 ? (
              <section>
                <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Upcoming</p>
                {renderRoadmapTaskGroups(sortedUpcomingTasks, 'upcoming', { groupedByTag: roadmapOrganizationMode === 'tag' }, (task) => {
                  const dueMeta = task.dueDate ? getRelativeDueMeta(task.dueDate) : null
                  const isSelected = selectedRoadmapTaskId === task.id
                  const visualState = getRoadmapTaskVisualState(task, 'upcoming', roadmapHighPriorityFocus)
                  const isCompressed = roadmapHighPriorityFocus && getPriorityScore(task) !== 3
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={(event) => {
                        setSelectedRoadmapTaskId(task.id)
                        openTaskPeek(task.id, event.currentTarget)
                      }}
                      onKeyDown={(event) => handleTaskRowKeyDown(event, task.id)}
                      draggable
                      onDragStart={() => setDraggedTaskId(task.id)}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (dragOverTaskId !== task.id) setDragOverTaskId(task.id)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        if (draggedTaskId) {
                          reorderGoalTask(selectedLifeGoal.id, draggedTaskId, task.id)
                        }
                        setDraggedTaskId(null)
                        setDragOverTaskId(null)
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null)
                        setDragOverTaskId(null)
                      }}
                      className={`relative grid w-full items-start gap-x-3 border-b border-white/[0.035] text-left transition-all duration-200 ease-out last:border-b-0 hover:border-white/[0.07] ${
                        isCompressed ? 'gap-y-0 py-1.5' : 'gap-y-1 py-3'
                      } ${
                        isSelected ? 'bg-white/[0.012]' : ''
                      } ${
                        dragOverTaskId === task.id && draggedTaskId && draggedTaskId !== task.id ? 'bg-white/[0.03]' : ''
                      }`}
                      style={{ ...visualState.rowStyle, opacity: visualState.opacity, gridTemplateColumns: roadmapNodeGridTemplate }}
                    >
                      <span aria-hidden="true" className={`pt-0.5 text-[16px] leading-none ${visualState.markerClassName}`}>
                        ○
                      </span>
                      <div className="min-w-0 pr-8">
                        <p className={`${isCompressed ? 'text-[14px] leading-5' : 'text-[15px]'} ${visualState.titleClassName} transition-all duration-200 ease-out`}>{task.text}</p>
                        <div className={`flex items-end justify-between gap-3 transition-all duration-200 ease-out ${isCompressed ? 'mt-0.5 min-h-[14px]' : 'mt-1 min-h-[18px]'}`}>
                          <div className="min-w-0 text-left pb-[2px]">
                            <div className={`flex flex-wrap items-center transition-all duration-200 ease-out ${isCompressed ? 'gap-1.5' : 'gap-2'}`}>
                              {task.dueDate ? (
                                <p className={`text-[12px] ${dueMeta?.toneClassName ?? visualState.metaClassName}`}>
                                  {dueMeta ? `${dueMeta.compactLabel} · ${formatTaskDueDate(task.dueDate)}` : formatTaskDueDate(task.dueDate)}
                                </p>
                              ) : null}
                              {!isCompressed ? renderPriorityChip(task) : null}
                              {!isCompressed ? renderTaskTags(task) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      {task.subtasks.length > 0 ? (
                        <div className="pointer-events-none absolute bottom-[17px] right-4 flex items-center justify-end">
                          {renderSubtaskProgressDots(task.subtasks)}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </section>
            ) : null}

            <section>
              <p className="pb-3 text-[11px] uppercase tracking-[0.18em] text-mist/56" style={roadmapContentInsetStyle}>Goal</p>
              <div className="grid items-start gap-x-3 border-b border-white/[0.035] py-3" style={{ gridTemplateColumns: roadmapNodeGridTemplate }}>
                <span aria-hidden="true" className="pt-0.5 text-[16px] leading-none text-white/84">
                  ◉
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-white/88">Goal</p>
                  <p className="mt-1 text-[12px] text-mist/58">Completion point</p>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-white/[0.05] pt-3">
            <button
              type="button"
              onClick={(event) => openNewTaskPeek(event.currentTarget)}
              className="text-sm text-white/62 transition hover:text-white/84"
            >
              + Add task
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-mist">No tasks yet. Add the first concrete step to build the roadmap.</p>
      )}
    </div>
  ) : null, [
    dragOverTaskId,
    draggedTaskId,
    handleTaskRowKeyDown,
    lifeGoalDetailTab,
    openNewTaskPeek,
    openTaskPeek,
    renderPriorityChip,
    renderRoadmapTaskGroups,
    renderSubtaskProgressDots,
    renderTaskTags,
    restoreTask,
    reorderGoalTask,
    roadmapArrivalCueActive,
    roadmapCompletedOpen,
    roadmapContentInsetStyle,
    roadmapHasHighPriorityTasks,
    roadmapHasTaggedTasks,
    roadmapHeaderControlActiveClass,
    roadmapHeaderControlBaseClass,
    roadmapHighPriorityFocus,
    roadmapLineColor,
    roadmapLineWidth,
    roadmapNodeGridTemplate,
    roadmapOrganizationMode,
    roadmapRailLeftStyle,
    roadmapRemainingCount,
    roadmapSections.completed,
    roadmapSections.current,
    roadmapSections.upcoming,
    roadmapSortControl,
    selectedLifeGoal.id,
    selectedGoalRuntimeTasks.length,
    selectedLifeGoalProgress.completedTaskItems.length,
    selectedRoadmapTaskId,
    setDragOverTaskId,
    setDraggedTaskId,
    setRoadmapCompletedOpen,
    setRoadmapHighPriorityFocus,
    setRoadmapOrganizationMode,
    setSelectedRoadmapTaskId,
    sortedCompletedTasks,
    sortedUpcomingTasks,
    taskMomentumTransition,
    visibleGoalStartCueTaskId,
  ])

  if (isRoadmapMode) {
    return (
      <motion.div
        key={`${selectedLifeGoal.id}-${lifeGoalDetailTab}`}
        className="w-full space-y-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLifeGoalDetailTab('focus')}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to Goal
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {detailHeaderRelationshipChips}
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="theme-page-title min-w-0 flex-1">
                  {inlineLifeGoalEditingField === 'title' ? inlineEditableTitle : inlineTitleDisplay}
                </h3>
                {showDetailCategory && selectedGoalCategory ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] leading-none text-white/70"
                    style={getLifeGoalCategoryChipStyle(selectedGoalCategoryColor)}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={getLifeGoalCategoryDotStyle(selectedGoalCategoryColor)} />
                    {selectedGoalCategory}
                  </span>
                ) : null}
                {renderParentGoalChips()}
              </div>
              {showDetailWhy && inlineLifeGoalEditingField === 'why' ? (
                <div className="mt-3 max-w-[44rem]">{inlineEditableWhy}</div>
              ) : showDetailWhy ? (
                <div className="mt-3 max-w-[44rem]">{inlineWhyDisplay}</div>
              ) : null}
            </div>
            <div className="theme-surface-soft inline-flex rounded-full border p-1">
              {([
                ['tasks', 'Tasks'],
                ['roadmap', 'Roadmap'],
              ] as Array<[LifeGoalDetailTab, string]>).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setLifeGoalDetailTab(tabId)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    lifeGoalDetailTab === tabId
                      ? 'theme-button-secondary'
                      : 'theme-text-muted hover:text-[rgb(var(--theme-text-primary-rgb))]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {lifeGoalDetailTab === 'tasks' ? tasksTabContent : roadmapTabContent}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeGoalsView(parentOverviewGoalsView)}
            className="theme-text-muted text-sm transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
          >
            ← Back to {isDirectionalGoal ? 'Directional Goals' : 'Outcome Goals'}
          </button>
          {isDirectionalGoal ? (
            <span className={`${goalHeaderChipClassName} border-white/[0.08] bg-white/[0.03] text-white/75`}>
              Direction
            </span>
          ) : null}
        </div>
        {isDirectionalGoal ? (
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
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {detailHeaderRelationshipChips}
            <Button
              variant="ghost"
              onClick={(event) => openEditLifeGoalComposer(selectedLifeGoal, event.currentTarget)}
            >
              Edit Goal
            </Button>
          </div>
        )}
      </div>

      {isDirectionalGoal ? (
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
      ) : (
        <div className="space-y-4">
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,1fr)]">
            <div
              className={`space-y-3 self-start xl:flex xl:flex-col xl:space-y-0 xl:gap-3 ${
                selectedLifeGoalVisionEditorOpen ? '' : 'xl:h-[78vh]'
              }`}
            >
              <LifeGoalFocusCard
                title={focusTitleContent}
                categoryChip={focusCategoryChip}
                primaryChip={null}
                statusChip={focusStatusChip}
                whyContent={focusWhyContent}
                nextTaskText={
                  selectedLifeGoal.status === 'complete'
                    ? 'You finished every step in this goal.'
                    : goalReadyToComplete
                      ? 'Everything is complete. Mark the goal finished when you are ready.'
                      : selectedLifeGoalProgress.nextTask?.text ?? 'No next task currently planned.'
                }
                actionFeedback={lifeGoalActionFeedback}
                primaryActionLabel={goalReadyToComplete ? 'Complete goal' : selectedLifeGoalProgress.nextTask ? 'Done — continue' : undefined}
                completeNextVisualState={completeNextVisualState}
                nextTaskVisualState={nextTaskVisualState}
                onPrimaryAction={primaryFocusAction}
                onFocusToday={handleFocusToday}
                showExecutionSection={!isDirectionalGoal}
              />

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

            <LifeGoalRoadmapPanel
            data={roadmapPanelData}
            actions={selectedRoadmapPanelActions}
            uiState={selectedRoadmapPanelUiState}
          />
            {relatedGoals.length > 0 ? linkedGoalsSection : null}
          </div>

          {supportingHabits.length > 0 ? supportingHabitsSection : null}

          {isOutcomeGoal && showDetailMetrics ? <GoalProgressTimelineChart
            tasks={selectedGoalRuntimeTasks}
            goalStartDate={selectedLifeGoal.startDate}
            goalCreatedAt={selectedLifeGoal.createdAt}
            goalTargetDate={selectedLifeGoal.targetDate}
            showExpectedProgressDefault={selectedLifeGoal.showExpectedProgressLine !== false}
            onShowExpectedProgressChange={(value) =>
              onUpdateLifeGoal(selectedLifeGoal.id, (goal) => ({
                ...goal,
                showExpectedProgressLine: value,
                updatedAt: new Date().toISOString(),
              }))
            }
          /> : null}
        </div>
      )}
      {milestoneDatePicker}
    </motion.div>
  )
})
