import { Button } from '../../../components/ui/Button'
import { DetailDrawer } from '../../../components/layout/DetailDrawer'
import { ResponsiveGrid, SectionCard } from '../../../components/layout/LayoutPrimitives'
import { getAchievementDetailLabel, getTrackerGoalLabel } from '../../../lib/habitTrackerGoals'
import { HabitTracker, HabitTrackerAchievement } from '../../../types'
import { formatDate } from '../goalUtils'

type ActiveGoalDetailItem = {
  kind: 'active'
  tracker: HabitTracker
  progress: {
    current: number
    target: number
    progressText: string
    startDate: string
    completed: boolean
    scheduled: boolean
    missed: boolean
  }
  completionDates: string[]
}

type CompletedGoalDetailItem = {
  kind: 'completed'
  tracker: HabitTracker
  achievement: HabitTrackerAchievement
  completionDates: string[]
}

type GoalDetailItem = ActiveGoalDetailItem | CompletedGoalDetailItem

type HabitGoalsTabProps = {
  activeGoals: ActiveGoalDetailItem[]
  completedGoals: CompletedGoalDetailItem[]
  selectedGoal: GoalDetailItem | null
  onChangeGoalsView: (view: 'life-overview') => void
  onCloseGoal: () => void
  onSelectGoal: (goal: GoalDetailItem) => void
}

function getTargetLabel(tracker: HabitTracker, target: number, goalType: HabitTrackerAchievement['goalType']) {
  switch (goalType) {
    case 'streak':
      return `${target} days`
    case 'times-per-week':
      return `${target} times / week`
    case 'target-value':
      return tracker.habitType === 'number' ? `${target} target value` : `${target} target`
    case 'minutes-target':
      return `${target} minutes`
  }
}

function getGoalStatusLabel(item: GoalDetailItem) {
  if (item.kind === 'completed') return 'Completed'
  if (item.progress.scheduled) return 'Scheduled'
  return 'Active'
}

function getGoalAccentColor(item: GoalDetailItem) {
  return item.tracker.color
}

