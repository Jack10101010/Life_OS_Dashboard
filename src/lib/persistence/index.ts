import { APP_STATE_STORAGE_KEY } from './keys'
import { getDefaultPersistedAppState, normalizePersistedAppState, PersistedAppState } from './migrations'
import { readJsonStorage, writeJsonStorage } from './storage'

export type { PersistedAppState } from './migrations'
export { getDefaultPersistedAppState } from './migrations'

export function loadPersistedAppState(currentYear: number): PersistedAppState {
  const parsed = readJsonStorage<Partial<PersistedAppState>>(APP_STATE_STORAGE_KEY)
  if (!parsed || typeof parsed !== 'object') {
    return getDefaultPersistedAppState(currentYear)
  }
  return normalizePersistedAppState(parsed, currentYear)
}

export function savePersistedAppState(state: PersistedAppState) {
  writeJsonStorage(APP_STATE_STORAGE_KEY, state)
}

export function exportPersistedAppState(state: PersistedAppState) {
  return JSON.stringify(state, null, 2)
}

export function importPersistedAppState(raw: string, currentYear: number) {
  const parsed = JSON.parse(raw) as Partial<PersistedAppState>
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup format')
  }
  return normalizePersistedAppState(parsed, currentYear)
}
