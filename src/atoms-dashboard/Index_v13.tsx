import GreetingHeader from "@/components/GreetingHeader";
import TodayCommandCenter from "@/components/TodayCommandCenter";
import WeeklySummary from "@/components/WeeklySummary";
import HabitsWeek from "@/components/HabitsWeek";
import GoalsNextAction from "@/components/GoalsNextAction";
import MomentumCard from "@/components/MomentumCard";
import InsightLayer from "@/components/InsightLayer";
import AppLayout from "@/components/AppLayout";

export default function Dashboard() {
  return (
    <AppLayout>
      <main className="max-w-[1100px] mx-auto px-6 py-8">
        {/* ═══ ACTION LAYER ═══ */}
        <section className="space-y-5 mb-8">
          <GreetingHeader />
          <TodayCommandCenter />
        </section>

        {/* ═══ CONTROL / PROGRESS LAYER ═══ */}
        <section className="space-y-4 mb-8">
          {/* Weekly strip */}
          <WeeklySummary />

          {/* Two-column: Habits + Goals/Momentum */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Habits */}
            <HabitsWeek />

            {/* Right: Goals + Momentum stacked */}
            <div className="space-y-4">
              <GoalsNextAction />
              <MomentumCard />
            </div>
          </div>
        </section>

        {/* ═══ INSIGHT / REFLECTION LAYER ═══ */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-zinc-800/60" />
            <span className="text-[10px] uppercase tracking-widest text-tertiary-content font-medium">
              Reflection
            </span>
            <div className="h-px flex-1 bg-zinc-800/60" />
          </div>
          <InsightLayer />
        </section>
      </main>
    </AppLayout>
  );
}