export function HabitGoalsTab({
  activeGoals,
  completedGoals,
  selectedGoal,
  onChangeGoalsView,
  onCloseGoal,
  onSelectGoal,
}: HabitGoalsTabProps) {
  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3">
        <div>
          <p className="theme-section-title">Habit goals</p>
          <h3 className="theme-page-title mt-2">Active targets and completed wins</h3>
        </div>
        <Button variant="ghost" onClick={() => onChangeGoalsView('life-overview')}>
          Life Goals
        </Button>
      </div>
      <ResponsiveGrid columns="two-uneven">
        <SectionCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Active habit goals</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Current targets</h3>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-mist">
              {activeGoals.length} live
            </div>
          </div>

          {activeGoals.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4 text-sm text-mist">
              No active habit goals yet. Set a goal on any custom habit heatmap to start tracking it here.
            </div>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((item) => (
                <button
                  key={`${item.tracker.id}-active`}
                  type="button"
                  onClick={() => onSelectGoal(item)}
                  className="w-full rounded-2xl border border-white/5 bg-panelSoft/45 p-4 text-left transition hover:border-white/10 hover:bg-panelSoft/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getGoalAccentColor(item) }}
                        />
                        <p className="truncate text-base font-semibold text-white">{item.tracker.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-mist">{getTrackerGoalLabel(item.tracker.goal)}</p>
                    </div>
                    <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-mist/80">
                      {getGoalStatusLabel(item)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-2.5 flex-1 gap-1.5">
                      {Array.from({ length: Math.max(item.progress.target, 1) }, (_, index) => {
                        const isFilled = index < item.progress.current
                        const isMissed = item.progress.missed && index === 0 && !isFilled
                        return (
                          <div
                            key={index}
                            className={`h-full flex-1 rounded-full ${isMissed ? 'bg-[#8D3D37]' : !isFilled ? 'bg-[#262626]' : ''}`}
                            style={isFilled ? { backgroundColor: getGoalAccentColor(item) } : undefined}
                          />
                        )
                      })}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-white">{item.progress.progressText}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist/85">
                    <span>Type: {getTrackerGoalLabel(item.tracker.goal)}</span>
                    <span>Target: {getTargetLabel(item.tracker, item.progress.target, item.tracker.goal!.type)}</span>
                    <span>Start: {formatDate(item.progress.startDate)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-mist/70">Completed habit goals</p>
              <h3 className="mt-2 text-3xl font-semibold text-white">Achievement archive</h3>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-mist">
              {completedGoals.length} total
            </div>
          </div>

          {completedGoals.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4 text-sm text-mist">
              Completed goals will stay here even after they roll off the habit card trophy shelf.
            </div>
          ) : (
            <div className="space-y-3">
              {completedGoals.map((item) => (
                <button
                  key={item.achievement.id}
                  type="button"
                  onClick={() => onSelectGoal(item)}
                  className="w-full rounded-2xl border border-white/5 bg-panelSoft/45 p-4 text-left transition hover:border-white/10 hover:bg-panelSoft/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] text-[#F2C76B]">Trophy</span>
                        <p className="truncate text-base font-semibold text-white">{item.tracker.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-mist">{getAchievementDetailLabel(item.achievement)}</p>
                    </div>
                    <span className="rounded-full border border-[#3B2E15] bg-[#20180C] px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-[#E7C976]">
                      Completed
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mist/85">
                    <span>Target: {getTargetLabel(item.tracker, item.achievement.target, item.achievement.goalType)}</span>
                    <span>Started: {formatDate(item.achievement.startedDate)}</span>
                    <span>Completed: {formatDate(item.achievement.completedDate)}</span>
                    <span>Duration: {item.achievement.durationDays} days</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </ResponsiveGrid>

      <DetailDrawer
        open={Boolean(selectedGoal)}
        onClose={onCloseGoal}
        size="md"
        subtitle={selectedGoal ? `${selectedGoal.tracker.title} goal history` : 'Goal detail'}
        title={
          !selectedGoal
            ? 'Goal detail'
            : selectedGoal.kind === 'active'
              ? getTrackerGoalLabel(selectedGoal.tracker.goal) ?? 'Active goal'
              : getAchievementDetailLabel(selectedGoal.achievement)
        }
      >
        {selectedGoal ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Status</p>
                  <p className="mt-2 text-xl font-semibold text-white">{getGoalStatusLabel(selectedGoal)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getGoalAccentColor(selectedGoal) }} />
                  <span className="text-sm text-mist">{selectedGoal.tracker.title}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Goal snapshot</p>
                <div className="mt-3 space-y-2 text-sm text-mist">
                  <p>
                    <span className="text-white">Type:</span>{' '}
                    {selectedGoal.kind === 'active'
                      ? getTrackerGoalLabel(selectedGoal.tracker.goal)
                      : getAchievementDetailLabel(selectedGoal.achievement)}
                  </p>
                  <p>
                    <span className="text-white">Target:</span>{' '}
                    {selectedGoal.kind === 'active'
                      ? getTargetLabel(selectedGoal.tracker, selectedGoal.progress.target, selectedGoal.tracker.goal!.type)
                      : getTargetLabel(
                          selectedGoal.tracker,
                          selectedGoal.achievement.target,
                          selectedGoal.achievement.goalType,
                        )}
                  </p>
                  <p>
                    <span className="text-white">Start date:</span>{' '}
                    {formatDate(
                      selectedGoal.kind === 'active'
                        ? selectedGoal.progress.startDate
                        : selectedGoal.achievement.startedDate,
                    )}
                  </p>
                  {selectedGoal.kind === 'completed' ? (
                    <>
                      <p>
                        <span className="text-white">Completed:</span> {formatDate(selectedGoal.achievement.completedDate)}
                      </p>
                      <p>
                        <span className="text-white">Duration:</span> {selectedGoal.achievement.durationDays} days
                      </p>
                    </>
                  ) : (
                    <p>
                      <span className="text-white">Progress:</span> {selectedGoal.progress.progressText}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-mist/60">
                  {selectedGoal.kind === 'completed' ? 'Achievement' : 'Live progress'}
                </p>
                {selectedGoal.kind === 'completed' ? (
                  <div className="mt-3 space-y-2 text-sm text-mist">
                    <p className="text-[#E7C976]">Trophy earned and preserved in your goal history.</p>
                    <p>
                      <span className="text-white">Completion day:</span> {formatDate(selectedGoal.achievement.completedDate)}
                    </p>
                    <p>
                      <span className="text-white">History record:</span> {selectedGoal.achievement.id}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="flex h-2.5 gap-1.5">
                      {Array.from({ length: Math.max(selectedGoal.progress.target, 1) }, (_, index) => {
                        const isFilled = index < selectedGoal.progress.current
                        const isMissed = selectedGoal.progress.missed && index === 0 && !isFilled
                        return (
                          <div
                            key={index}
                            className={`h-full flex-1 rounded-full ${isMissed ? 'bg-[#8D3D37]' : !isFilled ? 'bg-[#262626]' : ''}`}
                            style={isFilled ? { backgroundColor: getGoalAccentColor(selectedGoal) } : undefined}
                          />
                        )
                      })}
                    </div>
                    <p className="mt-3 text-sm text-mist">
                      {selectedGoal.progress.scheduled
                        ? `This goal starts on ${formatDate(selectedGoal.progress.startDate)}.`
                        : selectedGoal.progress.completed
                          ? 'This goal is currently completed.'
                          : selectedGoal.progress.missed
                            ? 'The goal has been reset after a missed day.'
                            : 'Progress is tracked live from the goal start date.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-panelSoft/40 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mist/60">Relevant completion dates</p>
              {selectedGoal.completionDates.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedGoal.completionDates.slice(-18).map((date) => (
                    <span key={date} className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-xs text-mist">
                      {formatDate(date)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-mist">No qualifying completion dates recorded yet.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={onCloseGoal}>Close</Button>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  )
}
