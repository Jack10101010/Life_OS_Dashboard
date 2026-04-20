import { Play, CheckCircle2, Target, Sparkles } from "lucide-react";

export default function TodayCommandCenter() {
  return (
    <div className="relative overflow-hidden rounded-2xl surface-2 border border-[hsl(220,80%,65%,0.12)] glow-blue">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] via-transparent to-violet-500/[0.03]" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />

      <div className="relative px-7 py-6">
        {/* Top label */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/15">
            <Sparkles className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400">
              Today's Priority
            </span>
          </div>
          <span className="text-[11px] text-tertiary-content">
            Saturday, April 12
          </span>
        </div>

        {/* Main task */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-primary-content tracking-tight leading-snug">
              Finalize Q2 product roadmap
            </h2>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-violet-400" />
                <span className="text-[12px] text-violet-400 font-medium">
                  Ship v2.0
                </span>
              </div>
              <span className="text-[11px] text-tertiary-content">·</span>
              <span className="text-[11px] text-amber-400/80 font-medium">
                Due today
              </span>
            </div>

            {/* Guidance line */}
            <p className="text-[12px] text-secondary-content mt-3 leading-relaxed max-w-lg">
              You've been consistent this week — keep the momentum going.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-[13px] font-medium transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/20">
              <Play className="w-3.5 h-3.5" />
              Start Task
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-medium hover:border-zinc-600 text-secondary-content hover:text-primary-content text-[13px] font-medium transition-all duration-200 bg-transparent">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}