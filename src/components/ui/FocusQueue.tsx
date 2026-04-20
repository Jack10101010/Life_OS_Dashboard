import { FocusItem } from "../../types/focus";
import FocusQueueItem from "./FocusQueueItem";
import { Plus } from "lucide-react";
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

interface FocusQueueProps {
  items: FocusItem[];
  onPromote: (id: string) => void;
  onComplete: (id: string) => void;
  isAnimating: boolean;
}

export default function FocusQueue({ items, onPromote, onComplete, isAnimating }: FocusQueueProps) {
  return (
    <div
      className={cn(
        "flex flex-[0_0_35%] min-w-0 flex-col rounded-[12px] border border-white/[0.06] bg-white/[0.03] p-5",
        isAnimating && "animate-in fade-in duration-500"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Next Up
          </span>
          <span className="text-[11px] font-medium text-zinc-700 ml-1">
            {items.length}
          </span>
        </div>
        <button
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition",
            "hover:bg-white/[0.05] hover:text-zinc-300"
          )}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5 flex-1">
        {items.map((item, index) => (
          <FocusQueueItem
            key={item.id}
            item={item}
            index={index}
            onPromote={onPromote}
            onComplete={onComplete}
            isAnimating={isAnimating}
          />
        ))}
      </div>

      {items.length > 0 && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="text-[11px] text-zinc-700 text-center">
            Click any item to make it your focus
          </p>
        </div>
      )}
    </div>
  );
}
