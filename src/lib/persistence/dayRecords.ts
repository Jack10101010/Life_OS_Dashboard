import {
  DashboardFinanceSheet,
  DashboardScratchpad,
  DayEventEntry,
  DayEntry,
  DayLogSection,
  DayTagEntry,
  MedicationSupplementEntry,
  ScratchpadFreeNote,
  ScratchpadLineItem,
  ScratchpadTodoItem,
  WeekEntry,
} from '../../types'
import {
  createEmptyDashboardExecution,
  dashboardExecutionHasMeaningfulContent,
  normalizeDashboardExecution,
} from '../dashboardExecution'

export const DAY_RECORD_VERSION = 1

type DayRecordSections = {
  sleep: {
    bedtime: string
    wakeTime: string
    sleepQuality: number | null
    wokeDuringNight: boolean | null
  }
  morning: {
    mood: number | null
    motivation: number | null
    clarity: number | null
    energy: number | null
    intention: string
    tagEntries: DayEntry['tagEntries']
  }
  day: {
    isLogged: boolean
    tasks: string[]
    reminders: string[]
    dailyActions: DayEventEntry[]
    medications: DayEntry['medications']
    tagEntries: DayEntry['tagEntries']
    bigWin: string
    journal: string
    dashboardQuickNote: string
    dashboardExecution: DayEntry['dashboardExecution']
    dailyIntentCompleteOneTask: boolean
    cellColor: DayEntry['cellColor']
    lowStateEntry: DayEntry['lowStateEntry']
  }
  evening: {
    moodNote: string
    outcome: DayEntry['eveningOutcome']
    unstable: boolean
    trajectory: DayEntry['eveningTrajectory']
    selfInfluence: DayEntry['eveningSelfInfluence']
    journal: string
    tagEntries: DayEntry['tagEntries']
  }
  scratchpad: DayEntry['dashboardScratchpad']
}

export type CanonicalDayRecord = DayRecordSections & {
  version: number
  date: string
  updatedAt: string
  fullDay: DayEntry
}

export function getCanonicalDayStorageKey(date: string) {
  return `life-dashboard:day:${date}`
}

export function getCanonicalDayBackupStorageKey(date: string, slot: number) {
  return `${getCanonicalDayStorageKey(date)}:backup:${slot}`
}

export function getLegacyScratchpadStorageKey(date: string) {
  return `life-dashboard:scratchpad:${date}`
}

function persistMigratedCanonicalDayRecord(record: CanonicalDayRecord) {
  if (typeof window === 'undefined') return

  const canonicalKey = getCanonicalDayStorageKey(record.date)
  window.localStorage.setItem(canonicalKey, JSON.stringify(record))
  console.info('[day-record-debug] migrationPersisted', {
    date: record.date,
    key: canonicalKey,
    updatedAt: record.updatedAt,
  })
}

export function buildCanonicalDayRecord(day: DayEntry): CanonicalDayRecord {
  return {
    version: DAY_RECORD_VERSION,
    date: day.date,
    updatedAt: day.updatedAt ?? new Date().toISOString(),
    sleep: {
      bedtime: day.bedtime,
      wakeTime: day.wakeTime,
      sleepQuality: day.sleepQuality,
      wokeDuringNight: day.wokeDuringNight,
    },
    morning: {
      mood: day.mood,
      motivation: day.motivation,
      clarity: day.clarity,
      energy: day.energy,
      intention: day.morningIntention,
      tagEntries: day.tagEntries.filter((entry) => entry.timeSection === 'morning'),
    },
    day: {
      isLogged: day.isLogged,
      tasks: day.tasks,
      reminders: day.reminders,
      dailyActions: day.dailyActions,
      medications: day.medications,
      tagEntries: day.tagEntries.filter((entry) => entry.timeSection === 'day'),
      bigWin: day.bigWin,
      journal: day.journal,
      dashboardQuickNote: day.dashboardQuickNote,
      dashboardExecution: day.dashboardExecution,
      dailyIntentCompleteOneTask: day.dailyIntentCompleteOneTask,
      cellColor: day.cellColor,
      lowStateEntry: day.lowStateEntry,
    },
    evening: {
      moodNote: day.moodNote,
      outcome: day.eveningOutcome,
      unstable: day.eveningUnstable,
      trajectory: day.eveningTrajectory,
      selfInfluence: day.eveningSelfInfluence,
      journal: day.journal,
      tagEntries: day.tagEntries.filter((entry) => entry.timeSection === 'evening'),
    },
    scratchpad: day.dashboardScratchpad,
    fullDay: day,
  }
}

export function isMeaningfulContent(record: CanonicalDayRecord | DayEntry | null | undefined) {
  if (!record) return false
  const day = 'fullDay' in record ? record.fullDay : record

  return (
    day.isLogged ||
    day.mood !== null ||
    day.motivation !== null ||
    day.clarity !== null ||
    day.energy !== null ||
    day.sleepQuality !== null ||
    day.bedtime.trim().length > 0 ||
    day.wakeTime.trim().length > 0 ||
    day.wokeDuringNight !== null ||
    day.eveningOutcome !== null ||
    day.eveningUnstable ||
    day.eveningTrajectory !== null ||
    day.eveningSelfInfluence !== null ||
    day.morningIntention.trim().length > 0 ||
    day.moodNote.trim().length > 0 ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
    day.dashboardQuickNote.trim().length > 0 ||
    dashboardExecutionHasMeaningfulContent(day.dashboardExecution) ||
    day.dailyIntentCompleteOneTask ||
    hasMeaningfulLowStateEntry(day.lowStateEntry) ||
    day.completedHabitIds.length > 0 ||
    day.habitsCompleted > 0 ||
    day.drank ||
    day.medications.length > 0 ||
    day.medications.some(hasMeaningfulMedication) ||
    day.tasks.some(hasMeaningfulString) ||
    day.reminders.some(hasMeaningfulString) ||
    day.dailyActions.some(hasMeaningfulDayEvent) ||
    day.tagEntries.some(hasMeaningfulTagEntry) ||
    day.tags.length > 0
  )
}

