import { CustomHabitTrackerCard } from '../../components/tracker/CustomHabitTrackerCard'
import { HeatmapSegmentedControl } from '../../components/tracker/HeatmapControls'
import { HabitTrackerEntryDraft, HabitTrackerPeriodView, Tag } from '../../types'
import { TrackerPage } from './TrackerPage'

export function TrackerWorkspace({
  trackerPage,
  customTrackers,
}: {
  trackerPage: React.ComponentProps<typeof TrackerPage>
  customTrackers: {
    tags: Tag[]
    heatmapLayout: React.ComponentProps<typeof CustomHabitTrackerCard>['layout']
    year: number
    habitTrackers: React.ComponentProps<typeof CustomHabitTrackerCard>['tracker'][]
    alcoholConsumedDates: string[]
    habitTrackerPeriodView: HabitTrackerPeriodView
    habitTrackerFocusDate: string
    habitTrackerCalendarRangeByTracker: Record<string, React.ComponentProps<typeof CustomHabitTrackerCard>['calendarRange']>
    habitEntryDraft: HabitTrackerEntryDraft | null
    collapsedTrackers: Record<string, boolean>
    onCreateTracker: () => void
    onPeriodViewChange: (view: HabitTrackerPeriodView) => void
    onToggleCollapse: (trackerId: string) => void
    onShiftPeriod: (date: string) => void
    onCalendarRangeChange: (trackerId: string, range: React.ComponentProps<typeof CustomHabitTrackerCard>['calendarRange']) => void
    onSelectDate: (tracker: React.ComponentProps<typeof CustomHabitTrackerCard>['tracker'], date: string) => void
    onOpenSettings: (tracker: React.ComponentProps<typeof CustomHabitTrackerCard>['tracker']) => void
    onOpenGoalSetup: (tracker: React.ComponentProps<typeof CustomHabitTrackerCard>['tracker']) => void
  }
}) {
  const {
    year,
    heatmapLayout,
    habitTrackers,
    alcoholConsumedDates,
    habitTrackerPeriodView,
    habitTrackerFocusDate,
    habitTrackerCalendarRangeByTracker,
    habitEntryDraft,
    collapsedTrackers,
    onCreateTracker,
    onPeriodViewChange,
    onToggleCollapse,
    onShiftPeriod,
    onCalendarRangeChange,
    onSelectDate,
    onOpenSettings,
    onOpenGoalSetup,
  } = customTrackers

  return (
    <>
      <TrackerPage {...trackerPage} />

      <div className="mt-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#8F8F8F]">Custom trackers</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Habit heatmaps</h3>
          </div>
          <div className="flex items-center gap-3">
            <HeatmapSegmentedControl
              items={[
                ['year', 'Year'],
                ['month', 'Month'],
                ['week', 'Week'],
              ] as Array<[HabitTrackerPeriodView, string]>}
              value={habitTrackerPeriodView}
              onChange={onPeriodViewChange}
            />
            <button
              onClick={onCreateTracker}
              className="rounded-2xl border border-[#2F2F2F] bg-[#181818] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#232323]"
            >
              Create habit
            </button>
          </div>
        </div>

        {habitTrackers.length === 0 ? (
          <div>
            <div className="rounded-3xl border border-[#252525] bg-[#111111] p-6 text-sm text-[#A0A0A0]">
              No custom heatmaps yet. Create one for habits like Running, Meditation, Sleep, or Reading.
            </div>
          </div>
        ) : null}

        <div className={`${habitTrackerPeriodView === 'year' ? 'space-y-5' : 'grid gap-5 md:grid-cols-2 xl:grid-cols-3'}`}>
          {habitTrackers.map((tracker) => (
            <CustomHabitTrackerCard
              key={tracker.id}
              tracker={tracker}
              alcoholConsumedDates={alcoholConsumedDates}
              year={year}
              layout={heatmapLayout}
              periodView={habitTrackerPeriodView}
              focusDate={habitTrackerFocusDate}
              calendarRange={habitTrackerCalendarRangeByTracker[tracker.id] ?? 'full-year'}
              selectedDate={habitEntryDraft?.trackerId === tracker.id ? habitEntryDraft.date : undefined}
              collapsed={collapsedTrackers[tracker.id] ?? false}
              onToggleCollapse={() => onToggleCollapse(tracker.id)}
              onShiftPeriod={onShiftPeriod}
              onCalendarRangeChange={(next) => onCalendarRangeChange(tracker.id, next)}
              onSelectDate={(date) => onSelectDate(tracker, date)}
              onOpenSettings={() => onOpenSettings(tracker)}
              onOpenGoalSetup={() => onOpenGoalSetup(tracker)}
            />
          ))}
        </div>
      </div>
    </>
  )
}
