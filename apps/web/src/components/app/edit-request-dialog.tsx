"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_LABELS } from "@/lib/feature-request";
import { api } from "@/trpc/react";

const NO_PROJECT = "__none__";

/**
 * Edit the request itself (title, description, priority, project) at any
 * point before it closes — a mistyped description must never be a dead end.
 * The agent works from this text, so after editing, re-running discovery or
 * regenerating the PRD picks up the correction.
 */
export function EditRequestDialog({
  request,
  projects,
}: {
  request: {
    id: string;
    title: string;
    description: string;
    priority: string;
    projectId: string | null;
  };
  projects: { id: string; name: string; key: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(request.title);
  const [description, setDescription] = useState(request.description);
  const [priority, setPriority] = useState(request.priority);
  const [projectId, setProjectId] = useState(request.projectId ?? NO_PROJECT);

  const update = api.featureRequest.update.useMutation({
    onSuccess: () => {
      toast.success("Request updated.");
      setOpen(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  function onOpenChange(next: boolean) {
    if (next) {
      // Re-seed from the latest server values each time it opens.
      setTitle(request.title);
      setDescription(request.description);
      setPriority(request.priority);
      setProjectId(request.projectId ?? NO_PROJECT);
    }
    setOpen(next);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate({
      id: request.id,
      title: title.trim(),
      description: description.trim(),
      priority: priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      projectId: projectId === NO_PROJECT ? null : projectId,
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onOpenChange(true)}
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Edit request</DialogTitle>
              <DialogDescription>
                The agent works from this text — after fixing it, re-run
                discovery or regenerate the PRD to pick up the changes.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
              <div className="space-y-2">
                <Label htmlFor="er-title">Title</Label>
                <Input
                  id="er-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={update.isPending}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="er-desc">Description</Label>
                <textarea
                  id="er-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  disabled={update.isPending}
                  className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="er-priority">Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v ?? "MEDIUM")}
                    disabled={update.isPending}
                  >
                    <SelectTrigger id="er-priority" className="w-full">
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
                <div className="space-y-2">
                  <Label htmlFor="er-project">Project</Label>
                  <Select
                    value={projectId}
                    onValueChange={(v) => setProjectId(v ?? NO_PROJECT)}
                    disabled={update.isPending}
                  >
                    <SelectTrigger id="er-project" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>
                        No project (Inbox)
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  update.isPending || !title.trim() || !description.trim()
                }
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
