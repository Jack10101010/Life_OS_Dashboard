import { AnimatePresence, motion } from 'framer-motion'
import { memo, RefObject, useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { FloatingPanelPosition, ModalSurface, OverlayBackdrop, OverlayRoot, PopoverSurface, DialogSurface } from '../../../components/layout/OverlayPrimitives'
import { LifeGoalTask, LifeGoalTaskPriority } from '../../../types'

const PLAIN_TEXT_BULLET_PREFIXES = ['- ', '• '] as const

type DeleteConfirmation =
  | { kind: 'task'; taskId: string }
  | { kind: 'subtask'; taskId: string; subtaskId: string; subtaskText: string }
  | null

type LifeGoalTaskPeekProps = {
  data: {
    task: LifeGoalTask | null
    activeSubtasks: LifeGoalTask['subtasks']
    completedSubtasks: LifeGoalTask['subtasks']
    datePanelPosition: FloatingPanelPosition | null
    dateViewMonth: Date
    priorityOptions: Array<{ value: LifeGoalTaskPriority; label: string }>
    milestoneOptions: Array<{ value: string; label: string }>
    showMilestoneField: boolean
    lockedMilestoneLabel: string | null
    relativeDueMeta: { label: string; compactLabel: string; toneClassName: string } | null
    weekdayLabels: readonly string[]
    todayIsoDate: string
  }
  uiState: {
    open: boolean
    completedSubtasksOpen: boolean
    subtaskEntryOpen: boolean
    subtaskDraft: string
    notesOpen: boolean
    datePickerOpen: boolean
    deleteConfirmation: DeleteConfirmation
    canMarkAsNext: boolean
    draggedSubtaskId: string | null
    dragOverSubtaskId: string | null
  }
  refs: {
    panelRef: RefObject<HTMLDivElement | null>
    titleRef: RefObject<HTMLTextAreaElement | null>
    dateFieldRef: RefObject<HTMLDivElement | null>
    datePanelRef: RefObject<HTMLDivElement | null>
    subtaskDraftRef: RefObject<HTMLInputElement | null>
    deleteDialogRef: RefObject<HTMLDivElement | null>
  }
  actions: {
    setCompletedSubtasksOpen: (value: boolean | ((current: boolean) => boolean)) => void
    setSubtaskEntryOpen: (value: boolean) => void
    setSubtaskDraft: (value: string) => void
    setNotesOpen: (value: boolean) => void
    setTaskDeleteConfirmation: (value: DeleteConfirmation) => void
    onClose: () => void
    onTitleChange: (value: string) => void
    onDescriptionChange: (value: string) => void
    onNotesChange: (value: string) => void
    onMilestoneChange: (value: string | null) => void
    onPriorityChange: (value: LifeGoalTaskPriority) => void
    tagDraft: string
    setTagDraft: (value: string) => void
    onTagKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
    onAddTag: () => void
    onRemoveTag: (tag: string) => void
    onOpenDatePicker: () => void
    onCloseDatePicker: () => void
    onApplyDate: (value: string) => void
    onShiftDateMonth: (delta: number) => void
    getCalendarDays: (date: Date) => Date[]
    formatCalendarDayValue: (date: Date) => string
    formatCalendarMonthLabel: (date: Date) => string
    formatDate: (date: string) => string
    formatTaskDueDate: (date: string) => string
    formatTaskCompletedDate: (date: string) => string
    setSubtaskInputRef: (id: string, element: HTMLInputElement | null) => void
    onSubtaskTextChange: (id: string, value: string) => void
    onSubtaskKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, id: string) => void
    onSubtaskToggle: (id: string, source?: HTMLElement) => void
    onSubtaskRemoveRequest: (subtaskId: string, subtaskText: string) => void
    onSubtaskReorderStart: (id: string) => void
    onSubtaskReorderOver: (event: React.DragEvent<HTMLDivElement>, id: string) => void
    onSubtaskReorderDrop: (event: React.DragEvent<HTMLDivElement>, id: string) => void
    onSubtaskReorderEnd: () => void
    onAddSubtask: () => void
    onToggleDeleteConfirmation: (kind: 'task') => void
    onSetAsNext: () => void
    onRestoreTask: (source: HTMLElement) => void
    onCompleteNext: (source: HTMLElement) => void
    onCompleteTask: (source: HTMLElement) => void
    onConfirmDelete: () => void
  }
}

