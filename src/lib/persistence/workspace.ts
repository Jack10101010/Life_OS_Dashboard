import {
  DashboardFinanceSheet,
  DashboardScratchpad,
  ScratchpadFreeNote,
  ScratchpadLineItem,
  ScratchpadTodoItem,
} from '../../types'
import { readJsonStorage, writeJsonStorage } from './storage'

export const WORKSPACE_RECORD_VERSION = 1
export const WORKSPACE_STORAGE_KEY = 'life-dashboard:workspace'

export type WorkspaceRecord = {
  version: number
  updatedAt: string
  workspace: DashboardScratchpad
}

export function getWorkspaceBackupStorageKey(slot: number) {
  return `${WORKSPACE_STORAGE_KEY}:backup:${slot}`
}

export function createEmptyWorkspaceScratchpad(): DashboardScratchpad {
  return {
    mode: 'free',
    text: '',
    freeNotes: [
      {
        id: 'workspace-note-1',
        title: 'Note 1',
        text: '',
      },
    ],
    activeFreeNoteId: 'workspace-note-1',
    moneyIn: [],
    moneyOut: [],
    notes: '',
    todoItems: [],
    financeSheets: {},
  }
}

export function isMeaningfulWorkspace(workspace: DashboardScratchpad) {
  return (
    hasMeaningfulString(workspace.text) ||
    workspace.freeNotes.some((note, index) => workspaceFreeNoteHasContent(note, index)) ||
    hasMeaningfulString(workspace.notes) ||
    workspace.moneyIn.some(hasMeaningfulLineItem) ||
    workspace.moneyOut.some(hasMeaningfulLineItem) ||
    Object.values(workspace.financeSheets).some(hasMeaningfulFinanceSheet) ||
    workspace.todoItems.some((item) => hasMeaningfulString(item.text))
  )
}

export function normalizeStoredWorkspaceRecord(raw: unknown): WorkspaceRecord | null {
  if (!raw || typeof raw !== 'object') return null

  const payload = raw as {
    version?: unknown
    updatedAt?: unknown
    workspace?: unknown
    scratchpad?: unknown
    mode?: unknown
    text?: unknown
    freeNotes?: unknown
    activeFreeNoteId?: unknown
    moneyIn?: unknown
    moneyOut?: unknown
    notes?: unknown
    todoItems?: unknown
    financeSheets?: unknown
  }

  const normalizedWorkspace = normalizeWorkspaceScratchpad(mergeWorkspaceSources(payload))

  return {
    version: typeof payload.version === 'number' ? payload.version : WORKSPACE_RECORD_VERSION,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
    workspace: normalizedWorkspace,
  }
}

export function readWorkspaceRecord(): WorkspaceRecord | null {
  if (typeof window === 'undefined') return null

  const canonicalRaw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  const canonicalRecord = canonicalRaw ? normalizeStoredWorkspaceRecord(safeParseWorkspacePayload(canonicalRaw)) : null

  if (canonicalRecord && isMeaningfulWorkspace(canonicalRecord.workspace)) {
    return canonicalRecord
  }

  const migratedRecord = findLatestLegacyWorkspaceRecord()
  if (migratedRecord) {
    persistMigratedWorkspaceRecord(migratedRecord.record, migratedRecord.sourceKey)
    return migratedRecord.record
  }

  if (canonicalRecord) {
    return canonicalRecord
  }

  return null
}

export function readWorkspaceBackups() {
  if (typeof window === 'undefined') return []

  return [1, 2, 3]
    .map((slot) => {
      const key = getWorkspaceBackupStorageKey(slot)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const record = normalizeStoredWorkspaceRecord(safeParseWorkspacePayload(raw))
      if (!record) return null
      return { slot, key, record }
    })
    .filter((backup): backup is { slot: number; key: string; record: WorkspaceRecord } => backup != null)
}

export function saveWorkspaceRecord(record: WorkspaceRecord) {
  if (typeof window === 'undefined') return { skipped: false as const }

  const currentRaw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  const currentRecord = currentRaw ? normalizeStoredWorkspaceRecord(safeParseWorkspacePayload(currentRaw)) : null
  const nextHasContent = isMeaningfulWorkspace(record.workspace)
  const currentHasContent = currentRecord ? isMeaningfulWorkspace(currentRecord.workspace) : false

  if (!nextHasContent && currentHasContent) {
    return { skipped: true as const }
  }

  if (currentRaw && currentRecord && currentHasContent) {
    for (let slot = 3; slot >= 2; slot -= 1) {
      const previousRaw = window.localStorage.getItem(getWorkspaceBackupStorageKey(slot - 1))
      if (previousRaw) window.localStorage.setItem(getWorkspaceBackupStorageKey(slot), previousRaw)
      else window.localStorage.removeItem(getWorkspaceBackupStorageKey(slot))
    }
    window.localStorage.setItem(getWorkspaceBackupStorageKey(1), currentRaw)
  }

  writeJsonStorage(WORKSPACE_STORAGE_KEY, record)
  return { skipped: false as const, record }
}

