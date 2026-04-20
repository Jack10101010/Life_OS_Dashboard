import React from "react";
import { Pin, Zap, ArrowRight } from "lucide-react";

export interface GoalRowProps {
  /** Emoji or icon string displayed at the start */
  emoji: string;
  /** Main goal title */
  title: string;
  /** Minimal category label (uppercase, small) */
  category: string;
  /** Short "why this matters" line — 1 line max */
  why: string;
  /** The clearly visible next action */
  nextAction: string;
  /** Progress value from 0 to 100 */
  progress: number;
  /**
   * Short supporting progress text for context.
   * e.g. "14/24 books", "8/10 milestones", "3 of 5 modules"
   * Falls back to "{progress}% complete" if omitted.
   */
  progressLabel?: string;
  /**
   * Days until due (positive) or days overdue (negative).
   * - 45  → "Due in 45 days"
   * - -3  → "Overdue by 3 days"
   * - 0   → "Due today"
   * - 200+ → softer phrasing like "Due in ~7 months"
   * Omit to hide due information entirely.
   */
  dueDays?: number;
  /** Whether this goal is pinned */
  pinned?: boolean;
  /** Whether this is a high-impact goal */
  highImpact?: boolean;
}

/** Format dueDays into human-friendly relative language */
function formatDue(dueDays: number): { text: string; urgent: boolean } {
  if (dueDays < 0) {
    const abs = Math.abs(dueDays);
    return { text: `Overdue by ${abs} day${abs === 1 ? "" : "s"}`, urgent: true };
  }
  if (dueDays === 0) {
    return { text: "Due today", urgent: true };
  }
  if (dueDays <= 7) {
    return { text: `Due in ${dueDays} day${dueDays === 1 ? "" : "s"}`, urgent: true };
  }
  if (dueDays <= 90) {
    return { text: `Due in ${dueDays} days`, urgent: false };
  }
  // Softer phrasing for distant goals
  const months = Math.round(dueDays / 30);
  if (months <= 12) {
    return { text: `Due in ~${months} month${months === 1 ? "" : "s"}`, urgent: false };
  }
  const years = Math.round(dueDays / 365);
  return { text: `Due in ~${years} year${years === 1 ? "" : "s"}`, urgent: false };
}

const GoalRow: React.FC<GoalRowProps> = ({
  emoji,
  title,
  category,
  why,
  nextAction,
  progress,
  progressLabel,
  dueDays,
  pinned = false,
  highImpact = false,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const dueInfo = dueDays !== undefined ? formatDue(dueDays) : null;
  const displayProgressLabel = progressLabel || `${clampedProgress}% complete`;

  return (
    <div
      className={`
        relative flex items-center justify-between gap-6
        rounded-xl px-6 py-5
        transition-all duration-200
        ${
          highImpact
            ? "border-l-2 border-l-amber-500/60 border-t border-r border-b border-t-white/[0.04] border-r-white/[0.04] border-b-white/[0.04] bg-[#13151D] shadow-[0_1px_16px_rgba(0,0,0,0.3)]"
            : "border border-[#1E2028] bg-[#12141A] shadow-[0_1px_12px_rgba(0,0,0,0.25)]"
        }
      `}
    >
      {/* ── Left Side: Meaning ── */}
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {/* Emoji */}
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xl leading-none">
          {emoji}
        </span>

        {/* Text block */}
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Category label */}
          <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            {category}
          </span>

          {/* Title row */}
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-lg font-semibold leading-tight text-slate-100">
              {title}
            </h3>

            {/* High-impact indicator — quieter treatment */}
            {highImpact && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-500/70">
                <Zap className="h-3 w-3 fill-amber-500/50 text-amber-500/70" />
                High Impact
              </span>
            )}
          </div>

          {/* Why this matters */}
          <p className="truncate text-sm italic leading-snug text-slate-400">
            {why}
          </p>

          {/* Next action */}
          <div className="flex items-center gap-1.5 pt-1">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate text-sm font-medium text-emerald-400">
              {nextAction}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Side: Signals ── */}
      <div className="flex shrink-0 flex-col items-end gap-2.5">
        {/* Pin + Due row */}
        <div className="flex items-center gap-2.5">
          {dueInfo && (
            <span
              className={`text-[11px] font-medium ${
                dueInfo.urgent ? "text-rose-400/80" : "text-slate-500"
              }`}
            >
              {dueInfo.text}
            </span>
          )}
          {pinned && (
            <Pin className="h-3.5 w-3.5 -rotate-45 text-amber-500/60" />
          )}
        </div>

        {/* Progress */}
        <div className="flex w-40 flex-col items-end gap-1.5">
          {/* Bar + percentage */}
          <div className="flex w-full items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  highImpact
                    ? "bg-gradient-to-r from-amber-500/80 to-amber-400/80"
                    : "bg-gradient-to-r from-indigo-500 to-indigo-400"
                }`}
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                highImpact ? "text-amber-400/80" : "text-indigo-400"
              }`}
            >
              {clampedProgress}%
            </span>
          </div>
          {/* Supporting progress label */}
          <span className="text-[11px] text-slate-500">
            {displayProgressLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GoalRow;