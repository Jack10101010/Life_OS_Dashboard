import { useState } from "react";
import { Flame } from "lucide-react";

interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  streak: number;
  days: boolean[]; // Mon-Sun, 7 entries
}

const INITIAL_HABITS: Habit[] = [
  {
    id: "1",
    name: "Morning meditation",
    emoji: "🧘",
    color: "emerald",
    streak: 6,
    days: [true, true, true, true, true, false, false],
  },
  {
    id: "2",
    name: "Exercise 30min",
    emoji: "💪",
    color: "blue",
    streak: 4,
    days: [true, true, false, true, true, false, false],
  },
  {
    id: "3",
    name: "Read 20 pages",
    emoji: "📖",
    color: "violet",
    streak: 3,
    days: [true, true, true, false, false, false, false],
  },
  {
    id: "4",
    name: "No social media",
    emoji: "📵",
    color: "amber",
    streak: 2,
    days: [false, true, true, true, false, false, false],
  },
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const TODAY_INDEX = 5; // Saturday

const colorMap: Record<string, { ring: string; fill: string; text: string }> = {
  emerald: {
    ring: "ring-emerald-500/40",
    fill: "bg-emerald-500",
    text: "text-emerald-400",
  },
  blue: {
    ring: "ring-blue-500/40",
    fill: "bg-blue-500",
    text: "text-blue-400",
  },
  violet: {
    ring: "ring-violet-500/40",
    fill: "bg-violet-500",
    text: "text-violet-400",
  },
  amber: {
    ring: "ring-amber-500/40",
    fill: "bg-amber-500",
    text: "text-amber-400",
  },
};

export default function HabitsWeek() {
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);

  const toggleToday = (habitId: string) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const newDays = [...h.days];
        newDays[TODAY_INDEX] = !newDays[TODAY_INDEX];
        return { ...h, days: newDays };
      })
    );
  };

  return (
    <div className="surface-1 border border-subtle rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-primary-content">
          Habits This Week
        </h3>
        <span className="text-[11px] text-tertiary-content">
          {habits.filter((h) => h.days.filter(Boolean).length >= 5).length}/{habits.length} on track
        </span>
      </div>

      {/* Day labels header */}
      <div className="flex items-center mb-3">
        <div className="w-[140px] shrink-0" />
        <div className="flex-1 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d, i) => (
            <span
              key={i}
              className={`text-center text-[9px] font-medium ${
                i === TODAY_INDEX ? "text-blue-400" : "text-tertiary-content"
              }`}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="w-[52px] shrink-0" />
      </div>

      {/* Habit rows */}
      <div className="space-y-2.5">
        {habits.map((habit) => {
          const colors = colorMap[habit.color];
          const completedCount = habit.days.filter(Boolean).length;
          return (
            <div key={habit.id} className="flex items-center">
              {/* Habit name */}
              <div className="w-[140px] shrink-0 flex items-center gap-2 min-w-0">
                <span className="text-sm">{habit.emoji}</span>
                <span className="text-[12px] text-secondary-content truncate">
                  {habit.name}
                </span>
              </div>

              {/* Day dots */}
              <div className="flex-1 grid grid-cols-7 gap-1">
                {habit.days.map((done, dayIdx) => {
                  const isToday = dayIdx === TODAY_INDEX;
                  const isFuture = dayIdx > TODAY_INDEX;
                  return (
                    <div key={dayIdx} className="flex justify-center">
                      {isFuture ? (
                        <div className="w-[18px] h-[18px] rounded-full bg-zinc-800/30" />
                      ) : isToday ? (
                        <button
                          onClick={() => toggleToday(habit.id)}
                          className={`w-[18px] h-[18px] rounded-full transition-all duration-200 ring-2 ${
                            done
                              ? `${colors.fill} ${colors.ring}`
                              : `bg-zinc-800 ring-zinc-600/50 hover:ring-zinc-500`
                          }`}
                          title="Click to toggle today"
                        />
                      ) : (
                        <div
                          className={`w-[18px] h-[18px] rounded-full ${
                            done ? `${colors.fill} opacity-70` : "bg-zinc-800/50"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Streak */}
              <div className="w-[52px] shrink-0 flex items-center justify-end gap-1">
                <Flame className={`w-3 h-3 ${colors.text}`} />
                <span className={`text-[11px] font-medium ${colors.text}`}>
                  {habit.streak + (habit.days[TODAY_INDEX] ? 1 : 0)}
                </span>
                <span className="text-[9px] text-tertiary-content">
                  ({completedCount}/7)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}