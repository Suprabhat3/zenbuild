"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { MoreHorizontal } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Group feature requests and repositories by product area.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New project
        </Button>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FolderKanban className="text-muted-foreground size-8" />
            <div className="space-y-1">
              <p className="font-medium">No projects yet</p>
              <p className="text-muted-foreground text-sm">
                Create your first project to start capturing feature requests.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              New project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="relative">
              <CardHeader className="space-y-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <CardTitle className="truncate">
                      <Link
                        href={`/projects/${p.id}`}
                        className="hover:underline"
                      >
                        {p.name}
                      </Link>
                    </CardTitle>
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
                          variant="destructive"
                          className="gap-2"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${p.name}"? Its feature requests are kept but unlinked.`,
                              )
                            ) {
                              remove.mutate({ id: p.id });
                            }
                          }}
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
                  <CardDescription className="line-clamp-2 pt-2">
                    {p.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="text-muted-foreground flex gap-4 text-sm">
                <span>{p.featureRequestCount} requests</span>
                <span>{p.repositoryCount} repos</span>
              </CardContent>
            </Card>
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
    </div>
  );
}
