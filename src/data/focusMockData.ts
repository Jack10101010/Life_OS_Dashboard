import { FocusItem } from "@/types/focus";

export const initialFocusItems: FocusItem[] = [
  {
    id: "1",
    title: "Finalize Q2 product roadmap",
    context: "Product Strategy",
    type: "subtask",
    priority: "high",
    dueDate: "Today",
    completed: false,
  },
  {
    id: "2",
    title: "Review design system tokens",
    context: "Design Ops",
    type: "task",
    priority: "medium",
    dueDate: "Today",
    completed: false,
  },
  {
    id: "3",
    title: "Write investor update email",
    context: "Fundraising",
    type: "subtask",
    priority: "high",
    dueDate: "Tomorrow",
    completed: false,
  },
  {
    id: "4",
    title: "Ship onboarding flow v2",
    context: "Growth",
    type: "task",
    priority: "medium",
    dueDate: "Today",
    completed: false,
  },
  {
    id: "5",
    title: "Prepare team standup notes",
    context: "Operations",
    type: "task",
    priority: "low",
    dueDate: "Today",
    completed: false,
  },
];

export const highImpactGoal = {
  id: "g1",
  title: "Launch v2.0 by end of Q2",
  context: "Product",
  progress: 58,
  nextAction: "Complete API migration",
};