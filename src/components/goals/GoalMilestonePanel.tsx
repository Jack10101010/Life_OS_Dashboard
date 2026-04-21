import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Calendar, Plus, X } from "lucide-react";
import { GoalDatePicker } from "../../features/goals/GoalDatePicker";
import {
  getFloatingPanelPosition,
  type FloatingPanelPosition,
} from "../layout/OverlayPrimitives";
import { IconButton } from "../ui/Button";
import type { LifeGoalMilestone } from "../../types";
import type { MouseEvent as ReactMouseEvent } from "react";

type MilestonePanelMode = "create" | "edit";

type MilestoneDraft = Pick<LifeGoalMilestone, "title" | "description" | "targetDate" | "showTargetDateInRoadmap" | "completed">;

interface GoalMilestonePanelProps {
  open: boolean;
  mode: MilestonePanelMode | null;
  draft: MilestoneDraft;
  milestone?: LifeGoalMilestone | null;
  goalTitle?: string;
  taskCounts?: {
    total: number;
    completed: number;
    active: number;
  };
  isEffectivelyCompleted?: boolean;
  onDraftChange: (draft: MilestoneDraft) => void;
  onSubmit: () => void;
  onDelete?: () => void;
  onComplete?: () => void;
  onRestore?: () => void;
  onAddTask?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onClose: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  rightOffset?: number;
}

