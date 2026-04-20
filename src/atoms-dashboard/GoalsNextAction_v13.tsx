import { Target, ArrowRight, Clock } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  progress: number;
  color: string;
  nextTask: string;
  dueLabel?: string;
}

const GOALS: Goal[] = [
  {
    id: "1",
    name: "Ship v2.0",
    progress: 68,
    color: "violet",
    nextTask: "Finalize Q2 product roadmap",
    dueLabel: "Due today",
  },
  {
    id: "2",
    name: "Reduce churn to <3%",
    progress: 45,
    color: "emerald",
    nextTask: "Analyze cohort retention data",
    dueLabel: "Due Mon",
  },
  {
    id: "3",
    name: "Launch mobile app",
    progress: 22,
    color: "blue",
    nextTask: "Review wireframe feedback",
  },
];

const barColors: Record<string, string> = {
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
};

const dotColors: Record<string, string> = {
  violet: "bg-violet-400",
  emerald: "bg-emerald-400",
  blue: "bg-blue-400",
};

const textColors: Record<string, string> = {
  violet: "text-violet-400",
  emerald: "text-emerald-400",
  blue: "text-blue-400",
};

export default function GoalsNextAction() {
  return (
    <div className="surface-1 border border-subtle rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-400" />
          <h3 className="text-[14px] font-semibold text-primary-content">
            Goals & Next Action
          </h3>
        </div>
        <span className="text-[11px] text-tertiary-content">3 active</span>
      </div>

      <div className="space-y-3">
        {GOALS.map((goal) => (
          <div
            key={goal.id}
            className="group p-3.5 rounded-lg surface-2 border border-subtle hover:border-medium transition-all duration-200"
          >
            {/* Goal header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dotColors[goal.color]}`} />
                <span className="text-[13px] font-medium text-primary-content">
                  {goal.name}
                </span>
              </div>
              <span className={`text-[12px] font-semibold ${textColors[goal.color]}`}>
                {goal.progress}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-zinc-800 mb-3">
              <div
                className={`h-full rounded-full ${barColors[goal.color]} transition-all duration-500`}
                style={{ width: `${goal.progress}%` }}
              />
            </div>

            {/* Next task */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ArrowRight className="w-3 h-3 text-tertiary-content shrink-0" />
                <span className="text-[12px] text-secondary-content truncate">
                  {goal.nextTask}
                </span>
              </div>
              {goal.dueLabel && (
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <Clock className="w-3 h-3 text-amber-400/70" />
                  <span className="text-[10px] text-amber-400/80 font-medium">
                    {goal.dueLabel}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}