export function scratchpadHasMeaningfulContent(scratchpad: DayEntry['dashboardScratchpad']) {
  return (
    hasMeaningfulString(scratchpad.text) ||
    scratchpad.freeNotes.some((note, index) => isMeaningfulFreeNote(note, index)) ||
    scratchpad.notes.trim().length > 0 ||
    scratchpad.moneyIn.some(hasMeaningfulScratchpadLineItem) ||
    scratchpad.moneyOut.some(hasMeaningfulScratchpadLineItem) ||
    Object.values(scratchpad.financeSheets).some(hasMeaningfulFinanceSheet) ||
    scratchpad.todoItems.some((item) => hasMeaningfulString(item.text))
  )
}

export function readCanonicalDayRecord(date: string, fallbackDay?: DayEntry): CanonicalDayRecord | null {
  if (typeof window === 'undefined') return null

  const canonicalKey = getCanonicalDayStorageKey(date)
  const legacyKey = getLegacyScratchpadStorageKey(date)

  console.info('[day-record-debug] hydrationStart', { date, canonicalKey, legacyKey })

  const canonicalRaw = window.localStorage.getItem(canonicalKey)
  console.info('[day-record-debug] canonicalLookup', {
    date,
    key: canonicalKey,
    found: Boolean(canonicalRaw),
  })
  const canonicalRecord = canonicalRaw ? normalizeStoredDayRecord(safeParse(canonicalRaw), date, fallbackDay) : null
  if (canonicalRecord) {
    console.info('[day-record-debug] hydrationComplete', {
      date,
      source: 'canonical',
      updatedAt: canonicalRecord.updatedAt,
      meaningful: isMeaningfulContent(canonicalRecord),
    })
    return canonicalRecord
  }

  const legacyScratchpadRaw = window.localStorage.getItem(legacyKey)
  console.info('[day-record-debug] legacyLookup', {
    date,
    key: legacyKey,
    found: Boolean(legacyScratchpadRaw),
  })
  const legacyRecord = legacyScratchpadRaw ? normalizeStoredDayRecord(safeParse(legacyScratchpadRaw), date, fallbackDay) : null
  if (legacyRecord && isMeaningfulContent(legacyRecord)) {
    persistMigratedCanonicalDayRecord(legacyRecord)
    console.info('[day-record-debug] migrationOccurred', {
      date,
      from: legacyKey,
      to: canonicalKey,
      updatedAt: legacyRecord.updatedAt,
    })
    console.info('[day-record-debug] hydrationComplete', {
      date,
      source: 'legacy-scratchpad',
      updatedAt: legacyRecord.updatedAt,
      meaningful: true,
    })
    return legacyRecord
  }

  console.info('[day-record-debug] hydrationComplete', { date, source: 'none', meaningful: false })
  return null
}

export function readCanonicalDayBackups(date: string, fallbackDay?: DayEntry) {
  if (typeof window === 'undefined') return []

  return [1, 2, 3]
    .map((slot) => {
      const key = getCanonicalDayBackupStorageKey(date, slot)
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const record = normalizeStoredDayRecord(safeParse(raw), date, fallbackDay)
      if (!record) return null
      return { slot, key, record }
    })
    .filter((backup): backup is { slot: number; key: string; record: CanonicalDayRecord } => backup != null)
}

export function saveCanonicalDayRecord(day: DayEntry) {
  if (typeof window === 'undefined') return { skipped: false as const }

  const nextRecord = buildCanonicalDayRecord(day)
  const storageKey = getCanonicalDayStorageKey(day.date)
  const currentRaw = window.localStorage.getItem(storageKey)
  const currentRecord = currentRaw ? normalizeStoredDayRecord(safeParse(currentRaw), day.date, day) : null
  const nextHasContent = isMeaningfulContent(nextRecord)
  const currentHasContent = currentRecord ? isMeaningfulContent(currentRecord) : false

  if (!nextHasContent && currentHasContent) {
    console.warn('[day-record-debug] saveSkipped', {
      reason: 'Prevented placeholder or empty day state from overwriting meaningful stored day data.',
      date: day.date,
      storageKey,
    })
    return { skipped: true as const }
  }

  if (currentRaw && currentRecord && currentHasContent) {
    for (let slot = 3; slot >= 2; slot -= 1) {
      const previousRaw = window.localStorage.getItem(getCanonicalDayBackupStorageKey(day.date, slot - 1))
      if (previousRaw) window.localStorage.setItem(getCanonicalDayBackupStorageKey(day.date, slot), previousRaw)
      else window.localStorage.removeItem(getCanonicalDayBackupStorageKey(day.date, slot))
    }
    window.localStorage.setItem(getCanonicalDayBackupStorageKey(day.date, 1), currentRaw)
    console.info('[day-record-debug] backupCreated', {
      date: day.date,
      storageKey: getCanonicalDayBackupStorageKey(day.date, 1),
      updatedAt: currentRecord.updatedAt,
    })
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextRecord))
  return { skipped: false as const, record: nextRecord }
}

