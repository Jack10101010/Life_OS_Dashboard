import { APP_STATE_STORAGE_KEY } from './keys'
import { overlayCanonicalDayRecords } from './dayRecords'
import { getDefaultPersistedAppState, normalizePersistedAppState, PersistedAppState } from './migrations'
import { readJsonStorage, writeJsonStorage } from './storage'

export type { PersistedAppState } from './migrations'
export { getDefaultPersistedAppState } from './migrations'

export function loadPersistedAppState(currentYear: number): PersistedAppState {
  const parsed = readJsonStorage<Partial<PersistedAppState>>(APP_STATE_STORAGE_KEY)
  if (!parsed || typeof parsed !== 'object') {
    return getDefaultPersistedAppState(currentYear)
  }
  const withCanonicalDays =
    parsed.dataByYear && typeof parsed.dataByYear === 'object'
      ? {
          ...parsed,
          dataByYear: overlayCanonicalDayRecords(parsed.dataByYear as PersistedAppState['dataByYear']),
        }
      : parsed
  return normalizePersistedAppState(withCanonicalDays, currentYear)
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
