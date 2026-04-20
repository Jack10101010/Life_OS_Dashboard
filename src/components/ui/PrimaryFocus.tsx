import { FocusItem } from "../../types/focus";
import { Check, ArrowUpRight, Flame, Clock, Target, ListTodo, ChevronRight } from "lucide-react";
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

interface PrimaryFocusProps {
  item: FocusItem;
  onComplete: (id: string) => void;
  isAnimating: boolean;
}

const priorityConfig = {
  high: { color: "bg-red-500", label: "High" },
  medium: { color: "bg-amber-500", label: "Medium" },
  low: { color: "bg-sky-500", label: "Low" },
};

const typeIcon = {
  task: ListTodo,
  goal: Target,
  subtask: ChevronRight,
};

export default function PrimaryFocus({ item, onComplete, isAnimating }: PrimaryFocusProps) {
  const priority = priorityConfig[item.priority];
  const TypeIcon = typeIcon[item.type];

  return (
    <div
      className={cn(
        "relative min-w-0 flex-[0_0_65%] rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-7 transition-all duration-500 ease-out",
        "hover:bg-white/[0.04]",
        isAnimating && "animate-in fade-in slide-in-from-bottom-3 duration-500"
      )}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.08)] px-2.5 py-1">
          <Flame className="h-3.5 w-3.5 text-white/82" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/82">
            Current Focus
          </span>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/50")}>
          <div className={cn("h-2 w-2 rounded-full", priority.color)} />
          <span className="text-[11px] font-medium text-zinc-400">{priority.label}</span>
        </div>
        {item.dueDate && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/50">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span className="text-[11px] font-medium text-zinc-400">{item.dueDate}</span>
          </div>
        )}
      </div>

      <h2 className="text-[22px] font-semibold text-zinc-50 leading-tight mb-2.5 tracking-[-0.01em]">
        {item.title}
      </h2>

      <div className="flex items-center gap-2 mb-6">
        <TypeIcon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-sm text-zinc-500">{item.context}</span>
      </div>

      {item.progress !== undefined && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Progress</span>
            <span className="text-[11px] font-semibold text-zinc-400">{item.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-white/70 transition-all duration-700 ease-out"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => onComplete(item.id)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-[rgb(var(--theme-accent-rgb)/0.18)] bg-[rgb(var(--theme-accent-rgb)/0.12)] px-5 py-2.5 text-sm font-medium text-white transition",
            "hover:bg-[rgb(var(--theme-accent-rgb)/0.18)]",
            "active:scale-[0.97]"
          )}
        >
          <Check className="w-4 h-4" />
          Complete
        </button>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/72 transition",
            "hover:bg-white/[0.05] hover:text-white",
            "active:scale-[0.97]"
          )}
        >
          <ArrowUpRight className="w-4 h-4" />
          Open
        </button>
      </div>
    </div>
  );
}
