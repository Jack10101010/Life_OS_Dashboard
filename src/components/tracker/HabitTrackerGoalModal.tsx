import { useEffect, useMemo, useState } from 'react'
import { buildDefaultGoalForHabitType, getGoalTypesForHabitType, getTodayIsoDate } from '../../lib/habitTrackerGoals'
import { HabitTracker, HabitTrackerGoal } from '../../types'
import { DetailDrawer } from '../layout/DetailDrawer'
import { Button } from '../ui/Button'

function normalizeGoalForType(goal: HabitTrackerGoal | null, tracker: HabitTracker) {
  if (goal) return goal
  return buildDefaultGoalForHabitType(tracker.habitType)
}

export function HabitTrackerGoalModal({
  tracker,
  open,
  onClose,
  onSave,
}: {
  tracker: HabitTracker | null
  open: boolean
  onClose: () => void
  onSave: (tracker: HabitTracker) => void
}) {
  const [draftGoal, setDraftGoal] = useState<HabitTrackerGoal | null>(tracker ? normalizeGoalForType(tracker.goal, tracker) : null)
  const [startMode, setStartMode] = useState<'today' | 'pick'>('today')
  const [startDate, setStartDate] = useState(getTodayIsoDate())

  useEffect(() => {
    setDraftGoal(tracker ? normalizeGoalForType(tracker.goal, tracker) : null)
    const nextStartDate = tracker?.goal?.startDate ?? getTodayIsoDate()
    setStartDate(nextStartDate)
    setStartMode(nextStartDate === getTodayIsoDate() ? 'today' : 'pick')
  }, [tracker])

  const goalOptions = useMemo(() => (tracker ? getGoalTypesForHabitType(tracker.habitType) : []), [tracker])
  const unsupportedGoalType = goalOptions.length === 0

  if (!tracker || !draftGoal) return null

  const setGoalType = (nextType: HabitTrackerGoal['type']) => {
    const nextStartDate = startMode === 'today' ? getTodayIsoDate() : startDate
    switch (nextType) {
      case 'streak':
        setDraftGoal({ type: 'streak', target: 7, startDate: nextStartDate })
        break
      case 'times-per-week':
        setDraftGoal({ type: 'times-per-week', target: 3, period: 'week', startDate: nextStartDate })
        break
      case 'target-value':
        setDraftGoal({ type: 'target-value', target: 1, startDate: nextStartDate })
        break
      case 'minutes-target':
        setDraftGoal({ type: 'minutes-target', target: 30, startDate: nextStartDate })
        break
    }
  }

  const save = () => {
    const resolvedStartDate = startMode === 'today' ? getTodayIsoDate() : startDate
    onSave({ ...tracker, goal: { ...draftGoal, startDate: resolvedStartDate } })
    onClose()
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      size="md"
      subtitle={`${tracker.title} goal`}
      title={tracker.goal ? 'Edit goal' : 'Set goal'}
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          {unsupportedGoalType ? (
            <>
              <p className="text-sm text-[#B0B0B0]">Goal types for this habit</p>
              <p className="mt-2 text-sm text-[#8C8C8C]">Option-based goals are planned, but this first version only supports checkbox, number, and timer goals.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#B0B0B0]">Goal type</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {goalOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setGoalType(option.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      draftGoal.type === option.value
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {!unsupportedGoalType ? (
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#B0B0B0]">Target</p>
              <p className="mt-1 text-xs text-[#8C8C8C]">
                {draftGoal.type === 'streak'
                  ? 'Choose how many days in a row you want to sustain.'
                  : draftGoal.type === 'times-per-week'
                    ? 'Choose how many times you want to complete this habit each week.'
                    : draftGoal.type === 'target-value'
                      ? 'Choose the number you want to reach each day.'
                      : 'Choose the number of minutes you want to reach each day.'}
              </p>
            </div>
            <input
              type="number"
              min={1}
              step={1}
              value={draftGoal.target}
              onChange={(event) =>
                setDraftGoal({
                  ...draftGoal,
                  target: Math.max(Number(event.target.value || 1), 1),
                } as HabitTrackerGoal)
              }
              className="w-24 rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-right text-white outline-none"
            />
          </div>
          {draftGoal.type === 'streak' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {[3, 5, 7, 14].map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setDraftGoal({ type: 'streak', target, startDate })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    draftGoal.target === target ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {target} days
                </button>
              ))}
            </div>
          ) : null}
          {draftGoal.type === 'times-per-week' ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {[2, 3, 4, 5, 7].map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => setDraftGoal({ type: 'times-per-week', target, period: 'week', startDate })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    draftGoal.target === target ? 'border-white/20 bg-white/10 text-white' : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {target}/week
                </button>
              ))}
            </div>
          ) : null}
          </div>
        ) : null}

        {!unsupportedGoalType ? (
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#181818] px-4 py-4">
            <p className="text-sm text-[#B0B0B0]">Start</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStartMode('today')
                  const today = getTodayIsoDate()
                  setStartDate(today)
                  setDraftGoal((current) => (current ? { ...current, startDate: today } : current))
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  startMode === 'today'
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                }`}
              >
                Start today
              </button>
              <button
                type="button"
                onClick={() => setStartMode('pick')}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  startMode === 'pick'
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/5 bg-[#1A1A1A] text-[#A0A0A0] hover:text-white'
                }`}
              >
                Pick start date
              </button>
            </div>
            {startMode === 'pick' ? (
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#8C8C8C]">Future starts are supported. Backdating into the past is disabled.</p>
                </div>
                <input
                  type="date"
                  min={getTodayIsoDate()}
                  value={startDate}
                  onChange={(event) => {
                    const nextDate = event.target.value || getTodayIsoDate()
                    setStartDate(nextDate)
                    setDraftGoal((current) => (current ? { ...current, startDate: nextDate } : current))
                  }}
                  className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2 text-right text-white outline-none"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-between gap-3">
          <Button
            onClick={() => {
              onSave({ ...tracker, goal: null })
              onClose()
            }}
          >
            Clear goal
          </Button>
          <div className="flex gap-3">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={unsupportedGoalType}>
              Save goal
            </Button>
          </div>
        </div>
      </div>
    </DetailDrawer>
  )
}
