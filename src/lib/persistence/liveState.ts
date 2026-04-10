import type { PersistedAppState } from './migrations'

const LIVE_STATE_DB_NAME = 'life-dashboard-state'
const LIVE_STATE_STORE_NAME = 'app-state'
const LIVE_STATE_DB_VERSION = 1
const LIVE_STATE_KEY = 'current'
const LIVE_STATE_IDB_TIMEOUT_MS = 4000

function withIndexedDbTimeout<T>(label: string, operation: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(`IndexedDB timeout during ${label}`))
    }, LIVE_STATE_IDB_TIMEOUT_MS)

    operation.then(
      (value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

function openLiveStateDb(): Promise<IDBDatabase> {
  return withIndexedDbTimeout('open', new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'))
      return
    }

    const request = window.indexedDB.open(LIVE_STATE_DB_NAME, LIVE_STATE_DB_VERSION)

    request.onerror = () => reject(request.error ?? new Error('Failed to open live state database'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(LIVE_STATE_STORE_NAME)) {
        database.createObjectStore(LIVE_STATE_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
  }))
}

export async function readPersistedAppStateFromIndexedDb(): Promise<Partial<PersistedAppState> | null> {
  const database = await openLiveStateDb()

  try {
    const transaction = database.transaction(LIVE_STATE_STORE_NAME, 'readonly')
    const store = transaction.objectStore(LIVE_STATE_STORE_NAME)

    return await withIndexedDbTimeout('read', new Promise((resolve, reject) => {
      const request = store.get(LIVE_STATE_KEY)
      request.onerror = () => reject(request.error ?? new Error('Failed to read live app state'))
      request.onsuccess = () => resolve((request.result as Partial<PersistedAppState> | undefined) ?? null)
    }))
  } finally {
    database.close()
  }
}

export async function writePersistedAppStateToIndexedDb(state: PersistedAppState): Promise<void> {
  const database = await openLiveStateDb()

  try {
    const transaction = database.transaction(LIVE_STATE_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(LIVE_STATE_STORE_NAME)

    await withIndexedDbTimeout('write', new Promise<void>((resolve, reject) => {
      const request = store.put(JSON.parse(JSON.stringify(state)), LIVE_STATE_KEY)
      request.onerror = () => reject(request.error ?? new Error('Failed to write live app state'))
      request.onsuccess = () => resolve()
    }))
  } finally {
    database.close()
  }
}

export const LIVE_PERSISTED_APP_STATE_DB_NAME = LIVE_STATE_DB_NAME
export const LIVE_PERSISTED_APP_STATE_STORE_NAME = LIVE_STATE_STORE_NAME
export const LIVE_PERSISTED_APP_STATE_KEY = LIVE_STATE_KEY