export default function GoalMilestonePanel({
  open,
  mode,
  draft,
  milestone,
  goalTitle,
  taskCounts,
  isEffectivelyCompleted = false,
  onDraftChange,
  onSubmit,
  onDelete,
  onComplete,
  onRestore,
  onAddTask,
  onMoveUp,
  onMoveDown,
  onClose,
  canMoveUp = false,
  canMoveDown = false,
  rightOffset = 0,
}: GoalMilestonePanelProps) {
  const dateFieldRef = useRef<HTMLButtonElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<FloatingPanelPosition | null>(null);
  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit milestone" : "Create milestone";
  const resolvedTaskCounts = taskCounts ?? { total: 0, completed: 0, active: 0 };

  useEffect(() => {
    if (!datePickerOpen || !dateFieldRef.current) return;

    const updatePosition = () => {
      if (!dateFieldRef.current) return;
      setDatePickerPosition(
        getFloatingPanelPosition(dateFieldRef.current, {
          minWidth: dateFieldRef.current.getBoundingClientRect().width,
          preferredWidth: dateFieldRef.current.getBoundingClientRect().width,
          estimatedHeight: 360,
        }),
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (dateFieldRef.current?.contains(target)) return;
      if (datePickerRef.current?.contains(target)) return;
      setDatePickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [datePickerOpen]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed bottom-0 right-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] w-full max-w-[528px] flex-col border-l border-zinc-700/80 bg-[rgb(var(--theme-surface-rgb))] shadow-2xl shadow-black/60"
            style={{ right: `${rightOffset}px` }}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex items-center justify-between gap-4 border-b border-zinc-700/70 px-6 py-[18px]">
              <div className="min-w-0 flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/85">
                  Milestone
                </span>
                <span className="text-zinc-800">·</span>
                <span className="min-w-0 truncate text-[12px] text-zinc-200/88">
                  {goalTitle || title}
                </span>
                {goalTitle ? (
                  <>
                    <span className="text-zinc-800">·</span>
                    <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                      {title}
                    </span>
                  </>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <IconButton
                  type="button"
                  onClick={onClose}
                  ariaLabel="Close milestone panel"
                  className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
                  icon={<X className="h-4 w-4" />}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overflow-x-hidden px-[30px] py-6">
              <input
                value={draft.title}
                onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                autoFocus
                placeholder={milestone?.title || "Milestone title"}
                className="w-full bg-transparent text-lg font-semibold text-zinc-100 outline-none placeholder:text-zinc-500"
              />

              <div className="space-y-3">
                <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Schedule</span>
                <button
                  ref={dateFieldRef}
                  type="button"
                  onClick={() => setDatePickerOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2 text-left text-[12px] text-zinc-300 outline-none transition-colors hover:border-zinc-600/70"
                  aria-haspopup="dialog"
                  aria-expanded={datePickerOpen}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <span className="truncate">
                      {draft.targetDate || "Target date"}
                    </span>
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                    Change
                  </span>
                </button>
                <GoalDatePicker
                  ref={datePickerRef}
                  value={draft.targetDate || null}
                  onChange={(value) => {
                    onDraftChange({ ...draft, targetDate: value });
                    setDatePickerOpen(false);
                  }}
                  onClose={() => setDatePickerOpen(false)}
                  anchorPosition={datePickerOpen && datePickerPosition ? { ...datePickerPosition, top: datePickerPosition.top + 4 } : null}
                  label="Target date"
                  navigationStyle="bordered"
                />
                {draft.targetDate ? (
                  <label className="flex items-center justify-between rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2 text-[12px] text-zinc-300">
                    <span>Show target date in roadmap</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(draft.showTargetDateInRoadmap)}
                      onClick={() =>
                        onDraftChange({
                          ...draft,
                          showTargetDateInRoadmap: !Boolean(draft.showTargetDateInRoadmap),
                        })
                      }
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition ${
                        draft.showTargetDateInRoadmap
                          ? "border-emerald-500/20 bg-emerald-500/15"
                          : "border-white/[0.08] bg-white/[0.025]"
                      }`}
                    >
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full bg-white/70 transition ${
                          draft.showTargetDateInRoadmap ? "translate-x-[14px]" : "translate-x-[3px]"
                        }`}
                      />
                    </button>
                  </label>
                ) : null}
              </div>

              {isEditMode ? (
                <div className="rounded-lg border border-zinc-700/70 bg-white/[0.025] p-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Total</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{resolvedTaskCounts.total}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Active</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{resolvedTaskCounts.active}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Done</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-100 tabular-nums">{resolvedTaskCounts.completed}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {isEditMode ? (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Actions</span>
                  <div className="grid gap-2">
                    {onAddTask ? (
                      <button
                        type="button"
                        onClick={onAddTask}
                        className="flex items-center justify-between rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2 text-left text-[12px] text-zinc-300 transition-colors hover:border-zinc-600/70 hover:text-zinc-100"
                      >
                        <span>Add task to milestone</span>
                        <Plus className="h-3.5 w-3.5 text-zinc-500" />
                      </button>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onMoveUp}
                        disabled={!canMoveUp}
                        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-600/70 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={onMoveDown}
                        disabled={!canMoveDown}
                        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2 text-[12px] text-zinc-300 transition-colors hover:border-zinc-600/70 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        Move down
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  Description
                </span>
                <textarea
                  value={draft.description}
                  onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                  rows={5}
                  placeholder="What this checkpoint represents"
                  className="min-h-[132px] w-full resize-none rounded-lg border border-zinc-700/70 bg-white/[0.025] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-zinc-500 hover:border-zinc-600/70 focus:border-zinc-600/70"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-700/70 px-6 py-3.5">
              {isEditMode && onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-600 transition-all hover:bg-red-500/10 hover:text-red-400"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-[12px] font-medium text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-300"
                >
                  Cancel
                </button>
                {isEditMode && isEffectivelyCompleted && onRestore ? (
                  <button
                    type="button"
                    onClick={onRestore}
                    className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-[12px] font-medium text-sky-300 transition-all hover:border-sky-500/30 hover:bg-sky-500/20"
                  >
                    Restore
                  </button>
                ) : null}
                {isEditMode && !isEffectivelyCompleted && onComplete ? (
                  <button
                    type="button"
                    onClick={onComplete}
                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12px] font-medium text-emerald-400 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/20"
                  >
                    Complete
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onSubmit}
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-[12px] font-medium text-emerald-400 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/20"
                >
                  {isEditMode ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
