import { useEffect, useMemo, useState } from 'react'
import { CustomHabitTrackerCard } from '../../components/tracker/CustomHabitTrackerCard'
import { HeatmapSegmentedControl } from '../../components/tracker/HeatmapControls'
import { SectionCard } from '../../components/layout/LayoutPrimitives'
import { HabitTrackerEntryDraft, HabitTrackerPeriodView, Tag } from '../../types'

type TrackerMapsViewMode = 'tabs' | 'scroll'

const TRACKER_MAPS_VIEW_MODE_KEY = 'life-dashboard.tracker-maps-view-mode'

export type HabitMapsContentProps = {
  tags: Tag[]
  heatmapLayout: React.ComponentProps<typeof CustomHabitTrackerCard>['layout']
  year: number
  habitTrackers: React.ComponentProps<typeof CustomHabitTrackerCard>['tracker'][]
  badHabitOccurredDates: string[]
  enableBadHabitTracking: boolean
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

export function HabitMapsContent({
  year,
  heatmapLayout,
  habitTrackers,
  badHabitOccurredDates,
  enableBadHabitTracking,
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
}: HabitMapsContentProps) {
  const [mapsViewMode, setMapsViewMode] = useState<TrackerMapsViewMode>(() => {
    if (typeof window === 'undefined') return 'scroll'
    const stored = window.localStorage.getItem(TRACKER_MAPS_VIEW_MODE_KEY)
    return stored === 'tabs' || stored === 'scroll' ? stored : 'scroll'
  })
  const [activeTabTrackerId, setActiveTabTrackerId] = useState<string | null>(habitTrackers[0]?.id ?? null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TRACKER_MAPS_VIEW_MODE_KEY, mapsViewMode)
  }, [mapsViewMode])

  useEffect(() => {
    if (habitTrackers.length === 0) {
      setActiveTabTrackerId(null)
      return
    }

    if (!activeTabTrackerId || !habitTrackers.some((tracker) => tracker.id === activeTabTrackerId)) {
      setActiveTabTrackerId(habitTrackers[0].id)
    }
  }, [activeTabTrackerId, habitTrackers])

  const activeTabTracker = useMemo(
    () => habitTrackers.find((tracker) => tracker.id === activeTabTrackerId) ?? habitTrackers[0] ?? null,
    [activeTabTrackerId, habitTrackers],
  )

  return (
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
          <HeatmapSegmentedControl
            items={[
              ['tabs', 'Tabbed'],
              ['scroll', 'Scroll'],
            ] as Array<[TrackerMapsViewMode, string]>}
            value={mapsViewMode}
            onChange={setMapsViewMode}
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
          <SectionCard compact className="border-[#252525] bg-[#111111] text-sm text-[#A0A0A0]">
            No custom heatmaps yet. Create one for habits like Running, Meditation, Sleep, or Reading.
          </SectionCard>
        </div>
      ) : null}

      {mapsViewMode === 'tabs' ? (
        <div className="space-y-4">
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="inline-flex min-w-full gap-2 px-1">
              {habitTrackers.map((tracker) => {
                const active = tracker.id === activeTabTracker?.id
                return (
                  <button
                    key={tracker.id}
                    type="button"
                    onClick={() => setActiveTabTrackerId(tracker.id)}
                    className={`shrink-0 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-white/[0.12] bg-[#262626] text-white'
                        : 'border-white/[0.06] bg-[#171717] text-[#A8A8A8] hover:border-white/[0.1] hover:bg-[#1D1D1D] hover:text-white'
                    }`}
                  >
                    {tracker.title}
                  </button>
                )
              })}
            </div>
          </div>

          {activeTabTracker ? (
            <CustomHabitTrackerCard
              key={activeTabTracker.id}
              tracker={activeTabTracker}
              badHabitOccurredDates={badHabitOccurredDates}
              enableBadHabitTracking={enableBadHabitTracking}
              year={year}
              layout={heatmapLayout}
              periodView={habitTrackerPeriodView}
              focusDate={habitTrackerFocusDate}
              calendarRange={habitTrackerCalendarRangeByTracker[activeTabTracker.id] ?? 'full-year'}
              selectedDate={habitEntryDraft?.trackerId === activeTabTracker.id ? habitEntryDraft.date : undefined}
              collapsed={collapsedTrackers[activeTabTracker.id] ?? false}
              onToggleCollapse={() => onToggleCollapse(activeTabTracker.id)}
              onShiftPeriod={onShiftPeriod}
              onCalendarRangeChange={(next) => onCalendarRangeChange(activeTabTracker.id, next)}
              onSelectDate={(date) => onSelectDate(activeTabTracker, date)}
              onOpenSettings={() => onOpenSettings(activeTabTracker)}
              onOpenGoalSetup={() => onOpenGoalSetup(activeTabTracker)}
            />
          ) : null}
        </div>
      ) : (
        <div className={habitTrackerPeriodView === 'year' ? 'space-y-5' : 'grid gap-5 md:grid-cols-2 2xl:grid-cols-3'}>
          {habitTrackers.map((tracker) => (
            <CustomHabitTrackerCard
              key={tracker.id}
              tracker={tracker}
              badHabitOccurredDates={badHabitOccurredDates}
              enableBadHabitTracking={enableBadHabitTracking}
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
      )}
    </div>
  )
}
