"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GitBranch,
  GitPullRequest,
  Loader2,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import type { FeatureRequestStatus } from "@/lib/feature-request";

type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface BoardMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
}
interface BoardTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  status: TaskStatus;
  priority: TaskPriority;
  estimate: number | null;
  rank: string;
  suggestedAreas: string[];
  assigneeId: string | null;
  createdAt: Date;
  dependsOn: { id: string; title: string }[];
  pr: {
    number: number;
    url: string;
    status: "OPEN" | "CLOSED" | "MERGED" | "DRAFT";
    origin: "AGENT" | "EXTERNAL";
  } | null;
}
interface BoardData {
  status: FeatureRequestStatus;
  canEdit: boolean;
  canGenerate: boolean;
  canImplement: boolean;
  members: BoardMember[];
  tasks: BoardTask[];
}

const COLUMNS: { status: TaskStatus; label: string; dot: string }[] = [
  { status: "BACKLOG", label: "Backlog", dot: "col-backlog" },
  { status: "TODO", label: "Todo", dot: "col-todo" },
  { status: "IN_PROGRESS", label: "In Progress", dot: "col-in_progress" },
  { status: "IN_REVIEW", label: "In Review", dot: "col-in_review" },
  { status: "DONE", label: "Done", dot: "col-done" },
];
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function initials(m: BoardMember): string {
  const base = m.name?.trim() || m.email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function KanbanBoard({
  featureRequestId,
  initialData,
  canApprove,
}: {
  featureRequestId: string;
  initialData: BoardData;
  canApprove: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const boardQuery = api.task.board.useQuery(
    { featureRequestId },
    { initialData, refetchOnMount: false },
  );
  const board = boardQuery.data ?? initialData;
  const canEdit = board.canEdit;

  // Local ordered copy so drag feels instant; re-synced when server data lands.
  const [tasks, setTasks] = useState<BoardTask[]>(board.tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [implementing, setImplementing] = useState<BoardTask | null>(null);
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    setTasks(board.tasks);
  }, [board.tasks]);

  const memberById = useMemo(
    () => new Map(board.members.map((m) => [m.id, m])),
    [board.members],
  );

  const columns = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => (a.rank < b.rank ? -1 : 1));
    const map: Record<TaskStatus, BoardTask[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of sorted) map[t.status].push(t);
    return map;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = api.task.move.useMutation({
    onError: (e) => {
      toast.error(e.message);
      void utils.task.board.invalidate({ featureRequestId });
    },
    onSettled: () => void utils.task.board.invalidate({ featureRequestId }),
  });

  function statusOf(id: string): TaskStatus | null {
    if (id.startsWith("col-")) return id.slice(4) as TaskStatus;
    return tasks.find((t) => t.id === id)?.status ?? null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeTaskId = String(active.id);
    const overId = String(over.id);
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    const targetStatus = statusOf(overId);
    if (!targetStatus) return;

    // Target column order (excluding the active task) and the slot to drop into.
    const targetList = columns[targetStatus].filter((t) => t.id !== activeTaskId);
    let index = targetList.length;
    if (!overId.startsWith("col-")) {
      const overIdx = targetList.findIndex((t) => t.id === overId);
      if (overIdx >= 0) index = overIdx;
    }
    const beforeTaskId = targetList[index - 1]?.id ?? null;
    const afterTaskId = targetList[index]?.id ?? null;

    // Optimistic reorder: rebuild the target column with the active task spliced
    // in at `index`, assigning provisional ranks so the local sort is stable.
    // The server returns the authoritative lexorank and we re-sync on settle.
    setTasks((prev) => {
      const moved = { ...task, status: targetStatus };
      const newTargetOrder = [
        ...targetList.slice(0, index),
        moved,
        ...targetList.slice(index),
      ].map((t, i) => ({ ...t, rank: provisionalRank(i) }));

      const others = prev.filter(
        (t) => t.id !== activeTaskId && t.status !== targetStatus,
      );
      return [...others, ...newTargetOrder];
    });

    move.mutate({ taskId: activeTaskId, status: targetStatus, beforeTaskId, afterTaskId });
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;
  const totalPoints = tasks.reduce((s, t) => s + (t.estimate ?? 0), 0);
  const doneCount = columns.DONE.length;

  return (
    <div className="space-y-4">
      <div className="app-board-summary">
        <span className="app-pipeline-chip">
          <strong>{tasks.length}</strong> tasks
        </span>
        <span className="app-pipeline-chip">
          <strong>{doneCount}</strong> done
        </span>
        <span className="app-pipeline-chip">
          <strong>{totalPoints}</strong> points
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <RegenerateButton featureRequestId={featureRequestId} canGenerate={board.canGenerate} />
          <ApprovePlanButton
            featureRequestId={featureRequestId}
            status={board.status}
            canApprove={canApprove}
            taskCount={tasks.length}
          />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="app-board">
          {COLUMNS.map((col) => (
            <Column
              key={col.status}
              col={col}
              tasks={columns[col.status]}
              canEdit={canEdit}
              canImplement={board.canImplement}
              memberById={memberById}
              onAdd={() => setCreatingIn(col.status)}
              onEdit={setEditing}
              onImplement={setImplementing}
              members={board.members}
              featureRequestId={featureRequestId}
              activeId={activeId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCardView
              task={activeTask}
              assignee={activeTask.assigneeId ? memberById.get(activeTask.assigneeId) ?? null : null}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {creatingIn && (
        <TaskDialog
          featureRequestId={featureRequestId}
          members={board.members}
          initialStatus={creatingIn}
          onClose={() => setCreatingIn(null)}
          onSaved={() => {
            setCreatingIn(null);
            void utils.task.board.invalidate({ featureRequestId });
            router.refresh();
          }}
        />
      )}
      {editing && (
        <TaskDialog
          featureRequestId={featureRequestId}
          members={board.members}
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void utils.task.board.invalidate({ featureRequestId });
            router.refresh();
          }}
        />
      )}
      {implementing && (
        <ImplementDialog
          featureRequestId={featureRequestId}
          task={implementing}
          onClose={() => setImplementing(null)}
          onSettled={() => {
            void utils.task.board.invalidate({ featureRequestId });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Stable-ish provisional rank for optimistic ordering (server returns real one). */
function provisionalRank(index: number): string {
  return `~${index.toString(36).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Column
// ---------------------------------------------------------------------------
function Column({
  col,
  tasks,
  canEdit,
  canImplement,
  memberById,
  members,
  featureRequestId,
  onAdd,
  onEdit,
  onImplement,
  activeId,
}: {
  col: { status: TaskStatus; label: string; dot: string };
  tasks: BoardTask[];
  canEdit: boolean;
  canImplement: boolean;
  memberById: Map<string, BoardMember>;
  members: BoardMember[];
  featureRequestId: string;
  onAdd: () => void;
  onEdit: (t: BoardTask) => void;
  onImplement: (t: BoardTask) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.status}` });

  return (
    <section className={`app-col ${isOver ? "is-over" : ""}`}>
      <header className="app-col-head">
        <span className="app-col-title">
          <span className={`app-col-dot ${col.dot}`} />
          {col.label}
        </span>
        <span className="app-col-count">{tasks.length}</span>
      </header>
      <div ref={setNodeRef} className="app-col-body">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 && (
            <p className="app-col-empty">Nothing here yet.</p>
          )}
          {tasks.map((t) => (
            <SortableCard
              key={t.id}
              task={t}
              canEdit={canEdit}
              canImplement={canImplement}
              assignee={t.assigneeId ? memberById.get(t.assigneeId) ?? null : null}
              members={members}
              featureRequestId={featureRequestId}
              onEdit={() => onEdit(t)}
              onImplement={() => onImplement(t)}
              dragging={activeId === t.id}
            />
          ))}
        </SortableContext>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground justify-start gap-1.5"
            onClick={onAdd}
          >
            <Plus className="size-4" />
            Add task
          </Button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sortable card (wraps the visual card with dnd-kit + actions menu)
// ---------------------------------------------------------------------------
function SortableCard({
  task,
  canEdit,
  canImplement,
  assignee,
  members,
  featureRequestId,
  onEdit,
  onImplement,
  dragging,
}: {
  task: BoardTask;
  canEdit: boolean;
  canImplement: boolean;
  assignee: BoardMember | null;
  members: BoardMember[];
  featureRequestId: string;
  onEdit: () => void;
  onImplement: () => void;
  dragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
    disabled: !canEdit,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCardView
        task={task}
        assignee={assignee}
        dragging={dragging}
        dragProps={canEdit ? { ...attributes, ...listeners } : undefined}
        actions={
          canEdit || canImplement ? (
            <CardMenu
              task={task}
              members={members}
              featureRequestId={featureRequestId}
              canEdit={canEdit}
              canImplement={canImplement}
              onEdit={onEdit}
              onImplement={onImplement}
            />
          ) : null
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pure card view (also used in the drag overlay)
// ---------------------------------------------------------------------------
function TaskCardView({
  task,
  assignee,
  overlay,
  dragging,
  dragProps,
  actions,
}: {
  task: BoardTask;
  assignee: BoardMember | null;
  overlay?: boolean;
  dragging?: boolean;
  dragProps?: Record<string, unknown>;
  actions?: React.ReactNode;
}) {
  return (
    <article
      className={`app-task-card ${overlay ? "is-overlay" : ""} ${dragging ? "is-dragging" : ""}`}
    >
      <div className="app-task-card-head">
        <h3 className="app-task-title" {...dragProps}>
          {task.title}
        </h3>
        {actions}
      </div>
      <div className="app-task-meta">
        <span className={`app-task-chip app-task-prio prio-${task.priority.toLowerCase()}`}>
          {PRIORITY_LABEL[task.priority]}
        </span>
        {task.estimate != null && (
          <span className="app-task-chip">{task.estimate} pt</span>
        )}
        {task.dependsOn.length > 0 && (
          <span className="app-task-dep" title={task.dependsOn.map((d) => d.title).join(", ")}>
            <GitBranch className="size-3" />
            {task.dependsOn.length}
          </span>
        )}
        {task.pr && (
          <Link
            href={task.pr.url}
            target="_blank"
            rel="noreferrer"
            className="app-task-chip gap-1 hover:underline"
            title={`Pull request #${task.pr.number} (${task.pr.status.toLowerCase()})`}
            onClick={(e) => e.stopPropagation()}
          >
            <GitPullRequest className="size-3" />#{task.pr.number}
          </Link>
        )}
        {assignee && (
          <span className="app-task-avatar ml-auto" title={assignee.name ?? assignee.email}>
            {assignee.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assignee.image} alt="" />
            ) : (
              initials(assignee)
            )}
          </span>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Per-card actions menu (keyboard-accessible alternative to drag)
// ---------------------------------------------------------------------------
function CardMenu({
  task,
  members,
  featureRequestId,
  canEdit,
  canImplement,
  onEdit,
  onImplement,
}: {
  task: BoardTask;
  members: BoardMember[];
  featureRequestId: string;
  canEdit: boolean;
  canImplement: boolean;
  onEdit: () => void;
  onImplement: () => void;
}) {
  const utils = api.useUtils();
  const invalidate = () => void utils.task.board.invalidate({ featureRequestId });

  const move = api.task.move.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const assign = api.task.assign.useMutation({
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const remove = api.task.remove.useMutation({
    onSuccess: () => {
      toast.success("Task deleted.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:text-foreground -mr-1 rounded-md p-1 transition-colors"
        aria-label="Task actions"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canImplement && (
          <>
            <DropdownMenuItem onClick={onImplement}>
              <Sparkles className="size-4" />
              {task.pr ? "Re-implement with AI" : "Implement with AI"}
            </DropdownMenuItem>
            {canEdit && <DropdownMenuSeparator />}
          </>
        )}

        {canEdit && (
          <>
            <DropdownMenuItem onClick={onEdit}>Edit details</DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                  <DropdownMenuItem
                    key={c.status}
                    onClick={() =>
                      move.mutate({
                        taskId: task.id,
                        status: c.status,
                        beforeTaskId: null,
                        afterTaskId: null,
                      })
                    }
                  >
                    {c.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Assignee</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={task.assigneeId ?? "none"}
                  onValueChange={(v) =>
                    assign.mutate({
                      taskId: task.id,
                      assigneeId: v === "none" ? null : v,
                    })
                  }
                >
                  <DropdownMenuRadioItem value="none">Unassigned</DropdownMenuRadioItem>
                  {members.map((m) => (
                    <DropdownMenuRadioItem key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => remove.mutate({ taskId: task.id })}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Create / edit task dialog
// ---------------------------------------------------------------------------
function TaskDialog({
  featureRequestId,
  members,
  task,
  initialStatus,
  onClose,
  onSaved,
}: {
  featureRequestId: string;
  members: BoardMember[];
  task?: BoardTask;
  initialStatus?: TaskStatus;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "MEDIUM");
  const [estimate, setEstimate] = useState<string>(
    task?.estimate != null ? String(task.estimate) : "",
  );
  const [assigneeId, setAssigneeId] = useState<string>(task?.assigneeId ?? "none");
  const [acceptance, setAcceptance] = useState(
    (task?.acceptanceCriteria ?? []).join("\n"),
  );
  const [areas, setAreas] = useState((task?.suggestedAreas ?? []).join("\n"));

  const create = api.task.create.useMutation({
    onSuccess: () => {
      toast.success("Task added.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const update = api.task.update.useMutation({
    onSuccess: () => {
      toast.success("Task updated.");
      onSaved();
    },
    onError: (e) => toast.error(e.message),
  });
  const assign = api.task.assign.useMutation();

  const busy = create.isPending || update.isPending || assign.isPending;
  const lines = (v: string) =>
    v.split("\n").map((l) => l.trim()).filter(Boolean);
  const estimateNum = estimate.trim() ? Number(estimate) : null;

  async function submit() {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (estimateNum != null && (Number.isNaN(estimateNum) || estimateNum < 1 || estimateNum > 13)) {
      toast.error("Estimate must be between 1 and 13.");
      return;
    }
    if (isEdit && task) {
      await update.mutateAsync({
        taskId: task.id,
        title: title.trim(),
        description: description.trim(),
        priority,
        estimate: estimateNum,
        acceptanceCriteria: lines(acceptance),
        suggestedAreas: lines(areas),
      });
      if ((task.assigneeId ?? "none") !== assigneeId) {
        await assign.mutateAsync({
          taskId: task.id,
          assigneeId: assigneeId === "none" ? null : assigneeId,
        });
      }
      onSaved();
    } else {
      create.mutate({
        featureRequestId,
        title: title.trim(),
        description: description.trim(),
        status: initialStatus ?? "BACKLOG",
        priority,
        estimate: estimateNum,
        acceptanceCriteria: lines(acceptance),
        suggestedAreas: lines(areas),
        assigneeId: assigneeId === "none" ? null : assigneeId,
      });
    }
  }

  const textareaClass =
    "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the task details, priority, and assignee."
              : "Add a task to the plan. You can drag it between columns afterwards."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Implement webhook signature verification"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <textarea
              id="task-desc"
              value={description}
              rows={3}
              disabled={busy}
              className={textareaClass}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-est">Estimate</Label>
              <Input
                id="task-est"
                type="number"
                min={1}
                max={13}
                value={estimate}
                disabled={busy}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="pts"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select
                value={assigneeId}
                onValueChange={(v) => setAssigneeId(v ?? "none")}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-ac">Acceptance criteria</Label>
            <textarea
              id="task-ac"
              value={acceptance}
              rows={3}
              disabled={busy}
              className={textareaClass}
              placeholder="One per line"
              onChange={(e) => setAcceptance(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-areas">Suggested areas</Label>
            <textarea
              id="task-areas"
              value={areas}
              rows={2}
              disabled={busy}
              className={textareaClass}
              placeholder="Files / modules, one per line"
              onChange={(e) => setAreas(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {isEdit ? "Save changes" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Implement-with-AI dialog (coding agent: task → branch → PR)
// ---------------------------------------------------------------------------
const ACTIVE_RUN = new Set(["QUEUED", "RUNNING"]);

interface ImplementOutput {
  summary?: string;
  confidence?: number;
  risk?: string;
  riskReasons?: string[];
  testsAdded?: boolean;
  followUps?: string[];
  pr?: { number?: number; url?: string; branch?: string };
}

function ImplementDialog({
  featureRequestId,
  task,
  onClose,
  onSettled,
}: {
  featureRequestId: string;
  task: BoardTask;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [repoId, setRepoId] = useState<string | undefined>(undefined);
  const [polling, setPolling] = useState(false);

  const reposQuery = api.coding.repos.useQuery({ featureRequestId });
  const repos = reposQuery.data?.repos ?? [];

  // Auto-select the sole connected repo.
  useEffect(() => {
    if (!repoId && repos.length === 1) setRepoId(repos[0]!.id);
  }, [repoId, repos]);

  const statusQuery = api.coding.taskStatus.useQuery(
    { taskId: task.id },
    { refetchInterval: polling ? 1500 : false },
  );
  const run = statusQuery.data?.run ?? null;
  const pr = statusQuery.data?.pr ?? null;
  const active = run ? ACTIVE_RUN.has(run.status) : false;

  useEffect(() => {
    if (active) setPolling(true);
  }, [active]);
  useEffect(() => {
    if (polling && run && !active) {
      setPolling(false);
      if (run.status === "FAILED") toast.error(run.error ?? "Implementation failed.");
      else if (run.status === "COMPLETED") toast.success("Pull request opened.");
      onSettled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, run?.status, active]);

  const implement = api.coding.implement.useMutation({
    onSuccess: () => {
      setPolling(true);
      void statusQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const out = (run?.output ?? null) as ImplementOutput | null;
  const busy = polling || active || implement.isPending;
  const needsRepoChoice = repos.length > 1 && !repoId;
  const noRepos = reposQuery.isSuccess && repos.length === 0;
  const completed = run?.status === "COMPLETED";

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Implement with AI
          </DialogTitle>
          <DialogDescription>
            The coding agent reads the connected repository, implements{" "}
            <span className="font-medium">{task.title}</span>, and opens a pull
            request for review. One PR per task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {noRepos && (
            <p className="text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
              No GitHub repository is connected to this feature&rsquo;s project.
              Connect one from the project page first.
            </p>
          )}

          {repos.length > 1 && !busy && !completed && (
            <div className="space-y-1.5">
              <Label>Repository</Label>
              <Select value={repoId} onValueChange={(v) => setRepoId(v ?? undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a repository" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.fullName}
                      {r.analyzedAt ? "" : " (analysis pending)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {busy && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              {run?.step ?? "Starting…"}
              {typeof run?.progress === "number" && run.progress > 0 && (
                <span>· {run.progress}%</span>
              )}
            </div>
          )}

          {completed && out && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
              {out.summary && <p className="leading-relaxed">{out.summary}</p>}
              <div className="flex flex-wrap items-center gap-2">
                {typeof out.confidence === "number" && (
                  <span className="app-task-chip">
                    Confidence {out.confidence}%
                  </span>
                )}
                {out.risk && (
                  <span
                    className={`app-task-chip gap-1 ${out.risk === "HIGH" ? "text-destructive" : ""}`}
                  >
                    <ShieldAlert className="size-3" />
                    {out.risk[0]! + out.risk.slice(1).toLowerCase()} risk
                  </span>
                )}
                {out.testsAdded && <span className="app-task-chip">Tests added</span>}
              </div>
              {out.riskReasons && out.riskReasons.length > 0 && (
                <ul className="text-muted-foreground list-disc space-y-0.5 pl-5">
                  {out.riskReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {pr && (
                <Link
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
                >
                  <GitPullRequest className="size-4" />
                  View pull request #{pr.number}
                </Link>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {completed ? "Close" : "Cancel"}
          </Button>
          {!completed && (
            <Button
              className="gap-1.5"
              disabled={busy || noRepos || needsRepoChoice}
              onClick={() => implement.mutate({ taskId: task.id, repositoryId: repoId })}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {task.pr ? "Re-implement" : "Implement"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Header actions
// ---------------------------------------------------------------------------
function RegenerateButton({
  featureRequestId,
  canGenerate,
}: {
  featureRequestId: string;
  canGenerate: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();
  const [polling, setPolling] = useState(false);

  const runQuery = api.workflowRun.latest.useQuery(
    { featureRequestId, type: "TASKS_GENERATE" },
    { refetchInterval: polling ? 1500 : false },
  );
  const run = runQuery.data;
  const active = run ? run.status === "QUEUED" || run.status === "RUNNING" : false;

  useEffect(() => {
    if (active) setPolling(true);
  }, [active]);
  useEffect(() => {
    if (polling && run && !active) {
      setPolling(false);
      if (run.status === "FAILED") toast.error(run.error ?? "Task generation failed.");
      else toast.success("Tasks regenerated.");
      void utils.task.board.invalidate({ featureRequestId });
      router.refresh();
    }
  }, [polling, run, active, featureRequestId, router, utils]);

  const generate = api.task.generate.useMutation({
    onSuccess: () => {
      setPolling(true);
      void runQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!canGenerate) return null;
  const busy = polling || active || generate.isPending;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={busy}
      onClick={() => generate.mutate({ featureRequestId })}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {busy ? run?.step ?? "Generating…" : "Regenerate tasks"}
    </Button>
  );
}

function ApprovePlanButton({
  featureRequestId,
  status,
  canApprove,
  taskCount,
}: {
  featureRequestId: string;
  status: string;
  canApprove: boolean;
  taskCount: number;
}) {
  const router = useRouter();
  const approve = api.task.approvePlan.useMutation({
    onSuccess: () => {
      toast.success("Plan approved. Development is unlocked.");
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (status !== "TASKS_READY") {
    if (status === "IN_DEVELOPMENT") {
      return (
        <span className="app-task-chip">
          <UserRound className="size-3" /> Plan approved
        </span>
      );
    }
    return null;
  }
  if (!canApprove) return null;

  return (
    <Button
      size="sm"
      className="gap-1.5"
      disabled={approve.isPending || taskCount === 0}
      onClick={() => approve.mutate({ featureRequestId })}
    >
      {approve.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Check className="size-4" />
      )}
      Approve plan
    </Button>
  );
}
