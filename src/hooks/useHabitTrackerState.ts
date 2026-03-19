import { useState } from 'react'
import { normalizeHabitTracker, syncHabitTrackerAchievements } from '../lib/habitTrackerGoals'
import { PersistedAppState } from '../lib/persistence'
import { HabitTracker, HabitTrackerCalendarRange, HabitTrackerEntryDraft, HabitTrackerPeriodView } from '../types'

function createEmptyHabitTracker(): HabitTracker {
  return {
    id: `tracker-${Date.now()}`,
    title: 'New habit tracker',
    description: '',
    habitType: 'checkbox',
    color: '#17C964',
    colorIntensity: 100,
    showAlcoholMarkers: false,
    weekendVisibility: 'show',
    clampDescription: true,
    goal: null,
    achievements: [],
    entries: {},
  }
}

export function useHabitTrackerState(initialState: PersistedAppState) {
  const [habitTrackers, setHabitTrackers] = useState<HabitTracker[]>(initialState.habitTrackers)
  const [editingTracker, setEditingTracker] = useState<HabitTracker | null>(initialState.editingTracker)
  const [goalEditingTracker, setGoalEditingTracker] = useState<HabitTracker | null>(null)
  const [habitEntryDraft, setHabitEntryDraft] = useState<HabitTrackerEntryDraft | null>(initialState.habitEntryDraft)
  const [moodCollapsed, setMoodCollapsed] = useState(initialState.moodCollapsed)
  const [collapsedTrackers, setCollapsedTrackers] = useState<Record<string, boolean>>(initialState.collapsedTrackers)
  const [habitTrackerPeriodView, setHabitTrackerPeriodView] = useState<HabitTrackerPeriodView>(initialState.habitTrackerPeriodView)
  const [habitTrackerFocusDate, setHabitTrackerFocusDate] = useState(initialState.habitTrackerFocusDate)
  const [habitTrackerCalendarRangeByTracker, setHabitTrackerCalendarRangeByTracker] = useState<Record<string, HabitTrackerCalendarRange>>(
    initialState.habitTrackerCalendarRangeByTracker,
  )

  const hydrate = (next: PersistedAppState) => {
    setHabitTrackers(next.habitTrackers.map(normalizeHabitTracker))
    setEditingTracker(next.editingTracker ? normalizeHabitTracker(next.editingTracker) : null)
    setGoalEditingTracker(null)
    setHabitEntryDraft(next.habitEntryDraft)
    setMoodCollapsed(next.moodCollapsed)
    setCollapsedTrackers(next.collapsedTrackers)
    setHabitTrackerPeriodView(next.habitTrackerPeriodView)
    setHabitTrackerFocusDate(next.habitTrackerFocusDate)
    setHabitTrackerCalendarRangeByTracker(next.habitTrackerCalendarRangeByTracker)
  }

  const createTracker = () => {
    setEditingTracker(createEmptyHabitTracker())
  }

  const deleteTracker = (trackerId: string) => {
    setHabitTrackers((current) => current.filter((tracker) => tracker.id !== trackerId))
    setCollapsedTrackers((current) => {
      const next = { ...current }
      delete next[trackerId]
      return next
    })
    setHabitTrackerCalendarRangeByTracker((current) => {
      const next = { ...current }
      delete next[trackerId]
      return next
    })
    setHabitEntryDraft((current) => (current?.trackerId === trackerId ? null : current))
    setEditingTracker(null)
  }

  const moveTrackerUp = (trackerId: string) => {
    setHabitTrackers((current) => {
      const index = current.findIndex((tracker) => tracker.id === trackerId)
      if (index <= 0) return current
      const next = [...current]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  const moveTrackerDown = (trackerId: string) => {
    setHabitTrackers((current) => {
      const index = current.findIndex((tracker) => tracker.id === trackerId)
      if (index === -1 || index >= current.length - 1) return current
      const next = [...current]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  const saveTracker = (tracker: HabitTracker) => {
    const syncedTracker = syncHabitTrackerAchievements(normalizeHabitTracker(tracker))
    setHabitTrackers((current) => {
      const exists = current.some((item) => item.id === syncedTracker.id)
      return exists ? current.map((item) => (item.id === syncedTracker.id ? syncedTracker : item)) : [...current, syncedTracker]
    })
  }

  const saveHabitEntry = () => {
    if (!habitEntryDraft) return
    setHabitTrackers((current) =>
      current.map((tracker) =>
        tracker.id !== habitEntryDraft.trackerId
          ? tracker
          : syncHabitTrackerAchievements({
              ...tracker,
              entries: {
                ...tracker.entries,
                [habitEntryDraft.date]: {
                  date: habitEntryDraft.date,
                  completed: habitEntryDraft.completed,
                  value: habitEntryDraft.value,
                  note: habitEntryDraft.note,
                },
              },
            }),
      ),
    )
    setHabitEntryDraft(null)
  }

  const clearTrackerAchievements = (trackerId: string) => {
    setHabitTrackers((current) =>
      current.map((tracker) =>
        tracker.id !== trackerId
          ? tracker
          : {
              ...tracker,
              achievements: [],
            },
      ),
    )
  }

  return {
    habitTrackers,
    setHabitTrackers,
    editingTracker,
    setEditingTracker,
    goalEditingTracker,
    setGoalEditingTracker,
    habitEntryDraft,
    setHabitEntryDraft,
    moodCollapsed,
    setMoodCollapsed,
    collapsedTrackers,
    setCollapsedTrackers,
    habitTrackerPeriodView,
    setHabitTrackerPeriodView,
    habitTrackerFocusDate,
    setHabitTrackerFocusDate,
    habitTrackerCalendarRangeByTracker,
    setHabitTrackerCalendarRangeByTracker,
    createTracker,
    deleteTracker,
    moveTrackerUp,
    moveTrackerDown,
    saveTracker,
    saveHabitEntry,
    clearTrackerAchievements,
    hydrate,
  }
}