export function clearCanonicalDayRecord(date: string, fallbackDay?: DayEntry) {
  if (typeof window === 'undefined') return

  const storageKey = getCanonicalDayStorageKey(date)
  const currentRaw = window.localStorage.getItem(storageKey)
  const currentRecord = currentRaw ? normalizeStoredDayRecord(safeParse(currentRaw), date, fallbackDay) : null
  if (currentRaw && currentRecord && isMeaningfulContent(currentRecord)) {
    for (let slot = 3; slot >= 2; slot -= 1) {
      const previousRaw = window.localStorage.getItem(getCanonicalDayBackupStorageKey(date, slot - 1))
      if (previousRaw) window.localStorage.setItem(getCanonicalDayBackupStorageKey(date, slot), previousRaw)
      else window.localStorage.removeItem(getCanonicalDayBackupStorageKey(date, slot))
    }
    window.localStorage.setItem(getCanonicalDayBackupStorageKey(date, 1), currentRaw)
  }
  window.localStorage.removeItem(storageKey)
}

export function overlayCanonicalDayRecords(dataByYear: Record<number, { days: DayEntry[]; weeks: WeekEntry[] }>) {
  return Object.fromEntries(
    Object.entries(dataByYear).map(([year, dataset]) => [
      year,
      {
        ...dataset,
        days: dataset.days.map((day) => {
          const record = readCanonicalDayRecord(day.date, day)
          if (!record) return day
          return { ...day, ...record.fullDay }
        }),
      },
    ]),
  ) as typeof dataByYear
}

export function normalizeStoredDayRecord(raw: unknown, viewedDate: string, fallbackDay?: DayEntry): CanonicalDayRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const parsed = raw as Partial<CanonicalDayRecord> & Record<string, unknown> & { fullDay?: Partial<DayEntry> }
  const normalizedDate = typeof parsed.date === 'string' && parsed.date.trim().length > 0 ? parsed.date : viewedDate
  const baseDay = createEmptyDayEntry(normalizedDate, fallbackDay)
  const candidateDay = mergeCanonicalSectionsIntoDayCandidate(parsed) as Partial<DayEntry> & Record<string, unknown>
  const normalizedScratchpad = normalizeStoredScratchpad(extractLegacyScratchpad(raw), normalizedDate, baseDay.dashboardScratchpad)
  const normalizedTagEntries = normalizeStoredTagEntries(candidateDay, baseDay.tags)
  const normalizedDay = normalizeDayEntryLike(candidateDay, baseDay, normalizedScratchpad, normalizedTagEntries, normalizedDate)

  return {
    version: typeof parsed.version === 'number' ? parsed.version : DAY_RECORD_VERSION,
    date: normalizedDate,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : normalizedDay.updatedAt ?? new Date().toISOString(),
    sleep: {
      bedtime: normalizedDay.bedtime,
      wakeTime: normalizedDay.wakeTime,
      sleepQuality: normalizedDay.sleepQuality,
      wokeDuringNight: normalizedDay.wokeDuringNight,
    },
    morning: {
      mood: normalizedDay.mood,
      motivation: normalizedDay.motivation,
      clarity: normalizedDay.clarity,
      energy: normalizedDay.energy,
      intention: normalizedDay.morningIntention,
      tagEntries: normalizedDay.tagEntries.filter((entry) => entry.timeSection === 'morning'),
    },
    day: {
      isLogged: normalizedDay.isLogged,
      tasks: normalizedDay.tasks,
      reminders: normalizedDay.reminders,
      dailyActions: normalizedDay.dailyActions,
      medications: normalizedDay.medications,
      tagEntries: normalizedDay.tagEntries.filter((entry) => entry.timeSection === 'day'),
      bigWin: normalizedDay.bigWin,
      journal: normalizedDay.journal,
      dashboardQuickNote: normalizedDay.dashboardQuickNote,
      dashboardExecution: normalizedDay.dashboardExecution,
      dailyIntentCompleteOneTask: normalizedDay.dailyIntentCompleteOneTask,
      cellColor: normalizedDay.cellColor,
      lowStateEntry: normalizedDay.lowStateEntry,
    },
    evening: {
      moodNote: normalizedDay.moodNote,
      outcome: normalizedDay.eveningOutcome,
      unstable: normalizedDay.eveningUnstable,
      trajectory: normalizedDay.eveningTrajectory,
      selfInfluence: normalizedDay.eveningSelfInfluence,
      journal: normalizedDay.journal,
      tagEntries: normalizedDay.tagEntries.filter((entry) => entry.timeSection === 'evening'),
    },
    scratchpad: normalizedDay.dashboardScratchpad,
    fullDay: normalizedDay,
  }
}

