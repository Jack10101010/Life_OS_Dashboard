import { DashboardExecution, DashboardExecutionStatus } from '../types'

const VALID_EXECUTION_STATUSES: DashboardExecutionStatus[] = ['idle', 'started', 'partial', 'complete']

export function createEmptyDashboardExecution(): DashboardExecution {
  return {
    goal: '',
    whyItMatters: '',
    todayTask: '',
    nextAction: '',
    minimumVersion: '',
    status: 'idle',
    deepWorkDone: false,
    movementDone: false,
    nightResetReflection: '',
    nightResetNextTask: '',
  }
}

export function normalizeDashboardExecution(
  raw: unknown,
  fallback: DashboardExecution = createEmptyDashboardExecution(),
): DashboardExecution {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback }
  }

  const execution = raw as Partial<DashboardExecution> & Record<string, unknown>

  return {
    goal: normalizeString(execution.goal, fallback.goal),
    whyItMatters: normalizeString(execution.whyItMatters, fallback.whyItMatters),
    todayTask: normalizeString(execution.todayTask, fallback.todayTask),
    nextAction: normalizeString(execution.nextAction, fallback.nextAction),
    minimumVersion: normalizeString(execution.minimumVersion, fallback.minimumVersion),
    status: VALID_EXECUTION_STATUSES.includes(execution.status as DashboardExecutionStatus)
      ? (execution.status as DashboardExecutionStatus)
      : fallback.status,
    deepWorkDone: typeof execution.deepWorkDone === 'boolean' ? execution.deepWorkDone : fallback.deepWorkDone,
    movementDone: typeof execution.movementDone === 'boolean' ? execution.movementDone : fallback.movementDone,
    nightResetReflection: normalizeString(execution.nightResetReflection, fallback.nightResetReflection),
    nightResetNextTask: normalizeString(execution.nightResetNextTask, fallback.nightResetNextTask),
  }
}

export function dashboardExecutionHasMeaningfulContent(execution: DashboardExecution | null | undefined) {
  if (!execution) return false

  return (
    hasMeaningfulString(execution.goal) ||
    hasMeaningfulString(execution.whyItMatters) ||
    hasMeaningfulString(execution.todayTask) ||
    hasMeaningfulString(execution.nextAction) ||
    hasMeaningfulString(execution.minimumVersion) ||
    execution.status !== 'idle' ||
    execution.deepWorkDone ||
    execution.movementDone ||
    hasMeaningfulString(execution.nightResetReflection) ||
    hasMeaningfulString(execution.nightResetNextTask)
  )
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function hasMeaningfulString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}
