import { useState } from 'react'
import { DashboardBlockLayoutItem } from '../types'

export function useDashboardState(initialLayout: DashboardBlockLayoutItem[]) {
  const [dashboardLayout, setDashboardLayout] = useState(initialLayout)

  const hydrate = (next: DashboardBlockLayoutItem[]) => {
    setDashboardLayout(next)
  }

  return {
    dashboardLayout,
    setDashboardLayout,
    hydrate,
  }
}