function mergeCanonicalSectionsIntoDayCandidate(
  parsed: Partial<CanonicalDayRecord> & Record<string, unknown> & { fullDay?: Partial<DayEntry> },
) {
  const fullDay =
    parsed.fullDay && typeof parsed.fullDay === 'object'
      ? { ...(parsed.fullDay as Partial<DayEntry> & Record<string, unknown>) }
      : {}

  const morningSection = parsed.morning && typeof parsed.morning === 'object' ? parsed.morning : null
  const daySection = parsed.day && typeof parsed.day === 'object' ? parsed.day : null
  const eveningSection = parsed.evening && typeof parsed.evening === 'object' ? parsed.evening : null
  const sleepSection = parsed.sleep && typeof parsed.sleep === 'object' ? parsed.sleep : null

  return {
    ...parsed,
    ...fullDay,
    isLogged: daySection && 'isLogged' in daySection ? daySection.isLogged : fullDay.isLogged ?? parsed.isLogged,
    bedtime: sleepSection && 'bedtime' in sleepSection ? sleepSection.bedtime : fullDay.bedtime ?? parsed.bedtime,
    wakeTime: sleepSection && 'wakeTime' in sleepSection ? sleepSection.wakeTime : fullDay.wakeTime ?? parsed.wakeTime,
    sleepQuality:
      sleepSection && 'sleepQuality' in sleepSection ? sleepSection.sleepQuality : fullDay.sleepQuality ?? parsed.sleepQuality,
    wokeDuringNight:
      sleepSection && 'wokeDuringNight' in sleepSection
        ? sleepSection.wokeDuringNight
        : fullDay.wokeDuringNight ?? parsed.wokeDuringNight,
    mood: morningSection && 'mood' in morningSection ? morningSection.mood : fullDay.mood ?? parsed.mood,
    motivation:
      morningSection && 'motivation' in morningSection ? morningSection.motivation : fullDay.motivation ?? parsed.motivation,
    clarity: morningSection && 'clarity' in morningSection ? morningSection.clarity : fullDay.clarity ?? parsed.clarity,
    energy: morningSection && 'energy' in morningSection ? morningSection.energy : fullDay.energy ?? parsed.energy,
    morningIntention:
      morningSection && 'intention' in morningSection
        ? morningSection.intention
        : fullDay.morningIntention ?? parsed.morningIntention,
    tasks: daySection && 'tasks' in daySection ? daySection.tasks : fullDay.tasks ?? parsed.tasks,
    reminders: daySection && 'reminders' in daySection ? daySection.reminders : fullDay.reminders ?? parsed.reminders,
    dailyActions:
      daySection && 'dailyActions' in daySection ? daySection.dailyActions : fullDay.dailyActions ?? parsed.dailyActions,
    medications:
      daySection && 'medications' in daySection ? daySection.medications : fullDay.medications ?? parsed.medications,
    bigWin: daySection && 'bigWin' in daySection ? daySection.bigWin : fullDay.bigWin ?? parsed.bigWin,
    dashboardQuickNote:
      daySection && 'dashboardQuickNote' in daySection
        ? daySection.dashboardQuickNote
        : fullDay.dashboardQuickNote ?? parsed.dashboardQuickNote,
    dashboardExecution:
      daySection && 'dashboardExecution' in daySection
        ? daySection.dashboardExecution
        : fullDay.dashboardExecution ?? parsed.dashboardExecution,
    dailyIntentCompleteOneTask:
      daySection && 'dailyIntentCompleteOneTask' in daySection
        ? daySection.dailyIntentCompleteOneTask
        : fullDay.dailyIntentCompleteOneTask ?? parsed.dailyIntentCompleteOneTask,
    cellColor:
      daySection && 'cellColor' in daySection
        ? daySection.cellColor
        : fullDay.cellColor ?? parsed.cellColor,
    lowStateEntry:
      daySection && 'lowStateEntry' in daySection
        ? daySection.lowStateEntry
        : fullDay.lowStateEntry ?? parsed.lowStateEntry,
    moodNote: eveningSection && 'moodNote' in eveningSection ? eveningSection.moodNote : fullDay.moodNote ?? parsed.moodNote,
    eveningOutcome: normalizeLegacyEveningOutcome(
      eveningSection && 'outcome' in eveningSection ? eveningSection.outcome : fullDay.eveningOutcome ?? parsed.eveningOutcome,
      daySection && 'cellColor' in daySection ? daySection.cellColor : fullDay.cellColor ?? parsed.cellColor,
      null,
    ),
    eveningUnstable:
      eveningSection && 'unstable' in eveningSection
        ? Boolean(eveningSection.unstable)
        : typeof fullDay.eveningUnstable === 'boolean'
          ? fullDay.eveningUnstable
          : normalizeLegacyEveningUnstable(
              fullDay.eveningOutcome ?? parsed.eveningOutcome,
              fullDay.eveningUnstable ?? parsed.eveningUnstable,
              false,
            ),
    eveningTrajectory:
      eveningSection && 'trajectory' in eveningSection
        ? eveningSection.trajectory
        : fullDay.eveningTrajectory ?? parsed.eveningTrajectory,
    eveningSelfInfluence:
      eveningSection && 'selfInfluence' in eveningSection
        ? eveningSection.selfInfluence
        : fullDay.eveningSelfInfluence ?? parsed.eveningSelfInfluence,
    journal:
      eveningSection && 'journal' in eveningSection
        ? eveningSection.journal
        : daySection && 'journal' in daySection
          ? daySection.journal
          : fullDay.journal ?? parsed.journal,
    tagEntries: getCanonicalTagEntryCandidate(fullDay, morningSection, daySection, eveningSection),
  }
}

function getCanonicalTagEntryCandidate(
  fullDay: Partial<DayEntry> & Record<string, unknown>,
  morningSection: Partial<CanonicalDayRecord['morning']> | null,
  daySection: Partial<CanonicalDayRecord['day']> | null,
  eveningSection: Partial<CanonicalDayRecord['evening']> | null,
) {
  const sectionEntries = [
    ...(morningSection && Array.isArray(morningSection.tagEntries) ? morningSection.tagEntries : []),
    ...(daySection && Array.isArray(daySection.tagEntries) ? daySection.tagEntries : []),
    ...(eveningSection && Array.isArray(eveningSection.tagEntries) ? eveningSection.tagEntries : []),
  ]

  if (sectionEntries.length > 0) return sectionEntries
  return Array.isArray(fullDay.tagEntries) ? fullDay.tagEntries : []
}

function extractLegacyScratchpad(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as { scratchpad?: unknown }
  if (payload.scratchpad && typeof payload.scratchpad === 'object') return payload.scratchpad as DayEntry['dashboardScratchpad']
  return raw as DayEntry['dashboardScratchpad']
}

