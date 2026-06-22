"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

import { CreateWorkspaceDialog } from "@/components/app/create-workspace-dialog";
import { Button } from "@/components/ui/button";

/** Shown when a user somehow has no workspace — lets them create their first. */
export function FirstWorkspace() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-muted/30 flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
        <Building2 className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">Create your first workspace</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Workspaces hold your projects, feature requests, and billing. You can
          create more and switch between them at any time.
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>Create workspace</Button>
      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
