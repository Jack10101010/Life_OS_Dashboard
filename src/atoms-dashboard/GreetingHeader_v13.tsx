import { TrendingUp, Flame } from "lucide-react";

export default function GreetingHeader() {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-primary-content tracking-tight">
          {greeting}, Jack
        </h1>
        <p className="text-[13px] text-secondary-content mt-1">
          Saturday, April 12 — 3 tasks due today, 1 habit pending
        </p>
      </div>

      {/* State of You */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl surface-2 border border-subtle">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">87%</span>
          </div>
          <span className="text-[11px] text-secondary-content">momentum</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl surface-2 border border-subtle">
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-sm font-semibold text-amber-400">4</span>
          </div>
          <span className="text-[11px] text-secondary-content">day streak</span>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-tertiary-content">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>12 done this week</span>
          <span className="mx-1">·</span>
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>2 overdue</span>
        </div>
      </div>
    </div>
  );
}