export const LifeGoalTaskPeek = memo(function LifeGoalTaskPeek({
  data,
  uiState,
  refs,
  actions,
}: LifeGoalTaskPeekProps) {
  const task = data.task
  const notesRef = useRef<HTMLTextAreaElement | null>(null)
  const taskActionsRef = useRef<HTMLDivElement | null>(null)
  const [taskActionsOpen, setTaskActionsOpen] = useState(false)
  const taskDescription = task?.description ?? ''
  const taskNotes = task?.notes ?? ''
  const taskId = task?.id ?? null

  const autosizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }

  const handlePlainTextBulletKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    onChange: (value: string) => void,
  ) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    ) {
      return
    }

    const textarea = event.currentTarget
    const { value, selectionStart, selectionEnd } = textarea
    if (selectionStart !== selectionEnd) return

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const nextLineBreakIndex = value.indexOf('\n', selectionStart)
    const lineEnd = nextLineBreakIndex === -1 ? value.length : nextLineBreakIndex
    const currentLine = value.slice(lineStart, lineEnd)
    const bulletPrefix = PLAIN_TEXT_BULLET_PREFIXES.find((prefix) => currentLine.startsWith(prefix))

    if (!bulletPrefix) return

    event.preventDefault()

    if (currentLine === bulletPrefix) {
      const nextValue = value.slice(0, lineStart) + value.slice(lineEnd)
      onChange(nextValue)
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(lineStart, lineStart)
      })
      return
    }

    const nextValue = `${value.slice(0, selectionStart)}\n${bulletPrefix}${value.slice(selectionEnd)}`
    const nextCaretPosition = selectionStart + 1 + bulletPrefix.length
    onChange(nextValue)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition)
    })
  }

  useEffect(() => {
    if (!uiState.open || !taskId) return
    const trimmedDescription = taskDescription.trim()
    if (!trimmedDescription) return

    const trimmedNotes = taskNotes.trim()
    const mergedNotes = trimmedNotes
      ? trimmedNotes.includes(trimmedDescription)
        ? taskNotes
        : `${trimmedDescription}\n\n${taskNotes}`
      : taskDescription

    if (mergedNotes !== taskNotes) {
      actions.onNotesChange(mergedNotes)
    }

    actions.onDescriptionChange('')
  }, [actions, taskDescription, taskId, taskNotes, uiState.open])

  useEffect(() => {
    if (!uiState.open || !taskId) return
    autosizeTextarea(notesRef.current)
  }, [taskId, taskNotes, uiState.open])

  useEffect(() => {
    if (!taskActionsOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!taskActionsRef.current?.contains(event.target as Node)) {
        setTaskActionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [taskActionsOpen])

  if (!uiState.open || !task) return null

  return (
    <>
      <OverlayRoot open={uiState.open}>
        <>
          <OverlayBackdrop zIndexClassName="z-[1000]" className="bg-black/44 backdrop-blur-[3px]" onClick={actions.onClose} />
          <ModalSurface
            zIndexClassName="z-[1010]"
            containerClassName="grid place-items-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8"
            panelClassName="theme-popover relative mx-auto w-[min(920px,calc(100vw-2rem))] max-w-[920px] overflow-hidden rounded-[32px] border border-white/[0.055] bg-[rgb(var(--theme-surface-elevated-rgb)/0.965)] shadow-[0_34px_96px_rgba(15,23,42,0.24)] sm:w-[min(920px,calc(100vw-3rem))]"
            onBackdropClick={actions.onClose}
          >
            <div ref={refs.panelRef} role="dialog" aria-modal="true" aria-label="Task detail">
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.055] px-7 py-5">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/58">Task detail</p>
                  <p className="mt-2 text-[13px] leading-6 text-mist/48">
                    Tighten the details, timing, and next actions without losing execution flow.
                  </p>
                </div>
                <div className="flex items-center gap-2" ref={taskActionsRef}>
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={taskActionsOpen}
                      onClick={() => setTaskActionsOpen((current) => !current)}
                      className="theme-button-secondary inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm transition"
                    >
                      •••
                    </button>
                    {taskActionsOpen ? (
                      <div className="theme-popover absolute right-0 top-[calc(100%+8px)] z-40 min-w-[164px] overflow-hidden rounded-[18px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.98)] p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.28)]">
                        <button
                          type="button"
                          onClick={() => {
                            setTaskActionsOpen(false)
                            actions.onToggleDeleteConfirmation('task')
                          }}
                          className="flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-sm text-[rgb(var(--theme-negative-rgb)/0.82)] transition hover:bg-[rgb(var(--theme-negative-rgb)/0.1)] hover:text-[rgb(var(--theme-negative-rgb)/0.96)]"
                        >
                          Delete task
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={actions.onClose}
                    className="theme-button-secondary inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="max-h-[min(78vh,760px)] overflow-y-auto overscroll-contain px-7 py-5 pb-20">
                <div className="grid gap-5 lg:items-stretch lg:grid-cols-[minmax(0,1.32fr)_minmax(272px,0.68fr)]">
                  <div className="space-y-4.5">
                    <div className="max-w-[34rem] space-y-1.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Task</p>
                      <textarea
                        ref={refs.titleRef}
                        value={task.text}
                        onChange={(event) => actions.onTitleChange(event.target.value)}
                        rows={2}
                        spellCheck={true}
                        className="w-full resize-none overflow-hidden bg-transparent text-[21px] font-semibold leading-[1.22] text-white outline-none placeholder:text-white/24"
                        placeholder="Task title"
                      />
                    </div>

                    <div className="border-t border-white/[0.04] pt-4">
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Notes & details</p>
                      <textarea
                        ref={notesRef}
                        value={task.notes}
                        onChange={(event) => actions.onNotesChange(event.target.value)}
                        onKeyDown={(event) => handlePlainTextBulletKeyDown(event, actions.onNotesChange)}
                        onInput={(event) => autosizeTextarea(event.currentTarget)}
                        rows={4}
                        spellCheck={true}
                        className="theme-input w-full resize-none overflow-hidden rounded-[20px] border border-white/[0.03] bg-white/[0.01] px-4 py-2.5 text-sm leading-6 outline-none"
                        placeholder="Context, details, reminders..."
                      />
                    </div>
                    </div>

                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Subtasks</p>
                        <p className="text-[11px] text-mist/42">{data.completedSubtasks.length}/{task.subtasks.length}</p>
                      </div>
                      <div className="space-y-1.5">
                        {data.activeSubtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            draggable
                            onDragStart={() => actions.onSubtaskReorderStart(subtask.id)}
                            onDragOver={(event) => actions.onSubtaskReorderOver(event, subtask.id)}
                            onDrop={(event) => actions.onSubtaskReorderDrop(event, subtask.id)}
                            onDragEnd={actions.onSubtaskReorderEnd}
                            className={`group grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] border border-white/[0.03] bg-white/[0.014] px-3 py-2 transition hover:bg-white/[0.026] focus-within:bg-white/[0.026] focus-within:ring-1 focus-within:ring-white/[0.05] ${
                              uiState.dragOverSubtaskId === subtask.id && uiState.draggedSubtaskId && uiState.draggedSubtaskId !== subtask.id ? 'bg-white/[0.045]' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(event) => actions.onSubtaskToggle(subtask.id, event.currentTarget)}
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${
                                subtask.completed
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.95)] bg-[rgb(var(--theme-accent-rgb)/0.95)] shadow-[0_0_0_1px_rgb(var(--theme-accent-rgb)/0.12)]'
                                  : 'border-white/[0.22] bg-transparent hover:border-white/[0.34]'
                              }`}
                              aria-label={subtask.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                            >
                              {subtask.completed ? <span aria-hidden="true" className="text-[10px] text-black/80">✓</span> : null}
                            </button>
                            <input
                              ref={(element) => actions.setSubtaskInputRef(subtask.id, element)}
                              value={subtask.text}
                              onChange={(event) => actions.onSubtaskTextChange(subtask.id, event.target.value)}
                              onKeyDown={(event) => actions.onSubtaskKeyDown(event, subtask.id)}
                              spellCheck={true}
                              className="w-full bg-transparent text-sm font-medium leading-5 text-white/88 outline-none placeholder:text-white/24"
                              placeholder="Subtask"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (subtask.completed) {
                                  actions.onSubtaskToggle(subtask.id)
                                  return
                                }
                                actions.onSubtaskRemoveRequest(subtask.id, subtask.text)
                              }}
                              className={`text-xs uppercase tracking-[0.14em] transition ${
                                subtask.completed
                                  ? 'text-[rgb(var(--theme-info-rgb)/0.62)] opacity-100 hover:text-[rgb(var(--theme-info-rgb)/0.9)]'
                                  : 'text-[rgb(var(--theme-negative-rgb)/0.46)] opacity-0 hover:text-[rgb(var(--theme-negative-rgb)/0.72)] focus:opacity-100 group-hover:opacity-100'
                              }`}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <div className={data.activeSubtasks.length > 0 ? 'mt-2.5 border-t border-white/[0.04] pt-3' : 'pt-1'}>
                          {uiState.subtaskEntryOpen ? (
                            <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-white/[0.045] bg-white/[0.012] px-3 py-2">
                              <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px] text-white/38">
                                +
                              </span>
                              <input
                                ref={refs.subtaskDraftRef}
                                value={uiState.subtaskDraft}
                                onChange={(event) => actions.setSubtaskDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                                    event.preventDefault()
                                    actions.onAddSubtask()
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault()
                                    actions.setSubtaskDraft('')
                                    actions.setSubtaskEntryOpen(false)
                                  }
                                }}
                                spellCheck={true}
                                className="w-full bg-transparent text-sm leading-5 text-white/88 outline-none placeholder:text-white/24"
                                placeholder="Add subtask"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => actions.setSubtaskEntryOpen(true)}
                            className="grid w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] border border-dashed border-white/[0.05] bg-white/[0.012] px-3 py-2 text-left text-sm text-white/30 transition hover:border-white/[0.08] hover:bg-white/[0.018] hover:text-white/46"
                          >
                            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px] text-white/38">
                              +
                            </span>
                              <span>Add subtask</span>
                            </button>
                          )}
                        </div>
                        {data.completedSubtasks.length > 0 ? (
                          <div className="mt-2">
                            <div className="mt-4 border-t border-white/[0.06] pt-[10px]">
                              <button
                                type="button"
                                onClick={() => actions.setCompletedSubtasksOpen((current) => !current)}
                                className="flex w-full items-center justify-between gap-3 rounded-[14px] px-3 py-1.5 text-left text-[11px] uppercase tracking-[0.08em] text-mist/75 transition hover:bg-white/[0.02] hover:text-white/54"
                              >
                                <span>Completed ({data.completedSubtasks.length})</span>
                                <span className="text-white/30">{uiState.completedSubtasksOpen ? '−' : '+'}</span>
                              </button>
                              <AnimatePresence initial={false}>
                                {uiState.completedSubtasksOpen ? (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0, y: -4 }}
                                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                                    exit={{ opacity: 0, height: 0, y: -4 }}
                                    transition={{ duration: 0.16, ease: 'easeOut' }}
                                    className="overflow-hidden"
                                  >
                                    <div className="mt-1 space-y-1 opacity-70">
                                      {data.completedSubtasks.map((subtask) => (
                                        <div
                                          key={subtask.id}
                                          className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[12px] border border-white/[0.024] bg-white/[0.01] px-3 py-2"
                                        >
                                          <span aria-hidden="true" className="text-[12px] leading-none text-white/34">
                                            ✓
                                          </span>
                                          <p className="truncate text-[13px] leading-5 text-white/42 line-through decoration-white/[0.18]">{subtask.text}</p>
                                          <button
                                            type="button"
                                            onClick={(event) => actions.onSubtaskToggle(subtask.id, event.currentTarget)}
                                            className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.54)] transition hover:text-[rgb(var(--theme-info-rgb)/0.82)]"
                                          >
                                            Restore
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[24px] border border-white/[0.05] bg-white/[0.018] px-4 py-4 lg:h-full">
                    <div className="space-y-3">
                      {data.lockedMilestoneLabel ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Milestone</p>
                          <div className="rounded-[18px] border border-white/[0.05] bg-white/[0.022] px-3 py-2">
                            <p className="text-[11px] text-mist/48">Adding to:</p>
                            <p className="mt-1 text-sm text-white/82">{data.lockedMilestoneLabel}</p>
                          </div>
                        </div>
                      ) : null}

                      {data.showMilestoneField && !data.lockedMilestoneLabel ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Milestone</p>
                          <div className="relative">
                            <select
                              value={task.milestoneId ?? ''}
                              onChange={(event) => actions.onMilestoneChange(event.target.value || null)}
                              className="theme-input w-full appearance-none rounded-[18px] border px-3 py-1.5 pr-9 text-sm outline-none"
                            >
                              {data.milestoneOptions.map((option) => (
                                <option key={option.value || 'none'} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <span className="theme-text-faint pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">▾</span>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Due date</p>
                      <div ref={refs.dateFieldRef} className="relative">
                        <button
                          type="button"
                          onClick={actions.onOpenDatePicker}
                          className="theme-input flex w-full items-center justify-between gap-2.5 rounded-[18px] border px-3 py-1.5 text-left text-sm transition"
                        >
                          <span className={task.dueDate ? 'theme-text-primary' : 'theme-text-muted'}>
                            {task.dueDate ? actions.formatDate(task.dueDate) : 'Optional due date'}
                          </span>
                          <span className="theme-text-faint text-xs">▾</span>
                        </button>

                        <OverlayRoot open={uiState.datePickerOpen && Boolean(data.datePanelPosition)}>
                          {uiState.datePickerOpen && data.datePanelPosition ? (
                            <PopoverSurface
                              position={data.datePanelPosition}
                              zIndexClassName="z-[1020]"
                              className="theme-popover overflow-hidden rounded-[24px] border p-3 shadow-[0_22px_46px_rgba(15,23,42,0.18)]"
                            >
                              <div ref={refs.datePanelRef}>
                                <div className="flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => actions.onShiftDateMonth(-1)}
                                    className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                  >
                                    Prev
                                  </button>
                                  <p className="theme-text-primary text-sm font-medium">{actions.formatCalendarMonthLabel(data.dateViewMonth)}</p>
                                  <button
                                    type="button"
                                    onClick={() => actions.onShiftDateMonth(1)}
                                    className="theme-text-muted rounded-full border border-[rgb(var(--theme-border-subtle-rgb))] px-2.5 py-1.5 text-xs transition hover:border-[rgb(var(--theme-border-strong-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                  >
                                    Next
                                  </button>
                                </div>

                                <div className="mt-3 grid grid-cols-7 gap-1.5">
                                  {data.weekdayLabels.map((day) => (
                                    <div key={day} className="theme-text-faint px-1 py-1 text-center text-[11px] uppercase tracking-[0.12em]">
                                      {day}
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-1 grid grid-cols-7 gap-1.5">
                                  {actions.getCalendarDays(data.dateViewMonth).map((day) => {
                                    const dayValue = actions.formatCalendarDayValue(day)
                                    const inCurrentMonth = day.getUTCMonth() === data.dateViewMonth.getUTCMonth()
                                    const isSelected = dayValue === (task.dueDate ?? '')
                                    const isToday = dayValue === data.todayIsoDate

                                    return (
                                      <button
                                        key={dayValue}
                                        type="button"
                                        onClick={() => actions.onApplyDate(dayValue)}
                                        className={`rounded-2xl border px-0 py-2 text-center text-sm transition ${
                                          isSelected
                                            ? 'border-[rgb(var(--theme-info-rgb)/0.28)] bg-[rgb(var(--theme-info-rgb)/0.12)] text-[rgb(var(--theme-text-primary-rgb))]'
                                            : isToday
                                              ? 'border-[rgb(var(--theme-border-strong-rgb))] bg-[rgb(var(--theme-surface-soft-rgb))] text-[rgb(var(--theme-text-primary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-elevated-rgb))]'
                                              : inCurrentMonth
                                                ? 'border-[rgb(var(--theme-border-subtle-rgb)/0.75)] bg-transparent text-[rgb(var(--theme-text-secondary-rgb))] hover:border-[rgb(var(--theme-border-strong-rgb))] hover:bg-[rgb(var(--theme-surface-soft-rgb))] hover:text-[rgb(var(--theme-text-primary-rgb))]'
                                                : 'border-transparent bg-transparent text-[rgb(var(--theme-text-faint-rgb))] hover:border-[rgb(var(--theme-border-subtle-rgb)/0.55)] hover:bg-[rgb(var(--theme-surface-soft-rgb)/0.6)]'
                                        }`}
                                      >
                                        {day.getUTCDate()}
                                      </button>
                                    )
                                  })}
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[rgb(var(--theme-border-subtle-rgb)/0.7)] pt-3">
                                  <button
                                    type="button"
                                    onClick={() => actions.onApplyDate(data.todayIsoDate)}
                                    className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                  >
                                    Today
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => actions.onApplyDate('')}
                                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={actions.onCloseDatePicker}
                                      className="theme-text-muted rounded-full px-2 py-1 text-xs transition hover:text-[rgb(var(--theme-text-primary-rgb))]"
                                    >
                                      Done
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </PopoverSurface>
                          ) : null}
                        </OverlayRoot>
                      </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Priority</p>
                      <div className="flex w-full flex-nowrap gap-1 rounded-[18px] bg-white/[0.02] p-1">
                        {data.priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => actions.onPriorityChange(option.value)}
                            className={`inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-full border px-2 text-[10px] uppercase tracking-[0.12em] transition ${
                              task.priority === option.value
                                ? option.value === 'high'
                                  ? 'border-[rgb(var(--theme-negative-rgb)/0.28)] bg-[rgb(var(--theme-negative-rgb)/0.08)] text-[rgb(var(--theme-negative-rgb)/0.95)]'
                                  : 'border-white/[0.12] bg-white/[0.08] text-white'
                                : 'border-white/[0.05] bg-white/[0.02] text-white/56 hover:text-white/78'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">Tags</p>
                      <div className="rounded-[18px] border border-white/[0.045] bg-white/[0.02] px-3 py-2 transition focus-within:border-white/[0.08] focus-within:bg-white/[0.025]">
                        {task.tags.length > 0 ? (
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {task.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] tracking-[0.04em] text-white/62"
                              >
                                <span>{tag}</span>
                                <button
                                  type="button"
                                  onClick={() => actions.onRemoveTag(tag)}
                                  className="text-white/42 transition hover:text-white/74"
                                  aria-label={`Remove ${tag} tag`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <input
                            value={actions.tagDraft}
                            onChange={(event) => actions.setTagDraft(event.target.value)}
                            onKeyDown={actions.onTagKeyDown}
                            spellCheck={false}
                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/24"
                            placeholder="Add tag..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] leading-4 text-mist/34">
                      <p className={task.dueDate ? `${data.relativeDueMeta?.toneClassName ?? 'text-white/40'} text-[11px]` : 'text-white/40'}>
                        {task.completedAt
                          ? `Completed ${actions.formatTaskCompletedDate(task.completedAt)}`
                          : task.dueDate
                            ? data.relativeDueMeta
                              ? `${data.relativeDueMeta.label} · ${actions.formatTaskDueDate(task.dueDate)}`
                              : `Due ${actions.formatTaskDueDate(task.dueDate)}`
                            : 'No due date set'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.055] bg-[rgb(var(--theme-surface-elevated-rgb)/0.972)] px-7 py-3.5 backdrop-blur-[8px]">
                <p className="text-[12px] text-mist/38">Changes saved automatically</p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {task.completed ? (
                    <Button variant="ghost" className="px-3.5 py-2 text-sm" onClick={(event) => actions.onRestoreTask(event.currentTarget)}>
                      Restore task
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="soft"
                        className="px-4 py-2 text-sm border-[rgb(var(--theme-accent-rgb)/0.18)] !text-[rgb(var(--theme-accent-rgb))] hover:border-[rgb(var(--theme-accent-rgb)/0.28)] hover:!text-[rgb(var(--theme-accent-rgb))]"
                        style={{
                          borderColor: 'rgb(var(--theme-accent-rgb) / 0.18)',
                          backgroundColor: 'rgb(var(--theme-accent-rgb) / 0.08)',
                          color: 'rgb(var(--theme-accent-rgb))',
                        }}
                        onClick={(event) => actions.onCompleteTask(event.currentTarget)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span aria-hidden="true" className="text-[13px] leading-none">✓</span>
                          <span>Mark complete</span>
                        </span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ModalSurface>
        </>
      </OverlayRoot>

      <OverlayRoot open={Boolean(uiState.deleteConfirmation)}>
        {uiState.deleteConfirmation ? (
          <>
            <OverlayBackdrop
              zIndexClassName="z-[1100]"
              className="bg-black/62 backdrop-blur-[5px]"
              onClick={() => actions.setTaskDeleteConfirmation(null)}
            />
            <DialogSurface
              zIndexClassName="z-[1110]"
              panelClassName="theme-popover w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb)/0.985)] shadow-[0_30px_80px_rgba(0,0,0,0.34)]"
              onBackdropClick={() => actions.setTaskDeleteConfirmation(null)}
            >
              <div ref={refs.deleteDialogRef} role="dialog" aria-modal="true" aria-label={uiState.deleteConfirmation.kind === 'subtask' ? 'Delete subtask' : 'Delete task'}>
                <div className="border-b border-white/[0.07] px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/56">
                        {uiState.deleteConfirmation.kind === 'subtask' ? 'Delete subtask' : 'Delete task'}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {uiState.deleteConfirmation.kind === 'subtask' ? 'Delete subtask?' : 'Delete task?'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => actions.setTaskDeleteConfirmation(null)}
                      className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.12] hover:text-white/76"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="space-y-5 px-6 py-5">
                  <p className="theme-text-muted text-sm leading-6">
                    {uiState.deleteConfirmation.kind === 'subtask'
                      ? 'This will permanently delete this subtask. This action cannot be undone.'
                      : 'This will permanently delete the task and its related details. This action cannot be undone.'}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => actions.setTaskDeleteConfirmation(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="ghost"
                      className="theme-danger-soft hover:border-[rgb(var(--theme-negative-rgb)/0.38)] hover:bg-[rgb(var(--theme-negative-rgb)/0.12)] hover:text-[rgb(var(--theme-negative-rgb)/0.98)]"
                      style={{
                        borderColor: 'rgb(var(--theme-negative-rgb) / 0.28)',
                        backgroundColor: 'rgb(var(--theme-negative-rgb) / 0.08)',
                      }}
                      onClick={actions.onConfirmDelete}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </DialogSurface>
          </>
        ) : null}
      </OverlayRoot>
    </>
  )
})