function createEmptyDayEntry(date: string, fallbackDay?: DayEntry): DayEntry {
  if (fallbackDay) {
    return {
      ...fallbackDay,
      date,
      dashboardScratchpad: normalizeStoredScratchpad(fallbackDay.dashboardScratchpad, date, fallbackDay.dashboardScratchpad),
      dashboardExecution: normalizeDashboardExecution(fallbackDay.dashboardExecution, fallbackDay.dashboardExecution),
      tasks: [...fallbackDay.tasks],
      reminders: [...fallbackDay.reminders],
      dailyActions: [...fallbackDay.dailyActions],
      medications: fallbackDay.medications.map((entry) => ({ ...entry })),
      tags: [...fallbackDay.tags],
      tagEntries: fallbackDay.tagEntries.map((entry) => ({ ...entry })),
      completedHabitIds: [...fallbackDay.completedHabitIds],
    }
  }

  return {
    id: `storage-${date}`,
    date,
    isLogged: false,
    cellColor: 'blank',
    mood: null,
    motivation: null,
    clarity: null,
    energy: null,
    sleepQuality: null,
    bedtime: '',
    wakeTime: '',
    wokeDuringNight: null,
    morningMood: 3,
    eveningMood: 3,
    moodNote: '',
    eveningOutcome: null,
    eveningUnstable: false,
    eveningTrajectory: null,
    eveningSelfInfluence: null,
    habitsCompleted: 0,
    habitsTotal: 0,
    completedHabitIds: [],
    drank: false,
    bigWin: '',
    journal: '',
    dashboardQuickNote: '',
    dashboardScratchpad: normalizeStoredScratchpad(null, date),
    dashboardExecution: createEmptyDashboardExecution(),
    dailyIntentCompleteOneTask: false,
    morningIntention: '',
    lowStateEntry: null,
    medications: [],
    tasks: [],
    reminders: [],
    dailyActions: [],
    tags: [],
    tagEntries: [],
    score: 0,
    updatedAt: null,
    linkedWeek: '',
  }
}

function normalizeDayEntryLike(
  raw: Partial<DayEntry> & Record<string, unknown>,
  baseDay: DayEntry,
  scratchpad: DashboardScratchpad,
  tagEntries: DayTagEntry[],
  date: string,
): DayEntry {
  return {
    ...baseDay,
    id: typeof raw.id === 'string' ? raw.id : baseDay.id,
    date,
    isLogged: typeof raw.isLogged === 'boolean' ? raw.isLogged : baseDay.isLogged,
    cellColor:
      raw.cellColor === 'blank' ||
      raw.cellColor === 'green' ||
      raw.cellColor === 'yellow' ||
      raw.cellColor === 'orange' ||
      raw.cellColor === 'red'
        ? raw.cellColor
        : baseDay.cellColor,
    mood: normalizeCheckInValue(raw.mood, baseDay.mood),
    motivation: normalizeCheckInValue(raw.motivation, baseDay.motivation),
    clarity: normalizeCheckInValue(raw.clarity, baseDay.clarity),
    energy: normalizeCheckInValue(raw.energy, baseDay.energy),
    sleepQuality: normalizeCheckInValue(raw.sleepQuality, baseDay.sleepQuality),
    bedtime: normalizeString(raw.bedtime, baseDay.bedtime),
    wakeTime: normalizeString(raw.wakeTime, baseDay.wakeTime),
    wokeDuringNight: typeof raw.wokeDuringNight === 'boolean' ? raw.wokeDuringNight : baseDay.wokeDuringNight,
    morningMood: typeof raw.morningMood === 'number' ? raw.morningMood : baseDay.morningMood,
    eveningMood: typeof raw.eveningMood === 'number' ? raw.eveningMood : baseDay.eveningMood,
    moodNote: normalizeString(raw.moodNote, baseDay.moodNote),
    eveningOutcome: normalizeLegacyEveningOutcome(raw.eveningOutcome, raw.cellColor, baseDay.eveningOutcome),
    eveningUnstable: normalizeLegacyEveningUnstable(raw.eveningOutcome, raw.eveningUnstable, baseDay.eveningUnstable),
    eveningTrajectory:
      raw.eveningTrajectory === 'improved' ||
      raw.eveningTrajectory === 'declined' ||
      raw.eveningTrajectory === 'stable' ||
      raw.eveningTrajectory === 'unstable'
        ? raw.eveningTrajectory
        : baseDay.eveningTrajectory,
    eveningSelfInfluence:
      raw.eveningSelfInfluence === 'helped' || raw.eveningSelfInfluence === 'neutral' || raw.eveningSelfInfluence === 'hurt'
        ? raw.eveningSelfInfluence
        : baseDay.eveningSelfInfluence,
    habitsCompleted: typeof raw.habitsCompleted === 'number' ? raw.habitsCompleted : baseDay.habitsCompleted,
    habitsTotal: typeof raw.habitsTotal === 'number' ? raw.habitsTotal : baseDay.habitsTotal,
    completedHabitIds: Array.isArray(raw.completedHabitIds) ? raw.completedHabitIds.filter((item): item is string => typeof item === 'string') : [...baseDay.completedHabitIds],
    drank: typeof raw.drank === 'boolean' ? raw.drank : baseDay.drank,
    bigWin: normalizeString(raw.bigWin, baseDay.bigWin),
    journal: normalizeString(raw.journal ?? raw.notes, baseDay.journal),
    dashboardQuickNote: normalizeString(raw.dashboardQuickNote, baseDay.dashboardQuickNote),
    dashboardExecution: normalizeDashboardExecution(raw.dashboardExecution, baseDay.dashboardExecution),
    dashboardScratchpad: scratchpad,
    dailyIntentCompleteOneTask:
      typeof raw.dailyIntentCompleteOneTask === 'boolean'
        ? raw.dailyIntentCompleteOneTask
        : baseDay.dailyIntentCompleteOneTask,
    morningIntention: normalizeString(raw.morningIntention, baseDay.morningIntention),
    lowStateEntry: normalizeLowStateEntry(raw.lowStateEntry),
    medications: normalizeMedications(raw.medications),
    tasks: normalizeStringArray(raw.tasks),
    reminders: normalizeStringArray(raw.reminders),
    dailyActions: normalizeDayEvents(raw.dailyActions),
    tags: normalizeReusableTagIds(raw.tags, tagEntries, baseDay.tags),
    tagEntries,
    score: typeof raw.score === 'number' ? raw.score : baseDay.score,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : baseDay.updatedAt,
    linkedWeek: typeof raw.linkedWeek === 'string' ? raw.linkedWeek : baseDay.linkedWeek,
  }
}

