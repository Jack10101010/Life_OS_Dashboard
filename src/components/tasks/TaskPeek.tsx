import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Calendar,
  Clock,
  Tag,
  AlertTriangle,
  Link2,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  ArrowRight,
  Circle,
  ExternalLink,
  Globe,
} from "lucide-react";
import { GoalDatePicker } from "../../features/goals/GoalDatePicker";
import {
  OverlayRoot,
  PopoverSurface,
  getFloatingPanelPosition,
  type FloatingPanelPosition,
} from "../layout/OverlayPrimitives";
import { IconButton } from "../ui/Button";
import type { LifeGoalTaskPriority } from "../../types";

// ─── Types ───────────────────────────────────────────────────────

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface ExternalLinkItem {
  id: string;
  url: string;
  label?: string;
}

export interface TaskLinkOption {
  id: string;
  label: string;
}

export interface TaskPeekGoalContext {
  title: string;
  goalType: "outcome" | "directional";
}

export interface TaskPeekMilestoneField {
  options: Array<{ id: string; label: string }>;
  value?: string;
  lockedLabel?: string;
  onChange?: (id?: string) => void;
}

export interface TaskPeekLinkedContextMap {
  [id: string]: TaskPeekGoalContext;
}

export interface TaskPeekMilestoneOptionsMap {
  [goalId: string]: Array<{ id: string; label: string }>;
}

type CreatedMilestone = {
  id: string;
  label: string;
};

export interface TaskData {
  id: string;
  title: string;
  completed?: boolean;
  completedAt?: string | null;
  dueDate?: string;
  dueTime?: string;
  isSomeday?: boolean;
  tag?: string;
  tagColor?: string;
  priority: LifeGoalTaskPriority;
  details?: string;
  subtasks: Subtask[];
  externalLinks: ExternalLinkItem[];
  linkedGoalId?: string;
  linkedDirectionId?: string;
  linkedGoal?: string;
  linkedDirection?: string;
  milestoneId?: string;
  createdAt?: string;
  updatedAt?: string;
}

type SubtaskDeleteUndoState = {
  subtask: Subtask;
  index: number;
  message: string;
};

type SubtaskEditState = {
  id: string;
  value: string;
};

interface TaskPeekProps {
  task: TaskData;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (task: TaskData) => void;
  goalOptions: TaskLinkOption[];
  directionOptions: TaskLinkOption[];
  autoSelectTitle?: boolean;
  goalContext?: TaskPeekGoalContext | null;
  milestoneField?: TaskPeekMilestoneField | null;
  linkedContextById?: TaskPeekLinkedContextMap;
  milestoneOptionsByGoalId?: TaskPeekMilestoneOptionsMap;
  onCreateMilestoneForGoal?: (goalId: string, title: string) => CreatedMilestone | null;
  onOpenLinkedGoal?: (goalId: string) => void;
  showDueTime?: boolean;
  showExternalLinks?: boolean;
  showLinkSection?: boolean;
  showTagSection?: boolean;
  showLaterToggle?: boolean;
  rightOffset?: number;
}

// ─── Tag Options ─────────────────────────────────────────────────

const TAG_OPTIONS = [
  { label: "Dev", color: "bg-blue-500/15 text-blue-400" },
  { label: "Docs", color: "bg-emerald-500/15 text-emerald-400" },
  { label: "Bug", color: "bg-red-500/15 text-red-400" },
  { label: "Meeting", color: "bg-amber-500/15 text-amber-400" },
  { label: "Design", color: "bg-violet-500/15 text-violet-400" },
  { label: "Research", color: "bg-cyan-500/15 text-cyan-400" },
  { label: "Urgent", color: "bg-pink-500/15 text-pink-400" },
  { label: "Review", color: "bg-orange-500/15 text-orange-400" },
];