function persistMigratedWorkspaceRecord(record: WorkspaceRecord, sourceKey: string) {
  if (typeof window === 'undefined') return
  writeJsonStorage(WORKSPACE_STORAGE_KEY, record)
}

function findLatestLegacyWorkspaceRecord() {
  if (typeof window === 'undefined') return null

  const candidates = Object.keys(window.localStorage)
    .filter((key) => key.startsWith('life-dashboard:scratchpad:') || key.startsWith('life-dashboard:day:'))
    .map((key) => {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = safeParseWorkspacePayload(raw)
      const workspace = extractLegacyWorkspace(parsed)
      const normalized = workspace ? normalizeStoredWorkspaceRecord(workspace) : null
      if (!normalized || !isMeaningfulWorkspace(normalized.workspace)) return null
      return {
        sourceKey: key,
        record: {
          ...normalized,
          updatedAt:
            typeof (parsed as { updatedAt?: unknown })?.updatedAt === 'string'
              ? ((parsed as { updatedAt: string }).updatedAt)
              : normalized.updatedAt,
        },
      }
    })
    .filter((candidate): candidate is { sourceKey: string; record: WorkspaceRecord } => candidate != null)
    .sort((left, right) => {
      const leftTime = left.record.updatedAt ? Date.parse(left.record.updatedAt) : 0
      const rightTime = right.record.updatedAt ? Date.parse(right.record.updatedAt) : 0
      return rightTime - leftTime
    })

  return candidates[0] ?? null
}

function extractLegacyWorkspace(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null

  const payload = raw as {
    workspace?: unknown
    scratchpad?: unknown
    fullDay?: { dashboardScratchpad?: unknown }
    dashboardScratchpad?: unknown
  }

  return payload.workspace ?? payload.scratchpad ?? payload.fullDay?.dashboardScratchpad ?? payload.dashboardScratchpad ?? raw
}

function mergeWorkspaceSources(payload: {
  workspace?: unknown
  scratchpad?: unknown
  mode?: unknown
  text?: unknown
  freeNotes?: unknown
  activeFreeNoteId?: unknown
  moneyIn?: unknown
  moneyOut?: unknown
  notes?: unknown
  todoItems?: unknown
  financeSheets?: unknown
}) {
  const nested =
    payload.workspace && typeof payload.workspace === 'object'
      ? (payload.workspace as Record<string, unknown>)
      : payload.scratchpad && typeof payload.scratchpad === 'object'
        ? (payload.scratchpad as Record<string, unknown>)
        : {}

  return {
    mode: pickStoredField(nested.mode, payload.mode),
    text: pickStoredField(nested.text, payload.text),
    freeNotes: pickStoredCollection(nested.freeNotes, payload.freeNotes),
    activeFreeNoteId: pickStoredField(nested.activeFreeNoteId, payload.activeFreeNoteId),
    moneyIn: pickStoredCollection(nested.moneyIn, payload.moneyIn),
    moneyOut: pickStoredCollection(nested.moneyOut, payload.moneyOut),
    notes: pickStoredField(nested.notes, payload.notes),
    todoItems: pickStoredCollection(nested.todoItems, payload.todoItems),
    financeSheets: pickStoredCollection(nested.financeSheets, payload.financeSheets),
  }
}

function normalizeWorkspaceScratchpad(raw: unknown): DashboardScratchpad {
  const scratchpad = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const defaultMonthKey = new Date().toISOString().slice(0, 7)
  const normalizedFreeNotes = normalizeWorkspaceFreeNotes(scratchpad.freeNotes, scratchpad.text)
  const normalizedFinanceSheets = normalizeWorkspaceFinanceSheets(scratchpad, defaultMonthKey)
  const normalizedTodoItems = normalizeWorkspaceTodoItems(scratchpad.todoItems)

  const inferredMode =
    scratchpad.mode === 'structured' || scratchpad.mode === 'todo' || scratchpad.mode === 'free'
      ? scratchpad.mode
      : Object.keys(normalizedFinanceSheets).length > 0
        ? 'structured'
        : normalizedTodoItems.some((item) => hasMeaningfulString(item.text) || item.completed)
          ? 'todo'
          : 'free'

  return {
    mode: inferredMode,
    text: typeof scratchpad.text === 'string' ? scratchpad.text : '',
    freeNotes: normalizedFreeNotes,
    activeFreeNoteId: normalizeWorkspaceActiveFreeNoteId(scratchpad.activeFreeNoteId, normalizedFreeNotes),
    moneyIn: normalizeWorkspaceLineItems(scratchpad.moneyIn, 'in'),
    moneyOut: normalizeWorkspaceLineItems(scratchpad.moneyOut, 'out'),
    notes: typeof scratchpad.notes === 'string' ? scratchpad.notes : '',
    todoItems: normalizedTodoItems,
    financeSheets: normalizedFinanceSheets,
  }
}