function normalizeStoredScratchpad(
  raw: unknown,
  dayDate: string,
  fallback?: DashboardScratchpad,
): DashboardScratchpad {
  const scratchpad =
    raw && typeof raw === 'object' && 'scratchpad' in (raw as Record<string, unknown>)
      ? ((raw as { scratchpad?: unknown }).scratchpad ?? raw)
      : raw
  const defaultMonthKey = dayDate.slice(0, 7)
  const legacyMoneyIn = normalizeScratchpadLineItems((scratchpad as { moneyIn?: unknown })?.moneyIn, 'in')
  const legacyMoneyOut = normalizeScratchpadLineItems((scratchpad as { moneyOut?: unknown })?.moneyOut, 'out')
  const normalizedFinanceSheets =
    scratchpad &&
    typeof scratchpad === 'object' &&
    (scratchpad as { financeSheets?: unknown }).financeSheets &&
    typeof (scratchpad as { financeSheets: unknown }).financeSheets === 'object' &&
    !Array.isArray((scratchpad as { financeSheets: unknown }).financeSheets)
      ? Object.fromEntries(
          Object.entries((scratchpad as { financeSheets: Record<string, unknown> }).financeSheets).map(([monthKey, sheet]) => [
            monthKey,
            normalizeFinanceSheet(sheet),
          ]),
        )
      : legacyMoneyIn.length > 0 ||
          legacyMoneyOut.length > 0 ||
          hasMeaningfulString(typeof (scratchpad as { notes?: unknown })?.notes === 'string' ? ((scratchpad as { notes: string }).notes) : '')
        ? {
            [defaultMonthKey]: {
              moneyIn: legacyMoneyIn,
              moneyOut: legacyMoneyOut,
              notes: normalizeString((scratchpad as { notes?: unknown })?.notes),
            },
          }
        : fallback?.financeSheets ?? {}

  const normalizedFreeNotes = normalizeFreeNotes((scratchpad as { freeNotes?: unknown })?.freeNotes, (scratchpad as { text?: unknown })?.text, dayDate, fallback?.freeNotes)

  return {
    mode:
      (scratchpad as { mode?: unknown })?.mode === 'structured'
        ? 'structured'
        : (scratchpad as { mode?: unknown })?.mode === 'todo'
          ? 'todo'
          : fallback?.mode ?? 'free',
    text: normalizeString((scratchpad as { text?: unknown })?.text, fallback?.text ?? ''),
    freeNotes: normalizedFreeNotes,
    activeFreeNoteId: normalizeActiveFreeNoteId((scratchpad as { activeFreeNoteId?: unknown })?.activeFreeNoteId, normalizedFreeNotes),
    moneyIn: legacyMoneyIn.length > 0 ? legacyMoneyIn : fallback?.moneyIn ?? [],
    moneyOut: legacyMoneyOut.length > 0 ? legacyMoneyOut : fallback?.moneyOut ?? [],
    notes: normalizeString((scratchpad as { notes?: unknown })?.notes, fallback?.notes ?? ''),
    todoItems: normalizeScratchpadTodoItems((scratchpad as { todoItems?: unknown })?.todoItems, fallback?.todoItems),
    financeSheets: normalizedFinanceSheets,
  }
}

function normalizeFreeNotes(
  rawNotes: unknown,
  legacyText: unknown,
  dayDate: string,
  fallbackNotes?: ScratchpadFreeNote[],
): ScratchpadFreeNote[] {
  const normalizedNotes = Array.isArray(rawNotes)
    ? rawNotes.map((note, index) => ({
        id:
          typeof (note as { id?: unknown })?.id === 'string'
            ? ((note as { id: string }).id)
            : `scratch-free-${dayDate}-${index}`,
        title:
          hasMeaningfulString(typeof (note as { title?: unknown })?.title === 'string' ? ((note as { title: string }).title) : '')
            ? normalizeString((note as { title?: unknown })?.title)
            : `Note ${index + 1}`,
        text: normalizeString((note as { text?: unknown })?.text),
      }))
    : []

  if (normalizedNotes.length > 0) return normalizedNotes
  if (Array.isArray(fallbackNotes) && fallbackNotes.length > 0) return fallbackNotes.map((note) => ({ ...note }))

  return [
    {
      id: `scratch-free-${dayDate}-0`,
      title: 'Note 1',
      text: typeof legacyText === 'string' ? legacyText : '',
    },
  ]
}

function normalizeActiveFreeNoteId(activeId: unknown, notes: ScratchpadFreeNote[]) {
  if (typeof activeId === 'string' && notes.some((note) => note.id === activeId)) return activeId

  const populatedNote = notes.find((note, index) => isMeaningfulFreeNote(note, index))
  return populatedNote?.id ?? notes[0]?.id ?? null
}

function normalizeFinanceSheet(raw: unknown): DashboardFinanceSheet {
  return {
    moneyIn: normalizeScratchpadLineItems((raw as { moneyIn?: unknown })?.moneyIn, 'in'),
    moneyOut: normalizeScratchpadLineItems((raw as { moneyOut?: unknown })?.moneyOut, 'out'),
    notes: normalizeString((raw as { notes?: unknown })?.notes),
  }
}

