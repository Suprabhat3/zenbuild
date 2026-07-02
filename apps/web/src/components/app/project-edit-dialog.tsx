"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { api } from "@/trpc/react";

export interface EditableProject {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Controlled dialog for renaming a project / editing its description.
 * Used from the projects grid (per-card dropdown) and the project detail page.
 */
export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
}: {
  project: EditableProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");

  // Re-seed the form whenever the dialog opens (or targets another project),
  // so stale edits from a cancelled session don't leak through.
  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [open, project.id, project.name, project.description]);

  const update = api.project.update.useMutation({
    onSuccess: () => {
      toast.success("Project updated.");
      onOpenChange(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const trimmedName = name.trim();
  const nameInvalid = trimmedName.length < 2 || trimmedName.length > 80;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (nameInvalid) {
      toast.error("Project name must be 2–80 characters.");
      return;
    }
    update.mutate({
      id: project.id,
      name: trimmedName,
      // Always send the (possibly empty) description so clearing it sticks —
      // the router treats `undefined` as "leave unchanged".
      description: description.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Rename the project or update its description. The key cannot be
              changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-edit-name">Name</Label>
              <Input
                id="project-edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Billing & Payments"
                maxLength={80}
                disabled={update.isPending}
                autoFocus
              />
              <p className="text-muted-foreground text-xs">2–80 characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-edit-desc">Description (optional)</Label>
              <Input
                id="project-edit-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this project covers"
                disabled={update.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || nameInvalid}>
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
