import { useState } from 'react'
import { PageId } from '../types'
import { PersistedAppState } from '../lib/persistence'

export function useAppShellState(initialState: PersistedAppState) {
  const [page, setPage] = useState<PageId>(initialState.page)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialState.sidebarCollapsed)
  const [sidebarOrder, setSidebarOrder] = useState<PageId[]>(initialState.sidebarOrder)
  const [sidebarLabels, setSidebarLabels] = useState<Record<PageId, string>>(initialState.sidebarLabels)
  const [pageDevNotes, setPageDevNotes] = useState<Record<PageId, string>>(initialState.pageDevNotes)

  const hydrate = (next: PersistedAppState) => {
    setPage(next.page)
    setSidebarCollapsed(next.sidebarCollapsed)
    setSidebarOrder(next.sidebarOrder)
    setSidebarLabels(next.sidebarLabels)
    setPageDevNotes(next.pageDevNotes)
  }

  return {
    page,
    setPage,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOrder,
    setSidebarOrder,
    sidebarLabels,
    setSidebarLabels,
    pageDevNotes,
    setPageDevNotes,
    hydrate,
  }
}
