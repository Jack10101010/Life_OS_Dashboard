import { AnimatePresence, motion } from 'framer-motion'
import { RefObject } from 'react'
import { Button } from '../../../components/ui/Button'
import { FloatingPanelPosition, ModalSurface, OverlayBackdrop, OverlayRoot, PopoverSurface, DialogSurface } from '../../../components/layout/OverlayPrimitives'
import { LifeGoalTask, LifeGoalTaskPriority } from '../../../types'
import { LIFE_GOAL_PHASE_OPTIONS } from '../lib/taskDerivations'

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
    phaseFieldRef: RefObject<HTMLSelectElement | null>
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
    onPhaseChange: (value: string) => void
    onPriorityChange: (value: LifeGoalTaskPriority) => void
    onTagsChange: (value: string) => void
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

export function LifeGoalTaskPeek({
  data,
  uiState,
  refs,
  actions,
}: LifeGoalTaskPeekProps) {
  const task = data.task

  if (!uiState.open || !task) return null

  return (
    <>
      <OverlayRoot open={uiState.open}>
        <>
          <OverlayBackdrop zIndexClassName="z-[1000]" className="bg-black/44 backdrop-blur-[3px]" onClick={actions.onClose} />
          <ModalSurface
            zIndexClassName="z-[1010]"
            containerClassName="grid place-items-center overflow-hidden px-4 py-6 sm:px-6 sm:py-8"
            panelClassName="theme-popover relative mx-auto w-[min(920px,calc(100vw-2rem))] max-w-[920px] overflow-hidden rounded-[30px] border border-white/[0.06] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.34)] sm:w-[min(920px,calc(100vw-3rem))]"
            onBackdropClick={actions.onClose}
          >
            <div ref={refs.panelRef} role="dialog" aria-modal="true" aria-label="Task detail">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-6 py-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-mist/62">Task detail</p>
                </div>
                <button
                  type="button"
                  onClick={actions.onClose}
                  className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/58 transition hover:border-white/[0.1] hover:text-white/78"
                >
                  Close
                </button>
              </div>

              <div className="max-h-[min(78vh,760px)] overflow-y-auto overscroll-contain px-6 py-3.5 pb-20">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)]">
                  <div className="space-y-3.5">
                    <div className="max-w-[34rem] space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Task</p>
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

                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Description</p>
                      <textarea
                        value={task.description}
                        onChange={(event) => actions.onDescriptionChange(event.target.value)}
                        rows={2}
                        spellCheck={true}
                        className="w-full resize-none rounded-[20px] border border-white/[0.05] bg-white/[0.025] px-4 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/24"
                        placeholder="Short context for the task..."
                      />
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Subtasks</p>
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
                            className={`group grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 transition hover:bg-white/[0.03] focus-within:bg-white/[0.03] focus-within:ring-1 focus-within:ring-white/[0.06] ${
                              uiState.dragOverSubtaskId === subtask.id && uiState.draggedSubtaskId && uiState.draggedSubtaskId !== subtask.id ? 'bg-white/[0.045]' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={(event) => actions.onSubtaskToggle(subtask.id, event.currentTarget)}
                              className={`h-[17px] w-[17px] shrink-0 rounded-full border transition ${
                                subtask.completed
                                  ? 'border-[rgb(var(--theme-accent-rgb)/0.95)] bg-[rgb(var(--theme-accent-rgb)/0.95)]'
                                  : 'border-white/[0.22] bg-transparent hover:border-white/[0.34]'
                              }`}
                              aria-label={subtask.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                            />
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
                        {data.completedSubtasks.length > 0 ? (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => actions.setCompletedSubtasksOpen((current) => !current)}
                              className="flex w-full items-center justify-between gap-3 rounded-[14px] px-2 py-1 text-left text-[11px] uppercase tracking-[0.14em] text-mist/46 transition hover:bg-white/[0.02] hover:text-white/64"
                            >
                              <span>Completed ({data.completedSubtasks.length})</span>
                              <span className="text-white/34">{uiState.completedSubtasksOpen ? '−' : '+'}</span>
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
                                  <div className="mt-1 space-y-0.5">
                                    {data.completedSubtasks.map((subtask) => (
                                      <div
                                        key={subtask.id}
                                        className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[12px] px-2 py-1.5"
                                      >
                                        <span aria-hidden="true" className="text-[12px] leading-none text-white/36">
                                          ✓
                                        </span>
                                        <p className="truncate text-[13px] leading-5 text-white/42">{subtask.text}</p>
                                        <button
                                          type="button"
                                          onClick={(event) => actions.onSubtaskToggle(subtask.id, event.currentTarget)}
                                          className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.58)] transition hover:text-[rgb(var(--theme-info-rgb)/0.88)]"
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
                        ) : null}
                        {uiState.subtaskEntryOpen ? (
                          <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 ring-1 ring-white/[0.06]">
                            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px] text-white/44">
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
                              className="w-full bg-transparent text-sm leading-5 text-white outline-none placeholder:text-white/24"
                              placeholder="Add subtask"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => actions.setSubtaskEntryOpen(true)}
                            className="grid w-full grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-[14px] px-2.5 py-1.5 text-left text-sm text-white/48 transition hover:bg-white/[0.03] hover:text-white/72"
                          >
                            <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center text-[14px]">
                              +
                            </span>
                            <span>Add subtask</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {uiState.notesOpen ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Notes</p>
                          {task.notes.trim() ? null : (
                            <button
                              type="button"
                              onClick={() => actions.setNotesOpen(false)}
                              className="text-[11px] uppercase tracking-[0.14em] text-white/40 transition hover:text-white/66"
                            >
                              Hide
                            </button>
                          )}
                        </div>
                          <textarea
                            value={task.notes}
                            onChange={(event) => actions.onNotesChange(event.target.value)}
                          rows={4}
                          spellCheck={true}
                          className="w-full resize-none rounded-[20px] border border-white/[0.05] bg-white/[0.025] px-4 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/24"
                          placeholder="Optional notes..."
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => actions.setNotesOpen(true)}
                        className="inline-flex items-center rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white/54 transition hover:border-white/[0.1] hover:text-white/74"
                      >
                        Add notes
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 border-t border-white/[0.05] pt-2.5 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Phase</p>
                      <select
                        ref={refs.phaseFieldRef}
                        value={task.phase?.trim() ? task.phase : 'General'}
                        onChange={(event) => actions.onPhaseChange(event.target.value)}
                        className="w-full rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/24"
                      >
                        {LIFE_GOAL_PHASE_OPTIONS.map((option) => (
                          <option key={option} value={option} className="bg-[rgb(var(--theme-surface-elevated-rgb))] text-white">
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Due date</p>
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

                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Priority</p>
                      <div className="inline-flex flex-wrap gap-1 rounded-[18px] bg-white/[0.02] p-1">
                        {data.priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => actions.onPriorityChange(option.value)}
                            className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] uppercase tracking-[0.12em] transition ${
                              task.priority === option.value
                                ? 'border-white/[0.12] bg-white/[0.08] text-white'
                                : 'border-white/[0.05] bg-white/[0.02] text-white/56 hover:text-white/78'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-mist/58">Tags</p>
                      <input
                        value={task.tags.join(', ')}
                        onChange={(event) => actions.onTagsChange(event.target.value)}
                        spellCheck={false}
                        className="w-full rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/24"
                        placeholder="Focus, Deep work"
                      />
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

              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[rgb(var(--theme-surface-elevated-rgb)/0.985)] px-6 py-2 shadow-[0_-10px_20px_rgba(0,0,0,0.12)] backdrop-blur-[10px]">
                <p className="max-w-[16rem] text-[10px] leading-3.5 text-mist/38">Enter confirms text changes and creates subtasks. Completion requires explicit action.</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="ghost"
                    className="theme-danger-soft border-[rgb(var(--theme-negative-rgb)/0.2)] bg-[rgb(var(--theme-negative-rgb)/0.08)] text-[rgb(var(--theme-negative-rgb)/0.88)] hover:border-[rgb(var(--theme-negative-rgb)/0.34)] hover:bg-[rgb(var(--theme-negative-rgb)/0.12)]"
                    onClick={() => actions.onToggleDeleteConfirmation('task')}
                  >
                    Delete task
                  </Button>
                  {!task.completed && uiState.canMarkAsNext ? (
                    <Button variant="ghost" onClick={actions.onSetAsNext}>
                      Mark as next
                    </Button>
                  ) : null}
                  {task.completed ? (
                    <Button variant="ghost" onClick={(event) => actions.onRestoreTask(event.currentTarget)}>
                      Restore task
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={(event) => actions.onCompleteNext(event.currentTarget)}>
                        Complete + next
                      </Button>
                      <Button variant="soft" onClick={(event) => actions.onCompleteTask(event.currentTarget)}>
                        Complete task
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
                      className="theme-danger-soft border-[rgb(var(--theme-negative-rgb)/0.24)] bg-[rgb(var(--theme-negative-rgb)/0.1)] text-[rgb(var(--theme-negative-rgb)/0.9)] hover:border-[rgb(var(--theme-negative-rgb)/0.38)] hover:bg-[rgb(var(--theme-negative-rgb)/0.14)]"
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
}