// ─── Auto-expanding Textarea ─────────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  maxHeight = 180,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxHeight?: number;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      const scrollH = ref.current.scrollHeight;
      ref.current.style.height = `${Math.min(scrollH, maxHeight)}px`;
      ref.current.style.overflowY = scrollH > maxHeight ? "auto" : "hidden";
    }
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-500 resize-none outline-none leading-relaxed"
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function TaskPeek({
  task,
  open,
  onClose,
  onComplete,
  onDelete,
  onUpdate,
  goalOptions,
  directionOptions,
  autoSelectTitle = false,
  goalContext = null,
  milestoneField = null,
  linkedContextById = {},
  milestoneOptionsByGoalId = {},
  onCreateMilestoneForGoal,
  onOpenLinkedGoal,
  showDueTime = true,
  showExternalLinks = true,
  showLinkSection: showLinkSectionProp = true,
  showTagSection = true,
  showLaterToggle = false,
  rightOffset = 0,
}: TaskPeekProps) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [dueTime, setDueTime] = useState(task.dueTime || "");
  const [isSomeday, setIsSomeday] = useState(task.isSomeday === true);
  const [tag, setTag] = useState(task.tag || "");
  const [tagColor, setTagColor] = useState(task.tagColor || "");
  const [priority, setPriority] = useState<LifeGoalTaskPriority>(task.priority);
  const [details, setDetails] = useState(task.details || "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks);
  const [newSubtask, setNewSubtask] = useState("");
  const [externalLinks, setExternalLinks] = useState<ExternalLinkItem[]>(task.externalLinks || []);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);
  const [linkedGoalId, setLinkedGoalId] = useState(task.linkedGoalId || "");
  const [linkedDirectionId, setLinkedDirectionId] = useState(task.linkedDirectionId || "");
  const [milestoneId, setMilestoneId] = useState(task.milestoneId || "");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showLinkSection, setShowLinkSection] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<FloatingPanelPosition | null>(null);
  const [goalMenuOpen, setGoalMenuOpen] = useState(false);
  const [goalMenuPosition, setGoalMenuPosition] = useState<FloatingPanelPosition | null>(null);
  const [directionMenuOpen, setDirectionMenuOpen] = useState(false);
  const [directionMenuPosition, setDirectionMenuPosition] = useState<FloatingPanelPosition | null>(null);
  const [milestoneMenuOpen, setMilestoneMenuOpen] = useState(false);
  const [milestoneMenuPosition, setMilestoneMenuPosition] = useState<FloatingPanelPosition | null>(null);
  const [subtaskDeleteUndo, setSubtaskDeleteUndo] = useState<SubtaskDeleteUndoState | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<SubtaskEditState | null>(null);
  const [creatingMilestoneInline, setCreatingMilestoneInline] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");

  const peekRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dueDateFieldRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const goalFieldRef = useRef<HTMLButtonElement>(null);
  const goalMenuRef = useRef<HTMLDivElement>(null);
  const directionFieldRef = useRef<HTMLButtonElement>(null);
  const directionMenuRef = useRef<HTMLDivElement>(null);
  const milestoneFieldRef = useRef<HTMLButtonElement>(null);
  const milestoneMenuRef = useRef<HTMLDivElement>(null);
  const subtaskDeleteUndoTimeoutRef = useRef<number | null>(null);
  const editingSubtaskInputRef = useRef<HTMLInputElement>(null);
  const shouldCancelSubtaskEditRef = useRef(false);
  const shouldCancelMilestoneCreateRef = useRef(false);
  const milestoneCreateInputRef = useRef<HTMLInputElement>(null);

  // Sync state when task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDueDate(task.dueDate || "");
    setDueTime(task.dueTime || "");
    setIsSomeday(task.isSomeday === true);
    setTag(task.tag || "");
    setTagColor(task.tagColor || "");
    setPriority(task.priority);
    setDetails(task.details || "");
    setSubtasks(task.subtasks);
    setExternalLinks(task.externalLinks || []);
    setNewLinkUrl("");
    setNewLinkLabel("");
    setShowAddLink(false);
    setLinkedGoalId(task.linkedGoalId || "");
    setLinkedDirectionId(task.linkedDirectionId || "");
    setMilestoneId(task.milestoneId || "");
    setShowLinkSection(false);
    setNewSubtask("");
    setShowTagPicker(false);
    setDatePickerOpen(false);
    setDatePickerPosition(null);
    setGoalMenuOpen(false);
    setGoalMenuPosition(null);
    setDirectionMenuOpen(false);
    setDirectionMenuPosition(null);
    setMilestoneMenuOpen(false);
    setMilestoneMenuPosition(null);
    setSubtaskDeleteUndo(null);
    setEditingSubtask(null);
    setCreatingMilestoneInline(false);
    setNewMilestoneTitle("");
  }, [task]);

  useEffect(() => {
    return () => {
      if (subtaskDeleteUndoTimeoutRef.current) {
        window.clearTimeout(subtaskDeleteUndoTimeoutRef.current);
        subtaskDeleteUndoTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editingSubtaskInputRef.current) return;
    editingSubtaskInputRef.current.focus();
    editingSubtaskInputRef.current.select();
  }, [editingSubtask?.id]);

  useEffect(() => {
    if (!creatingMilestoneInline || !milestoneCreateInputRef.current) return;
    milestoneCreateInputRef.current.focus();
    milestoneCreateInputRef.current.select();
  }, [creatingMilestoneInline]);

  const goalLabelById = useMemo(
    () => new Map(goalOptions.map((option) => [option.id, option.label])),
    [goalOptions]
  );
  const directionLabelById = useMemo(
    () => new Map(directionOptions.map((option) => [option.id, option.label])),
    [directionOptions]
  );
  const goalSelectedOptionLabel = useMemo(
    () => goalOptions.find((option) => option.id === linkedGoalId)?.label ?? "No goal linked",
    [goalOptions, linkedGoalId]
  );
  const directionSelectedOptionLabel = useMemo(
    () => directionOptions.find((option) => option.id === linkedDirectionId)?.label ?? "No direction linked",
    [directionOptions, linkedDirectionId]
  );
  const tagOptions = useMemo(() => {
    const currentTaskTag = task.tag?.trim();
    if (!currentTaskTag) return TAG_OPTIONS;

    const alreadyPresent = TAG_OPTIONS.some(
      (option) => option.label.trim().toLowerCase() === currentTaskTag.toLowerCase()
    );
    if (alreadyPresent) return TAG_OPTIONS;

    return [
      {
        label: currentTaskTag,
        color: task.tagColor?.trim() || "bg-zinc-500/15 text-zinc-400",
      },
      ...TAG_OPTIONS,
    ];
  }, [task.tag, task.tagColor]);

  const activeLinkedContext = useMemo(() => {
    if (linkedGoalId) return linkedContextById[linkedGoalId] ?? goalContext ?? null;
    if (linkedDirectionId) return linkedContextById[linkedDirectionId] ?? goalContext ?? null;
    return goalContext ?? null;
  }, [goalContext, linkedContextById, linkedDirectionId, linkedGoalId]);

  const contextualMilestoneOptions = useMemo(() => {
    if (!linkedGoalId) return [];
    return milestoneOptionsByGoalId[linkedGoalId] ?? [];
  }, [linkedGoalId, milestoneOptionsByGoalId]);

  const showContextualMilestoneField = Boolean(
    !milestoneField && linkedGoalId && activeLinkedContext?.goalType === "outcome"
  );
  const milestoneSelectOptions = useMemo(() => {
    if (milestoneField) {
      return milestoneField.options.map((option) => ({
        id: option.id || "",
        label: option.label,
      }));
    }

    if (showContextualMilestoneField) {
      return [{ id: "", label: "No milestone" }, ...contextualMilestoneOptions];
    }

    return [];
  }, [contextualMilestoneOptions, milestoneField, showContextualMilestoneField]);
  const milestoneSelectValue = milestoneField ? milestoneField.value || "" : milestoneId;
  const milestoneSelectedOptionLabel = useMemo(
    () => milestoneSelectOptions.find((option) => option.id === milestoneSelectValue)?.label ?? "No milestone",
    [milestoneSelectOptions, milestoneSelectValue]
  );
  const isCompletedTask = Boolean(task.completed || task.completedAt);
  const handleGoalSelect = useCallback((goalId: string) => {
    setLinkedGoalId(goalId);
    setGoalMenuOpen(false);
  }, []);
  const handleDirectionSelect = useCallback((directionId: string) => {
    setLinkedDirectionId(directionId);
    setDirectionMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!showContextualMilestoneField) {
      setMilestoneId("");
      return;
    }

    const milestoneIds = new Set(contextualMilestoneOptions.map((option) => option.id));
    if (milestoneId && !milestoneIds.has(milestoneId)) {
      setMilestoneId("");
    }
  }, [contextualMilestoneOptions, milestoneId, showContextualMilestoneField]);

  useEffect(() => {
    if (!goalMenuOpen || !goalFieldRef.current) return;

    const updatePosition = () => {
      if (!goalFieldRef.current) return;
      const fieldWidth = goalFieldRef.current.getBoundingClientRect().width;
      setGoalMenuPosition(
        getFloatingPanelPosition(goalFieldRef.current, {
          preferredWidth: fieldWidth,
          minWidth: fieldWidth,
          estimatedHeight: Math.min(320, Math.max(120, (goalOptions.length + 1) * 38 + 16)),
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [goalMenuOpen, goalOptions.length]);

  useEffect(() => {
    if (!directionMenuOpen || !directionFieldRef.current) return;

    const updatePosition = () => {
      if (!directionFieldRef.current) return;
      const fieldWidth = directionFieldRef.current.getBoundingClientRect().width;
      setDirectionMenuPosition(
        getFloatingPanelPosition(directionFieldRef.current, {
          preferredWidth: fieldWidth,
          minWidth: fieldWidth,
          estimatedHeight: Math.min(320, Math.max(120, (directionOptions.length + 1) * 38 + 16)),
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [directionMenuOpen, directionOptions.length]);

  useEffect(() => {
    if (!milestoneMenuOpen || !milestoneFieldRef.current) return;

    const updatePosition = () => {
      if (!milestoneFieldRef.current) return;
      const fieldWidth = milestoneFieldRef.current.getBoundingClientRect().width;
      setMilestoneMenuPosition(
        getFloatingPanelPosition(milestoneFieldRef.current, {
          preferredWidth: fieldWidth,
          minWidth: fieldWidth,
          estimatedHeight: Math.min(320, Math.max(160, milestoneSelectOptions.length * 38 + 16)),
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [milestoneMenuOpen, milestoneSelectOptions.length]);

  useEffect(() => {
    if (!goalMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (goalFieldRef.current?.contains(target) || goalMenuRef.current?.contains(target)) return;
      setGoalMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setGoalMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [goalMenuOpen]);

  useEffect(() => {
    if (!directionMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (directionFieldRef.current?.contains(target) || directionMenuRef.current?.contains(target)) return;
      setDirectionMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDirectionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [directionMenuOpen]);

  useEffect(() => {
    if (!milestoneMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (milestoneFieldRef.current?.contains(target) || milestoneMenuRef.current?.contains(target)) return;
      setMilestoneMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMilestoneMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [milestoneMenuOpen]);

  const headerTagTextColor = useMemo(() => {
    if (!tagColor) return "text-zinc-400";
    return tagColor
      .split(" ")
      .find((token) => token.startsWith("text-")) || "text-zinc-400";
  }, [tagColor]);
  const isOutcomeGoalTask = activeLinkedContext?.goalType === "outcome";
  const showGoalStructureSection =
    Boolean(activeLinkedContext) ||
    showLinkSectionProp ||
    Boolean(milestoneField) ||
    showContextualMilestoneField;
  const linkedSummary = useMemo(() => {
    if (linkedGoalId) return `Linked to: ${goalLabelById.get(linkedGoalId) || "Goal"}`
    if (linkedDirectionId) return `Linked to: ${directionLabelById.get(linkedDirectionId) || "Direction"}`
    return "Linked to: none"
  }, [directionLabelById, goalLabelById, linkedDirectionId, linkedGoalId]);
  const linkedGoalTargetId = linkedGoalId || linkedDirectionId || "";

  // Focus title on open
  useEffect(() => {
    if (open && titleRef.current) {
      setTimeout(() => {
        titleRef.current?.focus();
        if (autoSelectTitle) {
          titleRef.current?.select();
        }
      }, 150);
    }
  }, [autoSelectTitle, open]);

  useEffect(() => {
    if (!datePickerOpen || !dueDateFieldRef.current) return;

    const updatePosition = () => {
      if (!dueDateFieldRef.current) return;
      setDatePickerPosition(
        getFloatingPanelPosition(dueDateFieldRef.current, {
          minWidth: dueDateFieldRef.current.getBoundingClientRect().width,
          preferredWidth: dueDateFieldRef.current.getBoundingClientRect().width,
          estimatedHeight: 360,
        })
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (dueDateFieldRef.current?.contains(target)) return;
      if (datePickerRef.current?.contains(target)) return;
      setDatePickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [datePickerOpen]);

  // Build updated task
  const buildUpdated = useCallback(
    (): TaskData => ({
      ...task,
      title,
      dueDate: dueDate || undefined,
      ...(showDueTime ? { dueTime: dueTime || undefined } : {}),
      ...(showLaterToggle ? { isSomeday } : {}),
      ...(showTagSection
        ? {
            tag: tag || undefined,
            tagColor: tagColor || undefined,
          }
        : {}),
      priority,
      details: details || undefined,
      subtasks,
      ...(showExternalLinks ? { externalLinks } : {}),
      ...(showLinkSectionProp
        ? {
            linkedGoalId: linkedGoalId || undefined,
            linkedDirectionId: linkedDirectionId || undefined,
            linkedGoal: linkedGoalId ? goalLabelById.get(linkedGoalId) || undefined : undefined,
            linkedDirection: linkedDirectionId ? directionLabelById.get(linkedDirectionId) || undefined : undefined,
          }
        : {}),
      milestoneId: (milestoneField ? task.milestoneId : showContextualMilestoneField ? milestoneId || undefined : undefined),
      updatedAt: new Date().toISOString(),
    }),
    [
      task,
      title,
      dueDate,
      dueTime,
      isSomeday,
      tag,
      tagColor,
      priority,
      details,
      subtasks,
      externalLinks,
      linkedGoalId,
      linkedDirectionId,
      goalLabelById,
      directionLabelById,
      milestoneField,
      milestoneId,
      showContextualMilestoneField,
      showDueTime,
      showLaterToggle,
      showTagSection,
      showExternalLinks,
      showLinkSectionProp,
    ]
  );

  // Auto-save on close
  const handleClose = () => {
    onUpdate(buildUpdated());
    onClose();
  };

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleClose, open]);

  // Subtask helpers
  const toggleSubtask = (id: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
    );
  };

  const startEditingSubtask = (subtask: Subtask) => {
    shouldCancelSubtaskEditRef.current = false;
    setEditingSubtask({ id: subtask.id, value: subtask.title });
  };

  const saveEditingSubtask = () => {
    if (!editingSubtask) return;
    const nextTitle = editingSubtask.value.trim();
    if (nextTitle) {
      setSubtasks((prev) =>
        prev.map((subtask) =>
          subtask.id === editingSubtask.id ? { ...subtask, title: nextTitle } : subtask
        )
      );
    }
    setEditingSubtask(null);
    shouldCancelSubtaskEditRef.current = false;
  };

  const cancelEditingSubtask = () => {
    shouldCancelSubtaskEditRef.current = false;
    setEditingSubtask(null);
  };

  const handleCreateMilestoneInline = () => {
    const nextTitle = newMilestoneTitle.trim();
    if (!linkedGoalId || !onCreateMilestoneForGoal || !nextTitle) {
      setCreatingMilestoneInline(false);
      setNewMilestoneTitle("");
      shouldCancelMilestoneCreateRef.current = false;
      return;
    }
    const createdMilestone = onCreateMilestoneForGoal(linkedGoalId, nextTitle);
    if (!createdMilestone) return;
    setMilestoneId(createdMilestone.id);
    setCreatingMilestoneInline(false);
    setNewMilestoneTitle("");
    shouldCancelMilestoneCreateRef.current = false;
  };

  const cancelCreatingMilestoneInline = () => {
    shouldCancelMilestoneCreateRef.current = false;
    setCreatingMilestoneInline(false);
    setNewMilestoneTitle("");
  };

  const handleMilestoneSelect = (value: string) => {
    setMilestoneMenuOpen(false);
    setMilestoneId(value);
    milestoneField?.onChange?.(value || undefined);
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `st-${Date.now()}`, title: newSubtask.trim(), done: false },
    ]);
    setNewSubtask("");
  };

  const removeSubtask = (id: string) => {
    setSubtasks((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const removedSubtask = prev[index];

      if (subtaskDeleteUndoTimeoutRef.current) {
        window.clearTimeout(subtaskDeleteUndoTimeoutRef.current);
      }

      setSubtaskDeleteUndo({
        subtask: removedSubtask,
        index,
        message: "Subtask deleted",
      });
      subtaskDeleteUndoTimeoutRef.current = window.setTimeout(() => {
        setSubtaskDeleteUndo(null);
        subtaskDeleteUndoTimeoutRef.current = null;
      }, 4500);

      return prev.filter((s) => s.id !== id);
    });
  };

  const undoDeletedSubtask = () => {
    if (!subtaskDeleteUndo) return;
    if (subtaskDeleteUndoTimeoutRef.current) {
      window.clearTimeout(subtaskDeleteUndoTimeoutRef.current);
      subtaskDeleteUndoTimeoutRef.current = null;
    }
    setSubtasks((prev) => {
      const next = prev.slice();
      next.splice(subtaskDeleteUndo.index, 0, subtaskDeleteUndo.subtask);
      return next;
    });
    setSubtaskDeleteUndo(null);
  };

  // Quick date actions
  const moveToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDueDate(tomorrow.toISOString().slice(0, 10));
  };

  const moveToNextWeek = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDueDate(nextWeek.toISOString().slice(0, 10));
  };

  const moveToThreeDays = () => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 3);
    setDueDate(nextDate.toISOString().slice(0, 10));
  };

  // Select tag
  const selectTag = (t: { label: string; color: string }) => {
    setTag(t.label);
    setTagColor(t.color);
    setShowTagPicker(false);
  };

  const dueDateLabel = useMemo(() => {
    if (!dueDate) return "Due date";
    const parsed = new Date(`${dueDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dueDate;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, [dueDate]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Side Peek Panel */}
      <div
        ref={peekRef}
        className="fixed bottom-0 right-0 top-0 z-50 h-[100dvh] max-h-[100dvh] w-full max-w-[528px] bg-[rgb(var(--theme-surface-rgb))] border-l border-zinc-700/80 shadow-2xl shadow-black/60 flex flex-col animate-in slide-in-from-right duration-250"
        style={{ right: `${rightOffset}px` }}
      >
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between gap-4 px-6 py-[18px] border-b border-zinc-700/70">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full ${tag ? "bg-current" : "bg-zinc-500"} ${headerTagTextColor}`} />
            <span className={`text-[11px] font-medium uppercase tracking-wider ${tag ? headerTagTextColor : "text-zinc-400"}`}>
              {isOutcomeGoalTask ? "Goal Task" : "General Task"}
            </span>
            {activeLinkedContext && (
              <>
                <span className="text-zinc-800">·</span>
                {onOpenLinkedGoal && linkedGoalTargetId ? (
                  <button
                    type="button"
                    onClick={() => onOpenLinkedGoal(linkedGoalTargetId)}
                    className="group inline-flex min-w-0 items-center gap-1.5 text-left outline-none"
                    aria-label={`Open ${activeLinkedContext.title}`}
                  >
                    <span className="min-w-0 truncate text-[12px] text-zinc-200/88 underline decoration-transparent underline-offset-[3px] transition group-hover:text-white group-hover:decoration-zinc-500/70 group-focus-visible:text-white group-focus-visible:decoration-zinc-500/70">
                      {activeLinkedContext.title}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500/80 transition group-hover:text-zinc-300 group-focus-visible:text-zinc-300" />
                  </button>
                ) : (
                  <span className="min-w-0 truncate text-[12px] text-zinc-200">
                    {activeLinkedContext.title}
                  </span>
                )}
                <span className="shrink-0 rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                  {activeLinkedContext.goalType}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {task.updatedAt && (
              <span className="text-[10px] text-zinc-500">
                Edited{" "}
                {new Date(task.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <IconButton
              type="button"
              onClick={handleClose}
              ariaLabel="Close task peek"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
              icon={<X className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* ═══ SCROLLABLE BODY ═══ */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-[30px] py-6 space-y-7">
          {/* ── Title ── */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title..."
            className="w-full bg-transparent text-lg font-semibold text-zinc-100 placeholder:text-zinc-500 outline-none"
          />

          {showGoalStructureSection && (
            <div className="space-y-4">
              {showLinkSectionProp && (
                <div className="space-y-1.5">
                  <button
                    onClick={() => setShowLinkSection(!showLinkSection)}
                    className={`flex items-center gap-2 group text-left ${
                      linkedGoalId || linkedDirectionId ? "text-emerald-300/85" : ""
                    }`}
                  >
                    <Link2
                      className={`w-3.5 h-3.5 transition-colors ${
                        linkedGoalId || linkedDirectionId
                          ? "text-emerald-400/80 group-hover:text-emerald-300"
                          : "text-zinc-500 group-hover:text-zinc-300"
                      }`}
                    />
                    <span
                      className={`min-w-0 truncate text-[11px] transition-colors ${
                        linkedGoalId || linkedDirectionId
                          ? "text-emerald-300/85 group-hover:text-emerald-200"
                          : "text-zinc-400 group-hover:text-zinc-300"
                      }`}
                    >
                      {(linkedGoalId || linkedDirectionId)
                        ? (linkedGoalId
                            ? goalLabelById.get(linkedGoalId) || "Goal"
                            : directionLabelById.get(linkedDirectionId) || "Direction")
                        : "Linked to: none"}
                    </span>
                    <ChevronRight
                      className={`w-3 h-3 text-zinc-500 transition-transform ${showLinkSection ? "rotate-90" : ""}`}
                    />
                  </button>

                  {showLinkSection && (
                    <div className="min-w-0 space-y-2 pl-5.5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Goal</span>
                        <button
                          ref={goalFieldRef}
                          type="button"
                          onClick={() => {
                            setDirectionMenuOpen(false);
                            setGoalMenuOpen((current) => !current);
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg surface-2 border px-3 py-2 text-left text-[12px] outline-none transition-colors ${
                            linkedGoalId
                              ? "border-emerald-500/20 bg-emerald-500/[0.04] text-zinc-100 hover:border-emerald-500/30"
                              : "border-zinc-700/70 text-zinc-300 hover:border-zinc-600/70"
                          }`}
                          aria-haspopup="listbox"
                          aria-expanded={goalMenuOpen}
                        >
                          <span className="min-w-0 truncate">{goalSelectedOptionLabel}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-zinc-500" />
                        </button>
                        <OverlayRoot open={goalMenuOpen && Boolean(goalMenuPosition)}>
                          {goalMenuPosition ? (
                            <PopoverSurface
                              position={goalMenuPosition}
                              zIndexClassName="z-[85]"
                              className="theme-popover overflow-hidden rounded-[18px] border shadow-[0_22px_46px_rgba(15,23,42,0.24)]"
                            >
                              <div
                                ref={goalMenuRef}
                                role="listbox"
                                aria-label="Goal link options"
                                className="max-h-[320px] overflow-y-auto p-1.5"
                                style={{ backgroundColor: "rgb(var(--theme-surface-rgb))" }}
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={!linkedGoalId}
                                  onClick={() => handleGoalSelect("")}
                                  className={`flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[12px] transition ${
                                    !linkedGoalId
                                      ? "bg-white/[0.08] text-white"
                                      : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                  }`}
                                >
                                  <span className="min-w-0 truncate">No goal linked</span>
                                </button>
                                {goalOptions.map((goal) => {
                                  const isSelected = goal.id === linkedGoalId;
                                  return (
                                    <button
                                      key={goal.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => handleGoalSelect(goal.id)}
                                      className={`flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[12px] transition ${
                                        isSelected
                                          ? "bg-white/[0.08] text-white"
                                          : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                      }`}
                                    >
                                      <span className="min-w-0 truncate">{goal.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverSurface>
                          ) : null}
                        </OverlayRoot>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Direction</span>
                        <button
                          ref={directionFieldRef}
                          type="button"
                          onClick={() => {
                            setGoalMenuOpen(false);
                            setDirectionMenuOpen((current) => !current);
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg surface-2 border px-3 py-2 text-left text-[12px] outline-none transition-colors ${
                            linkedDirectionId
                              ? "border-emerald-500/20 bg-emerald-500/[0.04] text-zinc-100 hover:border-emerald-500/30"
                              : "border-zinc-700/70 text-zinc-300 hover:border-zinc-600/70"
                          }`}
                          aria-haspopup="listbox"
                          aria-expanded={directionMenuOpen}
                        >
                          <span className="min-w-0 truncate">{directionSelectedOptionLabel}</span>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-zinc-500" />
                        </button>
                        <OverlayRoot open={directionMenuOpen && Boolean(directionMenuPosition)}>
                          {directionMenuPosition ? (
                            <PopoverSurface
                              position={directionMenuPosition}
                              zIndexClassName="z-[85]"
                              className="theme-popover overflow-hidden rounded-[18px] border shadow-[0_22px_46px_rgba(15,23,42,0.24)]"
                            >
                              <div
                                ref={directionMenuRef}
                                role="listbox"
                                aria-label="Direction link options"
                                className="max-h-[320px] overflow-y-auto p-1.5"
                                style={{ backgroundColor: "rgb(var(--theme-surface-rgb))" }}
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={!linkedDirectionId}
                                  onClick={() => handleDirectionSelect("")}
                                  className={`flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[12px] transition ${
                                    !linkedDirectionId
                                      ? "bg-white/[0.08] text-white"
                                      : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                  }`}
                                >
                                  <span className="min-w-0 truncate">No direction linked</span>
                                </button>
                                {directionOptions.map((direction) => {
                                  const isSelected = direction.id === linkedDirectionId;
                                  return (
                                    <button
                                      key={direction.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      onClick={() => handleDirectionSelect(direction.id)}
                                      className={`flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[12px] transition ${
                                        isSelected
                                          ? "bg-white/[0.08] text-white"
                                          : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                      }`}
                                    >
                                      <span className="min-w-0 truncate">{direction.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverSurface>
                          ) : null}
                        </OverlayRoot>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(milestoneField || showContextualMilestoneField) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-zinc-400">
                      Milestone
                    </span>
                    {linkedGoalId && onCreateMilestoneForGoal && !milestoneField?.lockedLabel && !creatingMilestoneInline ? (
                      <button
                        type="button"
                        onClick={() => {
                          shouldCancelMilestoneCreateRef.current = false;
                          setCreatingMilestoneInline(true);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] text-zinc-400 transition hover:text-zinc-200"
                      >
                        <Plus className="h-3 w-3" />
                        Milestone
                      </button>
                    ) : null}
                  </div>
                  {milestoneField?.lockedLabel ? (
                    <div className="surface-2 border border-zinc-700/70 rounded-lg px-3 py-2">
                      <p className="text-[12px] text-zinc-200">{milestoneField.lockedLabel}</p>
                    </div>
                  ) : milestoneSelectOptions.length > 0 ? (
                    <>
                      <button
                        ref={milestoneFieldRef}
                        type="button"
                        onClick={() => setMilestoneMenuOpen((current) => !current)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg surface-2 border border-zinc-700/70 px-3 py-2 text-left text-[12px] text-zinc-200 outline-none transition-colors hover:border-zinc-600/70"
                        aria-haspopup="listbox"
                        aria-expanded={milestoneMenuOpen}
                      >
                        <span className="min-w-0 truncate">{milestoneSelectedOptionLabel}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90 text-zinc-500" />
                      </button>
                      <OverlayRoot open={milestoneMenuOpen && Boolean(milestoneMenuPosition)}>
                        {milestoneMenuPosition ? (
                          <PopoverSurface
                            position={milestoneMenuPosition}
                            zIndexClassName="z-[85]"
                            className="theme-popover overflow-hidden rounded-[18px] border shadow-[0_22px_46px_rgba(15,23,42,0.24)]"
                          >
                            <div
                              ref={milestoneMenuRef}
                              role="listbox"
                              aria-label="Milestone options"
                              className="max-h-[320px] overflow-y-auto p-1.5"
                              style={{ backgroundColor: "rgb(var(--theme-surface-rgb))" }}
                            >
                              {milestoneSelectOptions.map((option) => {
                                const isSelected = option.id === milestoneSelectValue;
                                return (
                                  <button
                                    key={option.id || "none"}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleMilestoneSelect(option.id)}
                                    className={`flex w-full items-center rounded-[14px] px-3 py-2.5 text-left text-[12px] transition ${
                                      isSelected
                                        ? "bg-white/[0.08] text-white"
                                        : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
                                    }`}
                                  >
                                    <span className="min-w-0 truncate">{option.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverSurface>
                        ) : null}
                      </OverlayRoot>
                    </>
                  ) : (
                    <div className="surface-2 border border-zinc-700/70 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-zinc-500">No milestones yet</p>
                    </div>
                  )}
                  {linkedGoalId && onCreateMilestoneForGoal && !milestoneField?.lockedLabel && creatingMilestoneInline ? (
                    <div className="surface-2 border border-zinc-700/70 rounded-lg px-3 py-2">
                      <input
                        ref={milestoneCreateInputRef}
                        value={newMilestoneTitle}
                        onChange={(event) => setNewMilestoneTitle(event.target.value)}
                        onBlur={() => {
                          if (shouldCancelMilestoneCreateRef.current) {
                            shouldCancelMilestoneCreateRef.current = false;
                            return;
                          }
                          handleCreateMilestoneInline();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCreateMilestoneInline();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            shouldCancelMilestoneCreateRef.current = true;
                            cancelCreatingMilestoneInline();
                          }
                        }}
                        placeholder="Milestone name"
                        className="w-full bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-500 outline-none"
                      />
                    </div>
                  ) : null}
                </div>
              )}
              <div className="h-px bg-zinc-800/40" />
            </div>
          )}

          {/* ── Scheduling ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Schedule
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Date */}
              <div ref={dueDateFieldRef} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 rounded-lg surface-2 border border-zinc-700/70 hover:border-zinc-600/70 transition-colors">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setDatePickerOpen((current) => !current)}
                  className={`w-full min-w-0 bg-transparent text-left text-[12px] outline-none transition-colors ${
                    dueDate ? "text-zinc-200" : "text-zinc-500"
                  }`}
                >
                  {dueDateLabel}
                </button>
                </div>
              </div>

              {/* Time */}
              {showDueTime && (
                <div className="w-[110px] flex items-center gap-2 px-3 py-2 rounded-lg surface-2 border border-zinc-700/70 hover:border-zinc-600/70 transition-colors">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  <input
                    type="text"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    placeholder="Time"
                    className="flex-1 bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-500 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Quick date actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={moveToTomorrow}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
              >
                <ArrowRight className="w-2.5 h-2.5" />
                Tomorrow
              </button>
              <button
                onClick={moveToThreeDays}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
              >
                <ArrowRight className="w-2.5 h-2.5" />
                +3 days
              </button>
              <button
                onClick={moveToNextWeek}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
              >
                <ArrowRight className="w-2.5 h-2.5" />
                +7 days
              </button>
              {showLaterToggle && (
                <button
                  type="button"
                  onClick={() => setIsSomeday((current) => !current)}
                  title="Keeps this out of the active task flow until you’re ready to revisit it."
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                    isSomeday
                      ? "bg-[rgb(var(--theme-info-rgb)/0.15)] text-[rgb(var(--theme-info-rgb)/0.95)]"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
                  }`}
                >
                  <ArrowRight className="w-2.5 h-2.5" />
                  Later
                </button>
              )}
              {dueDate && (
                <button
                  onClick={() => {
                    setDueDate("");
                    setDueTime("");
                    setDatePickerOpen(false);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-zinc-600 hover:text-red-400/70 transition-colors ml-auto"
                >
                  <X className="w-2.5 h-2.5" />
                  Clear
                </button>
              )}
            </div>
            <GoalDatePicker
              ref={datePickerRef}
              value={dueDate || null}
              onChange={(value) => {
                setDueDate(value);
                setDatePickerOpen(false);
              }}
              onClose={() => setDatePickerOpen(false)}
              anchorPosition={datePickerOpen && datePickerPosition ? { ...datePickerPosition, top: datePickerPosition.top + 4 } : null}
              label="Due date"
              navigationStyle="bordered"
            />
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-zinc-800/40" />

          {/* ── Classification: Tag + Priority ── */}
          <div className="space-y-4">
            {/* Tag */}
            {showTagSection && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                      Tag
                    </span>
                  </div>
                  <span className="flex min-w-[224px] items-center justify-end gap-1.5 group">
                    {tag ? (
                      <span
                        className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tagColor}`}
                      >
                        <Tag className="w-2 h-2" />
                        {tag}
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        Add tag
                      </span>
                    )}
                    <ChevronRight
                      className={`w-3 h-3 text-zinc-600 transition-transform ${showTagPicker ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>

                {showTagPicker && (
                  <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {tagOptions.map((t) => (
                      <button
                        key={t.label}
                        onClick={() => selectTag(t)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-all ${
                          tag === t.label
                            ? `${t.color} ring-1 ring-white/10`
                            : `${t.color} opacity-60 hover:opacity-100`
                        }`}
                      >
                        <Tag className="w-2 h-2" />
                        {t.label}
                      </button>
                    ))}
                    {tag && (
                      <button
                        onClick={() => {
                          setTag("");
                          setTagColor("");
                          setShowTagPicker(false);
                        }}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-1 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Priority */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Priority
                </span>
              </div>
              <div className="flex min-w-[224px] flex-wrap items-center justify-end gap-1">
                <button
                  onClick={() => setPriority("none")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    priority === "none"
                      ? "surface-3 text-zinc-300 border border-zinc-700/60"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  None
                </button>
                <button
                  onClick={() => setPriority("low")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    priority === "low"
                      ? "bg-[rgb(var(--theme-info-rgb)/0.15)] text-[rgb(var(--theme-info-rgb)/0.95)] border border-[rgb(var(--theme-info-rgb)/0.2)]"
                      : "text-zinc-700 hover:text-[rgb(var(--theme-info-rgb)/0.8)]"
                  }`}
                >
                  Low
                </button>
                <button
                  onClick={() => setPriority("medium")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    priority === "medium"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      : "text-zinc-700 hover:text-amber-400/70"
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setPriority("high")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    priority === "high"
                      ? "bg-red-500/15 text-red-400 border border-red-500/20"
                      : "text-zinc-700 hover:text-red-400/60"
                  }`}
                >
                  High
                </button>
              </div>
            </div>

          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-zinc-800/40" />

          {/* ── Details / Notes ── */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Notes
            </span>
            <div className="surface-2 border border-zinc-700/70 rounded-lg px-3 py-2.5 hover:border-zinc-600/70 transition-colors">
              <AutoTextarea
                value={details}
                onChange={setDetails}
                placeholder="Add notes, context, or details..."
                maxHeight={440}
                rows={7}
              />
            </div>
          </div>

          {/* ── Subtasks ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Subtasks
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500">Press Enter to add</span>
                {subtasks.length > 0 && (
                  <span className="text-[10px] text-zinc-500">
                    {subtasks.filter((s) => s.done).length}/{subtasks.length}
                  </span>
                )}
              </div>
            </div>

            {/* Subtask list */}
            <div className="space-y-0.5">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="group flex items-center gap-2.5 px-1 py-1.5 rounded-md hover:bg-zinc-800/30 transition-colors"
                >
                  <button
                    onClick={() => toggleSubtask(st.id)}
                    className={`group/checkbox flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border text-[9px] transition-colors ${
                      st.done
                        ? "border-[rgb(var(--theme-accent-rgb)/0.32)] bg-[rgb(var(--theme-accent-rgb)/0.12)] text-white"
                        : "border-white/[0.2] text-white/46 hover:border-emerald-400/70 hover:bg-[rgb(var(--theme-accent-rgb)/0.08)] hover:text-emerald-400"
                    }`}
                  >
                    {st.done ? "✓" : <span className="opacity-0 transition-opacity group-hover/checkbox:opacity-40">✓</span>}
                  </button>
                  {editingSubtask?.id === st.id ? (
                    <input
                      ref={editingSubtaskInputRef}
                      value={editingSubtask.value}
                      onChange={(e) =>
                        setEditingSubtask((current) =>
                          current && current.id === st.id
                            ? { ...current, value: e.target.value }
                            : current
                        )
                      }
                      onBlur={() => {
                        if (shouldCancelSubtaskEditRef.current) {
                          cancelEditingSubtask();
                          return;
                        }
                        saveEditingSubtask();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          saveEditingSubtask();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          shouldCancelSubtaskEditRef.current = true;
                          cancelEditingSubtask();
                        }
                      }}
                      className={`min-w-0 flex-1 bg-transparent text-[12px] outline-none ${
                        st.done ? "text-zinc-500 line-through" : "text-zinc-300"
                      }`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEditingSubtask(st)}
                      className={`min-w-0 flex-1 text-left text-[12px] ${
                        st.done ? "text-zinc-500 line-through" : "text-zinc-300"
                      }`}
                    >
                      {st.title}
                    </button>
                  )}
                  <IconButton
                    type="button"
                    onClick={() => removeSubtask(st.id)}
                    ariaLabel={`Delete subtask ${st.title}`}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400/70 transition-all"
                    icon={<X className="w-3 h-3" />}
                  />
                </div>
              ))}
            </div>

            {/* Add subtask */}
            <div className="flex items-center gap-2 px-1">
              <Circle className="w-3.5 h-3.5 text-zinc-800 flex-shrink-0" />
              <input
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onBlur={(e) => {
                  if ((e.relatedTarget as HTMLElement | null)?.dataset.subtaskAddButton === "true") return;
                  addSubtask();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSubtask();
                }}
                placeholder="Add a subtask..."
                className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
              {newSubtask.trim() && (
                <IconButton
                  type="button"
                  data-subtask-add-button="true"
                  onClick={addSubtask}
                  ariaLabel="Add subtask"
                  className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  icon={<Plus className="w-3.5 h-3.5" />}
                />
              )}
            </div>
          </div>

          {/* ── External Links ── */}
          {showExternalLinks && (
            <div className="pt-10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Links
                  </span>
                </div>
                {!showAddLink && (
                  <button
                    onClick={() => setShowAddLink(true)}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>

              {/* Link list */}
              {externalLinks.length > 0 && (
                <div className="space-y-1">
                  {externalLinks.map((link) => (
                    <div
                      key={link.id}
                      className="group flex min-w-0 items-center gap-2 px-2.5 py-1.5 rounded-lg surface-2 border border-zinc-700/70 hover:border-zinc-600/70 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 text-[11px] text-blue-400/80 hover:text-blue-400 truncate transition-colors"
                        title={link.url}
                      >
                        {link.label || link.url}
                      </a>
                      <IconButton
                        type="button"
                        onClick={() =>
                          setExternalLinks((prev) =>
                            prev.filter((l) => l.id !== link.id)
                          )
                        }
                        ariaLabel={`Remove link ${link.label || link.url}`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-600 hover:text-red-400/70 transition-all flex-shrink-0"
                        icon={<X className="w-3 h-3" />}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Add link form */}
              {showAddLink && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg surface-2 border border-zinc-700/70 focus-within:border-zinc-600/70 transition-colors">
                    <Globe className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                    <input
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="https://..."
                      className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-500 outline-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLinkUrl.trim()) {
                          setExternalLinks((prev) => [
                            ...prev,
                            {
                              id: `link-${Date.now()}`,
                              url: newLinkUrl.trim(),
                              label: newLinkLabel.trim() || undefined,
                            },
                          ]);
                          setNewLinkUrl("");
                          setNewLinkLabel("");
                          setShowAddLink(false);
                        }
                        if (e.key === "Escape") {
                          setNewLinkUrl("");
                          setNewLinkLabel("");
                          setShowAddLink(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg surface-2 border border-zinc-700/70 focus-within:border-zinc-600/70 transition-colors">
                    <Tag className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                    <input
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Label (optional)"
                      className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-500 outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLinkUrl.trim()) {
                          setExternalLinks((prev) => [
                            ...prev,
                            {
                              id: `link-${Date.now()}`,
                              url: newLinkUrl.trim(),
                              label: newLinkLabel.trim() || undefined,
                            },
                          ]);
                          setNewLinkUrl("");
                          setNewLinkLabel("");
                          setShowAddLink(false);
                        }
                        if (e.key === "Escape") {
                          setNewLinkUrl("");
                          setNewLinkLabel("");
                          setShowAddLink(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => {
                        setNewLinkUrl("");
                        setNewLinkLabel("");
                        setShowAddLink(false);
                      }}
                      className="px-2 py-1 rounded-md text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!newLinkUrl.trim()) return;
                        setExternalLinks((prev) => [
                          ...prev,
                          {
                            id: `link-${Date.now()}`,
                            url: newLinkUrl.trim(),
                            label: newLinkLabel.trim() || undefined,
                          },
                        ]);
                        setNewLinkUrl("");
                        setNewLinkLabel("");
                        setShowAddLink(false);
                        setNewLinkUrl("");
                        setNewLinkLabel("");
                        setShowAddLink(false);
                      }}
                      disabled={!newLinkUrl.trim()}
                      className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Add link
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {externalLinks.length === 0 && !showAddLink && (
                <button
                  onClick={() => setShowAddLink(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-zinc-700/70 text-[11px] text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/70 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add an external link
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {subtaskDeleteUndo ? (
            <motion.div
              className="fixed bottom-20 right-4 z-[60] max-w-[min(320px,calc(100vw-2rem))] rounded-[18px] border border-white/[0.07] bg-[rgb(var(--theme-surface-elevated-rgb)/0.96)] px-3.5 py-2.5 shadow-[0_16px_34px_rgba(0,0,0,0.24)] backdrop-blur-[10px]"
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/78">{subtaskDeleteUndo.message}</p>
                <button
                  type="button"
                  onClick={undoDeletedSubtask}
                  className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--theme-info-rgb)/0.76)] transition hover:text-[rgb(var(--theme-info-rgb)/0.96)]"
                >
                  Undo
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ═══ BOTTOM ACTION BAR ═══ */}
        <div className="px-6 py-3.5 border-t border-zinc-700/70 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => onDelete(task.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <button
            onClick={() => {
              onUpdate(buildUpdated());
              onComplete(task.id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium border transition-all ${
              isCompletedTask
                ? 'bg-[rgb(var(--theme-info-rgb)/0.1)] text-[rgb(var(--theme-info-rgb)/0.9)] border-[rgb(var(--theme-info-rgb)/0.22)] hover:bg-[rgb(var(--theme-info-rgb)/0.18)] hover:border-[rgb(var(--theme-info-rgb)/0.3)]'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            {isCompletedTask ? 'Restore' : 'Complete'}
          </button>
        </div>
      </div>
    </>
  );
}
