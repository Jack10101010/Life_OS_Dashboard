import { Calendar, TrendingUp, Zap } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LOGGED = [true, true, true, true, false, true, false]; // Sat is today (index 5)
const TODAY_INDEX = 5;

export default function WeeklySummary() {
  return (
    <div className="flex items-center gap-6 px-5 py-3.5 rounded-xl surface-1 border border-subtle">
      {/* Week dots */}
      <div className="flex items-center gap-1">
        <Calendar className="w-3.5 h-3.5 text-tertiary-content mr-2" />
        {DAYS.map((day, i) => (
          <div key={day} className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-tertiary-content font-medium">
              {day}
            </span>
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === TODAY_INDEX
                  ? "bg-blue-500 ring-2 ring-blue-500/30"
                  : LOGGED[i]
                  ? "bg-emerald-500/80"
                  : "bg-zinc-700/50"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="w-px h-6 bg-zinc-800" />

      {/* Stats */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span className="text-[12px] text-primary-content font-medium">5/7</span>
          <span className="text-[11px] text-tertiary-content">days logged</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-[12px] text-primary-content font-medium">78%</span>
          <span className="text-[11px] text-tertiary-content">habit completion</span>
        </div>
      </div>
    </div>
  );
}