import { useState, useCallback } from "react";
import { FocusItem } from "../../types/focus";
import { initialFocusItems, highImpactGoal } from "../../data/focusMockData";
import {
  Check,
  Zap as ZapIcon,
  Clock,
  Target,
  ArrowUpRight,
  Zap,
  ChevronRight,
  CornerDownRight,
} from "lucide-react";
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const priorityChip: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-500/10 border-red-500/30", text: "text-red-400", label: "High" },
  medium: { bg: "bg-amber-500/10 border-amber-500/30", text: "text-amber-400", label: "Medium" },
  low: { bg: "bg-sky-500/10 border-sky-500/30", text: "text-sky-400", label: "Low" },
};

const priorityDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

export default function FocusStrip() {
  const [items, setItems] = useState<FocusItem[]>(initialFocusItems);
  const [animKey, setAnimKey] = useState(0);
  const [goalExpanded, setGoalExpanded] = useState(false);

  const active = items[0];
  const queue = items.slice(1, 5);

  const triggerAnim = useCallback(() => setAnimKey((k) => k + 1), []);

  const handleComplete = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setItems((prev) => prev.filter((item) => item.id !== id));
      triggerAnim();
    },
    [triggerAnim]
  );

  const handlePromote = useCallback(
    (id: string) => {
      setItems((prev) => {
        const idx = prev.findIndex((item) => item.id === id);
        if (idx <= 0) return prev;
        const promoted = prev[idx];
        const rest = prev.filter((_, i) => i !== idx);
        return [promoted, ...rest];
      });
      triggerAnim();
    },
    [triggerAnim]
  );

  /* ── Empty state ── */
  if (!active) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-8 py-10">
        <Zap className="h-5 w-5 text-zinc-600" />
        <span className="text-sm font-medium text-zinc-300">All clear for today</span>
        <span className="text-[12px] text-zinc-500">Nothing in focus.</span>
      </div>
    );
  }

  const prio = priorityChip[active.priority];

  return (
    <div key={animKey} className="w-full">
      <div
        className={cn(
          "w-full rounded-[12px] border border-white/[0.06] bg-white/[0.03]",
          "overflow-hidden",
        )}
      >
        <div className="flex flex-col lg:flex-row">
          <div
            className={cn(
              "flex-1 min-w-0 px-5 pt-4 pb-5 lg:px-6 lg:pt-4 lg:pb-5",
              "border-b border-white/[0.06] lg:border-b-0 lg:border-r",
              "animate-in fade-in slide-in-from-left-2 duration-400"
            )}
          >
            <div className="flex items-center gap-1.5 mb-4">
              <ZapIcon className="h-3 w-3 text-zinc-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Today's Focus
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 rounded-md border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.08)] px-2 py-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/82">
                  Active
                </span>
              </div>
              <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md border", prio.bg)}>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider", prio.text)}>
                  {prio.label}
                </span>
              </div>
              {active.dueDate && (
                <div className="flex items-center gap-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5">
                  <Clock className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] font-medium text-zinc-500">{active.dueDate}</span>
                </div>
              )}
            </div>

            <h3 className="mb-1.5 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-white">
              {active.title}
            </h3>

            <p className="mb-5 text-[13px] text-zinc-500">{active.context}</p>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleComplete(active.id, e)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-3.5 py-1.5 text-[12px] font-medium text-white transition",
                  "hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]",
                  "active:scale-[0.97]"
                )}
              >
                <Check className="w-3 h-3" />
                Complete
              </button>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-white/72 transition",
                  "hover:bg-white/[0.05] hover:text-white active:scale-[0.97]"
                )}
              >
                <ArrowUpRight className="w-3 h-3" />
                Open
              </button>
            </div>
          </div>

          <div className="w-full lg:w-[340px] xl:w-[380px] flex flex-col flex-shrink-0 px-4 lg:px-5 pt-3.5 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Up next
              </span>
              {queue.length > 0 && (
                <span className="text-[9px] font-medium text-zinc-600">· {queue.length}</span>
              )}
            </div>

            <div className="space-y-0.5">
              {queue.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => handlePromote(item.id)}
                  className={cn(
                    "group w-full flex items-center gap-2.5 px-2 py-[7px] rounded-md text-left transition-all duration-150 cursor-pointer",
                    "hover:bg-white/[0.04]",
                    "active:scale-[0.99]",
                    "animate-in fade-in slide-in-from-right-1"
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div
                    onClick={(e) => handleComplete(item.id, e)}
                    className="relative flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center"
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-150",
                        priorityDot[item.priority],
                        "opacity-60 group-hover:opacity-0"
                      )}
                    />
                    <Check
                      className={cn(
                        "absolute inset-0 m-auto h-3 w-3 text-zinc-500 opacity-0 transition-all group-hover:opacity-60",
                        "hover:!opacity-100 hover:!text-white"
                      )}
                    />
                  </div>

                  <span className="flex-1 min-w-0 truncate text-[12px] text-zinc-400 transition-colors group-hover:text-white/82">
                    {item.title}
                  </span>

                  {item.dueDate === "Today" && (
                    <span className="shrink-0 text-[9px] font-medium text-zinc-500">today</span>
                  )}
                </button>
              ))}

              {queue.length === 0 && (
                <div className="px-2 py-1.5 text-[11px] text-zinc-500">No more tasks queued.</div>
              )}
            </div>

            <div className="my-3 border-t border-white/[0.06]" />

            <button
              onClick={() => setGoalExpanded((v) => !v)}
              className="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <Target className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span className="truncate text-[12px] font-medium text-zinc-400 transition-colors group-hover:text-white/82">
                {highImpactGoal.title}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                <span className="text-[10px] font-medium text-zinc-500">
                  {highImpactGoal.progress}%
                </span>
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-zinc-500 transition-transform duration-200",
                    goalExpanded && "rotate-90"
                  )}
                />
              </div>
            </button>

            {goalExpanded && (
              <div className="flex items-center gap-1.5 pl-[26px] mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <CornerDownRight className="h-3 w-3 shrink-0 text-zinc-600" />
                <span className="text-[11px] text-zinc-500">
                  Next:{" "}
                  <span className="text-zinc-400">{highImpactGoal.nextAction}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
