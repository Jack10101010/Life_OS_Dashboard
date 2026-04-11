import { PageId } from '../types'

export const DEFAULT_SIDEBAR_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'habit-maps', label: 'Habit Maps' },
  { id: 'your-days', label: 'Your Days' },
  { id: 'journal-recordings', label: 'Journal' },
  { id: 'goals', label: 'Goals' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'tasks', label: 'Priorities & Tasks' },
  { id: 'notes', label: 'Notes & Reflections' },
  { id: 'trade-log', label: 'Trade Log' },
  { id: 'settings', label: 'Settings' },
]

export function getDefaultSidebarOrder(): PageId[] {
  return DEFAULT_SIDEBAR_ITEMS.map((item) => item.id)
}

export function getDefaultSidebarLabels(): Record<PageId, string> {
  return DEFAULT_SIDEBAR_ITEMS.reduce(
    (acc, item) => {
      acc[item.id] = item.label
      return acc
    },
    {} as Record<PageId, string>,
  )
}