function normalizeScratchpadLineItems(raw: unknown, direction: 'in' | 'out'): ScratchpadLineItem[] {
  return Array.isArray(raw)
    ? raw.map((item, index) => ({
        id:
          typeof (item as { id?: unknown })?.id === 'string'
            ? ((item as { id: string }).id)
            : `scratch-${direction}-${index}`,
        name: normalizeString((item as { name?: unknown })?.name),
        day: normalizeString((item as { day?: unknown })?.day),
        amount: normalizeString((item as { amount?: unknown })?.amount),
        settled: typeof (item as { settled?: unknown })?.settled === 'boolean' ? ((item as { settled: boolean }).settled) : false,
      }))
    : []
}

function normalizeScratchpadTodoItems(raw: unknown, fallback?: ScratchpadTodoItem[]): ScratchpadTodoItem[] {
  if (Array.isArray(raw)) {
    return raw.map((item, index) => ({
      id:
        typeof (item as { id?: unknown })?.id === 'string'
          ? ((item as { id: string }).id)
          : `scratch-todo-${index}`,
      text: normalizeString((item as { text?: unknown })?.text),
      completed: typeof (item as { completed?: unknown })?.completed === 'boolean' ? ((item as { completed: boolean }).completed) : false,
    }))
  }
  return fallback ? fallback.map((item) => ({ ...item })) : []
}

function normalizeStoredTagEntries(raw: Partial<DayEntry> & Record<string, unknown>, fallbackTags: string[]): DayTagEntry[] {
  if (Array.isArray(raw.tagEntries) && raw.tagEntries.length > 0) {
    return raw.tagEntries
      .filter((entry): entry is DayTagEntry => Boolean(entry) && (typeof entry.tagId === 'string' || typeof entry.customLabel === 'string'))
      .map((entry, index) => ({
        id: typeof entry.id === 'string' ? entry.id : `day-tag-${index}`,
        tagId: typeof entry.tagId === 'string' ? entry.tagId : undefined,
        customLabel: typeof entry.customLabel === 'string' ? entry.customLabel : undefined,
        section:
          entry.section === 'sleep' || entry.section === 'feelings' || entry.section === 'actions' || entry.section === 'events'
            ? entry.section
            : 'actions',
        kind: entry.kind === 'feeling' || entry.kind === 'action' ? entry.kind : 'action',
        polarity:
          entry.polarity === 'positive' || entry.polarity === 'neutral' || entry.polarity === 'negative'
            ? entry.polarity
            : 'positive',
        timeSection: normalizeTimeSection(entry.timeSection),
        selected: typeof entry.selected === 'boolean' ? entry.selected : true,
      }))
  }

  return normalizeStringArray(raw.tags ?? fallbackTags).map((tagId, index) => ({
    id: `day-tag-${tagId}-${index}`,
    tagId,
    section: 'actions',
    kind: 'action',
    polarity: 'positive',
    timeSection: 'day',
    selected: true,
  }))
}

function normalizeReusableTagIds(raw: unknown, tagEntries: DayTagEntry[], fallback: string[] = []) {
  const fromRaw = normalizeStringArray(raw)
  if (fromRaw.length > 0) return fromRaw
  const fromEntries = tagEntries.filter((entry) => entry.selected && typeof entry.tagId === 'string').map((entry) => entry.tagId as string)
  return fromEntries.length > 0 ? fromEntries : [...fallback]
}

function normalizeLowStateEntry(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  return {
    feelings: Array.isArray((raw as { feelings?: unknown }).feelings)
      ? ((raw as { feelings: unknown[] }).feelings).filter((item): item is string => typeof item === 'string')
      : [],
    customFeeling: normalizeString((raw as { customFeeling?: unknown })?.customFeeling),
    mindText: normalizeString((raw as { mindText?: unknown })?.mindText),
    mindHelping:
      (raw as { mindHelping?: unknown })?.mindHelping === 'yes' ||
      (raw as { mindHelping?: unknown })?.mindHelping === 'no' ||
      (raw as { mindHelping?: unknown })?.mindHelping === 'not-sure'
        ? ((raw as { mindHelping: 'yes' | 'no' | 'not-sure' }).mindHelping)
        : null,
    realSituation: normalizeString((raw as { realSituation?: unknown })?.realSituation),
    nextThing: normalizeString((raw as { nextThing?: unknown })?.nextThing),
    completedAt: typeof (raw as { completedAt?: unknown })?.completedAt === 'string' ? ((raw as { completedAt: string }).completedAt) : null,
  }
}

function normalizeMedications(raw: unknown): MedicationSupplementEntry[] {
  return Array.isArray(raw)
    ? raw.map((entry, index) => ({
        id: typeof (entry as { id?: unknown })?.id === 'string' ? ((entry as { id: string }).id) : `med-${index}`,
        name: normalizeString((entry as { name?: unknown })?.name),
        dose: normalizeString((entry as { dose?: unknown })?.dose),
        unit: normalizeString((entry as { unit?: unknown })?.unit),
        timeTaken: normalizeString((entry as { timeTaken?: unknown; time?: unknown })?.timeTaken ?? (entry as { time?: unknown })?.time),
        notes: normalizeString((entry as { notes?: unknown })?.notes),
      }))
    : []
}

