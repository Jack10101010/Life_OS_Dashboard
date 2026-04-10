import { stripLegacyEmbeddedGoalTasksFromState, type PersistedAppState } from './migrations'

export type PersistedAppStateSnapshotType = 'auto' | 'manual' | 'pre_migration' | 'pre_import' | 'pre_restore'

export interface PersistedAppStateSnapshot {
  id: string
  createdAt: string
  schemaVersion: number
  appVersion?: string
  snapshotType: PersistedAppStateSnapshotType
  fingerprint: string
  payload: Partial<PersistedAppState>
}

export type PersistedAppStateSnapshotSummary = Omit<PersistedAppStateSnapshot, 'payload'>

const SNAPSHOT_DB_NAME = 'life-dashboard-snapshots'
const SNAPSHOT_STORE_NAME = 'snapshots'
const SNAPSHOT_DB_VERSION = 1
export const APP_STATE_SNAPSHOT_SCHEMA_VERSION = 1

function cloneSnapshotPayload(payload: Partial<PersistedAppState>) {
  return JSON.parse(JSON.stringify(stripLegacyEmbeddedGoalTasksFromState(payload))) as Partial<PersistedAppState>
}

function createSnapshotId() {
  return `snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function hashSnapshotPayload(payload: Partial<PersistedAppState>) {
  const raw = JSON.stringify(payload)
  let hash = 5381
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 33) ^ raw.charCodeAt(index)
  }
  return `fp-${(hash >>> 0).toString(36)}-${raw.length.toString(36)}`
}

function getSnapshotDayKey(createdAt: string) {
  return createdAt.slice(0, 10)
}

function getSnapshotWeekKey(createdAt: string) {
  const date = new Date(createdAt)
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function toSnapshotSummary(snapshot: PersistedAppStateSnapshot): PersistedAppStateSnapshotSummary {
  const { payload: _payload, ...summary } = snapshot
  return summary
}

function openSnapshotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = window.indexedDB.open(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('Failed to open snapshot database'))
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE_NAME)) {
        database.createObjectStore(SNAPSHOT_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function withSnapshotStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return openSnapshotDb().then((database) => {
    const transaction = database.transaction(SNAPSHOT_STORE_NAME, mode)
    const store = transaction.objectStore(SNAPSHOT_STORE_NAME)
    return operation(store).finally(() => database.close())
  })
}

function getAllSnapshotsFromStore(store: IDBObjectStore): Promise<PersistedAppStateSnapshot[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onerror = () => reject(request.error ?? new Error('Failed to read snapshots'))
    request.onsuccess = () => {
      const snapshots = Array.isArray(request.result) ? (request.result as PersistedAppStateSnapshot[]) : []
      resolve(snapshots.sort((left, right) => right.createdAt.localeCompare(left.createdAt)))
    }
  })
}

function putSnapshotInStore(store: IDBObjectStore, snapshot: PersistedAppStateSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.put(snapshot)
    request.onerror = () => reject(request.error ?? new Error('Failed to save snapshot'))
    request.onsuccess = () => resolve()
  })
}

function deleteSnapshotInStore(store: IDBObjectStore, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onerror = () => reject(request.error ?? new Error('Failed to delete snapshot'))
    request.onsuccess = () => resolve()
  })
}

function getSnapshotFromStore(store: IDBObjectStore, id: string): Promise<PersistedAppStateSnapshot | null> {
  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onerror = () => reject(request.error ?? new Error('Failed to load snapshot'))
    request.onsuccess = () => resolve((request.result as PersistedAppStateSnapshot | undefined) ?? null)
  })
}

function getRetainedSnapshotIds(summaries: PersistedAppStateSnapshotSummary[]) {
  const keep = new Set<string>()

  summaries.slice(0, 20).forEach((summary) => keep.add(summary.id))

  const dailyKeys = new Set<string>()
  for (const summary of summaries) {
    const dayKey = getSnapshotDayKey(summary.createdAt)
    if (dailyKeys.has(dayKey)) continue
    dailyKeys.add(dayKey)
    keep.add(summary.id)
    if (dailyKeys.size >= 7) break
  }

  const weeklyKeys = new Set<string>()
  for (const summary of summaries) {
    const weekKey = getSnapshotWeekKey(summary.createdAt)
    if (weeklyKeys.has(weekKey)) continue
    weeklyKeys.add(weekKey)
    keep.add(summary.id)
    if (weeklyKeys.size >= 4) break
  }

  return keep
}

async function pruneSnapshotsInStore(store: IDBObjectStore) {
  const snapshots = await getAllSnapshotsFromStore(store)
  const summaries = snapshots.map(toSnapshotSummary)
  const keepIds = getRetainedSnapshotIds(summaries)
  const deletions = snapshots
    .filter((snapshot) => !keepIds.has(snapshot.id))
    .map((snapshot) => deleteSnapshotInStore(store, snapshot.id))
  await Promise.all(deletions)
}

export async function listPersistedAppStateSnapshots(): Promise<PersistedAppStateSnapshotSummary[]> {
  try {
    return await withSnapshotStore('readonly', async (store) => {
      const snapshots = await getAllSnapshotsFromStore(store)
      return snapshots.map(toSnapshotSummary)
    })
  } catch {
    return []
  }
}

export async function getPersistedAppStateSnapshot(id: string): Promise<PersistedAppStateSnapshot | null> {
  try {
    return await withSnapshotStore('readonly', (store) => getSnapshotFromStore(store, id))
  } catch {
    return null
  }
}

export async function createPersistedAppStateSnapshot(options: {
  payload: Partial<PersistedAppState>
  snapshotType: PersistedAppStateSnapshotType
  schemaVersion?: number
  appVersion?: string
  force?: boolean
}): Promise<PersistedAppStateSnapshotSummary | null> {
  const payload = cloneSnapshotPayload(options.payload)
  const fingerprint = hashSnapshotPayload(payload)

  try {
    return await withSnapshotStore('readwrite', async (store) => {
      const existing = await getAllSnapshotsFromStore(store)
      const latest = existing[0] ?? null

      if (!options.force && latest && latest.fingerprint === fingerprint) {
        return toSnapshotSummary(latest)
      }

      const snapshot: PersistedAppStateSnapshot = {
        id: createSnapshotId(),
        createdAt: new Date().toISOString(),
        schemaVersion: options.schemaVersion ?? APP_STATE_SNAPSHOT_SCHEMA_VERSION,
        appVersion: options.appVersion,
        snapshotType: options.snapshotType,
        fingerprint,
        payload,
      }

      await putSnapshotInStore(store, snapshot)
      await pruneSnapshotsInStore(store)
      return toSnapshotSummary(snapshot)
    })
  } catch {
    return null
  }
}

export async function deletePersistedAppStateSnapshot(id: string): Promise<boolean> {
  try {
    await withSnapshotStore('readwrite', async (store) => {
      await deleteSnapshotInStore(store, id)
    })
    return true
  } catch {
    return false
  }
}
