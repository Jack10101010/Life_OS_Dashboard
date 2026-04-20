import { FocusItem } from "../../types/focus";
import { Check, Target, ListTodo, ChevronRight } from "lucide-react";
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

interface FocusQueueItemProps {
  item: FocusItem;
  index: number;
  onPromote: (id: string) => void;
  onComplete: (id: string) => void;
  isAnimating: boolean;
}

const priorityDot = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

const typeIcon = {
  task: ListTodo,
  goal: Target,
  subtask: ChevronRight,
};

export default function FocusQueueItem({ item, index, onPromote, onComplete, isAnimating }: FocusQueueItemProps) {
  const TypeIcon = typeIcon[item.type];

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 cursor-pointer",
        "hover:bg-zinc-800/40 border border-transparent hover:border-zinc-800",
        isAnimating && "animate-in fade-in slide-in-from-right-2",
      )}
      style={{ animationDelay: isAnimating ? `${index * 80}ms` : undefined }}
      onClick={() => onPromote(item.id)}
    >
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.03]">
        <span className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-400 transition-colors">
          {index + 1}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="truncate text-[14px] font-medium text-zinc-300 transition-colors group-hover:text-white/82">
            {item.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TypeIcon className="w-3 h-3 text-zinc-600" />
          <span className="text-[12px] text-zinc-600 truncate">{item.context}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0">
        {item.dueDate && (
          <span className="text-[11px] text-zinc-600 group-hover:text-zinc-500 transition-colors hidden sm:block">
            {item.dueDate}
          </span>
        )}
        <div className={cn("h-2 w-2 rounded-full", priorityDot[item.priority])} />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(item.id);
          }}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] transition-all duration-200",
            "opacity-0 group-hover:opacity-100",
            "text-zinc-500 hover:bg-[rgb(var(--theme-accent-rgb)/0.12)] hover:text-white hover:border-[rgb(var(--theme-accent-rgb)/0.18)]"
          )}
        >
          <Check className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
