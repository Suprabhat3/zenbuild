"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Inbox, Plus, SearchX } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NEXT_ACTION,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STAGE_FILTERS,
  STATUS_LABELS,
  STATUS_STAGE_FILTER,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/react";

export interface FeatureRequestRow {
  id: string;
  title: string;
  status: string;
  source: string;
  priority: string;
  requesterName: string | null;
  createdAt: Date;
  project: { id: string; name: string; key: string } | null;
}

export interface ProjectOption {
  id: string;
  name: string;
  key: string;
}

const NO_PROJECT = "__none__";
const ALL_PROJECTS = "__all__";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function FeatureRequestsManager({
  requests,
  projects,
  activeStage,
  attention,
  activeProjectId,
  openCreate,
  createProjectId,
}: {
  requests: FeatureRequestRow[];
  projects: ProjectOption[];
  activeStage: string | null;
  attention: boolean;
  activeProjectId: string | null;
  openCreate: boolean;
  createProjectId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("FORM");
  const [priority, setPriority] = useState("MEDIUM");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [autoStartDiscovery, setAutoStartDiscovery] = useState(true);

  // `?new=1` deep-links straight into the create dialog (e.g. from a project
  // page). Open it once, preselect the project, then strip the flag from the
  // URL so a refresh doesn't reopen the dialog.
  useEffect(() => {
    if (!openCreate) return;
    setOpen(true);
    if (createProjectId) setProjectId(createProjectId);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const query = params.toString();
    router.replace(`/requests${query ? `?${query}` : ""}`, {
      scroll: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreate, createProjectId]);

  const startDiscovery = api.clarification.start.useMutation();

  const create = api.featureRequest.create.useMutation({
    onSuccess: async (res) => {
      setOpen(false);
      resetForm();
      // Put the agent to work immediately — the workspace opens onto the
      // discovery conversation already in progress.
      if (autoStartDiscovery) {
        try {
          await startDiscovery.mutateAsync({ featureRequestId: res.id });
          toast.success("Request created — the agent is on it.");
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Request created, but discovery couldn't start — start it from the request.",
          );
        }
      } else {
        toast.success("Request created.");
      }
      router.push(`/requests/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setSource("FORM");
    setPriority("MEDIUM");
    setProjectId(NO_PROJECT);
    setRequesterName("");
    setRequesterEmail("");
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({
      title: title.trim(),
      description: description.trim(),
      source: source as "FORM" | "EMAIL" | "TICKET" | "CALL" | "API",
      priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      projectId: projectId === NO_PROJECT ? undefined : projectId,
      requesterName: requesterName.trim() || undefined,
      requesterEmail: requesterEmail.trim() || undefined,
    });
  }

  /** Build a filter URL, preserving the other active filters. */
  function filterHref(next: {
    stage?: string | null;
    attention?: boolean;
    projectId?: string | null;
  }) {
    const stage = next.stage === undefined ? activeStage : next.stage;
    const attn = next.attention === undefined ? attention : next.attention;
    const projectId =
      next.projectId === undefined ? activeProjectId : next.projectId;
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (attn) params.set("attention", "1");
    if (projectId) params.set("projectId", projectId);
    const query = params.toString();
    return `/requests${query ? `?${query}` : ""}`;
  }

  function onProjectFilterChange(value: string | null) {
    router.replace(
      filterHref({ projectId: value === ALL_PROJECTS || !value ? null : value }),
      { scroll: false },
    );
  }

  const visibleRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((r) => r.title.toLowerCase().includes(needle));
  }, [requests, search]);

  const hasFilters = Boolean(
    activeStage || attention || activeProjectId || search.trim(),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Delivery loop"
        title="Requests"
        description="Every feature request, from intake to ship. Capture requests from any source."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New request
          </Button>
        }
      />

      <div className="space-y-4">
        <div
          className="app-pipeline"
          role="navigation"
          aria-label="Filter by pipeline stage"
        >
          <Link
            href={filterHref({ stage: null })}
            className={`app-pipeline-chip${activeStage === null ? " is-active" : ""}`}
            aria-current={activeStage === null ? "true" : undefined}
          >
            All
          </Link>
          {STAGE_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={filterHref({ stage: f.key })}
              className={`app-pipeline-chip${activeStage === f.key ? " is-active" : ""}`}
              aria-current={activeStage === f.key ? "true" : undefined}
            >
              {f.label}
            </Link>
          ))}
          <Link
            href={filterHref({ attention: !attention })}
            className={`app-pipeline-chip${attention ? " is-active" : ""}`}
            aria-pressed={attention}
          >
            Needs attention
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            aria-label="Search feature requests by title"
            className="w-full sm:max-w-xs"
          />
          <Select
            value={activeProjectId ?? ALL_PROJECTS}
            onValueChange={onProjectFilterChange}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="Filter by project"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {visibleRequests.length === 0 ? (
        <div className="app-panel">
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="No matching requests"
              description="Nothing matches the current filters. Try broadening them."
              action={
                <Button
                  variant="outline"
                  render={<Link href="/requests" />}
                  onClick={() => setSearch("")}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No feature requests yet"
              description={
                <>
                  Create one here, or send a signed payload to the intake webhook
                  (see Settings → Intake).
                </>
              }
              action={
                <Button onClick={() => setOpen(true)} className="gap-1.5">
                  <Plus className="size-4" />
                  New request
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRequests.map((r) => {
                  const status = r.status as FeatureRequestStatus;
                  const stageChip = STATUS_STAGE_FILTER[status];
                  const hint =
                    NEXT_ACTION[status]?.hint ??
                    (status === "SHIPPED"
                      ? "Shipped — nothing left to do."
                      : `Closed — ${STATUS_LABELS[status].toLowerCase()}.`);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-md">
                        <Link
                          href={`/requests/${r.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {r.title}
                        </Link>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {hint}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {stageChip.label}
                          <span className="text-muted-foreground font-normal">
                            · {STATUS_LABELS[status]}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {PRIORITY_LABELS[r.priority] ?? r.priority}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {r.project ? (
                          <Badge variant="outline" className="font-mono">
                            {r.project.key}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {dateFormatter.format(new Date(r.createdAt))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New request</DialogTitle>
              <DialogDescription>
                Capture what the customer or product owner is asking for.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
              <div className="space-y-2">
                <Label htmlFor="fr-title">Title</Label>
                <Input
                  id="fr-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add dark mode to the dashboard"
                  disabled={create.isPending}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fr-desc">Description</Label>
                <textarea
                  id="fr-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does the requester want, and why?"
                  disabled={create.isPending}
                  rows={4}
                  className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fr-source">Source</Label>
                  <Select
                    value={source}
                    onValueChange={(v) => setSource(v ?? "FORM")}
                    disabled={create.isPending}
                  >
                    <SelectTrigger id="fr-source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fr-priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v ?? "MEDIUM")}
                    disabled={create.isPending}
                  >
                    <SelectTrigger id="fr-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fr-project">Project (optional)</Label>
                <Select
                  value={projectId}
                  onValueChange={(v) => setProjectId(v ?? NO_PROJECT)}
                  disabled={create.isPending}
                >
                  <SelectTrigger id="fr-project" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>No project (Inbox)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="fr-rname">Requester name (optional)</Label>
                  <Input
                    id="fr-rname"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    disabled={create.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fr-remail">Requester email (optional)</Label>
                  <Input
                    id="fr-remail"
                    type="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    disabled={create.isPending}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={autoStartDiscovery}
                  onChange={(e) => setAutoStartDiscovery(e.target.checked)}
                  disabled={create.isPending}
                  className="accent-primary mt-0.5 size-4 cursor-pointer"
                />
                <span>
                  <span className="font-medium">Start discovery right away</span>
                  <span className="text-muted-foreground block text-xs">
                    The agent immediately analyzes the request and asks its
                    follow-up questions.
                  </span>
                </span>
              </label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={create.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
