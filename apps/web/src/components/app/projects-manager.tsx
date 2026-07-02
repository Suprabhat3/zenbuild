"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderKanban, Pencil, Plus, Trash2, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProjectEditDialog } from "@/components/app/project-edit-dialog";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export interface ProjectRow {
  id: string;
  name: string;
  key: string;
  description: string | null;
  featureRequestCount: number;
  repositoryCount: number;
}

export function ProjectsManager({
  projects,
  canManage,
}: {
  projects: ProjectRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [editTarget, setEditTarget] = useState<ProjectRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);

  const create = api.project.create.useMutation({
    onSuccess: () => {
      toast.success("Project created.");
      setCreateOpen(false);
      setName("");
      setKey("");
      setDescription("");
      setKeyEdited(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = api.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted.");
      setDeleteTarget(null);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  // Auto-derive the key from the name until the user edits it explicitly.
  function onNameChange(value: string) {
    setName(value);
    if (!keyEdited) {
      setKey(
        value
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 10)
          .toUpperCase(),
      );
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    create.mutate({
      name: name.trim(),
      key: key.trim(),
      description: description.trim() || undefined,
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Group feature requests and repositories by product area."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      {projects.length === 0 ? (
        <div className="app-panel">
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start capturing feature requests."
            action={
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="size-4" />
                New project
              </Button>
            }
          />
        </div>
      ) : (
        <div className="app-project-grid">
          {projects.map((p) => (
            <article key={p.id} className="app-project-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-2">
                  <Link href={`/projects/${p.id}`} className="app-project-card-title">
                    {p.name}
                  </Link>
                  <Badge variant="outline" className="font-mono">
                    {p.key}
                  </Badge>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Project actions"
                        />
                      }
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => setEditTarget(p)}
                      >
                        <Pencil className="size-4" />
                        Edit project
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        className="gap-2"
                        onClick={() => setDeleteTarget(p)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="size-4" />
                        Delete project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {p.description && (
                <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
                  {p.description}
                </p>
              )}
              <div className="app-project-card-meta">
                <span>{p.featureRequestCount} requests</span>
                <span>{p.repositoryCount} repos</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                A project groups related feature requests and repositories.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Billing & Payments"
                  disabled={create.isPending}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-key">Key</Label>
                <Input
                  id="project-key"
                  value={key}
                  onChange={(e) => {
                    setKeyEdited(true);
                    setKey(e.target.value.toUpperCase());
                  }}
                  placeholder="BILL"
                  className="font-mono"
                  maxLength={10}
                  disabled={create.isPending}
                />
                <p className="text-muted-foreground text-xs">
                  2–10 letters/numbers, used to namespace work.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description (optional)</Label>
                <Input
                  id="project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this project covers"
                  disabled={create.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={create.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {editTarget && (
        <ProjectEditDialog
          project={editTarget}
          open
          onOpenChange={(next) => {
            if (!next) setEditTarget(null);
          }}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              This removes the project from the workspace and hides its feature
              requests. This action cannot be undone from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTarget) remove.mutate({ id: deleteTarget.id });
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
