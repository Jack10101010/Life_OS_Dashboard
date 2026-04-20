export type Priority = "high" | "medium" | "low";

export type FocusItemType = "task" | "goal" | "subtask";

export interface FocusItem {
  id: string;
  title: string;
  context: string;
  type: FocusItemType;
  priority: Priority;
  dueDate?: string;
  completed: boolean;
  progress?: number; // 0-100 for goals
}