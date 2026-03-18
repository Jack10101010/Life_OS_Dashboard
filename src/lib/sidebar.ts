import { PageId } from '../types'

export const DEFAULT_SIDEBAR_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'journal-recordings', label: 'Daily Journal' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'goals', label: 'Goals' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'vision-board', label: 'Vision Board' },
  { id: 'analytics', label: 'Analytics' },
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
