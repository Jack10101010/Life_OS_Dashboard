import { useEffect, useMemo, useRef, useState } from 'react'
import { DayEntry, LowStateEntry } from '../../types'
import { Card } from '../../components/ui/Card'
import { HeatmapSegmentedControl } from '../../components/tracker/HeatmapControls'

type JournalSection = 'journal' | 'gratitude' | 'vision-board'

const JOURNAL_PROMPTS = [
  "What's on your mind today?",
  'What feels most alive or unresolved right now?',
  'What deserves a little more honesty on the page?',
]
const LOW_STATE_OPTIONS = ['Anxious', 'Overwhelmed', 'Low', 'Restless', "Can't focus", 'Other'] as const

export function JournalPage({
  entries,
  initialSection = 'journal',
  onOpenDay,
  onUpdateDay,
}: {
  entries: DayEntry[]
  initialSection?: JournalSection
  onOpenDay: (day: DayEntry) => void
  onUpdateDay: (dayId: string, updater: (day: DayEntry) => DayEntry, options?: { skipCanonicalSave?: boolean }) => void
}) {
  const [section, setSection] = useState<JournalSection>(initialSection)

  useEffect(() => {
    setSection(initialSection)
  }, [initialSection])

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-[700px] flex-col gap-5">
        <div className="space-y-4 px-2">
          <p className="text-xs uppercase tracking-[0.24em] text-mist/65">Reflective space</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h3 className="text-3xl font-semibold text-white">Journal</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-mist">
                A quieter home for writing, gratitude, and longer-range vision, designed to feel separate from the tracker.
              </p>
            </div>
            <HeatmapSegmentedControl
              items={[
                ['journal', 'Journal'],
                ['gratitude', 'Gratitude'],
                ['vision-board', 'Vision Board'],
              ] as Array<[JournalSection, string]>}
              value={section}
              onChange={setSection}
            />
          </div>
        </div>

        {section === 'journal' ? <JournalWritingPanel entries={entries} onOpenDay={onOpenDay} onUpdateDay={onUpdateDay} /> : null}
        {section === 'gratitude' ? <GratitudePanel /> : null}
        {section === 'vision-board' ? <VisionBoardPanel /> : null}
      </div>
    </div>
  )
}

