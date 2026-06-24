"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

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
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
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

export function FeatureRequestsManager({
  requests,
  projects,
}: {
  requests: FeatureRequestRow[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("FORM");
  const [priority, setPriority] = useState("MEDIUM");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");

  const create = api.featureRequest.create.useMutation({
    onSuccess: (res) => {
      toast.success("Feature request created.");
      setOpen(false);
      resetForm();
      router.push(`/feature-requests/${res.id}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Feature requests
          </h1>
          <p className="text-muted-foreground text-sm">
            The entry point of the delivery loop. Capture requests from any source.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New request
        </Button>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Inbox className="text-muted-foreground size-8" />
            <div className="space-y-1">
              <p className="font-medium">No feature requests yet</p>
              <p className="text-muted-foreground text-sm">
                Create one here, or send a signed payload to the intake webhook
                (see Settings → Intake).
              </p>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/feature-requests/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          STATUS_BADGE_VARIANT[r.status as FeatureRequestStatus]
                        }
                      >
                        {STATUS_LABELS[r.status as FeatureRequestStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {SOURCE_LABELS[r.source] ?? r.source}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New feature request</DialogTitle>
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
                  className="border-input bg-transparent focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50"
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
