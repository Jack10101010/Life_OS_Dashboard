import { APP_STATE_STORAGE_KEY } from './keys'
import { overlayCanonicalDayRecords } from './dayRecords'
import {
  LIVE_PERSISTED_APP_STATE_DB_NAME,
  LIVE_PERSISTED_APP_STATE_KEY,
  LIVE_PERSISTED_APP_STATE_STORE_NAME,
  readPersistedAppStateFromIndexedDb,
  writePersistedAppStateToIndexedDb,
} from './liveState'
import {
  getDefaultPersistedAppState,
  logOutcomeGoalTaskRecoveryAudit,
  migratePersistedStateUnifiedTasksPhase1,
  normalizePersistedAppState,
  PersistedAppState,
  repairOutcomeGoalTaskFieldsFromEmbedded,
} from './migrations'
import {
  createPersistedAppStateSnapshot,
  deletePersistedAppStateSnapshot,
  getPersistedAppStateSnapshot,
  listPersistedAppStateSnapshots,
} from './snapshots'
import { readJsonStorage } from './storage'

export type { PersistedAppState } from './migrations'
export { getDefaultPersistedAppState } from './migrations'
export type { PersistedAppStateSnapshotType } from './snapshots'
export type { PersistedAppStateSnapshotSummary } from './snapshots'
export {
  LIVE_PERSISTED_APP_STATE_DB_NAME,
  LIVE_PERSISTED_APP_STATE_KEY,
  LIVE_PERSISTED_APP_STATE_STORE_NAME,
} from './liveState'
export {
  createPersistedAppStateSnapshot,
  deletePersistedAppStateSnapshot,
  getPersistedAppStateSnapshot,
  listPersistedAppStateSnapshots,
} from './snapshots'

export type PersistedAppStateLoadResult = {
  state: PersistedAppState
  storageMode: 'indexeddb' | 'readonly-localstorage'
}

function logStartup(message: string, payload?: Record<string, unknown>) {
  console.info(`[app-startup] ${message}`, payload ?? {})
}

export function createPersistedAppStateBackupSnapshot<T>(state: T) {
  return JSON.parse(JSON.stringify(state)) as T
}

export function getPersistedAppStateBackupFilename(date = new Date()) {
  const iso = date.toISOString().replace(/[:]/g, '-').replace(/\.\d{3}Z$/, 'Z')
  return `life-dashboard-backup-${iso}.json`
}

function isValidImportedPersistedAppStateShape(value: unknown): value is Partial<PersistedAppState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<PersistedAppState>
  if (!candidate.dataByYear || typeof candidate.dataByYear !== 'object' || Array.isArray(candidate.dataByYear)) return false
  if (candidate.tasks != null && !Array.isArray(candidate.tasks)) return false
  if (candidate.lifeGoals != null && !Array.isArray(candidate.lifeGoals)) return false
  if (candidate.habitTrackers != null && !Array.isArray(candidate.habitTrackers)) return false
  if (candidate.settings != null && (typeof candidate.settings !== 'object' || Array.isArray(candidate.settings))) return false
  return true
}

export function normalizeImportedPersistedAppState(value: unknown, currentYear: number) {
  if (!isValidImportedPersistedAppStateShape(value)) {
    throw new Error('Invalid backup format')
  }
  logStartup('normalizeStart', { source: 'import-restore' })
  const normalizedState = runTaskRelatedStatePipeline(value, currentYear)
  logStartup('normalizeSuccess', { source: 'import-restore' })
  return normalizedState
}

function runTaskRelatedStatePipeline(parsed: Partial<PersistedAppState>, currentYear: number): PersistedAppState {
  const withCanonicalDays =
    parsed.dataByYear && typeof parsed.dataByYear === 'object'
      ? {
          ...parsed,
          dataByYear: overlayCanonicalDayRecords(parsed.dataByYear as PersistedAppState['dataByYear']),
        }
      : parsed
  const migratedForStartup = (() => {
    try {
      return migratePersistedStateUnifiedTasksPhase1(withCanonicalDays)
    } catch {
      return withCanonicalDays
    }
  })()
  const repairedForStartup = (() => {
    try {
      return repairOutcomeGoalTaskFieldsFromEmbedded(migratedForStartup)
    } catch {
      return migratedForStartup
    }
  })()
  try {
    logOutcomeGoalTaskRecoveryAudit(repairedForStartup)
  } catch {
    // Diagnostic logging must never affect startup.
  }
  return normalizePersistedAppState(repairedForStartup, currentYear)
}