function normalizeWorkspaceFreeNotes(raw: unknown, legacyText: unknown): ScratchpadFreeNote[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((note, index) => {
      const safeNote = note && typeof note === 'object' ? (note as Record<string, unknown>) : {}
      return {
        id:
          typeof safeNote.id === 'string' && safeNote.id.length > 0
            ? safeNote.id
            : `workspace-note-${index + 1}`,
        title:
          typeof safeNote.title === 'string' && safeNote.title.trim().length > 0
            ? safeNote.title.trim()
            : `Note ${index + 1}`,
        text: typeof safeNote.text === 'string' ? safeNote.text : '',
      }
    })
  }

  return [
    {
      id: 'workspace-note-1',
      title: 'Note 1',
      text: typeof legacyText === 'string' ? legacyText : '',
    },
  ]
}

function normalizeWorkspaceActiveFreeNoteId(raw: unknown, notes: ScratchpadFreeNote[]) {
  if (typeof raw === 'string' && notes.some((note) => note.id === raw)) return raw
  const populatedNote = notes.find((note, index) => workspaceFreeNoteHasContent(note, index))
  return populatedNote?.id ?? notes[0]?.id ?? null
}

function normalizeWorkspaceLineItems(raw: unknown, prefix: 'in' | 'out'): ScratchpadLineItem[] {
  if (!Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const safeItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id:
        typeof safeItem.id === 'string' && safeItem.id.length > 0
          ? safeItem.id
          : `workspace-${prefix}-${index}`,
      name: typeof safeItem.name === 'string' ? safeItem.name : '',
      day: typeof safeItem.day === 'string' ? safeItem.day : '',
      amount: safeItem.amount != null ? String(safeItem.amount) : '',
      settled: typeof safeItem.settled === 'boolean' ? safeItem.settled : false,
    }
  })
}

function normalizeWorkspaceTodoItems(raw: unknown): ScratchpadTodoItem[] {
  if (!Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const safeItem = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id:
        typeof safeItem.id === 'string' && safeItem.id.length > 0
          ? safeItem.id
          : `workspace-todo-${index}`,
      text: typeof safeItem.text === 'string' ? safeItem.text : '',
      completed: typeof safeItem.completed === 'boolean' ? safeItem.completed : false,
    }
  })
}

function normalizeWorkspaceFinanceSheets(raw: Record<string, unknown>, defaultMonthKey: string): Record<string, DashboardFinanceSheet> {
  const normalizedLegacyMoneyIn = normalizeWorkspaceLineItems(raw.moneyIn, 'in')
  const normalizedLegacyMoneyOut = normalizeWorkspaceLineItems(raw.moneyOut, 'out')
  const normalizedLegacyNotes = typeof raw.notes === 'string' ? raw.notes : ''

  if (raw.financeSheets && typeof raw.financeSheets === 'object' && !Array.isArray(raw.financeSheets)) {
    return Object.fromEntries(
      Object.entries(raw.financeSheets as Record<string, unknown>).map(([monthKey, sheet]) => [
        monthKey,
        normalizeWorkspaceFinanceSheet(sheet),
      ]),
    )
  }

  if (normalizedLegacyMoneyIn.length > 0 || normalizedLegacyMoneyOut.length > 0 || hasMeaningfulString(normalizedLegacyNotes)) {
    return {
      [defaultMonthKey]: {
        moneyIn: normalizedLegacyMoneyIn,
        moneyOut: normalizedLegacyMoneyOut,
        notes: normalizedLegacyNotes,
      },
    }
  }

  return {}
}

function normalizeWorkspaceFinanceSheet(raw: unknown): DashboardFinanceSheet {
  const sheet = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    moneyIn: normalizeWorkspaceLineItems(sheet.moneyIn, 'in'),
    moneyOut: normalizeWorkspaceLineItems(sheet.moneyOut, 'out'),
    notes: typeof sheet.notes === 'string' ? sheet.notes : '',
  }
}

function safeParseWorkspacePayload(raw: string) {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function pickStoredField(primary: unknown, fallback: unknown) {
  if (typeof primary === 'string' && primary.trim().length === 0 && typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback
  }
  return primary ?? fallback
}

function pickStoredCollection(primary: unknown, fallback: unknown) {
  if (Array.isArray(primary)) return primary.length > 0 ? primary : Array.isArray(fallback) ? fallback : primary
  if (primary && typeof primary === 'object') {
    return Object.keys(primary as Record<string, unknown>).length > 0 ? primary : fallback
  }
  return fallback ?? primary
}

function hasMeaningfulString(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function workspaceFreeNoteHasContent(note: ScratchpadFreeNote, index: number) {
  return hasMeaningfulString(note.text) || normalizeWorkspaceNoteTitle(note.title).trim() !== `Note ${index + 1}`
}

function normalizeWorkspaceNoteTitle(title: string) {
  return typeof title === 'string' ? title : ''
}

function hasMeaningfulLineItem(item: ScratchpadLineItem) {
  return hasMeaningfulString(item.name) || hasMeaningfulString(item.day) || hasMeaningfulString(item.amount)
}

function hasMeaningfulFinanceSheet(sheet: DashboardFinanceSheet) {
  return hasMeaningfulString(sheet.notes) || sheet.moneyIn.some(hasMeaningfulLineItem) || sheet.moneyOut.some(hasMeaningfulLineItem)
}