function normalizeDayEvents(raw: unknown): DayEventEntry[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const title = normalizeString(entry)
        return title
          ? {
              id: `day-event-${index}`,
              title,
              description: '',
              time: '',
              tags: [],
            }
          : null
      }

      if (!entry || typeof entry !== 'object') return null

      const title = normalizeString((entry as { title?: unknown }).title)
      const description = normalizeString((entry as { description?: unknown; note?: unknown }).description ?? (entry as { note?: unknown }).note)

      if (!title && !description) return null

      return {
        id:
          typeof (entry as { id?: unknown }).id === 'string'
            ? ((entry as { id: string }).id)
            : `day-event-${index}`,
        title: title || description.slice(0, 80),
        description,
        time: normalizeString((entry as { time?: unknown }).time),
        tags: normalizeDayEventTags((entry as { tags?: unknown }).tags),
      }
    })
    .filter((entry): entry is DayEventEntry => entry != null)
}

function normalizeDayEventTags(raw: unknown): DayEventEntry['tags'] {
  if (!Array.isArray(raw)) return []

  return raw
    .map<DayEventEntry['tags'][number] | null>((entry, index) => {
      if (!entry || typeof entry !== 'object') return null

      return {
        id:
          typeof (entry as { id?: unknown }).id === 'string'
            ? ((entry as { id: string }).id)
            : `day-event-tag-${index}`,
        tagId: typeof (entry as { tagId?: unknown }).tagId === 'string' ? ((entry as { tagId: string }).tagId) : undefined,
        customLabel:
          typeof (entry as { customLabel?: unknown }).customLabel === 'string'
            ? ((entry as { customLabel: string }).customLabel)
            : undefined,
        section:
          (entry as { section?: unknown }).section === 'sleep' ||
          (entry as { section?: unknown }).section === 'feelings' ||
          (entry as { section?: unknown }).section === 'actions' ||
          (entry as { section?: unknown }).section === 'events'
            ? ((entry as { section: 'sleep' | 'feelings' | 'actions' | 'events' }).section)
            : 'actions',
        kind: (entry as { kind?: unknown }).kind === 'feeling' ? 'feeling' : 'action',
        polarity:
          (entry as { polarity?: unknown }).polarity === 'negative' ||
          (entry as { polarity?: unknown }).polarity === 'neutral' ||
          (entry as { polarity?: unknown }).polarity === 'positive'
            ? ((entry as { polarity: 'positive' | 'neutral' | 'negative' }).polarity)
            : 'positive',
      }
    })
    .filter((entry): entry is DayEventEntry['tags'][number] => entry !== null)
}

function normalizeStringArray(raw: unknown) {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
}

function normalizeCheckInValue(raw: unknown, fallback: number | null) {
  if (typeof raw !== 'number' || Number.isNaN(raw)) return fallback
  return Math.min(10, Math.max(1, Math.round(raw)))
}

function normalizeString(raw: unknown, fallback = '') {
  return typeof raw === 'string' ? raw : fallback
}

function normalizeTimeSection(raw: unknown): DayLogSection {
  return raw === 'morning' || raw === 'evening' || raw === 'day' ? raw : 'day'
}

function normalizeLegacyEveningOutcome(raw: unknown, rawCellColor: unknown, fallback: DayEntry['eveningOutcome']) {
  if (raw === 'good' || raw === 'mixed' || raw === 'poor') return raw
  if (raw !== 'unstable') return fallback

  if (rawCellColor === 'green') return 'good'
  if (rawCellColor === 'yellow') return 'mixed'
  if (rawCellColor === 'orange' || rawCellColor === 'red') return 'poor'
  return fallback ?? 'poor'
}

function normalizeLegacyEveningUnstable(rawOutcome: unknown, rawUnstable: unknown, fallback: boolean) {
  if (typeof rawUnstable === 'boolean') return rawUnstable
  if (rawOutcome === 'unstable') return true
  return fallback
}

function hasMeaningfulString(value: string | undefined | null) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasMeaningfulDayEvent(event: DayEventEntry) {
  return (
    hasMeaningfulString(event.title) ||
    hasMeaningfulString(event.description) ||
    hasMeaningfulString(event.time) ||
    event.tags.length > 0
  )
}

function hasMeaningfulScratchpadLineItem(item: ScratchpadLineItem) {
  return hasMeaningfulString(item.name) || hasMeaningfulString(item.day) || hasMeaningfulString(item.amount)
}

function hasMeaningfulFinanceSheet(sheet: DashboardFinanceSheet) {
  return hasMeaningfulString(sheet.notes) || sheet.moneyIn.some(hasMeaningfulScratchpadLineItem) || sheet.moneyOut.some(hasMeaningfulScratchpadLineItem)
}

function isMeaningfulFreeNote(note: ScratchpadFreeNote, index: number) {
  return hasMeaningfulString(note.text) || normalizeString(note.title).trim() !== `Note ${index + 1}`
}

function hasMeaningfulMedication(entry: MedicationSupplementEntry) {
  return (
    hasMeaningfulString(entry.name) ||
    hasMeaningfulString(entry.dose) ||
    hasMeaningfulString(entry.unit) ||
    hasMeaningfulString(entry.timeTaken) ||
    hasMeaningfulString(entry.notes)
  )
}

function hasMeaningfulTagEntry(entry: DayTagEntry) {
  return Boolean((entry.tagId && entry.tagId.trim().length > 0) || (entry.customLabel && entry.customLabel.trim().length > 0))
}

function hasMeaningfulLowStateEntry(entry: DayEntry['lowStateEntry']) {
  return Boolean(
    entry &&
      (entry.feelings.length > 0 ||
        hasMeaningfulString(entry.customFeeling) ||
        hasMeaningfulString(entry.mindText) ||
        entry.mindHelping !== null ||
        hasMeaningfulString(entry.realSituation) ||
        hasMeaningfulString(entry.nextThing)),
  )
}

function safeParse(raw: string) {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}
