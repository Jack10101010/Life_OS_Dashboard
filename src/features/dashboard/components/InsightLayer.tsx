import { useState } from 'react'
import {
  BookOpen,
  ChevronRight,
  Grid3X3,
  ListTodo,
  Plus,
  Send,
} from 'lucide-react'

type InsightTask = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low' | 'none'
}

type JournalEntry = {
  id: string
  date: string
  text: string
}

type InsightLayerProps = {
  consistency: number[]
  tasks: InsightTask[]
  entries: JournalEntry[]
  onOpenTasks?: () => void
}

function MonthlyConsistency({ data }: { data: number[] }) {
  const intensityMap: Record<number, string> = {
    0: 'bg-zinc-800/40',
    1: 'bg-emerald-500/20',
    2: 'bg-emerald-500/40',
    3: 'bg-emerald-500/60',
    4: 'bg-emerald-500/80',
  }

  const activeDays = data.filter((day) => day > 0).length

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">
            Monthly Consistency
          </h4>
        </div>
        <span className="text-[10px] text-tertiary-content">{activeDays}/30 active days</span>
      </div>
      <div className="grid grid-cols-10 gap-[3px]">
        {data.map((value, index) => (
          <div
            key={index}
            className={`aspect-square rounded-[3px] ${intensityMap[value] ?? intensityMap[0]} transition-colors`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[9px] text-tertiary-content">Last 30</span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-tertiary-content">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`w-2 h-2 rounded-[2px] ${intensityMap[level]}`}
            />
          ))}
          <span className="text-[9px] text-tertiary-content">More</span>
        </div>
        <span className="text-[9px] text-tertiary-content">Now</span>
      </div>
    </div>
  )
}

function TasksPreview({
  tasks,
  onOpenTasks,
}: {
  tasks: InsightTask[]
  onOpenTasks?: () => void
}) {
  const priorityDot: Record<string, string> = {
    high: 'bg-rose-400',
    medium: 'bg-amber-400',
    low: 'bg-zinc-600',
    none: 'bg-zinc-700',
  }

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">General Tasks</h4>
        </div>
        <span className="text-[10px] text-tertiary-content">{tasks.length} total</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2.5 py-1.5 group cursor-pointer"
            onClick={onOpenTasks}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityDot[task.priority]}`}
            />
            <span className="text-[12px] text-secondary-content group-hover:text-primary-content transition-colors truncate">
              {task.title}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenTasks}
        className="flex items-center gap-1.5 mt-3 text-[11px] text-tertiary-content hover:text-secondary-content transition-colors"
      >
        <span>Open full list</span>
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}

function JournalHighlights({ entries }: { entries: JournalEntry[] }) {
  const [newEntry, setNewEntry] = useState('')

  return (
    <div className="surface-1 border border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-tertiary-content" />
          <h4 className="text-[13px] font-medium text-secondary-content">Journal</h4>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 p-2 rounded-lg surface-2 border border-subtle">
        <Plus className="w-3 h-3 text-tertiary-content shrink-0" />
        <input
          type="text"
          placeholder="Quick note..."
          value={newEntry}
          onChange={(event) => setNewEntry(event.target.value)}
          className="flex-1 bg-transparent text-[12px] text-primary-content placeholder:text-tertiary-content outline-none"
        />
        {newEntry && (
          <button
            type="button"
            className="shrink-0 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Send className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {entries.map((entry) => (
          <div key={entry.id} className="group cursor-pointer">
            <span className="text-[10px] text-tertiary-content font-medium">{entry.date}</span>
            <p className="text-[11px] text-secondary-content leading-relaxed mt-0.5 line-clamp-2 group-hover:text-primary-content transition-colors">
              {entry.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function InsightLayer({
  consistency,
  tasks,
  entries,
  onOpenTasks,
}: InsightLayerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MonthlyConsistency data={consistency} />
      <TasksPreview tasks={tasks} onOpenTasks={onOpenTasks} />
      <JournalHighlights entries={entries} />
    </div>
  )
}
