import { ArrowRight, Zap, Clock, Play } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface HeroSectionProps {
  title: string;
  emoji: string;
  titleContent?: ReactNode;
  emojiContent?: ReactNode;
  status: "Active" | "On Hold" | "Completed";
  isHighImpact: boolean;
  progress: number;
  nextTask: {
    title: string;
    category: string;
    estimatedTime: string;
  };
  lastProgressed: string;
  onNextTaskClick?: (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void;
  onToggleHighImpact?: () => void;
  onToggleStatus?: () => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  actions?: ReactNode;
  showEmoji?: boolean;
  showStatus?: boolean;
}

function StatusPill({ status, onToggleStatus }: { status: "Active" | "On Hold" | "Completed"; onToggleStatus?: () => void }) {
  const isActive = status === "Active";
  const isCompleted = status === "Completed";
  const isInteractive = Boolean(onToggleStatus) && !isCompleted;
  const pillClassName = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide ${
    isActive
      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      : isCompleted
        ? "bg-slate-500/10 text-slate-300 border border-slate-500/20"
      : "bg-amber-500/[0.08] text-amber-400/85 border border-amber-500/[0.16]"
  } ${
    isInteractive
      ? isActive
        ? "cursor-pointer transition hover:border-emerald-400/30 hover:text-emerald-300"
        : "cursor-pointer transition hover:border-amber-400/[0.24] hover:text-amber-300"
      : ""
  }`;
  const content = (
    <>
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? "bg-emerald-400 animate-pulse" : isCompleted ? "bg-slate-300" : "bg-amber-400"
        }`}
      />
      {status}
    </>
  );

  if (isInteractive) {
    return (
      <button type="button" onClick={onToggleStatus} aria-pressed={isActive} className={pillClassName}>
        {content}
      </button>
    );
  }

  return (
    <span className={pillClassName}>
      {content}
    </span>
  );
}

export default function HeroSection({
  title,
  emoji,
  titleContent,
  emojiContent,
  status,
  isHighImpact,
  progress,
  nextTask,
  lastProgressed,
  onNextTaskClick,
  onToggleHighImpact,
  onToggleStatus,
  isExpanded = true,
  onToggleExpanded,
  actions,
  showEmoji = true,
  showStatus = true,
}: HeroSectionProps) {
  const handleNextTaskKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onNextTaskClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onNextTaskClick(event);
  };

  return (
    <section className="w-full">
      {/* Title Row */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {showEmoji ? emojiContent ?? <span className="text-3xl">{emoji}</span> : null}
            {titleContent ?? (
              <h1 className="text-2xl font-bold text-slate-100 tracking-tight truncate">
                {title}
              </h1>
            )}
          </div>
          {/* Micro context line */}
          <p className="text-sm text-slate-500 flex items-center gap-1.5 ml-12">
            <Clock className="w-3.5 h-3.5" />
            {lastProgressed}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0 pt-1">
          {!isExpanded && showStatus ? (
            <span className="text-xs font-semibold text-indigo-400 tabular-nums">
              {progress}%
            </span>
          ) : null}
          {showStatus ? <StatusPill status={status} onToggleStatus={onToggleStatus} /> : null}
          <button
            type="button"
            onClick={onToggleHighImpact}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              isHighImpact
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:border-amber-400/30 hover:text-amber-300"
                : "bg-white/[0.025] text-slate-500 border-white/[0.07] hover:border-white/[0.12] hover:text-slate-300"
            } ${onToggleHighImpact ? "cursor-pointer" : "cursor-default"}`}
            aria-pressed={isHighImpact}
          >
            <Zap className={`w-3.5 h-3.5 ${isHighImpact ? "fill-amber-400" : ""}`} />
            High Impact
          </button>
          {actions ? (
            <div className="flex items-center gap-2.5">
              {actions}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${isExpanded ? "max-h-[260px] opacity-100" : "max-h-0 opacity-0"}`}>
        {/* Progress Bar */}
        <div className="mt-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 tracking-wide uppercase">
              Progress
            </span>
            <span className="text-xs font-semibold text-indigo-400 tabular-nums">
              {progress}%
            </span>
          </div>
          <div className="h-1.5 bg-[#1A1D26] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, #6366F1 0%, #818CF8 100%)",
                boxShadow: "0 0 8px rgba(99,102,241,0.16)",
              }}
            />
          </div>
        </div>

        {/* Next Task Card — PRIMARY VISUAL ELEMENT */}
        <div
          className="group relative rounded-xl p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
          role={onNextTaskClick ? "button" : undefined}
          tabIndex={onNextTaskClick ? 0 : undefined}
          onClick={onNextTaskClick}
          onKeyDown={handleNextTaskKeyDown}
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.045) 0%, rgba(255,255,255,0.012) 100%)",
            border: "1px solid rgba(16,185,129,0.16)",
            boxShadow: "0 1px 12px rgba(0,0,0,0.18)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(16,185,129,0.26)";
            e.currentTarget.style.boxShadow =
              "0 6px 18px rgba(0,0,0,0.22), 0 0 16px rgba(99,102,241,0.045)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(16,185,129,0.16)";
            e.currentTarget.style.boxShadow =
              "0 1px 12px rgba(0,0,0,0.18)";
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <Play className="w-4.5 h-4.5 text-indigo-400 fill-indigo-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400/70 mb-1">
                  Next Task
                </p>
                <h3 className="text-base font-semibold text-slate-100 truncate">
                  {nextTask.title}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-500">
                    {nextTask.category}
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {nextTask.estimatedTime}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors duration-300">
              <ArrowRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-0.5 transition-transform duration-300" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
