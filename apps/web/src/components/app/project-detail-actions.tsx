"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import {
  ProjectEditDialog,
  type EditableProject,
} from "@/components/app/project-edit-dialog";
import { Button } from "@/components/ui/button";

/** Header actions for the project detail page: edit + new feature request. */
export function ProjectDetailActions({ project }: { project: EditableProject }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-4" />
        Edit
      </Button>
      <Button
        className="gap-1.5"
        render={
          <Link href={`/feature-requests?new=1&projectId=${project.id}`} />
        }
      >
        <Plus className="size-4" />
        New feature request
      </Button>
      <ProjectEditDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
