import { useMemo } from 'react'
import { LifeGoalTask } from '../../../types'
import { getRoadmapTaskSections } from '../lib/taskDerivations'

export function useRoadmapSections(tasks: LifeGoalTask[]) {
  return useMemo(() => getRoadmapTaskSections(tasks), [tasks])
}
