import type { TaskData as TaskPeekTaskData } from '../components/tasks/TaskPeek'
import type { LifeGoalTask, Task } from '../types'
import { normalizeLifeGoalPhaseValue } from '../features/goals/lib/taskDerivations'

type TaskToTaskPeekOptions = {
  tagColor?: string
  linkedGoal?: string
  linkedDirection?: string
}

type LifeGoalTaskToTaskPeekOptions = {
  title?: string
}

type TaskPeekToTaskOptions = {
  dueDate: string | null
  dueTime: string | null
  isSomeday: boolean
  taskTag: string | null
  tagColor: string | null
  linkedGoalId: string | null
  linkedDirectionId: string | null
  updatedAt: string
}

export function taskToLifeGoalTask(task: Task): LifeGoalTask {
  return {
    id: task.id,
    text: task.text,
    milestoneId: task.milestoneId ?? null,
    phase: normalizeLifeGoalPhaseValue(task.phase),
    notes: task.notes ?? '',
    dueDate: task.dueDate ?? null,
    taskTag: task.taskTag ?? null,
    tagColor: task.tagColor ?? null,
    priority: task.priority ?? 'none',
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((subtask) => ({
          id: subtask.id,
          text: subtask.text,
          completed: subtask.completed,
        }))
      : [],
    completed: task.completed,
    completedAt: task.completedAt ?? null,
  }
}

export function taskToTaskPeekData(task: Task, options: TaskToTaskPeekOptions = {}): TaskPeekTaskData {
  return {
    id: task.id,
    title: task.text,
    completed: task.completed,
    completedAt: task.completedAt ?? undefined,
    dueDate: task.dueDate ?? undefined,
    dueTime: task.dueTime ?? undefined,
    isSomeday: task.isSomeday === true,
    tag: task.taskTag ?? undefined,
    tagColor: options.tagColor ?? task.tagColor ?? undefined,
    priority: task.priority,
    details: task.notes?.trim() ? task.notes.trim() : undefined,
    subtasks: (task.subtasks ?? []).map((subtask) => ({
      id: subtask.id,
      title: subtask.text,
      done: subtask.completed,
    })),
    externalLinks: task.externalLinks ?? [],
    linkedGoalId: task.linkedGoalId ?? undefined,
    linkedDirectionId: task.linkedDirectionId ?? undefined,
    linkedGoal: options.linkedGoal,
    linkedDirection: options.linkedDirection,
    milestoneId: task.milestoneId ?? undefined,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt ?? undefined,
  }
}

export function lifeGoalTaskToTaskPeekData(
  task: LifeGoalTask,
  options: LifeGoalTaskToTaskPeekOptions = {},
): TaskPeekTaskData {
  return {
    id: task.id,
    title: options.title ?? task.text,
    completed: task.completed,
    completedAt: task.completedAt ?? undefined,
    dueDate: task.dueDate ?? undefined,
    tag: task.taskTag ?? undefined,
    tagColor: task.tagColor ?? undefined,
    priority: task.priority,
    details: task.notes?.trim() ? task.notes.trim() : undefined,
    subtasks: (task.subtasks ?? []).map((subtask) => ({
      id: subtask.id,
      title: subtask.text,
      done: subtask.completed,
    })),
    externalLinks: [],
  }
}

export function taskPeekDataToLifeGoalTask(task: LifeGoalTask, updatedTask: TaskPeekTaskData): LifeGoalTask {
  return {
    ...task,
    text: updatedTask.title,
    dueDate: updatedTask.dueDate ?? null,
    taskTag: updatedTask.tag ?? null,
    tagColor: updatedTask.tagColor ?? null,
    priority: updatedTask.priority,
    notes: updatedTask.details ?? '',
    subtasks: (updatedTask.subtasks ?? []).map((subtask) => ({
      id: subtask.id,
      text: subtask.title,
      completed: subtask.done,
    })),
  }
}

export function taskPeekDataToTask(
  task: Task,
  updatedTask: TaskPeekTaskData,
  options: TaskPeekToTaskOptions,
): Task {
  return {
    ...task,
    text: updatedTask.title,
    dueDate: options.dueDate,
    dueTime: options.dueTime,
    isSomeday: options.isSomeday,
    taskTag: options.taskTag,
    tagColor: options.tagColor,
    priority: updatedTask.priority,
    notes: updatedTask.details ?? '',
    subtasks: (updatedTask.subtasks ?? []).map((subtask) => ({
      id: subtask.id,
      text: subtask.title,
      completed: subtask.done,
    })),
    externalLinks: updatedTask.externalLinks ?? [],
    linkedGoalId: options.linkedGoalId,
    linkedDirectionId: options.linkedDirectionId,
    milestoneId: updatedTask.milestoneId ?? null,
    updatedAt: options.updatedAt,
  }
}
