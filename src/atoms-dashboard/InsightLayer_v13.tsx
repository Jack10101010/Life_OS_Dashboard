import { useState } from "react";
import {
  Grid3X3,
  ListTodo,
  BookOpen,
  Plus,
  ChevronRight,
  Send,
} from "lucide-react";

/* ─── Monthly Consistency Grid ─── */
function MonthlyConsistency() {
  // 30 days of data (0-4 scale: 0=none, 1=low, 2=med, 3=high, 4=full)
  const data = [
    3, 4, 4, 2, 3, 0, 1, 4, 4, 3, 2, 4, 3, 1, 0, 3, 4, 4, 2, 3, 4, 4, 3, 2,
    1, 4, 3, 4, 2, 0,
  ];

  const intensityMap: Record<number, string> = {
    0: "bg-zinc-800/40",
    1: "bg-emerald-500/20",
    2: "bg-emerald-500/40",
    3: "bg-emerald-500/60",
    4: "bg-emerald-500/80",
  };

  const activeDays = data.filter((d) => d > 0).length;

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">
            Monthly Consistency
          </h4>
        </div>
        <span className="text-[10px] text-tertiary-content">
          {activeDays}/30 active days
        </span>
      </div>
      <div className="grid grid-cols-10 gap-[3px]">
        {data.map((val, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[3px] ${intensityMap[val]} transition-colors`}
            title={`Day ${i + 1}: ${val === 0 ? "No activity" : `Level ${val}`}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-tertiary-content">Mar 13</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-tertiary-content">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-2 h-2 rounded-[2px] ${intensityMap[level]}`}
            />
          ))}
          <span className="text-[9px] text-tertiary-content">More</span>
        </div>
        <span className="text-[9px] text-tertiary-content">Apr 12</span>
      </div>
    </div>
  );
}

/* ─── General Tasks Preview ─── */
function TasksPreview() {
  const tasks = [
    { id: "1", title: "Review PR #142 comments", priority: "medium" },
    { id: "2", title: "Send weekly standup notes", priority: "low" },
    { id: "3", title: "Update design tokens doc", priority: "low" },
  ];

  const priorityDot: Record<string, string> = {
    high: "bg-rose-400",
    medium: "bg-amber-400",
    low: "bg-zinc-600",
  };

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">
            General Tasks
          </h4>
        </div>
        <span className="text-[10px] text-tertiary-content">8 total</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2.5 py-1.5 group cursor-pointer"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[task.priority]}`}
            />
            <span className="text-[12px] text-secondary-content group-hover:text-primary-content transition-colors truncate">
              {task.title}
            </span>
          </div>
        ))}
      </div>
      <button className="flex items-center gap-1.5 mt-3 text-[11px] text-tertiary-content hover:text-secondary-content transition-colors">
        <span>Open full list</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ─── Journal Highlights ─── */
function JournalHighlights() {
  const [newEntry, setNewEntry] = useState("");

  const entries = [
    {
      id: "1",
      date: "Apr 11",
      text: "Had a breakthrough on the retention model. The cohort analysis revealed that onboarding flow changes from March are already showing results...",
    },
    {
      id: "2",
      date: "Apr 10",
      text: "Feeling focused this week. The morning meditation habit is really paying off — clearer thinking in the first 2 hours of the day.",
    },
    {
      id: "3",
      date: "Apr 8",
      text: "Need to rethink the mobile app timeline. Dependencies on the API team are creating bottlenecks.",
    },
  ];

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">
            Journal
          </h4>
        </div>
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg surface-2 border border-subtle">
        <Plus className="w-3 h-3 text-tertiary-content shrink-0" />
        <input
          type="text"
          placeholder="Quick note..."
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          className="flex-1 bg-transparent text-[12px] text-primary-content placeholder:text-tertiary-content outline-none"
        />
        {newEntry && (
          <button className="shrink-0 text-blue-400 hover:text-blue-300 transition-colors">
            <Send className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-2.5">
        {entries.map((entry) => (
          <div key={entry.id} className="group cursor-pointer">
            <span className="text-[10px] text-tertiary-content font-medium">
              {entry.date}
            </span>
            <p className="text-[11px] text-secondary-content leading-relaxed mt-0.5 line-clamp-2 group-hover:text-primary-content transition-colors">
              {entry.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Combined Insight Layer ─── */
export default function InsightLayer() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MonthlyConsistency />
      <TasksPreview />
      <JournalHighlights />
    </div>
  );
}