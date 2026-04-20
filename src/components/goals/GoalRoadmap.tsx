import { Check, Circle, Plus } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type StepStatus = "completed" | "current" | "upcoming";
type StepSubtitleTone = "default" | "today" | "upcoming" | "overdue";

interface Step {
  id: string;
  taskId?: string;
  title: string;
  status: StepStatus;
  subtitle?: string;
  subtitleTone?: StepSubtitleTone;
  subtitleDot?: boolean;
  subtitleSuffix?: string;
}

interface Milestone {
  id: string;
  label: string;
  labelType?: string;
  steps: Step[];
  metadata?: string;
}

interface RoadmapTimelineProps {
  milestones: Milestone[];
  completedMilestones?: Milestone[];
  completedCount: number;
  totalCount: number;
  lastActivity: string;
  showMilestones?: boolean;
  showCompletedFooter?: boolean;
  completedExpanded?: boolean;
  onAddTask?: (event: MouseEvent<HTMLButtonElement>) => void;
  onAddTaskToMilestone?: (milestone: Milestone, event: MouseEvent<HTMLButtonElement>) => void;
  onAddMilestone?: (event: MouseEvent<HTMLButtonElement>) => void;
  onStepClick?: (taskId: string, event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void;
  onToggleCompletedExpanded?: () => void;
  headerActions?: ReactNode;
}

type RailPoint = {
  type: "milestone" | "step";
  x: number;
  y: number;
};

type RailRoute = {
  anchor?: RailPoint;
  marker?: RailPoint;
  steps: RailPoint[];
};

function StepNode({
  step,
  onStepClick,
  markerRef,
}: {
  step: Step;
  onStepClick?: RoadmapTimelineProps["onStepClick"];
  markerRef?: (node: HTMLDivElement | null) => void;
}) {
  const isCompleted = step.status === "completed";
  const isCurrent = step.status === "current";
  const isClickable = Boolean(step.taskId && onStepClick);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!step.taskId || !onStepClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onStepClick(step.taskId, event);
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!step.taskId || !onStepClick) return;
    onStepClick(step.taskId, event);
  };

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      className={`relative flex items-start gap-4 pl-1 group/step ${
        isCurrent ? "py-[12.5px]" : "py-[9px]"
      } ${isClickable ? "cursor-pointer" : ""}`}
    >
      <div ref={markerRef} className="relative z-10 -ml-1 mt-1.5 flex-shrink-0">
        {isCompleted ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
            <Check className="h-3.5 w-3.5 text-emerald-500/70" />
          </div>
        ) : isCurrent ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/12 ring-2 ring-[rgba(16,185,129,0.26)] ring-offset-2 ring-offset-[#12141A]">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2A2D3A] bg-[#1A1D26]">
            <Circle className="h-3 w-3 text-slate-600" />
          </div>
        )}
      </div>

      <div
        className={`min-w-0 flex-1 rounded-lg px-4 py-2.5 transition-all duration-200 ${
          isCurrent
            ? "border border-[rgba(16,185,129,0.34)] bg-emerald-500/[0.035]"
            : "hover:bg-white/[0.02]"
        }`}
      >
        <p
          className={`text-sm font-medium leading-snug ${
            isCompleted
              ? "text-slate-500 line-through decoration-slate-700"
              : isCurrent
                ? "text-slate-100"
                : "text-slate-300"
          }`}
        >
          {step.title}
        </p>
        <p className="mt-0.5 flex min-h-[16px] items-center gap-1.5 text-xs">
          {step.subtitle ? (
            <>
              {step.subtitleDot ? (
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    step.subtitleTone === "overdue"
                      ? "bg-red-400/80"
                      : step.subtitleTone === "upcoming"
                        ? "bg-orange-400/80"
                        : step.subtitleTone === "today"
                          ? "bg-emerald-400/80"
                          : "bg-slate-500/70"
                  }`}
                />
              ) : null}
              <span
          className={
            step.subtitleTone === "overdue"
              ? "text-[rgb(var(--theme-negative-rgb)/0.92)]"
              : step.subtitleTone === "upcoming"
                ? "text-orange-400/85"
                : step.subtitleTone === "today"
                        ? "text-emerald-400/80"
                        : isCurrent
                          ? "text-emerald-400/60"
                          : "text-slate-500"
                }
              >
                {step.subtitle}
              </span>
              {step.subtitleSuffix ? (
                <>
                  <span
                    aria-hidden="true"
                    className={step.subtitleTone === "overdue" ? "text-[5px] leading-none text-[rgb(var(--theme-negative-rgb)/0.92)]" : "text-[5px] leading-none text-slate-500"}
                  >
                    ●
                  </span>
                  <span className={step.subtitleTone === "overdue" ? "text-[rgb(var(--theme-negative-rgb)/0.92)]" : "text-slate-500"}>
                    {step.subtitleSuffix}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            "\u00A0"
          )}
        </p>
      </div>
    </div>
  );
}

function MilestoneDivider({
  milestone,
  anchorRef,
  markerRef,
  isOpen,
  onAddTask,
}: {
  milestone: Milestone;
  anchorRef?: (node: HTMLSpanElement | null) => void;
  markerRef?: (node: HTMLDivElement | null) => void;
  isOpen?: boolean;
  onAddTask?: RoadmapTimelineProps["onAddTaskToMilestone"];
}) {
  const completedInGroup = milestone.steps.filter((step) => step.status === "completed").length;
  const totalInGroup = milestone.steps.length;

  return (
    <div className="relative flex items-center gap-3 py-3 pl-1">
      <div
        ref={markerRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2"
      />
      <div
        ref={anchorRef}
        className={`group/milestone ml-8 min-w-0 flex-1 px-3 py-2 transition-[background-color,border-color,color] duration-150 ease-out ${
          isOpen
            ? "border-b border-[rgba(16,185,129,0.10)] bg-transparent hover:border-[rgba(16,185,129,0.16)]"
            : "rounded-xl border border-emerald-500/[0.12] bg-[#151820] hover:border-emerald-500/[0.18] hover:bg-[#181B24]"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            {isOpen ? (
              <>
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-emerald-300"
                  style={{ textShadow: "0 0 8px rgba(52,211,153,0.28)" }}
                >
                  You are here
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-slate-600">-</span>
              </>
            ) : null}
            <span
              className={`truncate text-[10px] font-semibold uppercase tracking-widest ${
                isOpen ? "text-emerald-400/70" : "text-slate-400"
              }`}
            >
              {milestone.label}
            </span>
            <span className="text-[13px] leading-none text-slate-600">·</span>
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-emerald-400/55">
              {completedInGroup}/{totalInGroup}
            </span>
          </span>
          <div className="flex flex-shrink-0 items-center gap-2">
            {milestone.metadata ? (
              <span className="text-[10px] tabular-nums text-slate-600">
                {milestone.metadata}
              </span>
            ) : null}
            {onAddTask ? (
              <button
                type="button"
                aria-label={`Add task to ${milestone.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAddTask(milestone, event);
                }}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center text-slate-500 opacity-0 transition hover:text-emerald-400 focus:opacity-100 group-hover/milestone:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoadmapTimeline({
  milestones,
  completedMilestones = [],
  completedCount,
  totalCount,
  lastActivity,
  showMilestones = true,
  showCompletedFooter = false,
  completedExpanded = false,
  onAddTask,
  onAddTaskToMilestone,
  onAddMilestone,
  onStepClick,
  onToggleCompletedExpanded,
  headerActions,
}: RoadmapTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railContainerRef = useRef<HTMLDivElement>(null);
  const milestoneAnchorRefs = useRef(new Map<string, HTMLSpanElement>());
  const milestoneMarkerRefs = useRef(new Map<string, HTMLDivElement>());
  const stepMarkerRefs = useRef(new Map<string, HTMLDivElement>());
  const completedFooterCount = completedMilestones.reduce(
    (total, milestone) => total + milestone.steps.length,
    0
  );
  const [railGeometry, setRailGeometry] = useState({
    path: "",
    width: 0,
    height: 0,
  });

  const setMilestoneAnchorRef = useCallback((id: string) => (node: HTMLSpanElement | null) => {
    if (node) {
      milestoneAnchorRefs.current.set(id, node);
      return;
    }
    milestoneAnchorRefs.current.delete(id);
  }, []);

  const setMilestoneMarkerRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      milestoneMarkerRefs.current.set(id, node);
      return;
    }
    milestoneMarkerRefs.current.delete(id);
  }, []);

  const setStepMarkerRef = useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      stepMarkerRefs.current.set(id, node);
      return;
    }
    stepMarkerRefs.current.delete(id);
  }, []);

  const updateRailGeometry = useCallback(() => {
    const container = railContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const renderedMilestones = completedExpanded ? [...milestones, ...completedMilestones] : milestones;
    const railRoutes: RailRoute[] = renderedMilestones.map((milestone) => {
      const anchor = milestoneAnchorRefs.current.get(milestone.id);
      const anchorRect = anchor?.getBoundingClientRect();
      const marker = milestoneMarkerRefs.current.get(milestone.id);
      const markerRect = marker?.getBoundingClientRect();
      const milestoneAnchor = showMilestones && anchorRect
        ? {
            type: "milestone" as const,
            x: anchorRect.left - containerRect.left + 4,
            y: anchorRect.top - containerRect.top + anchorRect.height / 2,
          }
        : undefined;
      const milestoneMarker = markerRect
        ? {
            type: "milestone" as const,
            x: markerRect.left - containerRect.left + markerRect.width / 2,
            y: markerRect.top - containerRect.top + markerRect.height / 2,
          }
        : undefined;

      const stepPoints: RailPoint[] = milestone.steps.flatMap((step) => {
        const marker = stepMarkerRefs.current.get(step.id);
        if (!marker) return [];
        const markerRect = marker.getBoundingClientRect();
        return [{
          type: "step" as const,
          x: markerRect.left - containerRect.left + markerRect.width / 2,
          y: markerRect.top - containerRect.top + markerRect.height / 2,
        }];
      });

      return {
        anchor: showMilestones ? milestoneAnchor ?? milestoneMarker : undefined,
        marker: showMilestones ? milestoneMarker : undefined,
        steps: stepPoints,
      };
    });
    const railPoints = railRoutes.flatMap((route) => [
      ...(route.anchor ? [route.anchor] : []),
      ...route.steps,
    ]);

    if (railPoints.length < 1) {
      setRailGeometry({ path: "", width: containerRect.width, height: containerRect.height });
      return;
    }

    const spineCandidates = railRoutes.flatMap((route) => [
      ...(route.marker ? [route.marker.x] : []),
      ...route.steps.map((step) => step.x),
    ]);
    const spineX = spineCandidates.length > 0
      ? spineCandidates.reduce((sum, x) => sum + x, 0) / spineCandidates.length
      : railPoints[0].x;
    const bendY = 10;
    const firstRoute = railRoutes.find((route) => route.anchor || route.steps.length > 0);
    const firstY = firstRoute?.anchor?.y ?? firstRoute?.steps[0]?.y ?? railPoints[0].y;
    let cursorY = firstY;
    let path = `M ${spineX} ${cursorY}`;

    railRoutes.forEach((route, routeIndex) => {
      const anchor = route.anchor;
      if (anchor) {
        if (routeIndex === 0) {
          path += ` L ${spineX} ${anchor.y}`;
          cursorY = anchor.y;
        } else {
          const preY = Math.max(cursorY, anchor.y - bendY);
          path += ` L ${spineX} ${preY}`;

          if (Math.abs(anchor.x - spineX) > 4) {
            path += ` Q ${spineX} ${anchor.y} ${anchor.x} ${anchor.y}`;
            path += ` Q ${spineX} ${anchor.y} ${spineX} ${anchor.y + bendY}`;
            cursorY = anchor.y + bendY;
          } else {
            path += ` L ${spineX} ${anchor.y}`;
            cursorY = anchor.y;
          }
        }
      }

      route.steps.forEach((step) => {
        path += ` L ${spineX} ${step.y}`;
        cursorY = step.y;
      });
    });

    setRailGeometry({
      path,
      width: containerRect.width,
      height: containerRect.height,
    });
  }, [completedExpanded, completedMilestones, milestones, showMilestones]);

  useLayoutEffect(() => {
    updateRailGeometry();
    const container = railContainerRef.current;
    const scroller = scrollRef.current;
    if (!container) return;

    const observer = new ResizeObserver(updateRailGeometry);
    observer.observe(container);
    scroller?.addEventListener("scroll", updateRailGeometry, { passive: true });

    return () => {
      observer.disconnect();
      scroller?.removeEventListener("scroll", updateRailGeometry);
    };
  }, [updateRailGeometry]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
          Roadmap
        </h2>
        <div className="ml-auto flex items-center gap-3">
          {onAddMilestone ? (
            <button
              type="button"
              onClick={onAddMilestone}
              className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 transition-colors hover:text-indigo-400"
            >
              Add Milestone
            </button>
          ) : null}
          <span className="text-xs tabular-nums text-slate-500">
            {completedCount} of {totalCount} tasks
          </span>
          {headerActions ? (
            <div className="[&>div>button]:h-7 [&>div>button]:w-7 [&>div>button]:rounded-full [&>div>button]:border [&>div>button]:border-white/[0.08] [&>div>button]:bg-white/[0.035] [&>div>button]:text-white/64 [&>div>button:hover]:border-white/[0.12] [&>div>button:hover]:bg-white/[0.055] [&>div>button:hover]:text-white/86">
              {headerActions}
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="theme-scrollbar -mr-2 h-full overflow-y-auto pr-2"
        >
          <div ref={railContainerRef} className="relative ml-3">
            {railGeometry.path ? (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 overflow-visible"
                width={railGeometry.width}
                height={railGeometry.height}
                viewBox={`0 0 ${railGeometry.width} ${railGeometry.height}`}
                preserveAspectRatio="none"
              >
                <path
                  d={railGeometry.path}
                  fill="none"
                  stroke="rgba(16,185,129,0.38)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}

            {showMilestones ? (
              milestones.map((milestone, index) => (
                <div key={milestone.id}>
                  <div className={index === 0 ? "" : "mt-1"}>
                    <MilestoneDivider
                      milestone={milestone}
                      anchorRef={setMilestoneAnchorRef(milestone.id)}
                      markerRef={setMilestoneMarkerRef(milestone.id)}
                      isOpen={index === 0}
                      onAddTask={onAddTaskToMilestone}
                    />
                  </div>

                  {milestone.steps.length > 0 ? (
                    milestone.steps.map((step) => (
                      <StepNode
                        key={step.id}
                        step={step}
                        onStepClick={onStepClick}
                        markerRef={setStepMarkerRef(step.id)}
                      />
                    ))
                  ) : (
                    <div className="py-2.5 pl-11 pr-4 text-xs text-slate-600">
                      No tasks in this milestone yet
                    </div>
                  )}
                </div>
              ))
            ) : (
              milestones.flatMap((milestone) => milestone.steps).map((step) => (
                <StepNode
                  key={step.id}
                  step={step}
                  onStepClick={onStepClick}
                  markerRef={setStepMarkerRef(step.id)}
                />
              ))
            )}

            {showCompletedFooter && completedFooterCount > 0 ? (
              <div className="mt-3 pl-11 pr-4">
                <button
                  type="button"
                  onClick={onToggleCompletedExpanded}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.045] bg-white/[0.014] px-3 py-2 text-left text-xs text-slate-500 transition hover:border-white/[0.075] hover:bg-white/[0.024] hover:text-slate-300"
                >
                  <span>{completedExpanded ? "Hide completed tasks" : `Show ${completedFooterCount} completed ${completedFooterCount === 1 ? "task" : "tasks"}`}</span>
                  <span aria-hidden="true">{completedExpanded ? "−" : "+"}</span>
                </button>
              </div>
            ) : null}

            {showCompletedFooter && completedExpanded ? (
              showMilestones ? (
                completedMilestones.map((milestone) => (
                  <div key={`completed-${milestone.id}`}>
                    {milestone.steps.map((step) => (
                      <StepNode
                        key={step.id}
                        step={step}
                        onStepClick={onStepClick}
                        markerRef={setStepMarkerRef(step.id)}
                      />
                    ))}
                  </div>
                ))
              ) : (
                completedMilestones.flatMap((milestone) => milestone.steps).map((step) => (
                  <StepNode
                    key={step.id}
                    step={step}
                    onStepClick={onStepClick}
                    markerRef={setStepMarkerRef(step.id)}
                  />
                ))
              )
            ) : null}

            <div className="h-2" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onAddTask}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#2A2D3A] py-2.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:border-emerald-500/25 hover:bg-emerald-500/[0.025] hover:text-emerald-400/80"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Task
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-[#1A1D26] pt-3">
        <span className="text-[10px] uppercase tracking-widest text-slate-600">
          Last activity
        </span>
        <span className="text-[10px] text-slate-500">{lastActivity}</span>
      </div>
    </div>
  );
}
