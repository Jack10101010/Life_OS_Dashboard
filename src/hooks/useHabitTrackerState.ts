import { useState } from 'react'
import { PersistedAppState } from '../lib/persistence'
import { HabitTracker, HabitTrackerCalendarRange, HabitTrackerPeriodView } from '../types'

function createEmptyHabitTracker(): HabitTracker {
  return {
    id: `tracker-${Date.now()}`,
    title: 'New habit tracker',
    description: '',
    color: '#17C964',
    colorIntensity: 100,
    weekendVisibility: 'show',
    clampDescription: true,
    entries: {},
  }
}

export function useHabitTrackerState(initialState: PersistedAppState) {
  const [habitTrackers, setHabitTrackers] = useState<HabitTracker[]>(initialState.habitTrackers)
  const [editingTracker, setEditingTracker] = useState<HabitTracker | null>(initialState.editingTracker)
  const [habitEntryDraft, setHabitEntryDraft] = useState(initialState.habitEntryDraft)
  const [moodCollapsed, setMoodCollapsed] = useState(initialState.moodCollapsed)
  const [collapsedTrackers, setCollapsedTrackers] = useState<Record<string, boolean>>(initialState.collapsedTrackers)
  const [habitTrackerPeriodView, setHabitTrackerPeriodView] = useState<HabitTrackerPeriodView>(initialState.habitTrackerPeriodView)
  const [habitTrackerFocusDate, setHabitTrackerFocusDate] = useState(initialState.habitTrackerFocusDate)
  const [habitTrackerCalendarRangeByTracker, setHabitTrackerCalendarRangeByTracker] = useState<Record<string, HabitTrackerCalendarRange>>(
    initialState.habitTrackerCalendarRangeByTracker,
  )

  const hydrate = (next: PersistedAppState) => {
    setHabitTrackers(next.habitTrackers)
    setEditingTracker(next.editingTracker)
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
    setHabitTrackers((current) => {
      const exists = current.some((item) => item.id === tracker.id)
      return exists ? current.map((item) => (item.id === tracker.id ? tracker : item)) : [...current, tracker]
    })
  }

  const saveHabitEntry = () => {
    if (!habitEntryDraft) return
    setHabitTrackers((current) =>
      current.map((tracker) =>
        tracker.id !== habitEntryDraft.trackerId
          ? tracker
          : {
              ...tracker,
              entries: {
                ...tracker.entries,
                [habitEntryDraft.date]: {
                  date: habitEntryDraft.date,
                  completed: habitEntryDraft.completed,
                  note: habitEntryDraft.note,
                },
              },
            },
      ),
    )
    setHabitEntryDraft(null)
  }

  return {
    habitTrackers,
    setHabitTrackers,
    editingTracker,
    setEditingTracker,
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
    hydrate,
  }
}
