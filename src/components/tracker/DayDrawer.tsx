import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  BadHabitDefinition,
  DayEntry,
  DayEventEntry,
  DayLogSection,
  HabitTracker,
  MedicationSupplementEntry,
  Tag,
  TagKind,
  TagPolarity,
  TagSection,
  WeekEntry,
} from '../../types'
import { getTrackerGoalProgress } from '../../lib/habitTrackerGoals'
import { DayColorSelector } from './DayColorSelector'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { TagPill } from '../ui/TagPill'

type CustomTagTimeContext = DayLogSection | 'sleep'
const dailyLogSubsectionLabelClassName = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-white/78'
const dailyLogFieldLabelClassName = 'text-[13px] font-medium text-white/82'
const dailyLogMicroLabelClassName = 'text-[10px] font-normal uppercase tracking-[0.1em] text-white/56'
const dailyCockpitQuickActions = ['+ Goal', '+ Task', '+ Habit', '+ Journal', '+ Event', '+ Note'] as const

export function DayDrawer({
  day,
  allDays,
  week,
  tags,
  habitTrackers,
  badHabits,
  badHabitDateMap,
  enableBadHabitTracking,
  enableMedicationTracking,
  open,
  onClose,
  onSelectTag,
  onCreateTag,
  onRenameTag,
  onUpdateTag,
  onReorganizeTag,
  onArchiveTag,
  onUnarchiveTag,
  onDeleteTag,
  onNavigateDay,
  onUpdateDay,
  onToggleHabit,
  onToggleBadHabit,
  onDeleteDay,
}: {
  day: DayEntry | null
  allDays: DayEntry[]
  week: WeekEntry | null
  tags: Tag[]
  habitTrackers: HabitTracker[]
  badHabits: BadHabitDefinition[]
  badHabitDateMap: Map<string, BadHabitDefinition[]>
  enableBadHabitTracking: boolean
  enableMedicationTracking: boolean
  open: boolean
  onClose: () => void
  onSelectTag: (tagId: string, timeSection?: DayLogSection) => void
  onCreateTag: (input: {
    name: string
    section?: TagSection
    kind?: TagKind
    polarity?: TagPolarity
    availableIn?: DayLogSection[]
  }) => Tag
  onRenameTag: (tagId: string, name: string) => void
  onUpdateTag: (
    tagId: string,
    updates: { name: string; section: TagSection; kind: TagKind; polarity: TagPolarity; availableIn: DayLogSection[] },
  ) => void
  onReorganizeTag: (tagId: string, targetSection: TagSection, beforeTagId?: string) => void
  onArchiveTag: (tagId: string) => void
  onUnarchiveTag: (tagId: string) => void
  onDeleteTag: (tagId: string) => void
  onNavigateDay: (direction: 'prev' | 'next') => void
  onUpdateDay: (dayId: string, updater: (day: DayEntry) => DayEntry, options?: { skipCanonicalSave?: boolean }) => void
  onToggleHabit: (trackerId: string, date: string) => void
  onToggleBadHabit: (dayId: string, date: string, badHabitId: string) => void
  onDeleteDay: (dayId: string) => boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null)
  const [morningExpanded, setMorningExpanded] = useState(true)
  const [dayExpanded, setDayExpanded] = useState(false)
  const [eveningExpanded, setEveningExpanded] = useState(false)
  const [intentionFocused, setIntentionFocused] = useState(false)
  const [showMorningIntentionInEvening, setShowMorningIntentionInEvening] = useState(false)
  const [reflectionFocused, setReflectionFocused] = useState(false)
  const [medicationsExpanded, setMedicationsExpanded] = useState(false)
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null)
  const [medicationDraft, setMedicationDraft] = useState<MedicationSupplementEntry>(createMedicationDraft())
  const [eventComposerOpen, setEventComposerOpen] = useState(false)
  const [expandedDayEventIds, setExpandedDayEventIds] = useState<string[]>([])
  const [editingDayEventId, setEditingDayEventId] = useState<string | null>(null)
  const [pendingDeleteDayEventId, setPendingDeleteDayEventId] = useState<string | null>(null)
  const [dayTaskDraft, setDayTaskDraft] = useState('')
  const [editingDayTaskIndex, setEditingDayTaskIndex] = useState<number | null>(null)
  const [editingDayTaskDraft, setEditingDayTaskDraft] = useState('')
  const [pendingDeleteDayTaskIndex, setPendingDeleteDayTaskIndex] = useState<number | null>(null)
  const [dayEventDraft, setDayEventDraft] = useState(createDayEventDraft())
  const [dayEventSelectedTagIds, setDayEventSelectedTagIds] = useState<string[]>([])
  const [dayEventCustomTags, setDayEventCustomTags] = useState<DayEventEntry['tags']>([])
  const [dayEventTagPickerOpen, setDayEventTagPickerOpen] = useState(false)
  const [sleepTagPickerOpen, setSleepTagPickerOpen] = useState(false)
  const [morningTagPickerOpen, setMorningTagPickerOpen] = useState(false)
  const [eveningTagPickerOpen, setEveningTagPickerOpen] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [creatingTagHost, setCreatingTagHost] = useState<CustomTagTimeContext | null>(null)
  const [managingTags, setManagingTags] = useState(false)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [pendingTagDeleteId, setPendingTagDeleteId] = useState<string | null>(null)
  const [pendingSectionRemoval, setPendingSectionRemoval] = useState<{ tagId: string; section: DayLogSection } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [editingTagSection, setEditingTagSection] = useState<TagSection>('actions')
  const [editingTagKind, setEditingTagKind] = useState<TagKind>('action')
  const [editingTagPolarity, setEditingTagPolarity] = useState<TagPolarity>('positive')
  const [editingTagAvailableIn, setEditingTagAvailableIn] = useState<DayLogSection[]>(['day', 'evening'])
  const [customTagName, setCustomTagName] = useState('')
  const [customTagSaveMode, setCustomTagSaveMode] = useState<'once' | 'reusable'>('reusable')
  const [customTagSection, setCustomTagSection] = useState<TagSection>('actions')
  const [customTagPolarity, setCustomTagPolarity] = useState<TagPolarity>('positive')
  const [customTagTimeSection, setCustomTagTimeSection] = useState<CustomTagTimeContext>('evening')
  const [manageTagsTab, setManageTagsTab] = useState<'sleep' | DayLogSection>('day')
  const [draggedTagId, setDraggedTagId] = useState<string | null>(null)
  const [dragOverSection, setDragOverSection] = useState<TagSection | null>(null)
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const drawerBodyRef = useRef<HTMLDivElement | null>(null)
  const morningSectionRef = useRef<HTMLDivElement | null>(null)
  const daySectionRef = useRef<HTMLDivElement | null>(null)
  const eveningSectionRef = useRef<HTMLDivElement | null>(null)
  const sleepSubsectionRef = useRef<HTMLDivElement | null>(null)
  const morningCheckInRef = useRef<HTMLDivElement | null>(null)
  const morningTagsRef = useRef<HTMLDivElement | null>(null)
  const morningIntentionRef = useRef<HTMLDivElement | null>(null)
  const dayTasksRef = useRef<HTMLDivElement | null>(null)
  const dayHabitsRef = useRef<HTMLDivElement | null>(null)
  const dayMedicationsRef = useRef<HTMLDivElement | null>(null)
  const dayEventsRef = useRef<HTMLDivElement | null>(null)
  const daySignalsRef = useRef<HTMLDivElement | null>(null)
  const eveningTagsRef = useRef<HTMLDivElement | null>(null)
  const eveningOutcomeRef = useRef<HTMLDivElement | null>(null)
  const eveningReflectionRef = useRef<HTMLDivElement | null>(null)
  const intentionRef = useRef<HTMLTextAreaElement | null>(null)
  const reflectionRef = useRef<HTMLTextAreaElement | null>(null)
  const [activeScrollSection, setActiveScrollSection] = useState<'morning' | 'day' | 'evening'>('morning')
  const [activeScrollSubsection, setActiveScrollSubsection] = useState<string | null>(null)

  useEffect(() => {
    setMenuOpen(false)
    setShowDeleteConfirm(false)
    setMorningExpanded(true)
    setDayExpanded(false)
    setEveningExpanded(false)
    setIntentionFocused(false)
    setShowMorningIntentionInEvening(false)
    setReflectionFocused(false)
    setMedicationsExpanded(false)
    setEditingMedicationId(null)
    setMedicationDraft(createMedicationDraft())
    setEventComposerOpen(false)
    setExpandedDayEventIds([])
    setEditingDayEventId(null)
    setPendingDeleteDayEventId(null)
    setDayTaskDraft('')
    setEditingDayTaskIndex(null)
    setEditingDayTaskDraft('')
    setPendingDeleteDayTaskIndex(null)
    setDayEventDraft(createDayEventDraft())
    setDayEventSelectedTagIds([])
    setDayEventCustomTags([])
    setDayEventTagPickerOpen(false)
    setSleepTagPickerOpen(false)
    setMorningTagPickerOpen(false)
    setEveningTagPickerOpen(false)
    setCreatingTag(false)
    setCreatingTagHost(null)
    setManagingTags(false)
    setEditingTagId(null)
    setPendingTagDeleteId(null)
    setPendingSectionRemoval(null)
    setRenameDraft('')
    setEditingTagSection('actions')
    setEditingTagKind('action')
    setEditingTagPolarity('positive')
    setEditingTagAvailableIn(['day', 'evening'])
    setCustomTagName('')
    setCustomTagSaveMode('reusable')
    setCustomTagSection('actions')
    setCustomTagPolarity('positive')
    setCustomTagTimeSection('evening')
    setDraggedTagId(null)
    setDragOverSection(null)
    setDragOverTagId(null)
  }, [day?.id, open])

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setMenuOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!animatingHabitId) return
    const timeoutId = window.setTimeout(() => setAnimatingHabitId(null), 160)
    return () => window.clearTimeout(timeoutId)
  }, [animatingHabitId])

  useEffect(() => {
    if (!managingTags) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [managingTags])

  useEffect(() => {
    if (!intentionRef.current) return
    resizeTextarea(intentionRef.current)
  }, [day?.id, day?.morningIntention, open])

  useEffect(() => {
    if (!intentionFocused || !intentionRef.current) return
    resizeTextarea(intentionRef.current)
    intentionRef.current.focus()
    const length = intentionRef.current.value.length
    intentionRef.current.setSelectionRange(length, length)
  }, [intentionFocused])

  useEffect(() => {
    if (!reflectionRef.current) return
    resizeTextarea(reflectionRef.current)
  }, [day?.id, day?.journal, open])

  useEffect(() => {
    if (!open || !day) return
    const container = drawerBodyRef.current
    if (!container) return

    const sections = [
      { key: 'morning' as const, subsection: null, ref: morningSectionRef },
      ...(morningExpanded
        ? [
            { key: 'morning' as const, subsection: 'Sleep', ref: sleepSubsectionRef },
            { key: 'morning' as const, subsection: 'Morning check in', ref: morningCheckInRef },
            { key: 'morning' as const, subsection: 'Morning tags', ref: morningTagsRef },
            { key: 'morning' as const, subsection: 'Morning intention', ref: morningIntentionRef },
          ]
        : []),
      { key: 'day' as const, subsection: null, ref: daySectionRef },
      ...(dayExpanded
        ? [
            { key: 'day' as const, subsection: 'Tasks', ref: dayTasksRef },
            { key: 'day' as const, subsection: 'Habits', ref: dayHabitsRef },
            ...(enableMedicationTracking ? [{ key: 'day' as const, subsection: 'Medications & supplements', ref: dayMedicationsRef }] : []),
            { key: 'day' as const, subsection: 'Day events', ref: dayEventsRef },
            { key: 'day' as const, subsection: 'Signals', ref: daySignalsRef },
          ]
        : []),
      { key: 'evening' as const, subsection: null, ref: eveningSectionRef },
      ...(eveningExpanded
        ? [
            { key: 'evening' as const, subsection: 'Evening tags', ref: eveningTagsRef },
            { key: 'evening' as const, subsection: 'Outcome', ref: eveningOutcomeRef },
            { key: 'evening' as const, subsection: 'Reflection', ref: eveningReflectionRef },
          ]
        : []),
    ]

    const updateActiveSection = () => {
      const containerRect = container.getBoundingClientRect()
      const activationOffset = 106
      let nextActive: 'morning' | 'day' | 'evening' = 'morning'
      let nextSubsection: string | null = null

      sections.forEach(({ key, subsection, ref }) => {
        const node = ref.current
        if (!node) return
        const topWithinContainer = node.getBoundingClientRect().top - containerRect.top
        if (topWithinContainer <= activationOffset) {
          nextActive = key
          nextSubsection = subsection
        }
      })

      setActiveScrollSection((current) => (current === nextActive ? current : nextActive))
      setActiveScrollSubsection((current) => (current === nextSubsection ? current : nextSubsection))
    }

    const rafId = window.requestAnimationFrame(updateActiveSection)
    container.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)

    return () => {
      window.cancelAnimationFrame(rafId)
      container.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [
    open,
    day,
    morningExpanded,
    dayExpanded,
    eveningExpanded,
    enableMedicationTracking,
    sleepTagPickerOpen,
    morningTagPickerOpen,
    dayEventTagPickerOpen,
    medicationsExpanded,
    eventComposerOpen,
    eveningTagPickerOpen,
    intentionFocused,
    reflectionFocused,
  ])

  if (!day) return null

  const sectionToggleClassName =
    'flex h-12 w-12 items-center justify-center rounded-[20px] border border-white/[0.1] bg-white/[0.04] text-[26px] leading-none text-white/88 transition-[border-color,background-color,color,filter,transform] duration-150 ease-out hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white hover:brightness-105'
  const subsectionCardClassName =
    'space-y-3.5 rounded-[20px] border border-white/[0.03] bg-[rgba(255,255,255,0.032)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.12)]'
  const innerFieldPanelClassName =
    'rounded-[24px] border border-white/[0.028] bg-[rgba(255,255,255,0.036)] shadow-[inset_0_1px_0_rgba(255,255,255,0.014),0_14px_30px_rgba(0,0,0,0.12)] transition-[background-color,border-color,box-shadow,filter] duration-200 ease-out'

  const activeHabits = useMemo(
    () => habitTrackers.filter((tracker) => isHabitAvailableOnDate(tracker, day.date)),
    [day.date, habitTrackers],
  )
  const occurredBadHabits = badHabitDateMap.get(day.date) ?? []
  const occurredBadHabitIds = new Set(occurredBadHabits.map((habit) => habit.id))
  const alcoholBadHabitId = badHabits.find((habit) => habit.id === 'alcohol')?.id ?? null
  const activeHabitIds = useMemo(() => new Set(habitTrackers.map((tracker) => tracker.id)), [habitTrackers])
  const canDelete = hasEntryData(day) || occurredBadHabits.length > 0
  const completedGoals = useMemo(
    () =>
      habitTrackers
        .flatMap((tracker) =>
          (tracker.achievements ?? [])
            .filter((achievement) => achievement.completedDate === day.date)
            .map((achievement) => ({ tracker, achievement })),
        )
        .sort((left, right) => left.achievement.completedDate.localeCompare(right.achievement.completedDate)),
    [day.date, habitTrackers],
  )
  const latestCompletedGoal = completedGoals[completedGoals.length - 1] ?? null
  const activeGoalProgress = useMemo(
    () =>
      habitTrackers
        .map((tracker) => ({
          tracker,
          progress: tracker.goal ? getTrackerGoalProgress(tracker, Number(day.date.slice(0, 4))) : null,
        }))
        .filter(
          (item): item is { tracker: HabitTracker; progress: NonNullable<ReturnType<typeof getTrackerGoalProgress>> } =>
            item.progress != null && item.progress.active && !item.progress.completed,
        ),
    [day.date, habitTrackers],
  )
  const momentumStreak = useMemo(
    () => getMomentumStreak(allDays, habitTrackers, activeHabitIds, day.date, badHabitDateMap, alcoholBadHabitId),
    [allDays, habitTrackers, activeHabitIds, day.date, badHabitDateMap, alcoholBadHabitId],
  )
  const visibleGoalProgress = activeGoalProgress.slice(0, 2)
  const hiddenGoalProgress = activeGoalProgress.slice(2)
  const hiddenGoalCount = hiddenGoalProgress.length
  const selectedTagEntries = day.tagEntries.filter((entry) => entry.selected)
  const customDayTagEntries = day.tagEntries.filter((entry) => !entry.tagId)
  const morningSelectedReusableTagIds = selectedTagEntries
    .filter((entry) => entry.timeSection === 'morning')
    .map((entry) => entry.tagId)
    .filter((tagId): tagId is string => typeof tagId === 'string')
  const sleepSelectedReusableTagIds = selectedTagEntries
    .filter((entry) => entry.section === 'sleep')
    .map((entry) => entry.tagId)
    .filter((tagId): tagId is string => typeof tagId === 'string')
  const daySelectedReusableTagIds = selectedTagEntries
    .filter((entry) => entry.timeSection === 'day')
    .map((entry) => entry.tagId)
    .filter((tagId): tagId is string => typeof tagId === 'string')
  const eveningSelectedReusableTagIds = selectedTagEntries
    .filter((entry) => entry.timeSection === 'evening')
    .map((entry) => entry.tagId)
    .filter((tagId): tagId is string => typeof tagId === 'string')
  const sleepCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'sleep')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const morningFeelingCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'feelings' && entry.timeSection === 'morning')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const morningActionCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'actions' && entry.timeSection === 'morning')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const dayFeelingCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'feelings' && entry.timeSection === 'day')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const dayActionCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'actions' && entry.timeSection === 'day')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const eveningFeelingCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'feelings' && entry.timeSection === 'evening')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const eveningActionCustomTagItems = customDayTagEntries
    .filter((entry) => entry.section === 'actions' && entry.timeSection === 'evening')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const legacyDayTagItems = selectedTagEntries
    .filter((entry) => entry.timeSection === 'day')
    .map((entry) => getDisplayTagForEntry(entry, tags))
    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForEntry>> => item != null)
  const sleepTags = tags.filter((tag) => tag.isActive && tag.section === 'sleep')
  const morningFeelingTags = tags.filter((tag) => tag.isActive && tag.section === 'feelings' && isTagAvailableInSection(tag, 'morning'))
  const dayFeelingTags = tags.filter((tag) => tag.isActive && tag.section === 'feelings' && isTagAvailableInSection(tag, 'day'))
  const eveningFeelingTags = tags.filter((tag) => tag.isActive && tag.section === 'feelings' && isTagAvailableInSection(tag, 'evening'))
  const morningActionTags = tags.filter((tag) => tag.isActive && tag.section === 'actions' && isTagAvailableInSection(tag, 'morning'))
  const dayActionTags = tags.filter((tag) => tag.isActive && tag.section === 'actions' && isTagAvailableInSection(tag, 'day'))
  const eveningActionTags = tags.filter((tag) => tag.isActive && tag.section === 'actions' && isTagAvailableInSection(tag, 'evening'))
  const dayEventTags = tags.filter((tag) => tag.isActive && tag.section === 'events' && isTagAvailableInSection(tag, 'day'))
  const customTags = tags.filter((tag) => tag.isCustom)
  const customTagsBySection = useMemo(
    () => ({
      sleep: customTags.filter((tag) => tag.section === 'sleep'),
      feelings: customTags.filter((tag) => tag.section === 'feelings'),
      actions: customTags.filter((tag) => tag.section === 'actions'),
      events: customTags.filter((tag) => tag.section === 'events'),
    }),
    [customTags],
  )
  const manageTagGroups = useMemo(() => {
    if (manageTagsTab === 'sleep') {
      return [{ title: 'Sleep', section: 'sleep' as const, tags: customTagsBySection.sleep }]
    }

    return ([
      { title: 'Mood', section: 'feelings' as const, tags: customTagsBySection.feelings },
      { title: 'Actions', section: 'actions' as const, tags: customTagsBySection.actions },
      { title: 'Events', section: 'events' as const, tags: customTagsBySection.events },
    ] as const)
      .map((group) => ({
        ...group,
        tags: group.tags.filter((tag) => isTagAvailableInSection(tag, manageTagsTab)),
      }))
  }, [customTagsBySection, manageTagsTab])
  const handleTagDragStart = (tagId: string) => {
    setDraggedTagId(tagId)
    setDragOverTagId(null)
  }
  const handleTagDragEnd = () => {
    setDraggedTagId(null)
    setDragOverSection(null)
    setDragOverTagId(null)
  }
  const handleTagDrop = (targetSection: TagSection, beforeTagId?: string) => {
    if (!draggedTagId) return
    onReorganizeTag(draggedTagId, targetSection, beforeTagId)
    setDraggedTagId(null)
    setDragOverSection(null)
    setDragOverTagId(null)
  }
  const openManageTags = (tab?: 'sleep' | DayLogSection) => {
    if (tab) setManageTagsTab(tab)
    setManagingTags(true)
  }
  const stickySectionLabel = activeScrollSection.toUpperCase()
  const stickySubsectionLabel = activeScrollSubsection?.toUpperCase() ?? null
  const medications = day.medications ?? []
  const sortedMedications = useMemo(() => sortMedicationEntries(medications), [medications])
  const medicationSuggestions = useMemo(() => getMedicationSuggestions(allDays, day.date), [allDays, day.date])
  const medicationEditorOpen = medicationsExpanded || editingMedicationId != null
  const handleToggleCustomTag = (entryId: string) => {
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tagEntries: current.tagEntries.map((entry) => (entry.id === entryId ? { ...entry, selected: !entry.selected } : entry)),
    }))
  }

  const handleMoveTagEntry = (entryId: string, timeSection: DayLogSection) => {
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tagEntries: current.tagEntries.map((entry) => (entry.id === entryId ? { ...entry, timeSection, selected: true } : entry)),
    }))
  }

  const handleSelectCreatedTag = (createdTag: Tag, timeSection: DayLogSection) => {
    const resolvedTimeSection = createdTag.section === 'sleep' ? 'morning' : timeSection
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tags: current.tags.includes(createdTag.id) ? current.tags : [...current.tags, createdTag.id],
      tagEntries: [
        ...current.tagEntries.filter((entry) => entry.tagId !== createdTag.id),
        {
          id: createDayTagEntryId(createdTag.id),
          tagId: createdTag.id,
          section: createdTag.section,
          kind: createdTag.kind,
          polarity: createdTag.polarity,
          timeSection: resolvedTimeSection,
          selected: true,
        },
      ],
    }))
  }

  const handleAddDayTask = () => {
    const trimmed = dayTaskDraft.trim()
    if (!trimmed) return

    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tasks:
        editingDayTaskIndex != null
          ? current.tasks.map((task, index) => (index === editingDayTaskIndex ? trimmed : task))
          : [...current.tasks, trimmed],
    }))
    setDayTaskDraft('')
    setPendingDeleteDayTaskIndex(null)
  }

  const handleSaveDayTaskEdit = () => {
    if (editingDayTaskIndex == null) return
    const trimmed = editingDayTaskDraft.trim()
    if (!trimmed) {
      setEditingDayTaskIndex(null)
      setEditingDayTaskDraft('')
      return
    }

    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tasks: current.tasks.map((task, index) => (index === editingDayTaskIndex ? trimmed : task)),
    }))
    setEditingDayTaskIndex(null)
    setEditingDayTaskDraft('')
    setPendingDeleteDayTaskIndex(null)
  }

  const handleRemoveDayTask = (taskIndex: number) => {
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      tasks: current.tasks.filter((_, index) => index !== taskIndex),
    }))
    if (editingDayTaskIndex === taskIndex) {
      setEditingDayTaskIndex(null)
      setEditingDayTaskDraft('')
    } else if (editingDayTaskIndex != null && editingDayTaskIndex > taskIndex) {
      setEditingDayTaskIndex((current) => (current == null ? current : current - 1))
    }
    setPendingDeleteDayTaskIndex(null)
  }

  const handleEditDayTask = (task: string, taskIndex: number) => {
    setEditingDayTaskIndex(taskIndex)
    setEditingDayTaskDraft(task)
    setPendingDeleteDayTaskIndex(null)
  }

  const resetDayEventComposer = () => {
    setDayEventDraft(createDayEventDraft())
    setDayEventSelectedTagIds([])
    setDayEventCustomTags([])
    setDayEventTagPickerOpen(false)
    setEditingDayEventId(null)
    setPendingDeleteDayEventId(null)
  }

  const handleSaveDayEvent = () => {
    const trimmedTitle = dayEventDraft.title.trim()
    const trimmedDescription = dayEventDraft.description.trim()
    if (!trimmedTitle) return

    const selectedEventTags = dayEventSelectedTagIds
      .map((tagId) => tags.find((tag) => tag.id === tagId))
      .filter((tag): tag is Tag => tag != null)
      .map((tag, index) => ({
        id: `day-event-tag-${Date.now().toString(36)}-${index}`,
        tagId: tag.id,
        section: tag.section,
        kind: tag.kind,
        polarity: tag.polarity,
      }))

    const nextEventTags = [...selectedEventTags, ...dayEventCustomTags]

    onUpdateDay(day.id, (current) => {
      const nextEntry = {
        id: editingDayEventId ?? createDayEventId(),
        title: trimmedTitle,
        description: trimmedDescription,
        time: dayEventDraft.time,
        tags: nextEventTags,
      }

      return {
        ...current,
        isLogged: true,
        dailyActions: editingDayEventId
          ? current.dailyActions.map((entry) => (entry.id === editingDayEventId ? nextEntry : entry))
          : [...current.dailyActions, nextEntry],
      }
    })
    resetDayEventComposer()
    setEventComposerOpen(false)
  }

  const handleEditDayEvent = (entry: DayEntry['dailyActions'][number]) => {
    setEditingDayEventId(entry.id)
    setPendingDeleteDayEventId(null)
    setDayEventDraft({
      title: entry.title,
      description: entry.description,
      time: entry.time,
    })
    setDayEventSelectedTagIds(entry.tags.map((tag) => tag.tagId).filter((tagId): tagId is string => typeof tagId === 'string'))
    setDayEventCustomTags(entry.tags.filter((tag) => !tag.tagId))
    setDayEventTagPickerOpen(entry.tags.length > 0)
    setEventComposerOpen(true)
    setExpandedDayEventIds((current) => (current.includes(entry.id) ? current : [...current, entry.id]))
  }

  const handleDeleteDayEvent = (eventId: string) => {
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      dailyActions: current.dailyActions.filter((entry) => entry.id !== eventId),
    }))
    setExpandedDayEventIds((current) => current.filter((id) => id !== eventId))
    if (editingDayEventId === eventId) {
      resetDayEventComposer()
      setEventComposerOpen(false)
    }
    setPendingDeleteDayEventId(null)
  }

  const handleSaveMedication = () => {
    const trimmedName = medicationDraft.name.trim()
    if (!trimmedName) return

    onUpdateDay(day.id, (current) => {
      const nextEntry = {
        ...medicationDraft,
        name: trimmedName,
        dose: medicationDraft.dose.trim(),
        unit: medicationDraft.unit.trim(),
        timeTaken: medicationDraft.timeTaken,
        notes: medicationDraft.notes.trim(),
      }
      const existingIndex = current.medications.findIndex((entry) => entry.id === nextEntry.id)
      const nextMedications =
        existingIndex >= 0
          ? current.medications.map((entry, index) => (index === existingIndex ? nextEntry : entry))
          : [...current.medications, nextEntry]

      return {
        ...current,
        isLogged: true,
        medications: nextMedications,
      }
    })

    setEditingMedicationId(null)
    setMedicationDraft(createMedicationDraft())
    setMedicationsExpanded(false)
  }

  const handleEditMedication = (entry: MedicationSupplementEntry) => {
    setEditingMedicationId(entry.id)
    setMedicationDraft(entry)
    setMedicationsExpanded(true)
  }

  const handleRemoveMedication = (medicationId: string) => {
    onUpdateDay(day.id, (current) => ({
      ...current,
      isLogged: true,
      medications: current.medications.filter((entry) => entry.id !== medicationId),
    }))

    if (editingMedicationId === medicationId) {
      setEditingMedicationId(null)
      setMedicationDraft(createMedicationDraft())
      setMedicationsExpanded(false)
    }
  }

  return (
    <>
      <DetailDrawer
        open={open}
        onClose={onClose}
        size="lg"
        bodyRef={drawerBodyRef}
        subtitle="Daily cockpit"
        title={new Date(day.date).toLocaleDateString('en-IE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        headerActions={
          <>
            <button
              onClick={() => onNavigateDay('prev')}
              className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
            >
              Prev
            </button>
            <button
              onClick={() => onNavigateDay('next')}
              className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
            >
              Next
            </button>
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="rounded-full border border-[#333] bg-[#191919] px-3 py-1.5 text-sm text-[#B0B0B0] transition hover:bg-[#222] hover:text-white"
                aria-label="More options"
              >
                •••
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+8px)] z-40 min-w-[180px] rounded-2xl border border-[#2B2B2B] bg-[#151515] p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.38)]">
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => {
                      if (!canDelete) return
                      setMenuOpen(false)
                      setShowDeleteConfirm(true)
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition ${
                      canDelete
                        ? 'text-[#F0F0F0] hover:bg-[#202020]'
                        : 'cursor-not-allowed text-[#6F6F6F]'
                    }`}
                  >
                    <span>Clear today</span>
                  </button>
                </div>
              ) : null}
            </div>
          </>
        }
      >
        <div className="space-y-7">
        <div className="sticky top-0 z-20 -mt-2 mb-2 flex justify-start">
          <div className="flex items-center gap-2 rounded-[16px] border border-white/[0.045] bg-[linear-gradient(180deg,rgba(22,22,22,0.96)_0%,rgba(15,15,15,0.94)_100%)] px-3.5 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/82">{stickySectionLabel}</span>
            {stickySubsectionLabel ? (
              <>
                <span className="text-white/24">—</span>
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/56">{stickySubsectionLabel}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dailyCockpitQuickActions.map((action) => (
            <button
              key={action}
              type="button"
              className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/64 transition-[background-color,border-color,color,filter] duration-150 hover:border-white/[0.1] hover:bg-white/[0.05] hover:text-white/82 hover:brightness-105"
            >
              {action}
            </button>
          ))}
        </div>
        <div className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-[20px] bg-white/[0.03] px-4 py-2.5 text-sm">
          <PrimingHint hint="Days in a row staying on track">
            <span className="font-medium text-white">
              {momentumStreak > 0 ? `🔥 ${momentumStreak}d momentum` : 'Start momentum today'}
            </span>
          </PrimingHint>
          <span className="text-white/12">•</span>
          <PrimingHint hint="Most recently completed goal">
            <span className="min-w-0 font-medium text-white">
              {latestCompletedGoal ? `🏆 ${latestCompletedGoal.tracker.title}` : '🏆 No achievements yet'}
            </span>
          </PrimingHint>
          <span className="text-white/12">•</span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-mist">
            {visibleGoalProgress.length > 0 ? (
              <>
                {visibleGoalProgress.map(({ tracker, progress }) => (
                  <PrimingHint key={tracker.id} hint="Progress towards active goal">
                    <span className="truncate">
                      ⏳ {shortenHabitLabel(tracker.title)} {progress.current}/{progress.target}
                    </span>
                  </PrimingHint>
                ))}
                {hiddenGoalCount > 0 ? (
                  <GoalOverflowHint goals={hiddenGoalProgress}>
                    <span className="cursor-default text-white/58 transition hover:text-white/75">+{hiddenGoalCount}</span>
                  </GoalOverflowHint>
                ) : null}
              </>
            ) : (
              <PrimingHint hint="Progress towards active goal">
                <span>⏳ No active goals</span>
              </PrimingHint>
            )}
          </div>
        </div>

        <div ref={morningSectionRef}>
        <Card
          className="bg-[#121212] p-5 transition-colors duration-150 ease-out"
          style={{
            borderColor: morningExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.035)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 24%, rgba(255,255,255,0) 100%)',
            boxShadow:
              activeScrollSection === 'morning'
                ? '0 0 0 1px rgba(255,255,255,0.028), 0 18px 38px rgba(0,0,0,0.18)'
                : '0 16px 36px rgba(0,0,0,0.16)',
            filter: activeScrollSection === 'morning' ? 'brightness(1.018)' : undefined,
          }}
        >
          <button
            type="button"
            onClick={() => setMorningExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <SectionHeader title="Morning" description="Sleep, starting state, and what matters most." major />
            <span className={sectionToggleClassName} aria-hidden="true">
              {morningExpanded ? '−' : '+'}
            </span>
          </button>
          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out ${
              morningExpanded ? 'mt-6 grid-rows-[1fr] opacity-100 translate-y-0' : 'mt-0 grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-6">
              <div ref={sleepSubsectionRef} className="ml-2 rounded-[20px] border border-white/[0.03] bg-[rgba(255,255,255,0.032)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.12)] transition-[background-color,box-shadow,filter] duration-150 ease-out hover:bg-[rgba(255,255,255,0.036)] hover:brightness-[1.01]">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/82">Sleep</p>
                    <p className="text-[12px] text-mist/56">Capture the night</p>
                  </div>

                  <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                    <TimePickerField
                      value={day.bedtime}
                      placeholder="Bedtime"
                      onChange={(value) =>
                        onUpdateDay(day.id, (current) => ({
                          ...current,
                          isLogged: true,
                          bedtime: value,
                        }))
                      }
                    />
                    <TimePickerField
                      value={day.wakeTime}
                      placeholder="Wake time"
                      onChange={(value) =>
                        onUpdateDay(day.id, (current) => ({
                          ...current,
                          isLogged: true,
                          wakeTime: value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateDay(day.id, (current) => ({
                          ...current,
                          isLogged: true,
                          wokeDuringNight: current.wokeDuringNight === true ? false : true,
                        }))
                      }
                      className={`flex h-[42px] items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition md:self-stretch ${
                        day.wokeDuringNight
                          ? 'border-white/[0.1] bg-white/[0.025] text-white/74 hover:border-white/[0.14] hover:bg-white/[0.035] hover:text-white/84'
                          : 'border-white/[0.05] bg-transparent text-white/54 hover:border-white/[0.08] hover:bg-white/[0.015] hover:text-white/72'
                      }`}
                    >
                      <span
                        className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border text-[11px] leading-none transition ${
                          day.wokeDuringNight
                            ? 'border-white/[0.18] bg-white/[0.04] text-white/72'
                            : 'border-white/[0.1] bg-transparent text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span>Woke during night</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <CheckInRow
                      label="Sleep quality"
                      value={day.sleepQuality}
                      onSelect={(value) =>
                        onUpdateDay(day.id, (current) => ({
                          ...current,
                          isLogged: true,
                          sleepQuality: value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2 border-t border-white/[0.05] pt-2">
                    <div className="flex items-center justify-between gap-3">
                    <p className={dailyLogSubsectionLabelClassName}>Sleep tags</p>
                      <button
                        type="button"
                        onClick={() => setSleepTagPickerOpen((current) => !current)}
                        className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
                      >
                        {sleepTagPickerOpen ? 'Hide picker' : '+ Add tags'}
                      </button>
                    </div>
                    <SelectedTagSummary
                      title="Selected"
                      tags={sleepTags.filter((tag) => sleepSelectedReusableTagIds.includes(tag.id))}
                      customItems={sleepCustomTagItems.filter((item) => item.active)}
                      onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                      onToggleCustom={handleToggleCustomTag}
                      emptyLabel="No sleep tags selected yet."
                    />
                    {sleepTagPickerOpen ? (
                      <div className="dailylog-reveal space-y-3 rounded-[18px] border border-white/[0.06] bg-black/10 p-3">
                        <TagGroup
                          title="Sleep tags"
                          tags={sleepTags}
                          selectedIds={sleepSelectedReusableTagIds}
                          customItems={sleepCustomTagItems}
                          onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                          onToggleCustom={handleToggleCustomTag}
                        />
                        <TagSectionFooterActions
                          onCreate={() => {
                            setCreatingTag((current) => !(current && creatingTagHost === 'sleep'))
                            setCreatingTagHost((current) => (current === 'sleep' ? null : 'sleep'))
                            setCustomTagTimeSection('sleep')
                          }}
                          onManage={() => openManageTags('sleep')}
                        />
                        {creatingTag && creatingTagHost === 'sleep' ? (
                          <CustomTagComposer
                            customTagName={customTagName}
                            onCustomTagNameChange={setCustomTagName}
                            customTagSaveMode={customTagSaveMode}
                            onCustomTagSaveModeChange={setCustomTagSaveMode}
                            customTagSection={customTagSection}
                            onCustomTagSectionChange={setCustomTagSection}
                            customTagTimeSection={customTagTimeSection}
                            onCustomTagTimeSectionChange={setCustomTagTimeSection}
                            customTagPolarity={customTagPolarity}
                            onCustomTagPolarityChange={setCustomTagPolarity}
                            onCancel={() => {
                              setCreatingTag(false)
                              setCreatingTagHost(null)
                              setCustomTagName('')
                              setCustomTagSaveMode('reusable')
                              setCustomTagSection('actions')
                              setCustomTagPolarity('positive')
                              setCustomTagTimeSection('sleep')
                            }}
                            onSubmit={() => {
                              const resolvedSection = resolveCustomTagSection(customTagSection, customTagTimeSection)
                              const resolvedKind = getDefaultKindForSection(resolvedSection)
                              const resolvedAvailability = getAvailabilityForCustomTagTimeContext(customTagTimeSection)
                              const resolvedTimeSection = getTagEntryTimeSectionForCustomTagTimeContext(customTagTimeSection)

                              if (customTagSaveMode === 'reusable') {
                                const created = onCreateTag({
                                  name: customTagName.trim(),
                                  section: resolvedSection,
                                  kind: resolvedKind,
                                  polarity: customTagPolarity,
                                  availableIn: resolvedAvailability,
                                })
                                handleSelectCreatedTag(created, resolvedTimeSection)
                              } else {
                                onUpdateDay(day.id, (current) => {
                                  const trimmedLabel = customTagName.trim()
                                  const existingIndex = current.tagEntries.findIndex(
                                    (entry) =>
                                      !entry.tagId &&
                                      entry.timeSection === resolvedTimeSection &&
                                      entry.section === resolvedSection &&
                                      entry.customLabel?.toLowerCase() === trimmedLabel.toLowerCase(),
                                  )

                                  if (existingIndex >= 0) {
                                    return {
                                      ...current,
                                      isLogged: true,
                                      tagEntries: current.tagEntries.map((entry, index) =>
                                        index === existingIndex
                                          ? {
                                              ...entry,
                                              customLabel: trimmedLabel,
                                              section: resolvedSection,
                                              kind: resolvedKind,
                                              polarity: customTagPolarity,
                                              timeSection: resolvedTimeSection,
                                              selected: true,
                                            }
                                          : entry,
                                      ),
                                    }
                                  }

                                  return {
                                    ...current,
                                    isLogged: true,
                                    tagEntries: [
                                      ...current.tagEntries,
                                      {
                                        id: createCustomDayTagId(),
                                        customLabel: trimmedLabel,
                                        section: resolvedSection,
                                        kind: resolvedKind,
                                        polarity: customTagPolarity,
                                        timeSection: resolvedTimeSection,
                                        selected: true,
                                      },
                                    ],
                                  }
                                })
                              }
                              setCreatingTag(false)
                              setCreatingTagHost(null)
                              setCustomTagName('')
                              setCustomTagSaveMode('reusable')
                              setCustomTagSection('actions')
                              setCustomTagPolarity('positive')
                              setCustomTagTimeSection('sleep')
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div ref={morningCheckInRef} className="ml-2 space-y-2 px-3 pt-4">
                <p className={dailyLogSubsectionLabelClassName}>Morning check in</p>
                <CheckInRow
                  label="Mood"
                  value={day.mood}
                  onSelect={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      mood: value,
                    }))
                  }
                />
                <CheckInRow
                  label="Motivation"
                  value={day.motivation}
                  onSelect={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      motivation: value,
                    }))
                  }
                />
                <CheckInRow
                  label="Clarity"
                  value={day.clarity}
                  onSelect={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      clarity: value,
                    }))
                  }
                />
                <CheckInRow
                  label="Energy"
                  value={day.energy}
                  onSelect={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      energy: value,
                    }))
                  }
                />
              </div>

              <div
                ref={morningTagsRef}
                className={`ml-2 ${subsectionCardClassName} transition-[background-color,box-shadow,filter] duration-150 ease-out hover:bg-[rgba(255,255,255,0.039)] hover:brightness-[1.012]`}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.035)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <SectionHeader title="Morning tags" />
                  <button
                    type="button"
                    onClick={() => {
                      const next = !morningTagPickerOpen
                      setMorningTagPickerOpen(next)
                      if (!next && creatingTagHost === 'morning') {
                        setCreatingTag(false)
                        setCreatingTagHost(null)
                      }
                    }}
                    className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
                  >
                    {morningTagPickerOpen ? 'Hide picker' : '+ Add tags'}
                  </button>
                </div>
                <SelectedTagSummary
                  title="Mood"
                  tags={morningFeelingTags.filter((tag) => morningSelectedReusableTagIds.includes(tag.id))}
                  customItems={morningFeelingCustomTagItems.filter((item) => item.active)}
                  onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                  onToggleCustom={handleToggleCustomTag}
                  emptyLabel="No mood tags selected yet."
                />
                <SelectedTagSummary
                  title="Actions"
                  tags={morningActionTags.filter((tag) => morningSelectedReusableTagIds.includes(tag.id))}
                  customItems={morningActionCustomTagItems.filter((item) => item.active)}
                  onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                  onToggleCustom={handleToggleCustomTag}
                  emptyLabel="No action tags selected yet."
                />
                {morningTagPickerOpen ? (
                  <div className="dailylog-reveal space-y-3 rounded-[18px] border border-white/[0.06] bg-black/10 p-3">
                    <TagGroup
                      title="Mood"
                      tags={morningFeelingTags}
                      selectedIds={morningSelectedReusableTagIds}
                      customItems={morningFeelingCustomTagItems}
                      onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                      onToggleCustom={handleToggleCustomTag}
                    />
                    <TagGroup
                      title="Actions"
                      tags={morningActionTags}
                      selectedIds={morningSelectedReusableTagIds}
                      customItems={morningActionCustomTagItems}
                      onToggle={(tagId) => onSelectTag(tagId, 'morning')}
                      onToggleCustom={handleToggleCustomTag}
                    />
                    <TagSectionFooterActions
                      onCreate={() => {
                        setCreatingTag((current) => !(current && creatingTagHost === 'morning'))
                        setCreatingTagHost((current) => (current === 'morning' ? null : 'morning'))
                      }}
                      onManage={() => openManageTags('morning')}
                    />
                    {creatingTag && creatingTagHost === 'morning' ? (
                      <CustomTagComposer
                        customTagName={customTagName}
                        onCustomTagNameChange={setCustomTagName}
                        customTagSaveMode={customTagSaveMode}
                        onCustomTagSaveModeChange={setCustomTagSaveMode}
                        customTagSection={customTagSection}
                        onCustomTagSectionChange={setCustomTagSection}
                        customTagTimeSection={customTagTimeSection}
                        onCustomTagTimeSectionChange={setCustomTagTimeSection}
                        customTagPolarity={customTagPolarity}
                        onCustomTagPolarityChange={setCustomTagPolarity}
                        onCancel={() => {
                          setCreatingTag(false)
                          setCreatingTagHost(null)
                          setCustomTagName('')
                          setCustomTagSaveMode('reusable')
                          setCustomTagSection('actions')
                          setCustomTagPolarity('positive')
                          setCustomTagTimeSection('morning')
                        }}
                        onSubmit={() => {
                          const resolvedSection = resolveCustomTagSection(customTagSection, customTagTimeSection)
                          const resolvedKind = getDefaultKindForSection(resolvedSection)
                          const resolvedAvailability = getAvailabilityForCustomTagTimeContext(customTagTimeSection)
                          const resolvedTimeSection = getTagEntryTimeSectionForCustomTagTimeContext(customTagTimeSection)

                          if (customTagSaveMode === 'reusable') {
                            const created = onCreateTag({
                              name: customTagName.trim(),
                              section: resolvedSection,
                              kind: resolvedKind,
                              polarity: customTagPolarity,
                              availableIn: resolvedAvailability,
                            })
                            handleSelectCreatedTag(created, resolvedTimeSection)
                          } else {
                            onUpdateDay(day.id, (current) => {
                              const trimmedLabel = customTagName.trim()
                              const existingIndex = current.tagEntries.findIndex(
                                (entry) =>
                                  !entry.tagId &&
                                  entry.timeSection === resolvedTimeSection &&
                                  entry.section === resolvedSection &&
                                  entry.customLabel?.toLowerCase() === trimmedLabel.toLowerCase(),
                              )

                              if (existingIndex >= 0) {
                                return {
                                  ...current,
                                  isLogged: true,
                                  tagEntries: current.tagEntries.map((entry, index) =>
                                    index === existingIndex
                                      ? {
                                          ...entry,
                                          customLabel: trimmedLabel,
                                          section: resolvedSection,
                                          kind: resolvedKind,
                                          polarity: customTagPolarity,
                                          timeSection: resolvedTimeSection,
                                          selected: true,
                                        }
                                      : entry,
                                  ),
                                }
                              }

                              return {
                                ...current,
                                isLogged: true,
                                tagEntries: [
                                  ...current.tagEntries,
                                  {
                                    id: createCustomDayTagId(),
                                    customLabel: trimmedLabel,
                                    section: resolvedSection,
                                    kind: resolvedKind,
                                    polarity: customTagPolarity,
                                    timeSection: resolvedTimeSection,
                                    selected: true,
                                  },
                                ],
                              }
                            })
                          }
                          setCreatingTag(false)
                          setCreatingTagHost(null)
                          setCustomTagName('')
                          setCustomTagSaveMode('reusable')
                          setCustomTagSection('actions')
                          setCustomTagPolarity('positive')
                          setCustomTagTimeSection('morning')
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div ref={morningIntentionRef} className="ml-2 space-y-1.5 px-3 pt-2">
                <p className={dailyLogSubsectionLabelClassName}>Morning intention</p>
                {intentionFocused ? (
                  <textarea
                    ref={intentionRef}
                    value={day.morningIntention}
                    onChange={(event) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        morningIntention: event.target.value,
                      }))
                    }
                    onInput={(event) => resizeTextarea(event.currentTarget)}
                    onBlur={() => setIntentionFocused(false)}
                    placeholder="What matters most today?"
                    className={`${innerFieldPanelClassName} dailylog-reveal min-h-[96px] w-full resize-none overflow-hidden whitespace-normal break-words px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-mist/45 focus:border-white/[0.08] focus:bg-[rgba(255,255,255,0.042)]`}
                    style={{
                      wordBreak: 'break-word',
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIntentionFocused(true)}
                    className={`${innerFieldPanelClassName} relative block min-h-[72px] w-full overflow-hidden px-4 py-3 text-left text-sm leading-6 text-white/90 hover:border-white/[0.065] hover:bg-[rgba(255,255,255,0.03)]`}
                  >
                    <div className="pointer-events-none">
                      <p
                        className={`whitespace-pre-wrap break-words ${day.morningIntention.trim() ? 'line-clamp-3' : 'text-mist/45'}`}
                        style={{ wordBreak: 'break-word' }}
                      >
                        {day.morningIntention.trim() || 'What matters most today?\nWhat kind of person will you be today?'}
                      </p>
                      {day.morningIntention.trim() ? (
                        <div className="pointer-events-none absolute inset-x-4 bottom-3 h-8 bg-gradient-to-t from-[rgba(22,22,22,0.94)] to-transparent" />
                      ) : null}
                    </div>
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        </Card>
        </div>

        <div ref={daySectionRef}>
        <Card
          className="bg-[#121212] p-5 transition-colors duration-150 ease-out"
          style={{
            borderColor: dayExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.035)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.014) 0%, rgba(255,255,255,0.006) 22%, rgba(255,255,255,0) 100%)',
            boxShadow:
              activeScrollSection === 'day'
                ? '0 0 0 1px rgba(255,255,255,0.028), 0 18px 38px rgba(0,0,0,0.16)'
                : '0 16px 36px rgba(0,0,0,0.14)',
            filter: activeScrollSection === 'day' ? 'brightness(1.018)' : undefined,
          }}
        >
          <button
            type="button"
            onClick={() => setDayExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <SectionHeader title="Day" description="Tasks, habits, events, and what happened as the day unfolded." major />
            <span className={sectionToggleClassName} aria-hidden="true">
              {dayExpanded ? '−' : '+'}
            </span>
          </button>

          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out ${
              dayExpanded ? 'mt-5 grid-rows-[1fr] opacity-100 translate-y-0' : 'mt-0 grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
          <div className="space-y-5">
          <div ref={dayTasksRef} className={subsectionCardClassName}>
            <div className="flex items-center justify-between gap-3">
              <p className={dailyLogSubsectionLabelClassName}>Tasks</p>
              <span className="text-xs text-white/34">
                {day.tasks.length} {day.tasks.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {day.tasks.length > 0 ? (
              <div className="space-y-2">
                {day.tasks.map((task, index) => (
                  <div key={`${task}-${index}`} className="group rounded-[18px] border border-white/[0.06] bg-[#171717] px-4 py-2">
                    <div className="flex items-center gap-3">
                      {editingDayTaskIndex === index ? (
                        <input
                          autoFocus
                          value={editingDayTaskDraft}
                          onChange={(event) => setEditingDayTaskDraft(event.target.value)}
                          onBlur={handleSaveDayTaskEdit}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              handleSaveDayTaskEdit()
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              setEditingDayTaskIndex(null)
                              setEditingDayTaskDraft('')
                            }
                          }}
                          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-mist/45"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleEditDayTask(task, index)}
                          className="min-w-0 flex-1 text-left transition hover:text-white"
                        >
                          <span className="block min-w-0 truncate text-sm text-white/84">{task}</span>
                        </button>
                      )}
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => setPendingDeleteDayTaskIndex((current) => (current === index ? null : index))}
                          aria-label="Delete task"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] leading-none text-white/40 transition hover:bg-white/[0.05] hover:text-white/82"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                    {pendingDeleteDayTaskIndex === index ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-3 py-2">
                        <p className="text-xs text-[#F4C7C3]">Delete this task?</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingDeleteDayTaskIndex(null)}
                            className="rounded-full px-2.5 py-1 text-xs font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white/82"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDayTask(index)}
                            className="rounded-full bg-[rgba(239,68,68,0.14)] px-2.5 py-1 text-xs font-medium text-[#F4C7C3] transition hover:bg-[rgba(239,68,68,0.22)]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mist/72">No day tasks logged yet.</p>
            )}
            <div className="flex gap-2">
              <input
                value={dayTaskDraft}
                onChange={(event) => setDayTaskDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddDayTask()
                  }
                }}
                placeholder="Add a task for today"
                className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
              />
              <button
                type="button"
                onClick={handleAddDayTask}
                className="rounded-2xl bg-white/[0.06] px-3 py-2 text-sm text-white/82 transition hover:bg-white/[0.1]"
              >
                Add
              </button>
            </div>
          </div>

          <div ref={dayHabitsRef} className={subsectionCardClassName}>
            <div className="flex items-start justify-between gap-3">
              <SectionHeader title="Habits" description="Completed any habits today? Mark them here." />
            </div>
            <div className="grid gap-2">
              {activeHabits.length > 0 ? (
                activeHabits.map((habit) => {
                  const complete = habit.entries[day.date]?.completed ?? false
                  const animating = animatingHabitId === habit.id
                  return (
                    <button
                      key={habit.id}
                      onClick={() => {
                        setAnimatingHabitId(habit.id)
                        onToggleHabit(habit.id, day.date)
                      }}
                      className="group flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-2.5 text-left transition-transform duration-150 ease-out hover:bg-[#232323] active:scale-[0.988]"
                      style={{
                        transform: animating ? 'scale(1.03)' : undefined,
                        backgroundColor: complete ? 'rgba(79, 220, 148, 0.06)' : '#181818',
                        boxShadow: complete
                          ? '0 0 0 1px rgba(79, 220, 148, 0.08)'
                          : animating
                            ? '0 6px 16px rgba(0,0,0,0.18)'
                            : 'none',
                        transition:
                          'transform 160ms ease-out, background-color 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms ease-out, filter 140ms ease-out',
                        borderColor: complete ? 'rgba(79, 220, 148, 0.16)' : 'rgba(255,255,255,0.07)',
                        filter: animating ? 'brightness(1.02)' : undefined,
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.borderColor = complete ? 'rgba(79, 220, 148, 0.28)' : 'rgba(255,255,255,0.14)'
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.borderColor = complete ? 'rgba(79, 220, 148, 0.16)' : 'rgba(255,255,255,0.07)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none transition-all duration-200 ease-out ${
                            complete ? 'text-[#0B1810]' : 'bg-transparent text-transparent'
                          }`}
                          style={{
                            backgroundColor: complete ? '#4FDC94' : 'transparent',
                            borderColor: complete ? '#4FDC94' : 'rgba(255,255,255,0.16)',
                            boxShadow: complete ? '0 0 10px rgba(79, 220, 148, 0.12)' : 'none',
                            transform: animating ? 'scale(1.06)' : undefined,
                          }}
                        >
                          {complete ? '✓' : null}
                        </span>
                        <span
                          className="text-sm transition-colors duration-150 ease-out group-hover:text-white/88"
                          style={{
                            color: complete ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.73)',
                          }}
                        >
                          {habit.title}
                        </span>
                      </div>
                      <span className="text-xs font-medium transition-all duration-200 ease-out group-hover:text-white/68" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        {complete ? 'Done' : ''}
                      </span>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-mist/72">No habits are available to log for this date.</p>
              )}
            </div>
          </div>

          {enableMedicationTracking ? (
          <div ref={dayMedicationsRef} className={subsectionCardClassName}>
            <div className="flex items-start justify-between gap-3">
              <SectionHeader title="Medications & supplements" description="Track what you took today in a compact, structured way." />
              {!medicationEditorOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMedicationId(null)
                    setMedicationDraft(createMedicationDraft())
                    setMedicationsExpanded(true)
                  }}
                  className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
                >
                  + Add item
                </button>
              ) : null}
            </div>

            {sortedMedications.length > 0 ? (
              <div className="space-y-2">
                {sortedMedications.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-[20px] border border-white/[0.06] bg-[#171717] px-3.5 py-3">
                    <button
                      type="button"
                      onClick={() => handleEditMedication(entry)}
                      className="min-w-0 flex-1 text-left transition hover:text-white"
                    >
                      <p className="truncate text-sm text-white/86">{formatMedicationSummary(entry)}</p>
                      {entry.notes.trim() ? <p className="mt-1 truncate text-xs text-mist/75">{entry.notes.trim()}</p> : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(entry.id)}
                      className="text-xs font-medium text-white/55 transition hover:text-white/82"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-mist/72">Nothing logged yet. Add medications or supplements as they come up.</p>
            )}

            {medicationEditorOpen ? (
              <div className="rounded-[22px] border border-white/[0.06] bg-[#171717] p-3.5">
                {medicationSuggestions.length > 0 ? (
                  <div className="mb-3">
                    <p className={dailyLogSubsectionLabelClassName}>Recent</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {medicationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.key}
                          type="button"
                          onClick={() =>
                            setMedicationDraft((current) => ({
                              ...current,
                              name: suggestion.name,
                              dose: suggestion.dose,
                              unit: suggestion.unit,
                              timeTaken: current.timeTaken || suggestion.timeTaken,
                            }))
                          }
                          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/78 transition hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white"
                        >
                          {suggestion.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.45fr)_0.7fr_0.68fr_0.92fr]">
                  <input
                    value={medicationDraft.name}
                    onChange={(event) => setMedicationDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Name"
                    className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                  />
                  <input
                    value={medicationDraft.dose}
                    onChange={(event) => setMedicationDraft((current) => ({ ...current, dose: event.target.value }))}
                    placeholder="Dose"
                    className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                  />
                  <input
                    value={medicationDraft.unit}
                    onChange={(event) => setMedicationDraft((current) => ({ ...current, unit: event.target.value }))}
                    placeholder="Unit"
                    className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                  />
                  <TimePickerField
                    value={medicationDraft.timeTaken}
                    placeholder="Time"
                    onChange={(value) => setMedicationDraft((current) => ({ ...current, timeTaken: value }))}
                  />
                </div>
                <textarea
                  value={medicationDraft.notes}
                  onChange={(event) => setMedicationDraft((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional notes"
                  className="mt-2.5 min-h-[88px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                />
                <div className="mt-3 flex justify-end gap-2">
                  {editingMedicationId ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(editingMedicationId)}
                      className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:text-white"
                    >
                      Remove
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMedicationId(null)
                      setMedicationDraft(createMedicationDraft())
                      setMedicationsExpanded(false)
                    }}
                    className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!medicationDraft.name.trim()}
                    onClick={handleSaveMedication}
                    className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                      medicationDraft.name.trim()
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'cursor-not-allowed bg-white/8 text-mist/60'
                    }`}
                  >
                    {editingMedicationId ? 'Save changes' : 'Add item'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          ) : null}

          <div ref={dayEventsRef} className="space-y-3 rounded-[20px] border border-white/[0.03] bg-[rgba(255,255,255,0.032)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <SectionHeader title="Day events" description="Log what happened during the day without turning it into admin." />
              <button
                type="button"
                onClick={() => setEventComposerOpen((current) => !current)}
                className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
              >
                + Log event
              </button>
            </div>
            {day.dailyActions.length > 0 ? (
              <div className="space-y-2">
                {day.dailyActions.map((entry) => {
                  const expanded = expandedDayEventIds.includes(entry.id)
                  const eventTags = entry.tags
                    .map((tagEntry) => getDisplayTagForDayEventTag(tagEntry, tags))
                    .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForDayEventTag>> => item != null)

                  return (
                    <div key={entry.id} className="group rounded-[18px] border border-white/[0.06] bg-[#171717] px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDayEventIds((current) =>
                              current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id],
                            )
                          }
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-white/88">{entry.title}</span>
                          {entry.time ? (
                            <span className="shrink-0 text-[12px] font-medium uppercase tracking-[0.08em] text-white/46">
                              {entry.time}
                            </span>
                          ) : null}
                        </button>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleEditDayEvent(entry)}
                            aria-label="Edit event"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none text-white/40 transition hover:bg-white/[0.05] hover:text-white/78"
                          >
                            <span className="inline-block rotate-90">✎</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDeleteDayEventId((current) => (current === entry.id ? null : entry.id))
                            }
                            aria-label="Delete event"
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[14px] leading-none text-white/32 transition hover:bg-white/[0.05] hover:text-[#FCA5A5]"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                      {expanded ? (
                        <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
                          {entry.description ? <p className="text-sm leading-6 text-white/68">{entry.description}</p> : null}
                          {entry.time ? (
                            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#9A9A9A]">Time · {entry.time}</p>
                          ) : null}
                          {eventTags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {eventTags.map((tagItem) => (
                                <TagPill
                                  key={tagItem.id}
                                  tag={tagItem.tag}
                                  active
                                  emphasis="selected"
                                  muted
                                  oneOff={tagItem.oneOff}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {pendingDeleteDayEventId === entry.id ? (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] px-3 py-2">
                          <p className="text-xs text-[#F4C7C3]">Delete this event?</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPendingDeleteDayEventId(null)}
                              className="rounded-xl bg-white/[0.04] px-2.5 py-1.5 text-xs text-mist transition hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDayEvent(entry.id)}
                              className="rounded-xl bg-[rgba(239,68,68,0.16)] px-2.5 py-1.5 text-xs font-medium text-[#FFDAD6] transition hover:bg-[rgba(239,68,68,0.22)]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
            {eventComposerOpen ? (
              <div className="space-y-3 rounded-[18px] border border-white/[0.06] bg-[#171717] p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                  <input
                    value={dayEventDraft.title}
                    onChange={(event) => setDayEventDraft((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Event title"
                    className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                  />
                  <input
                    type="time"
                    value={dayEventDraft.time}
                    onChange={(event) => setDayEventDraft((current) => ({ ...current, time: event.target.value }))}
                    className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] focus:border-white/[0.14] focus:bg-[#202020]"
                  />
                </div>
                <textarea
                  value={dayEventDraft.description}
                  onChange={(event) => setDayEventDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description (optional)"
                  className="min-h-[88px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                />
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDayEventTagPickerOpen((current) => {
                        const next = !current
                        if (!next && creatingTagHost === 'day') {
                          setCreatingTag(false)
                          setCreatingTagHost(null)
                        }
                        return next
                      })
                    }
                    className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
                  >
                    {dayEventTagPickerOpen ? 'Hide tags' : 'Add tags'}
                  </button>
                  {dayEventTagPickerOpen ? (
                      <div className="dailylog-reveal space-y-3 rounded-[18px] border border-white/[0.06] bg-black/10 p-3">
                      <TagGroup
                        title="Mood"
                        tags={dayFeelingTags}
                        selectedIds={dayEventSelectedTagIds}
                        onToggle={(tagId) =>
                          setDayEventSelectedTagIds((current) =>
                            current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                          )
                        }
                        onToggleCustom={() => undefined}
                      />
                      <TagGroup
                        title="Actions"
                        tags={dayActionTags}
                      selectedIds={dayEventSelectedTagIds}
                      onToggle={(tagId) =>
                        setDayEventSelectedTagIds((current) =>
                          current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                        )
                      }
                      onToggleCustom={() => undefined}
                    />
                      <TagGroup
                        title="Events"
                        tags={dayEventTags}
                        selectedIds={dayEventSelectedTagIds}
                        customItems={dayEventCustomTags
                          .map((entry) => getDisplayTagForDayEventTag(entry, tags))
                          .filter((item): item is NonNullable<ReturnType<typeof getDisplayTagForDayEventTag>> => item != null)
                          .map((item) => ({
                            entryId: item.id,
                            active: true,
                            oneOff: item.oneOff,
                            tag: item.tag,
                          }))}
                        onToggle={(tagId) =>
                          setDayEventSelectedTagIds((current) =>
                            current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
                          )
                        }
                        onToggleCustom={(entryId) =>
                          setDayEventCustomTags((current) => current.filter((entry) => entry.id !== entryId))
                        }
                      />
                      <TagSectionFooterActions
                        onCreate={() => {
                          setCreatingTag((current) => !(current && creatingTagHost === 'day'))
                          setCreatingTagHost((current) => (current === 'day' ? null : 'day'))
                          setCustomTagSection('events')
                          setCustomTagTimeSection('day')
                        }}
                        onManage={() => openManageTags('day')}
                      />
                      {creatingTag && creatingTagHost === 'day' ? (
                        <CustomTagComposer
                          customTagName={customTagName}
                          onCustomTagNameChange={setCustomTagName}
                          customTagSaveMode={customTagSaveMode}
                          onCustomTagSaveModeChange={setCustomTagSaveMode}
                          customTagSection={customTagSection}
                          onCustomTagSectionChange={setCustomTagSection}
                          customTagTimeSection={customTagTimeSection}
                          onCustomTagTimeSectionChange={setCustomTagTimeSection}
                          customTagPolarity={customTagPolarity}
                          onCustomTagPolarityChange={setCustomTagPolarity}
                          onCancel={() => {
                            setCreatingTag(false)
                            setCreatingTagHost(null)
                            setCustomTagName('')
                            setCustomTagSaveMode('reusable')
                            setCustomTagSection('actions')
                            setCustomTagPolarity('positive')
                            setCustomTagTimeSection('day')
                          }}
                          onSubmit={() => {
                            const resolvedSection = resolveCustomTagSection(customTagSection, customTagTimeSection)
                            const resolvedKind = getDefaultKindForSection(resolvedSection)
                            const resolvedPolarity = customTagPolarity

                            if (customTagSaveMode === 'reusable') {
                              const created = onCreateTag({
                                name: customTagName.trim(),
                                section: resolvedSection,
                                kind: resolvedKind,
                                polarity: resolvedPolarity,
                                availableIn: getAvailabilityForCustomTagTimeContext(customTagTimeSection),
                              })
                              setDayEventSelectedTagIds((current) => (current.includes(created.id) ? current : [...current, created.id]))
                            } else {
                              const trimmedLabel = customTagName.trim()
                              setDayEventCustomTags((current) => {
                                const existingIndex = current.findIndex(
                                  (entry) =>
                                    !entry.tagId &&
                                    entry.customLabel?.toLowerCase() === trimmedLabel.toLowerCase() &&
                                    entry.section === resolvedSection,
                                )

                                if (existingIndex >= 0) {
                                  return current.map((entry, index) =>
                                    index === existingIndex
                                      ? {
                                          ...entry,
                                          customLabel: trimmedLabel,
                                          section: resolvedSection,
                                          kind: resolvedKind,
                                          polarity: resolvedPolarity,
                                        }
                                      : entry,
                                  )
                                }

                                return [
                                  ...current,
                                  {
                                    id: `day-event-tag-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
                                    customLabel: trimmedLabel,
                                    section: resolvedSection,
                                    kind: resolvedKind,
                                    polarity: resolvedPolarity,
                                  },
                                ]
                              })
                            }

                            setCreatingTag(false)
                            setCreatingTagHost(null)
                            setCustomTagName('')
                            setCustomTagSaveMode('reusable')
                            setCustomTagSection('actions')
                            setCustomTagPolarity('positive')
                            setCustomTagTimeSection('day')
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetDayEventComposer()
                      setEventComposerOpen(false)
                    }}
                    className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDayEvent}
                    className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
                      dayEventDraft.title.trim()
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'cursor-not-allowed bg-white/8 text-mist/60'
                    }`}
                  >
                    {editingDayEventId ? 'Save changes' : 'Add event'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={daySignalsRef} className="space-y-4 rounded-[20px] border border-white/[0.03] bg-[rgba(255,255,255,0.032)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.12)]">
            <SectionHeader title="Signals" description="Keep the extra context close, but lightweight." />
            <div className="space-y-4">
              <div className="space-y-2">
                <p className={dailyLogSubsectionLabelClassName}>Day Color</p>
                <DayColorSelector
                  value={day.cellColor}
                  onChange={(value) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      cellColor: value,
                    }))
                  }
                />
              </div>
              {enableBadHabitTracking && badHabits.length > 0 ? (
                <div className="space-y-2 border-t border-white/[0.06] pt-3">
                  <p className={dailyLogSubsectionLabelClassName}>Bad habits</p>
                  <div className="flex flex-wrap gap-2">
                    {badHabits.map((habit) => {
                      const occurred = occurredBadHabitIds.has(habit.id)
                      return (
                        <button
                          key={habit.id}
                          type="button"
                          onClick={() => onToggleBadHabit(day.id, day.date, habit.id)}
                          className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
                            occurred
                              ? 'border-[#6B2B2C] bg-[#231617] text-[#F1D3D3]'
                              : 'border-white/[0.06] bg-[#1A1A1A] text-[#B0B0B0] hover:bg-[#202020] hover:text-white'
                          }`}
                        >
                          {habit.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 border-t border-white/[0.06] pt-3">
                <p className={dailyLogSubsectionLabelClassName}>Big win</p>
                <input
                  value={day.bigWin}
                  onChange={(event) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      bigWin: event.target.value,
                    }))
                  }
                  placeholder="One thing that went well"
                  className="w-full rounded-2xl border border-white/[0.06] bg-[#171717] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/50 focus:border-white/[0.12] focus:bg-[#1B1B1B]"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                />
              </div>
            </div>
          </div>
          </div>
            </div>
          </div>
        </Card>
        </div>

        <div ref={eveningSectionRef}>
        <Card
          className="bg-[#121212] p-5 transition duration-150 ease-out"
          style={{
            backgroundColor: reflectionFocused ? '#141414' : '#121212',
            borderColor: reflectionFocused || eveningExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.035)',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.014) 0%, rgba(255,255,255,0.006) 22%, rgba(255,255,255,0) 100%)',
            boxShadow:
              activeScrollSection === 'evening'
                ? '0 0 0 1px rgba(255,255,255,0.03), 0 18px 38px rgba(0,0,0,0.16)'
                : reflectionFocused
                  ? '0 0 0 1px rgba(255,255,255,0.03), 0 16px 36px rgba(0,0,0,0.14)'
                  : '0 16px 36px rgba(0,0,0,0.14)',
            filter: activeScrollSection === 'evening' ? 'brightness(1.018)' : undefined,
          }}
        >
          <button
            type="button"
            onClick={() => setEveningExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <SectionHeader title="Evening" description="Final state of the day and a low-pressure wrap-up." major />
            <span className={sectionToggleClassName} aria-hidden="true">
              {eveningExpanded ? '−' : '+'}
            </span>
          </button>
          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out ${
              eveningExpanded ? 'mt-5 grid-rows-[1fr] opacity-100 translate-y-0' : 'mt-0 grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="overflow-hidden">
            <div className="space-y-5">
              <div ref={eveningTagsRef} className={subsectionCardClassName}>
                <div className="flex items-start justify-between gap-3">
                  <SectionHeader title="Evening tags" />
                  <button
                    type="button"
                    onClick={() => {
                      const next = !eveningTagPickerOpen
                      setEveningTagPickerOpen(next)
                      if (!next && creatingTagHost === 'evening') {
                        setCreatingTag(false)
                        setCreatingTagHost(null)
                      }
                    }}
                    className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-xs font-medium text-mist transition hover:border-white/18 hover:text-white"
                  >
                    {eveningTagPickerOpen ? 'Hide picker' : '+ Add tags'}
                  </button>
                </div>
                {legacyDayTagItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className={dailyLogSubsectionLabelClassName}>Existing entries</p>
                    <div className="flex flex-wrap gap-2">
                      {legacyDayTagItems.map((item) => (
                        <button
                          key={`legacy-${item.entryId}`}
                          type="button"
                          onClick={() => handleMoveTagEntry(item.entryId, 'evening')}
                          className="transition duration-150 ease-out hover:scale-[1.02] hover:brightness-110"
                        >
                          <TagPill tag={item.tag} active oneOff={item.oneOff} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <SelectedTagSummary
                  title="Mood"
                  tags={eveningFeelingTags.filter((tag) => eveningSelectedReusableTagIds.includes(tag.id))}
                  customItems={eveningFeelingCustomTagItems.filter((item) => item.active)}
                  onToggle={(tagId) => onSelectTag(tagId, 'evening')}
                  onToggleCustom={handleToggleCustomTag}
                  emptyLabel="No mood tags selected yet."
                />
                <SelectedTagSummary
                  title="Actions"
                  tags={eveningActionTags.filter((tag) => eveningSelectedReusableTagIds.includes(tag.id))}
                  customItems={eveningActionCustomTagItems.filter((item) => item.active)}
                  onToggle={(tagId) => onSelectTag(tagId, 'evening')}
                  onToggleCustom={handleToggleCustomTag}
                  emptyLabel="No action tags selected yet."
                />
                {eveningTagPickerOpen ? (
                      <div className="dailylog-reveal space-y-3 rounded-[18px] border border-white/[0.06] bg-black/10 p-3">
                    <TagGroup
                      title="Mood"
                      tags={eveningFeelingTags}
                      selectedIds={eveningSelectedReusableTagIds}
                      customItems={eveningFeelingCustomTagItems}
                      onToggle={(tagId) => onSelectTag(tagId, 'evening')}
                      onToggleCustom={handleToggleCustomTag}
                    />
                    <TagGroup
                      title="Actions"
                      tags={eveningActionTags}
                      selectedIds={eveningSelectedReusableTagIds}
                      customItems={eveningActionCustomTagItems}
                      onToggle={(tagId) => onSelectTag(tagId, 'evening')}
                      onToggleCustom={handleToggleCustomTag}
                    />
                    <TagSectionFooterActions
                      onCreate={() => {
                        setCreatingTag((current) => !(current && creatingTagHost === 'evening'))
                        setCreatingTagHost((current) => (current === 'evening' ? null : 'evening'))
                      }}
                      onManage={() => openManageTags('evening')}
                    />
                    {creatingTag && creatingTagHost === 'evening' ? (
                      <CustomTagComposer
                        customTagName={customTagName}
                        onCustomTagNameChange={setCustomTagName}
                        customTagSaveMode={customTagSaveMode}
                        onCustomTagSaveModeChange={setCustomTagSaveMode}
                        customTagSection={customTagSection}
                        onCustomTagSectionChange={setCustomTagSection}
                        customTagTimeSection={customTagTimeSection}
                        onCustomTagTimeSectionChange={setCustomTagTimeSection}
                        customTagPolarity={customTagPolarity}
                        onCustomTagPolarityChange={setCustomTagPolarity}
                        onCancel={() => {
                          setCreatingTag(false)
                          setCreatingTagHost(null)
                          setCustomTagName('')
                          setCustomTagSaveMode('reusable')
                          setCustomTagSection('actions')
                          setCustomTagPolarity('positive')
                          setCustomTagTimeSection('evening')
                        }}
                        onSubmit={() => {
                          const resolvedSection = resolveCustomTagSection(customTagSection, customTagTimeSection)
                          const resolvedKind = getDefaultKindForSection(resolvedSection)
                          const resolvedAvailability = getAvailabilityForCustomTagTimeContext(customTagTimeSection)
                          const resolvedTimeSection = getTagEntryTimeSectionForCustomTagTimeContext(customTagTimeSection)

                          if (customTagSaveMode === 'reusable') {
                            const created = onCreateTag({
                              name: customTagName.trim(),
                              section: resolvedSection,
                              kind: resolvedKind,
                              polarity: customTagPolarity,
                              availableIn: resolvedAvailability,
                            })
                            handleSelectCreatedTag(created, resolvedTimeSection)
                          } else {
                            onUpdateDay(day.id, (current) => {
                              const trimmedLabel = customTagName.trim()
                              const existingIndex = current.tagEntries.findIndex(
                                (entry) =>
                                  !entry.tagId &&
                                  entry.timeSection === resolvedTimeSection &&
                                  entry.section === resolvedSection &&
                                  entry.customLabel?.toLowerCase() === trimmedLabel.toLowerCase(),
                              )

                              if (existingIndex >= 0) {
                                return {
                                  ...current,
                                  isLogged: true,
                                  tagEntries: current.tagEntries.map((entry, index) =>
                                    index === existingIndex
                                      ? {
                                          ...entry,
                                          customLabel: trimmedLabel,
                                          section: resolvedSection,
                                          kind: resolvedKind,
                                          polarity: customTagPolarity,
                                          timeSection: resolvedTimeSection,
                                          selected: true,
                                        }
                                      : entry,
                                  ),
                                }
                              }

                              return {
                                ...current,
                                isLogged: true,
                                tagEntries: [
                                  ...current.tagEntries,
                                  {
                                    id: createCustomDayTagId(),
                                    customLabel: trimmedLabel,
                                    section: resolvedSection,
                                    kind: resolvedKind,
                                    polarity: customTagPolarity,
                                    timeSection: resolvedTimeSection,
                                    selected: true,
                                  },
                                ],
                              }
                            })
                          }
                          setCreatingTag(false)
                          setCreatingTagHost(null)
                          setCustomTagName('')
                          setCustomTagSaveMode('reusable')
                          setCustomTagSection('actions')
                          setCustomTagPolarity('positive')
                          setCustomTagTimeSection('evening')
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div ref={eveningOutcomeRef} className="space-y-4 rounded-[20px] border border-white/[0.03] bg-[rgba(255,255,255,0.032)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.12)]">
                <SectionHeader title="Outcome" description="Capture the true ending and direction of the day." />
                <div className="space-y-4">
                  <CompactChoiceRow
                    label="How did the day actually go?"
                    value={day.eveningOutcome}
                    options={[
                      { label: 'Good', value: 'good', tone: 'green' },
                      { label: 'Mixed', value: 'mixed', tone: 'orange' },
                      { label: 'Poor', value: 'poor', tone: 'red' },
                      { label: 'Unstable', value: 'unstable', tone: 'yellow' },
                    ]}
                    onChange={(value) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        eveningOutcome: value,
                        cellColor: getCellColorForEveningOutcome(value),
                      }))
                    }
                  />
                  <CompactChoiceRow
                    label="How did the day move?"
                    value={day.eveningTrajectory}
                    optional
                    options={[
                      { label: '↑ Improved', value: 'improved', tone: 'green' },
                      { label: '↓ Declined', value: 'declined', tone: 'red' },
                      { label: '→ Stable', value: 'stable', tone: 'neutral' },
                      { label: '~ Unstable', value: 'unstable', tone: 'yellow' },
                    ]}
                    onChange={(value) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        eveningTrajectory: value,
                      }))
                    }
                  />
                  <CompactChoiceRow
                    label="Did I help or hurt my state?"
                    value={day.eveningSelfInfluence}
                    optional
                    options={[
                      { label: '👍 Helped', value: 'helped', tone: 'green' },
                      { label: '➖ Neutral', value: 'neutral', tone: 'neutral' },
                      { label: '👎 Hurt', value: 'hurt', tone: 'red' },
                    ]}
                    onChange={(value) =>
                      onUpdateDay(day.id, (current) => ({
                        ...current,
                        isLogged: true,
                        eveningSelfInfluence: value,
                      }))
                    }
                  />
                </div>
              </div>

              <div ref={eveningReflectionRef} className="space-y-3">
                <SectionHeader title="Reflection" />
                {(() => {
                  const morningIntention = day.morningIntention.trim()
                  const hasMorningIntention = morningIntention.length > 0

                  return (
                    <>
                <textarea
                  ref={reflectionRef}
                  value={day.journal}
                  onChange={(event) =>
                    onUpdateDay(day.id, (current) => ({
                      ...current,
                      isLogged: true,
                      journal: event.target.value,
                    }))
                  }
                  onInput={(event) => resizeTextarea(event.currentTarget)}
                  onFocus={() => setReflectionFocused(true)}
                  onBlur={() => setReflectionFocused(false)}
                  placeholder={
                    hasMorningIntention
                      ? 'What stood out today?\nHow did today align with your intention?'
                      : 'What stood out today?'
                  }
                  className={`${innerFieldPanelClassName} min-h-[120px] w-full resize-none overflow-hidden px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-mist/45 focus:border-white/[0.08] focus:bg-[rgba(255,255,255,0.032)]`}
                  style={{
                    transition: 'height 160ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out',
                  }}
                />
                      {hasMorningIntention ? (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowMorningIntentionInEvening((current) => !current)}
                            className="text-left text-[13px] font-medium text-white/58 transition hover:text-white/78"
                          >
                            {showMorningIntentionInEvening ? 'Hide morning intention' : 'Show morning intention'}
                          </button>
                          {showMorningIntentionInEvening ? (
                            <div className="rounded-[20px] border border-white/[0.028] bg-[rgba(255,255,255,0.034)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.012),0_12px_28px_rgba(0,0,0,0.1)]">
                              <p className={dailyLogSubsectionLabelClassName}>
                                Morning intention
                              </p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/86">
                                {morningIntention}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )
                })()}
              </div>
            </div>
            </div>
          </div>
        </Card>
        </div>

        </div>
      </DetailDrawer>

      {showDeleteConfirm ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(420px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <h4 className="text-xl font-semibold text-white">Clear today&apos;s data?</h4>
            <p className="mt-2 text-sm leading-6 text-mist">
              This will remove your mood, habits, notes, signals, and medications for today.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const deleted = onDeleteDay(day.id)
                  setShowDeleteConfirm(false)
                  if (!deleted) return
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {pendingSectionRemoval ? (
        <>
          <div className="fixed inset-0 z-[55] bg-black/40" onClick={() => setPendingSectionRemoval(null)} />
          <div className="fixed left-1/2 top-1/2 z-[60] w-[min(420px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <h4 className="text-xl font-semibold text-white">Delete this tag entirely?</h4>
            <p className="mt-2 text-sm leading-6 text-mist">
              Removing this tag from {getDayLogSectionLabel(pendingSectionRemoval.section)} would leave it with no section
              availability. Delete the tag entirely instead? Past entries will remain unchanged.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingSectionRemoval(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onDeleteTag(pendingSectionRemoval.tagId)
                  setPendingSectionRemoval(null)
                }}
              >
                Delete entirely
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {pendingTagDeleteId ? (
        <>
          <div className="fixed inset-0 z-[55] bg-black/40" onClick={() => setPendingTagDeleteId(null)} />
          <div className="fixed left-1/2 top-1/2 z-[60] w-[min(420px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <h4 className="text-xl font-semibold text-white">Delete this tag?</h4>
            <p className="mt-2 text-sm leading-6 text-mist">
              Delete this tag from your tag library? Past entries will remain unchanged.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingTagDeleteId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onDeleteTag(pendingTagDeleteId)
                  setPendingTagDeleteId(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {managingTags ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setManagingTags(false)} />
          <div className="fixed left-1/2 top-1/2 z-50 flex max-h-[82vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-[#2B2B2B] bg-[#111111] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-[#111111] pb-4">
              <div>
                <h4 className="text-xl font-semibold text-white">Manage tags</h4>
                <p className="mt-2 text-sm leading-6 text-mist">Rename, classify, or archive custom tags without affecting past entries.</p>
              </div>
              <button
                type="button"
                onClick={() => setManagingTags(false)}
                className="text-sm text-mist transition hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-1 flex-1 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-4">
                <TagMetaToggle
                  label=""
                  options={[
                    { label: 'Sleep', value: 'sleep' },
                    { label: 'Morning', value: 'morning' },
                    { label: 'Day', value: 'day' },
                    { label: 'Evening', value: 'evening' },
                  ]}
                  value={manageTagsTab}
                  onChange={(value) => setManageTagsTab(value as 'sleep' | DayLogSection)}
                />
                <div className="space-y-3">
              {customTags.length > 0 ? (
                manageTagGroups.map((group) => (
                    <div key={group.title} className="space-y-2.5">
                      <p className={dailyLogSubsectionLabelClassName}>{group.title}</p>
                      <div
                        className={`space-y-3 rounded-[24px] border p-2 transition ${
                          dragOverSection === group.section
                            ? 'border-white/[0.14] bg-white/[0.03]'
                            : 'border-transparent bg-transparent'
                        }`}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                          setDragOverSection(group.section)
                          setDragOverTagId(null)
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setDragOverSection((current) => (current === group.section ? null : current))
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          handleTagDrop(group.section)
                        }}
                      >
                        {group.tags.length > 0 ? ([ 
                          { key: 'positive', tags: group.tags.filter((tag) => tag.polarity === 'positive') },
                          { key: 'neutral', tags: group.tags.filter((tag) => tag.polarity === 'neutral') },
                          { key: 'negative', tags: group.tags.filter((tag) => tag.polarity === 'negative') },
                        ] as const).map((polarityGroup) =>
                          polarityGroup.tags.length > 0 ? (
                            <div key={`${group.title}-${polarityGroup.key}`} className="space-y-3">
                              <div className="space-y-3">
                                {polarityGroup.tags.map((tag) => {
                                  const editing = editingTagId === tag.id
                                  return (
                                    <div
                                      key={tag.id}
                                      draggable={!editing}
                                      onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'move'
                                        handleTagDragStart(tag.id)
                                      }}
                                      onDragEnd={handleTagDragEnd}
                                      onDragOver={(event) => {
                                        event.preventDefault()
                                        event.dataTransfer.dropEffect = 'move'
                                        setDragOverSection(group.section)
                                        setDragOverTagId(tag.id)
                                      }}
                                      onDrop={(event) => {
                                        event.preventDefault()
                                        handleTagDrop(group.section, tag.id)
                                      }}
                                      className={`group rounded-[22px] border bg-[#161616] px-4 py-3 shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition ${
                                        dragOverTagId === tag.id
                                          ? 'border-white/[0.14] shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                                          : 'border-white/[0.05]'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0 flex-1">
                                          {editing ? (
                                            <div className="space-y-2.5">
                                              <input
                                                value={renameDraft}
                                                onChange={(event) => setRenameDraft(event.target.value)}
                                                className="w-full rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2 text-sm text-white outline-none transition focus:border-white/[0.14] focus:bg-[#202020]"
                                                style={{
                                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                                                }}
                                              />
                                            </div>
                                          ) : (
                                            <div className="flex min-w-0 items-start gap-3">
                                              <span className="cursor-grab select-none pt-1 text-base leading-none text-white/22 transition hover:text-white/42 active:cursor-grabbing">
                                                ⋮⋮
                                              </span>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                  <TagPill tag={tag} active emphasis="selected" />
                                                  {!tag.isActive ? <span className="text-xs text-mist/70">Archived</span> : null}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5 opacity-55 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100 md:pl-4">
                                          {editing ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingTagId(null)
                                                  setRenameDraft('')
                                                  setEditingTagSection('actions')
                                                  setEditingTagKind('action')
                                                  setEditingTagPolarity('positive')
                                                  setEditingTagAvailableIn(['day', 'evening'])
                                                }}
                                                className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:text-white"
                                              >
                                                Cancel
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  onUpdateTag(tag.id, {
                                                    name: renameDraft,
                                                    section: tag.section,
                                                    kind: tag.kind,
                                                    polarity: tag.polarity,
                                                    availableIn: tag.availableIn,
                                                  })
                                                  setEditingTagId(null)
                                                  setRenameDraft('')
                                                  setEditingTagSection('actions')
                                                  setEditingTagKind('action')
                                                  setEditingTagPolarity('positive')
                                                  setEditingTagAvailableIn(['day', 'evening'])
                                                }}
                                                className="rounded-2xl bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                                              >
                                                Save
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <ManageTagActionButton
                                                icon="✏️"
                                                label="Rename this tag and update its name everywhere it appears in the tag library."
                                                ariaLabel="Rename this tag"
                                                onClick={() => {
                                                  setEditingTagId(tag.id)
                                                  setRenameDraft(tag.name)
                                                  setEditingTagSection(tag.section)
                                                  setEditingTagKind(tag.kind)
                                                  setEditingTagPolarity(tag.polarity)
                                                  setEditingTagAvailableIn(tag.availableIn)
                                                }}
                                              />
                                              {manageTagsTab !== 'sleep' && tag.availableIn.includes(manageTagsTab) ? (
                                                <ManageTagActionButton
                                                  icon="➖"
                                                  label={`Remove this tag from ${getDayLogSectionLabel(manageTagsTab)} only, while keeping it available in its other sections.`}
                                                  ariaLabel={`Remove this tag from ${getDayLogSectionLabel(manageTagsTab)}`}
                                                  className="text-white/52 hover:text-white/82"
                                                  onClick={() => {
                                                    const nextAvailableIn = tag.availableIn.filter((value) => value !== manageTagsTab)
                                                    if (nextAvailableIn.length === 0) {
                                                      setPendingSectionRemoval({ tagId: tag.id, section: manageTagsTab })
                                                      return
                                                    }
                                                    onUpdateTag(tag.id, {
                                                      name: tag.name,
                                                      section: tag.section,
                                                      kind: tag.kind,
                                                      polarity: tag.polarity,
                                                      availableIn: nextAvailableIn,
                                                    })
                                                  }}
                                                />
                                              ) : null}
                                              {tag.isActive ? (
                                                <ManageTagActionButton
                                                  icon="📦"
                                                  label="Archive this tag so it no longer appears in active tag pickers, while keeping past entries intact."
                                                  ariaLabel="Archive this tag"
                                                  className="text-white/40 hover:text-white/72"
                                                  onClick={() => onArchiveTag(tag.id)}
                                                />
                                              ) : (
                                                <ManageTagActionButton
                                                  icon="📬"
                                                  label="Unarchive this tag and return it to the active tag pickers."
                                                  ariaLabel="Unarchive this tag"
                                                  className="text-white/52 hover:text-white/82"
                                                  onClick={() => onUnarchiveTag(tag.id)}
                                                />
                                              )}
                                              <ManageTagActionButton
                                                icon="🗑"
                                                label="Delete this tag from the tag library everywhere. Past logged entries will stay preserved."
                                                ariaLabel="Delete this tag entirely"
                                                className="text-[#D78E88] hover:bg-[rgba(239,68,68,0.12)] hover:text-[#F4C7C3]"
                                                onClick={() => setPendingTagDeleteId(tag.id)}
                                              />
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ) : null,
                        ) : (
                          <p className="px-3 py-2 text-sm text-mist/70">No tags in this section yet.</p>
                        )}
                      </div>
                    </div>
                ))
              ) : (
                <p className="text-sm text-mist/75">No custom tags yet.</p>
              )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

function hasEntryData(day: DayEntry) {
  return (
    day.isLogged ||
    day.cellColor !== 'blank' ||
    day.mood !== null ||
    day.motivation !== null ||
    day.clarity !== null ||
    day.energy !== null ||
    day.sleepQuality !== null ||
    day.bedtime.trim().length > 0 ||
    day.wakeTime.trim().length > 0 ||
    day.wokeDuringNight !== null ||
    day.morningIntention.trim().length > 0 ||
    day.moodNote.trim().length > 0 ||
    day.completedHabitIds.length > 0 ||
    day.habitsCompleted > 0 ||
    day.drank ||
    day.bigWin.trim().length > 0 ||
    day.journal.trim().length > 0 ||
    day.dashboardQuickNote.trim().length > 0 ||
    day.dashboardScratchpad.text.trim().length > 0 ||
    day.dashboardScratchpad.notes.trim().length > 0 ||
    day.dashboardScratchpad.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    day.dashboardScratchpad.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
    Object.values(day.dashboardScratchpad.financeSheets ?? {}).some(
      (sheet) =>
        sheet.notes.trim().length > 0 ||
        sheet.moneyIn.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0) ||
        sheet.moneyOut.some((item) => item.name.trim().length > 0 || item.day.trim().length > 0 || item.amount.trim().length > 0),
    ) ||
    Boolean(
      day.lowStateEntry &&
        (day.lowStateEntry.feelings.length > 0 ||
          day.lowStateEntry.customFeeling.trim().length > 0 ||
          day.lowStateEntry.mindText.trim().length > 0 ||
          day.lowStateEntry.mindHelping !== null ||
          day.lowStateEntry.realSituation.trim().length > 0 ||
          day.lowStateEntry.nextThing.trim().length > 0),
    ) ||
    day.medications.length > 0 ||
    day.tasks.length > 0 ||
    day.reminders.length > 0 ||
    day.dailyActions.length > 0 ||
    day.tagEntries.length > 0 ||
    day.tags.length > 0
  )
}

function createCustomDayTagId() {
  return `day-tag-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function createDayTagEntryId(seed: string) {
  return `day-tag-${seed}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function getDisplayTagForEntry(entry: DayEntry['tagEntries'][number], tags: Tag[]) {
  if (entry.tagId) {
    const reusableTag = tags.find((tag) => tag.id === entry.tagId)
    if (!reusableTag) return null
    return {
      entryId: entry.id,
      active: entry.selected,
      oneOff: false,
      timeSection: entry.timeSection,
      tag: reusableTag,
    }
  }

  if (!entry.customLabel) return null

  return {
    entryId: entry.id,
    active: entry.selected,
    oneOff: true,
    timeSection: entry.timeSection,
    tag: {
      id: entry.id,
      name: entry.customLabel,
      color: getTagColor(entry.polarity),
      section: entry.section,
      availableIn: [entry.timeSection] as DayLogSection[],
      kind: entry.kind,
      polarity: entry.polarity,
      isCustom: true,
      isActive: true,
    },
  }
}

function ManageTagActionButton({
  icon,
  label,
  ariaLabel,
  onClick,
  className = '',
}: {
  icon: string
  label: string
  ariaLabel: string
  onClick: () => void
  className?: string
}) {
  const [tooltipVisible, setTooltipVisible] = useState(false)

  return (
    <div
      className="relative flex"
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] leading-none text-white/58 transition hover:bg-white/[0.05] ${className}`}
      >
        {icon}
      </button>
      {tooltipVisible ? (
        <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 w-56 rounded-2xl border border-white/[0.08] bg-[#171717] px-3 py-2 text-xs leading-5 text-white/84 shadow-[0_16px_40px_rgba(0,0,0,0.32)]">
          {label}
        </div>
      ) : null}
    </div>
  )
}

const MOMENTUM_RULES = {
  requireNoAlcohol: true,
  minHabits: 1,
  allowLowMood: false,
}

function isMomentumDay(
  day: DayEntry,
  habitTrackers: HabitTracker[],
  activeHabitIds: Set<string>,
  badHabitDateMap: Map<string, BadHabitDefinition[]>,
  alcoholBadHabitId: string | null,
) {
  if (
    MOMENTUM_RULES.requireNoAlcohol &&
    alcoholBadHabitId &&
    (badHabitDateMap.get(day.date) ?? []).some((habit) => habit.id === alcoholBadHabitId)
  ) {
    return false
  }

  const moodSignal = getDayMoodSignal(day)
  if (!MOMENTUM_RULES.allowLowMood && moodSignal !== null && moodSignal < 4) return false

  const habitsCompleted = habitTrackers.filter(
    (tracker) => activeHabitIds.has(tracker.id) && tracker.entries[day.date]?.completed,
  ).length
  if (habitsCompleted < MOMENTUM_RULES.minHabits) return false

  return true
}

function getMomentumStreak(
  days: DayEntry[],
  habitTrackers: HabitTracker[],
  activeHabitIds: Set<string>,
  upToDate: string,
  badHabitDateMap: Map<string, BadHabitDefinition[]>,
  alcoholBadHabitId: string | null,
) {
  const sortedDays = [...days]
    .filter((day) => day.date <= upToDate)
    .sort((left, right) => left.date.localeCompare(right.date))

  let streak = 0
  for (let index = sortedDays.length - 1; index >= 0; index -= 1) {
    if (isMomentumDay(sortedDays[index], habitTrackers, activeHabitIds, badHabitDateMap, alcoholBadHabitId)) {
      streak += 1
    } else {
      break
    }
  }

  return streak
}

function getDayMoodSignal(day: DayEntry) {
  const values = [day.mood, day.energy, day.clarity, day.motivation].filter(
    (value): value is number => typeof value === 'number',
  )
  if (values.length > 0) {
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  if (day.morningMood || day.eveningMood) {
    return ((day.morningMood + day.eveningMood) / 2) * 2
  }

  return null
}

function PrimingHint({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <span className="group relative inline-flex min-w-0 items-center">
      <span className="min-w-0">{children}</span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-max max-w-[220px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#141414] px-3 py-2 text-center text-xs leading-5 text-mist shadow-[0_16px_34px_rgba(0,0,0,0.36)] group-hover:block">
        {hint}
      </span>
    </span>
  )
}

function GoalOverflowHint({
  children,
  goals,
}: {
  children: ReactNode
  goals: Array<{ tracker: HabitTracker; progress: NonNullable<ReturnType<typeof getTrackerGoalProgress>> }>
}) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden min-w-[180px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#141414] px-3 py-2.5 text-left text-xs leading-5 text-mist shadow-[0_16px_34px_rgba(0,0,0,0.36)] group-hover:block">
        <span className="flex flex-col gap-1.5">
          {goals.map(({ tracker, progress }) => (
            <span key={tracker.id} className="whitespace-nowrap">
              ⏳ {tracker.title} {progress.current}/{progress.target}
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}

function shortenHabitLabel(value: string) {
  return value.length <= 10 ? value : `${value.slice(0, 10).trim()}…`
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`
}

function createMedicationDraft(): MedicationSupplementEntry {
  return {
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    dose: '',
    unit: '',
    timeTaken: '',
    notes: '',
  }
}

function createDayEventId() {
  return `day-event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createDayEventDraft() {
  return {
    title: '',
    description: '',
    time: '',
  }
}

function getDisplayTagForDayEventTag(entry: DayEventEntry['tags'][number], tags: Tag[]) {
  if (entry.tagId) {
    const reusableTag = tags.find((tag) => tag.id === entry.tagId)
    if (!reusableTag) return null

    return {
      id: entry.id,
      oneOff: false,
      tag: reusableTag,
    }
  }

  if (!entry.customLabel) return null

  return {
    id: entry.id,
    oneOff: true,
    tag: {
      id: entry.id,
      name: entry.customLabel,
      color: getTagColor(entry.polarity),
      section: entry.section,
      availableIn: ['day'] as DayLogSection[],
      kind: entry.kind,
      polarity: entry.polarity,
      isCustom: true,
      isActive: true,
    },
  }
}

function getMedicationSuggestions(days: DayEntry[], currentDate: string) {
  const suggestionsByName = new Map<
    string,
    {
      key: string
      name: string
      dose: string
      unit: string
      timeTaken: string
      label: string
      frequency: number
      lastUsed: string
    }
  >()

  days
    .filter((day) => day.date <= currentDate)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
    .forEach((day) => {
      ;(day.medications ?? []).forEach((entry) => {
        const name = entry.name.trim()
        if (!name) return
        const key = name.toLowerCase()
        const existing = suggestionsByName.get(key)
        if (!existing) {
          suggestionsByName.set(key, {
            key,
            name,
            dose: entry.dose.trim(),
            unit: entry.unit.trim(),
            timeTaken: entry.timeTaken,
            label: [name, entry.dose.trim() ? `${entry.dose.trim()}${entry.unit.trim()}` : entry.unit.trim() || null].filter(Boolean).join(' · '),
            frequency: 1,
            lastUsed: day.date,
          })
          return
        }

        existing.frequency += 1
      })
    })

  return [...suggestionsByName.values()]
    .sort((left, right) => {
      if (left.frequency !== right.frequency) return right.frequency - left.frequency
      return right.lastUsed.localeCompare(left.lastUsed)
    })
    .slice(0, 6)
}

function formatMedicationSummary(entry: MedicationSupplementEntry) {
  const detail = entry.dose.trim() ? `${entry.dose.trim()}${entry.unit.trim()}` : entry.unit.trim()
  return [entry.name.trim(), detail || null, entry.timeTaken || null].filter(Boolean).join(' · ')
}

function sortMedicationEntries(entries: MedicationSupplementEntry[]) {
  return [...entries].sort((left, right) => {
    const leftMinutes = getTimeSortValue(left.timeTaken)
    const rightMinutes = getTimeSortValue(right.timeTaken)

    if (leftMinutes !== rightMinutes) return leftMinutes - rightMinutes
    return left.name.localeCompare(right.name)
  })
}

function getTimeSortValue(value: string) {
  if (!value) return Number.MAX_SAFE_INTEGER
  const [hours, minutes] = value.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.MAX_SAFE_INTEGER
  return hours * 60 + minutes
}

function isWeekendIso(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

function isHabitAvailableOnDate(tracker: HabitTracker, date: string) {
  if (!isWeekendIso(date)) return true
  return tracker.weekendVisibility === 'show'
}

function TimePickerField({
  value,
  placeholder,
  onChange,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const HOUR_ITEM_HEIGHT = 40
  const HOUR_LIST_PADDING = 54
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const [hourCenterIndex, setHourCenterIndex] = useState(8)
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const [hour, minute] = value ? value.split(':') : ['08', '00']

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node) || panelRef.current?.contains(event.target as Node)) {
        return
      }
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setPanelPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(220, rect.width),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !hourListRef.current) return
    const selected = hourListRef.current.querySelector<HTMLButtonElement>(`[data-hour="${hour}"]`)
    selected?.scrollIntoView({ block: 'center' })
  }, [hour, open])

  useEffect(() => {
    setHourCenterIndex(Number(hour))
  }, [hour])

  const updateHourCenterIndex = () => {
    if (!hourListRef.current) return
    const { scrollTop, clientHeight } = hourListRef.current
    const centerY = scrollTop + clientHeight / 2
    const centerIndex = (centerY - HOUR_LIST_PADDING - HOUR_ITEM_HEIGHT / 2) / HOUR_ITEM_HEIGHT
    setHourCenterIndex(Math.max(0, Math.min(23, centerIndex)))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition hover:border-white/[0.12] hover:bg-[#202020]"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
      >
        <span className={value ? 'text-white' : 'text-mist/45'}>{value || placeholder}</span>
        <span className="text-white/45">▾</span>
      </button>

      {open && panelPosition && typeof document !== 'undefined'
        ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[80] rounded-[22px] border border-white/[0.08] bg-[#111111] p-3 shadow-[0_18px_42px_rgba(0,0,0,0.38)] opacity-100 translate-y-0 transition duration-200 ease-out"
          style={{
            top: `${panelPosition.top}px`,
            left: `${panelPosition.left}px`,
            width: `${panelPosition.width}px`,
            boxShadow: '0 20px 46px rgba(0,0,0,0.38)',
            animation: 'time-picker-pop 180ms ease-out',
          }}
        >
          <div
            className="pointer-events-none absolute left-6 top-0 h-3 w-3 -translate-y-1/2 rotate-45 border-l border-t border-white/[0.08] bg-[#111111]"
            aria-hidden="true"
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-white/[0.06] bg-[#171717] p-2">
              <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">Hour</p>
              <div className="relative">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[#171717] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-9 -translate-y-1/2 rounded-xl border border-white/[0.08] bg-white/[0.04]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-[#171717] to-transparent" />
                <div
                  ref={hourListRef}
                  onScroll={updateHourCenterIndex}
                  className="max-h-48 snap-y snap-mandatory overflow-y-auto overscroll-contain py-[54px] pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                {Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map((option, index) => (
                  (() => {
                    const distance = Math.abs(index - hourCenterIndex)
                    const scale = Math.max(0.82, 1.08 - distance * 0.09)
                    const opacity = Math.max(0.24, 1 - distance * 0.24)
                    const translateY = Math.sign(index - hourCenterIndex) * Math.min(8, distance * 2.4)
                    const centered = Math.round(hourCenterIndex) === index
                    const isSelected = option === hour

                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onChange(`${option}:${minute}`)}
                        data-hour={option}
                        className={`block h-10 w-full snap-center rounded-xl px-2 text-sm transition ${
                          centered ? 'text-white' : 'text-white/55 hover:text-white/76'
                        }`}
                        style={{
                          transform: `translateY(${translateY}px) scale(${centered ? Math.max(scale, 1.08) : scale})`,
                          opacity,
                          fontWeight: centered || isSelected ? 600 : 500,
                          filter: centered ? 'blur(0px)' : `blur(${Math.min(1.2, distance * 0.28)}px)`,
                        }}
                      >
                        {option}
                      </button>
                    )
                  })()
                ))}
                </div>
              </div>
            </div>
            <div className="rounded-[18px] border border-white/[0.06] bg-[#171717] p-2">
              <p className="mb-2 px-1 text-[10px] uppercase tracking-[0.18em] text-mist/60">Minute</p>
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto overscroll-contain pr-1">
                {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0')).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onChange(`${hour}:${option}`)}
                    className={`rounded-xl px-2 py-1.5 text-xs transition ${
                      option === minute ? 'bg-white text-black' : 'bg-white/[0.04] text-mist hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-between">
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs font-medium text-white/58 transition hover:text-white/78"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-white/58 transition hover:text-white/78"
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function SectionHeader({ title, description, major = false }: { title: string; description?: string; major?: boolean }) {
  return (
    <div className={major ? 'space-y-2' : 'space-y-1'}>
      <p
        className={
          major
            ? 'text-[13px] font-semibold uppercase tracking-[0.16em] text-white/88'
            : dailyLogSubsectionLabelClassName
        }
      >
        {title}
      </p>
      {description ? (
        <p className={major ? 'max-w-2xl text-[15px] leading-7 text-mist' : 'text-sm leading-6 text-mist'}>{description}</p>
      ) : null}
    </div>
  )
}

function CompactChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  optional = false,
}: {
  label: string
  value: T | null
  options: Array<{ label: string; value: T; tone: 'green' | 'orange' | 'red' | 'yellow' | 'neutral' }>
  onChange: (value: T | null) => void
  optional?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className={dailyLogSubsectionLabelClassName}>{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value
          const selectedClass =
            option.tone === 'green'
              ? 'border-[rgba(34,197,94,0.36)] bg-[rgba(34,197,94,0.14)] text-[#DDFBE7]'
              : option.tone === 'orange'
                ? 'border-[rgba(245,158,11,0.36)] bg-[rgba(245,158,11,0.14)] text-[#FCE7C2]'
                : option.tone === 'yellow'
                  ? 'border-[rgba(250,204,21,0.34)] bg-[rgba(250,204,21,0.12)] text-[#FDF3C6]'
                  : option.tone === 'red'
                    ? 'border-[rgba(239,68,68,0.34)] bg-[rgba(239,68,68,0.14)] text-[#F7D6D3]'
                    : 'border-white/[0.14] bg-white/[0.07] text-white/88'

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(optional && active ? null : option.value)}
              className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition duration-150 ease-out ${
                active
                  ? selectedClass
                  : 'border-white/[0.06] bg-[#1A1A1A] text-[#B0B0B0] hover:border-white/[0.1] hover:bg-[#202020] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TagSectionFooterActions({
  onCreate,
  onManage,
}: {
  onCreate: () => void
  onManage: () => void
}) {
  return (
    <div className="flex justify-end gap-1 pt-1">
      <button
        type="button"
        onClick={onCreate}
        className="flex h-10 w-10 items-center justify-center rounded-2xl text-white/42 transition hover:bg-white/[0.04] hover:text-white/78 focus-visible:bg-white/[0.05] focus-visible:text-white/82 focus-visible:outline-none"
        aria-label="Create new tag"
      >
        <span className="text-[15px] leading-none">⊕</span>
      </button>
      <button
        type="button"
        onClick={onManage}
        className="flex h-10 w-10 items-center justify-center rounded-2xl text-white/42 transition hover:bg-white/[0.04] hover:text-white/78 focus-visible:bg-white/[0.05] focus-visible:text-white/82 focus-visible:outline-none"
        aria-label="Manage tags"
      >
        <span className="text-[15px] leading-none">✎</span>
      </button>
    </div>
  )
}

function CustomTagComposer({
  customTagName,
  onCustomTagNameChange,
  customTagSaveMode,
  onCustomTagSaveModeChange,
  customTagSection,
  onCustomTagSectionChange,
  customTagTimeSection,
  onCustomTagTimeSectionChange,
  customTagPolarity,
  onCustomTagPolarityChange,
  onCancel,
  onSubmit,
}: {
  customTagName: string
  onCustomTagNameChange: (value: string) => void
  customTagSaveMode: 'once' | 'reusable'
  onCustomTagSaveModeChange: (value: 'once' | 'reusable') => void
  customTagSection: TagSection
  onCustomTagSectionChange: (value: TagSection) => void
  customTagTimeSection: CustomTagTimeContext
  onCustomTagTimeSectionChange: (value: CustomTagTimeContext) => void
  customTagPolarity: TagPolarity
  onCustomTagPolarityChange: (value: TagPolarity) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <div className="rounded-[18px] bg-white/[0.03] p-2.5">
      <div className="space-y-2.5">
        <input
          value={customTagName}
          onChange={(event) => onCustomTagNameChange(event.target.value)}
          placeholder="New custom tag"
          className="rounded-2xl border border-white/[0.08] bg-[#1A1A1A] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-mist/45 focus:border-white/[0.14] focus:bg-[#202020]"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        />
        <TagMetaToggle
          label="Save"
          options={[
            { label: 'Save as reusable', value: 'reusable' },
            { label: 'Once-off', value: 'once' },
          ]}
          value={customTagSaveMode}
          onChange={(value) => onCustomTagSaveModeChange(value as 'once' | 'reusable')}
          columns={2}
          accent="blue"
        />
        <TagMetaToggle
          label="Type"
          options={[
            { label: 'Mood', value: 'feelings' },
            { label: 'Actions', value: 'actions' },
            { label: 'Events', value: 'events' },
          ]}
          value={customTagSection}
          onChange={(value) => onCustomTagSectionChange(value as TagSection)}
          columns={3}
          accent="blue"
        />
        <TagMetaToggle
          label="Time"
          options={[
            { label: 'Sleep', value: 'sleep' },
            { label: 'Morning', value: 'morning' },
            { label: 'Evening', value: 'evening' },
            { label: 'Day', value: 'day' },
          ]}
          value={customTagTimeSection}
          onChange={(value) => onCustomTagTimeSectionChange(value as CustomTagTimeContext)}
          columns={4}
          accent="blue"
        />
        <TagMetaToggle
          label="Polarity"
          options={[
            { label: 'Positive', value: 'positive' },
            { label: 'Neutral', value: 'neutral' },
            { label: 'Negative', value: 'negative' },
          ]}
          value={customTagPolarity}
          onChange={(value) => onCustomTagPolarityChange(value as TagPolarity)}
          columns={3}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl bg-white/[0.04] px-3 py-2 text-sm text-mist transition hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!customTagName.trim()}
            onClick={onSubmit}
            className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
              customTagName.trim() ? 'bg-white text-black hover:bg-white/90' : 'cursor-not-allowed bg-white/8 text-mist/60'
            }`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

function TagMetaToggle({
  label,
  options,
  value,
  onChange,
  columns,
  accent = 'green',
}: {
  label: string
  options: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
  columns?: number
  accent?: 'green' | 'blue'
}) {
  return (
    <div className="space-y-1.5">
      <p className={`px-1 ${dailyLogSubsectionLabelClassName}`}>{label}</p>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const selected = option.value === value
          const negative = label === 'Polarity' && option.value === 'negative'
          const neutral = label === 'Polarity' && option.value === 'neutral'
          const oneOffSelected = label === 'Save' && option.value === 'once' && selected
          const selectedClass = negative
            ? 'border-[#B35A65]/60 bg-[#B35A65]/20 text-[#F7B4BC] shadow-[0_0_0_1px_rgba(179,90,101,0.18)]'
            : neutral
              ? 'border-[rgba(96,165,250,0.56)] bg-[rgba(96,165,250,0.18)] text-[#D7E9FF] shadow-[0_0_0_1px_rgba(96,165,250,0.16)]'
              : accent === 'blue'
                ? 'border-[rgba(96,165,250,0.6)] bg-[rgba(96,165,250,0.16)] text-[#D7E9FF] shadow-[0_0_0_1px_rgba(96,165,250,0.16)]'
                : 'border-[#22C55E]/60 bg-[#22C55E]/18 text-[#B8F3CC] shadow-[0_0_0_1px_rgba(34,197,94,0.14)]'

          return (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChange(option.value)
              }}
              className={`min-w-0 whitespace-nowrap rounded-2xl border px-2.5 py-2 text-[13px] text-center transition ${
                selected
                  ? selectedClass
                  : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#B0B0B0] hover:border-[#3A3A3A] hover:bg-[#222222] hover:text-white'
              }`}
              style={{
                borderStyle: oneOffSelected ? 'dashed' : 'solid',
                borderWidth: oneOffSelected ? 2 : 1,
                boxShadow: oneOffSelected ? '0 0 0 1px rgba(96,165,250,0.18)' : undefined,
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TagAvailabilityToggle({
  value,
  onChange,
}: {
  value: DayLogSection[]
  onChange: (value: DayLogSection[]) => void
}) {
  const options: Array<{ label: string; value: DayLogSection }> = [
    { label: 'Morning', value: 'morning' },
    { label: 'Day', value: 'day' },
    { label: 'Evening', value: 'evening' },
  ]

  return (
    <div className="space-y-1.5">
      <p className={`px-1 ${dailyLogSubsectionLabelClassName}`}>Available In</p>
      <div className="grid gap-2 md:grid-cols-3">
        {options.map((option) => {
          const selected = value.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChange(
                  selected ? value.filter((item) => item !== option.value) : [...value, option.value].sort(byDayLogSectionOrder),
                )
              }}
              className={`min-w-0 whitespace-nowrap rounded-2xl border px-2.5 py-2 text-[13px] text-center transition ${
                selected
                  ? 'border-[#22C55E]/60 bg-[#22C55E]/18 text-[#B8F3CC] shadow-[0_0_0_1px_rgba(34,197,94,0.14)]'
                  : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#B0B0B0] hover:border-[#3A3A3A] hover:bg-[#222222] hover:text-white'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function getTagColor(polarity: TagPolarity) {
  if (polarity === 'positive') return '#22C55E'
  if (polarity === 'neutral') return '#60A5FA'
  return '#B35A65'
}

function TagGroup({
  title,
  tags,
  selectedIds,
  customItems = [],
  onToggle,
  onToggleCustom,
}: {
  title: string
  tags: Tag[]
  selectedIds: string[]
  customItems?: Array<{
    entryId: string
    active: boolean
    oneOff: boolean
    tag: Tag
  }>
  onToggle: (tagId: string) => void
  onToggleCustom: (entryId: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className={dailyLogMicroLabelClassName}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const active = selectedIds.includes(tag.id)
          return (
            <button
              key={tag.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggle(tag.id)
              }}
              className={`transition duration-150 ease-out ${
                active ? 'hover:brightness-100' : 'hover:scale-[1.02] hover:brightness-110'
              }`}
            >
              <TagPill tag={tag} active={active} />
            </button>
          )
        })}
        {customItems.map((item) => (
          <button
            key={item.entryId}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleCustom(item.entryId)
            }}
            className={`transition duration-150 ease-out ${
              item.active ? 'hover:brightness-100' : 'hover:scale-[1.02] hover:brightness-110'
            }`}
          >
            <TagPill tag={item.tag} active={item.active} oneOff />
          </button>
        ))}
      </div>
    </div>
  )
}

function SelectedTagSummary({
  title,
  tags,
  customItems = [],
  onToggle,
  onToggleCustom,
  emptyLabel,
}: {
  title: string
  tags: Tag[]
  customItems?: Array<{
    entryId: string
    active: boolean
    oneOff: boolean
    tag: Tag
  }>
  onToggle: (tagId: string) => void
  onToggleCustom: (entryId: string) => void
  emptyLabel: string
}) {
  const visibleCustomItems = customItems.filter((item) => item.active)
  const hasItems = tags.length > 0 || visibleCustomItems.length > 0

  return (
    <div className="space-y-2">
      <p className={dailyLogMicroLabelClassName}>{title}</p>
      {hasItems ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggle(tag.id)
              }}
              className="transition duration-150 ease-out hover:brightness-100"
            >
              <TagPill tag={tag} active />
            </button>
          ))}
          {visibleCustomItems.map((item) => (
            <button
              key={item.entryId}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onToggleCustom(item.entryId)
              }}
              className="transition duration-150 ease-out hover:brightness-100"
            >
              <TagPill tag={item.tag} active oneOff />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-mist/68">{emptyLabel}</p>
      )}
    </div>
  )
}

function getDefaultKindForSection(section: TagSection): TagKind {
  if (section === 'feelings') return 'feeling'
  return 'action'
}

function resolveCustomTagSection(section: TagSection, timeContext: CustomTagTimeContext): TagSection {
  return timeContext === 'sleep' ? 'sleep' : section
}

function getAvailabilityForCustomTagTimeContext(timeContext: CustomTagTimeContext): DayLogSection[] {
  return timeContext === 'sleep' ? ['morning'] : [timeContext]
}

function getTagEntryTimeSectionForCustomTagTimeContext(timeContext: CustomTagTimeContext): DayLogSection {
  return timeContext === 'sleep' ? 'morning' : timeContext
}

function getDefaultAvailableInForSection(section: TagSection): DayLogSection[] {
  if (section === 'sleep') return ['morning']
  if (section === 'feelings') return ['morning', 'day', 'evening']
  if (section === 'events') return ['day']
  return ['morning', 'day', 'evening']
}

function isTagAvailableInSection(tag: Tag, section: DayLogSection) {
  if (tag.availableIn.includes(section)) return true

  return (
    tag.section === 'actions' &&
    section === 'morning' &&
    tag.availableIn.length === 2 &&
    tag.availableIn.includes('day') &&
    tag.availableIn.includes('evening')
  )
}

function getDayLogSectionLabel(value: DayLogSection) {
  if (value === 'morning') return 'Morning'
  if (value === 'day') return 'Day'
  return 'Evening'
}

function getCellColorForEveningOutcome(outcome: DayEntry['eveningOutcome']): DayEntry['cellColor'] {
  if (outcome === 'good') return 'green'
  if (outcome === 'mixed') return 'orange'
  if (outcome === 'poor') return 'red'
  if (outcome === 'unstable') return 'yellow'
  return 'blank'
}

function byDayLogSectionOrder(left: DayLogSection, right: DayLogSection) {
  return getDayLogSectionOrder(left) - getDayLogSectionOrder(right)
}

function getDayLogSectionOrder(value: DayLogSection) {
  if (value === 'morning') return 0
  if (value === 'day') return 1
  return 2
}

function CheckInRow({ label, value, onSelect }: { label: string; value: number | null; onSelect: (value: number) => void }) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null)
  const percent = value ? `${(value / 10) * 100}%` : '0%'
  const hoverPercent = hoveredValue ? `${(hoveredValue / 10) * 100}%` : '0%'
  const thumbPercent = value ? `calc(${percent} - 7px)` : '-9999px'

  return (
    <div className="grid items-center gap-2 md:grid-cols-[140px_1fr_28px]">
      <p className={dailyLogFieldLabelClassName}>{label}</p>
      <button
        type="button"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
          const nextValue = Math.min(10, Math.max(1, Math.floor(ratio * 10) + 1))
          setHoveredValue(nextValue)
        }}
        onMouseLeave={() => setHoveredValue(null)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
          const snapped = Math.min(10, Math.max(1, Math.floor(ratio * 10) + 1))
          onSelect(snapped)
        }}
        aria-label={label}
        className="relative h-7 w-full transition-[filter] duration-150 ease-out hover:brightness-[1.03]"
      >
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
          {hoveredValue ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/[0.06] transition-all duration-150 ease-out"
              style={{ width: hoverPercent }}
            />
          ) : null}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-glow transition-all duration-160 ease-out"
            style={{
              width: percent,
              opacity: value ? 0.72 + value * 0.028 : 0,
              boxShadow: value ? '0 0 14px rgba(79,220,148,0.16)' : 'none',
            }}
          />
          {value ? (
            <div
              className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-white/[0.16] bg-white/[0.08] shadow-[0_0_10px_rgba(79,220,148,0.12)] transition-all duration-160 ease-out"
              style={{ left: thumbPercent }}
            />
          ) : null}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 10) 100%',
              backgroundPosition: '0 0',
            }}
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.06]" />
        </div>
      </button>
      <span className="text-right text-sm font-medium text-mist">{hoveredValue ?? value ?? '–'}</span>
    </div>
  )
}