function JournalWritingPanel({
  entries,
  onOpenDay,
  onUpdateDay,
}: {
  entries: DayEntry[]
  onOpenDay: (day: DayEntry) => void
  onUpdateDay: (dayId: string, updater: (day: DayEntry) => DayEntry, options?: { skipCanonicalSave?: boolean }) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [focused, setFocused] = useState(false)
  const [lowStateMode, setLowStateMode] = useState(false)
  const [lowStateStep, setLowStateStep] = useState(0)
  const todayIso = new Date().toISOString().slice(0, 10)
  const orderedEntries = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries])
  const activeEntry = useMemo(
    () =>
      orderedEntries.find((entry) => entry.date === todayIso) ??
      orderedEntries.find((entry) => entry.isLogged || entry.journal.trim().length > 0 || entry.moodNote.trim().length > 0 || entry.bigWin.trim().length > 0) ??
      orderedEntries[0] ??
      null,
    [orderedEntries, todayIso],
  )
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(activeEntry?.id ?? null)

  useEffect(() => {
    if (!activeEntry) return
    setSelectedEntryId((current) => current ?? activeEntry.id)
  }, [activeEntry])

  const selectedEntry = useMemo(
    () => orderedEntries.find((entry) => entry.id === selectedEntryId) ?? activeEntry ?? null,
    [activeEntry, orderedEntries, selectedEntryId],
  )
  const loggedEntries = useMemo(
    () =>
      orderedEntries.filter((entry) => entry.isLogged && (entry.journal.trim().length > 0 || entry.moodNote.trim().length > 0 || entry.bigWin.trim().length > 0)),
    [orderedEntries],
  )
  const prompt = selectedEntry ? JOURNAL_PROMPTS[new Date(`${selectedEntry.date}T00:00:00Z`).getUTCDate() % JOURNAL_PROMPTS.length] : JOURNAL_PROMPTS[0]

  useEffect(() => {
    if (!textareaRef.current) return
    resizeTextarea(textareaRef.current)
  }, [selectedEntry?.id, selectedEntry?.journal])

  useEffect(() => {
    setLowStateMode(false)
    setLowStateStep(0)
  }, [selectedEntry?.id])

  if (!selectedEntry) {
    return (
      <Card className="border-white/[0.04] bg-transparent p-0 shadow-none">
        <p className="text-sm text-mist">No journal entries are available yet.</p>
      </Card>
    )
  }

  const lowStateEntry = selectedEntry.lowStateEntry ?? createLowStateEntry()
  const updateLowStateEntry = (updater: (entry: LowStateEntry) => LowStateEntry) => {
    onUpdateDay(selectedEntry.id, (current) => ({
      ...current,
      isLogged: true,
      lowStateEntry: updater(current.lowStateEntry ?? createLowStateEntry()),
    }))
  }

  return (
    <>
      {lowStateMode ? (
        <LowStateModePanel
          entry={lowStateEntry}
          step={lowStateStep}
          onBack={() => setLowStateStep((current) => Math.max(0, current - 1))}
          onNext={() => setLowStateStep((current) => Math.min(4, current + 1))}
          onClose={() => {
            setLowStateMode(false)
            setLowStateStep(0)
          }}
          onChange={updateLowStateEntry}
        />
      ) : null}

      <section
        className={`rounded-[30px] px-2 py-2 transition duration-200 ease-out ${lowStateMode ? 'hidden' : ''}`}
        style={{
          backgroundColor: focused ? 'rgba(255,255,255,0.012)' : 'transparent',
          boxShadow: focused ? '0 0 0 1px rgba(255,255,255,0.03)' : 'none',
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-mist/60">Entry</p>
            <h4 className="mt-2 text-2xl font-semibold text-white">
              {new Date(`${selectedEntry.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h4>
            {selectedEntry.bigWin.trim() ? <p className="mt-3 text-sm text-mist">{selectedEntry.bigWin.trim()}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLowStateMode(true)}
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/76 transition hover:border-white/[0.14] hover:text-white"
            >
              Low State Mode
            </button>
            <button
              type="button"
              onClick={() => onOpenDay(selectedEntry)}
              className="text-sm text-white/58 transition hover:text-white/82"
            >
              Open day
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={selectedEntry.journal}
          onChange={(event) =>
            onUpdateDay(selectedEntry.id, (current) => ({
              ...current,
              isLogged: true,
              journal: event.target.value,
            }))
          }
          onInput={(event) => resizeTextarea(event.currentTarget)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={prompt}
          className="min-h-[240px] w-full resize-none overflow-hidden bg-transparent px-1 py-1 text-[17px] leading-8 text-white/86 outline-none placeholder:text-mist/42"
          style={{ transition: 'height 160ms ease-out, color 150ms ease-out' }}
        />
      </section>

      <section className={`${focused || lowStateMode ? 'opacity-72' : 'opacity-100'} space-y-4 transition duration-200 ease-out`}>
        <div className="flex items-center justify-between px-2">
          <p className="text-xs uppercase tracking-[0.22em] text-mist/60">Past entries</p>
          <p className="text-xs text-mist/55">{loggedEntries.length} saved</p>
        </div>
        <div className="space-y-1">
          {loggedEntries.length > 0 ? (
            loggedEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedEntryId(entry.id)}
                className={`block w-full rounded-[22px] px-2 py-3 text-left transition ${
                  selectedEntry.id === entry.id ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]'
                }`}
              >
                <p className="text-sm font-medium text-white/82">
                  {new Date(`${entry.date}T00:00:00Z`).toLocaleDateString('en-IE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-mist">
                  {getJournalPreview(entry)}
                </p>
              </button>
            ))
          ) : (
            <p className="px-2 text-sm text-mist">No saved entries yet. Start with today.</p>
          )}
        </div>
      </section>
    </>
  )
}

function LowStateModePanel({
  entry,
  step,
  onBack,
  onNext,
  onClose,
  onChange,
}: {
  entry: LowStateEntry
  step: number
  onBack: () => void
  onNext: () => void
  onClose: () => void
  onChange: (updater: (entry: LowStateEntry) => LowStateEntry) => void
}) {
  const isFinalStep = step === 4

  return (
    <section className="mx-auto max-w-[620px] space-y-8 rounded-[34px] border border-white/[0.05] bg-white/[0.02] px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.24em] text-mist/60">Low State Mode</p>
        <button type="button" onClick={onClose} className="text-sm text-white/56 transition hover:text-white/82">
          Close
        </button>
      </div>

      {step === 0 ? (
        <div className="space-y-5">
          <div>
            <h4 className="text-3xl font-semibold text-white">What&apos;s going on right now?</h4>
            <p className="mt-3 text-sm leading-7 text-mist">Start simple. Name the state without trying to solve it yet.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LOW_STATE_OPTIONS.map((option) => {
              const active = entry.feelings.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      feelings: active ? current.feelings.filter((value) => value !== option) : [...current.feelings, option],
                    }))
                  }
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    active ? 'border-white/[0.18] bg-white/[0.08] text-white' : 'border-white/[0.08] bg-white/[0.03] text-mist hover:text-white'
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
          <textarea
            value={entry.customFeeling}
            onChange={(event) => onChange((current) => ({ ...current, customFeeling: event.target.value }))}
            placeholder="Anything else you want to name?"
            className="min-h-[90px] w-full resize-none bg-transparent text-sm leading-7 text-white/84 outline-none placeholder:text-mist/42"
          />
        </div>
      ) : null}

      {step === 1 ? (
        <StepTextArea
          title="What&apos;s actually on your mind?"
          description="Keep it short and direct."
          value={entry.mindText}
          onChange={(value) => onChange((current) => ({ ...current, mindText: value }))}
        />
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <div>
            <h4 className="text-3xl font-semibold text-white">Is your mind helping you right now?</h4>
            <p className="mt-3 text-sm leading-7 text-mist">You don&apos;t need a perfect answer. Just be honest.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['yes', 'Yes'],
              ['no', 'No'],
              ['not-sure', 'Not sure'],
            ].map(([value, label]) => {
              const active = entry.mindHelping === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChange((current) => ({ ...current, mindHelping: value as LowStateEntry['mindHelping'] }))}
                  className={`rounded-full border px-3 py-2 text-sm transition ${
                    active ? 'border-white/[0.18] bg-white/[0.08] text-white' : 'border-white/[0.08] bg-white/[0.03] text-mist hover:text-white'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          {entry.mindHelping === 'no' ? (
            <StepTextArea
              title="What&apos;s the real situation, without the noise?"
              description="Write the clearest version you can."
              value={entry.realSituation}
              onChange={(value) => onChange((current) => ({ ...current, realSituation: value }))}
              compact
            />
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <StepTextArea
            title="What&apos;s one small thing you can do next?"
            description="Keep it tiny. Enough to create momentum."
            value={entry.nextThing}
            onChange={(value) => onChange((current) => ({ ...current, nextThing: value }))}
          />
          <div className="flex flex-wrap gap-2 text-sm text-mist/72">
            {['Drink water', 'Step outside', 'Reply to one message', 'Write one sentence', 'Take a slow breath'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onChange((current) => ({ ...current, nextThing: item }))}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {isFinalStep ? (
        <div className="space-y-4">
          <p className="text-3xl font-semibold text-white">You don&apos;t need to solve everything right now.</p>
          <p className="text-lg text-mist">Just do the next small thing.</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className={`text-sm transition ${step === 0 ? 'pointer-events-none opacity-0' : 'text-white/56 hover:text-white/82'}`}
        >
          Back
        </button>
        {isFinalStep ? (
          <button
            type="button"
            onClick={() => {
              onChange((current) => ({ ...current, completedAt: new Date().toISOString() }))
              onClose()
            }}
            className="rounded-full border border-white/[0.08] bg-white text-sm font-medium text-black px-4 py-2 transition hover:bg-white/92"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="rounded-full border border-white/[0.08] bg-white text-sm font-medium text-black px-4 py-2 transition hover:bg-white/92"
          >
            Continue
          </button>
        )}
      </div>
    </section>
  )
}

function StepTextArea({
  title,
  description,
  value,
  onChange,
  compact = false,
}: {
  title: string
  description: string
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-3xl font-semibold text-white">{title}</h4>
        <p className="mt-3 text-sm leading-7 text-mist">{description}</p>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full resize-none bg-transparent text-sm leading-7 text-white/84 outline-none placeholder:text-mist/42 ${compact ? 'min-h-[110px]' : 'min-h-[160px]'}`}
        placeholder="Write a few lines."
      />
    </div>
  )
}

function GratitudePanel() {
  return (
    <div className="space-y-8 px-2">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mist/65">Gratitude</p>
        <h3 className="mt-3 text-3xl font-semibold text-white">A softer gratitude ritual</h3>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mist">
          Keep this light. A few honest lines are enough.
        </p>
      </div>

      <div className="space-y-5">
        {['Something small that helped today', 'Someone or something I appreciate', 'A moment I want to remember'].map((prompt) => (
          <div key={prompt} className="border-b border-white/[0.07] pb-4">
            <p className="text-sm text-white/82">{prompt}</p>
            <p className="mt-3 text-sm leading-7 text-mist/70">Write a line here when this section becomes active.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function VisionBoardPanel() {
  return (
    <div className="space-y-8 px-2">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mist/65">Vision board</p>
        <h3 className="mt-3 text-3xl font-semibold text-white">Longer-range direction</h3>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-mist">
          Keep it visual, spacious, and intentional. This area is meant to feel more like a wall of direction than a dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          'Themes and identity cues',
          'Images and references',
          'Ideas worth returning to',
          'Longer-range reminders',
        ].map((item) => (
          <div key={item} className="rounded-[28px] border border-white/[0.05] bg-white/[0.02] p-6">
            <p className="text-sm font-medium text-white/86">{item}</p>
            <p className="mt-3 text-sm leading-6 text-mist/72">This space will stay intentionally light until visual boards become active.</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function getJournalPreview(entry: DayEntry) {
  const firstLine = entry.journal.split('\n').map((line) => line.trim()).find(Boolean)
  return firstLine || entry.moodNote || entry.bigWin || 'Journal entry'
}

function resizeTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(240, textarea.scrollHeight)}px`
}

function createLowStateEntry(): LowStateEntry {
  return {
    feelings: [],
    customFeeling: '',
    mindText: '',
    mindHelping: null,
    realSituation: '',
    nextThing: '',
    completedAt: null,
  }
}