export async function loadPersistedAppState(currentYear: number): Promise<PersistedAppStateLoadResult> {
  logStartup('hydrationStart', { currentYear })
  try {
    logStartup('indexedDbReadStart', {
      db: LIVE_PERSISTED_APP_STATE_DB_NAME,
      store: LIVE_PERSISTED_APP_STATE_STORE_NAME,
      key: LIVE_PERSISTED_APP_STATE_KEY,
    })
    const indexedDbState = await readPersistedAppStateFromIndexedDb()
    if (indexedDbState && typeof indexedDbState === 'object') {
      logStartup('indexedDbReadSuccess', { found: true })
      logStartup('normalizeStart', { source: 'indexeddb' })
      const normalizedState = runTaskRelatedStatePipeline(indexedDbState, currentYear)
      logStartup('normalizeSuccess', { source: 'indexeddb' })
      return {
        state: normalizedState,
        storageMode: 'indexeddb',
      }
    }
    logStartup('indexedDbReadSuccess', { found: false })

    logStartup('localStorageFallbackStart', { key: APP_STATE_STORAGE_KEY })
    const localStorageState = readJsonStorage<Partial<PersistedAppState>>(APP_STATE_STORAGE_KEY)
    if (localStorageState && typeof localStorageState === 'object') {
      logStartup('localStorageFallbackSuccess', { found: true })
      await createPersistedAppStateSnapshot({
        payload: createPersistedAppStateBackupSnapshot(localStorageState),
        snapshotType: 'pre_migration',
        force: true,
      })
      logStartup('normalizeStart', { source: 'localstorage' })
      const normalizedState = runTaskRelatedStatePipeline(localStorageState, currentYear)
      logStartup('normalizeSuccess', { source: 'localstorage' })
      await writePersistedAppStateToIndexedDb(normalizedState)
      logStartup('indexedDbWriteSuccess', { source: 'localstorage-migration' })
      return {
        state: normalizedState,
        storageMode: 'indexeddb',
      }
    }
    logStartup('localStorageFallbackSuccess', { found: false })

    logStartup('defaultStateUsed', { reason: 'no-indexeddb-or-localstorage-state' })
    return {
      state: getDefaultPersistedAppState(currentYear),
      storageMode: 'indexeddb',
    }
  } catch (error) {
    logStartup('indexedDbFailure', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    console.error('IndexedDB persistence unavailable; falling back to localStorage read-only mode.', error)
    logStartup('localStorageFallbackStart', { key: APP_STATE_STORAGE_KEY, mode: 'readonly-localstorage' })
    const localStorageState = readJsonStorage<Partial<PersistedAppState>>(APP_STATE_STORAGE_KEY)
    if (localStorageState && typeof localStorageState === 'object') {
      logStartup('localStorageFallbackSuccess', { found: true, mode: 'readonly-localstorage' })
      logStartup('normalizeStart', { source: 'localstorage-readonly' })
      const normalizedState = runTaskRelatedStatePipeline(localStorageState, currentYear)
      logStartup('normalizeSuccess', { source: 'localstorage-readonly' })
      return {
        state: normalizedState,
        storageMode: 'readonly-localstorage',
      }
    }

    logStartup('totalLoadFailureFallbackDefault', {})
    return {
      state: getDefaultPersistedAppState(currentYear),
      storageMode: 'readonly-localstorage',
    }
  }
}

export async function savePersistedAppState(state: PersistedAppState) {
  try {
    await writePersistedAppStateToIndexedDb(state)
    return true
  } catch (error) {
    console.error('Failed to save live app state to IndexedDB.', error)
    return false
  }
}

export function exportPersistedAppState(state: PersistedAppState) {
  return JSON.stringify(state, null, 2)
}

export function importPersistedAppState(raw: string, currentYear: number) {
  const parsed = JSON.parse(raw) as Partial<PersistedAppState>
  return normalizeImportedPersistedAppState(parsed, currentYear)
}
