import MiniChart from "./GoalMiniChart";
import { TrendingUp, CheckCircle2, Clock, BarChart3 } from "lucide-react";

interface InsightSectionProps {
  percentComplete: number;
  tasksCompleted: number;
  tasksRemaining: number;
  lastActivity: string;
  chartData: number[];
  trend: "on-track" | "behind" | "ahead";
}

function TrendBadge({ trend }: { trend: InsightSectionProps["trend"] }) {
  const config = {
    "on-track": {
      label: "On track",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    behind: {
      label: "Slightly behind pace",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    ahead: {
      label: "Ahead of schedule",
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
  };
  const c = config[trend];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color} ${c.bg} border ${c.border}`}
    >
      <TrendingUp className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export default function InsightSection({
  percentComplete,
  tasksCompleted,
  tasksRemaining,
  lastActivity,
  chartData,
  trend,
}: InsightSectionProps) {
  return (
    <section className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
          Insights
        </h2>
        <TrendBadge trend={trend} />
      </div>

      {/* Integrated flow layout — NOT a grid dashboard */}
      <div className="flex flex-col gap-5">
        {/* Dominant insight: chart + main metric */}
        <div
          className="rounded-xl p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex items-end justify-between gap-8">
            <div className="flex-shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-1">
                30-Day Activity
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-100 tabular-nums">
                  {percentComplete}%
                </span>
                <span className="text-xs text-slate-500">complete</span>
              </div>
            </div>
            <div className="flex-1 max-w-[240px]">
              <MiniChart data={chartData} width={240} height={56} />
            </div>
          </div>
        </div>

        {/* Supporting metrics — flowing naturally */}
        <div className="flex items-center gap-6 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 tabular-nums">
                {tasksCompleted}
              </p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                Completed
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-[#1E2330]" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-indigo-400/70" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 tabular-nums">
                {tasksRemaining}
              </p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                Remaining
              </p>
            </div>
          </div>

          <div className="w-px h-8 bg-[#1E2330]" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500/70" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {lastActivity}
              </p>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                Last Active
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
