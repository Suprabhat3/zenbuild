"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function GeneralSettingsForm({
  organizationId,
  initialName,
  slug,
  canEdit,
}: {
  organizationId: string;
  initialName: string;
  slug: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== initialName && name.trim().length > 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setSaving(true);
    const { error } = await authClient.organization.update({
      organizationId,
      data: { name: name.trim() },
    });
    if (error) {
      setSaving(false);
      toast.error(error.message ?? "Could not update the workspace.");
      return;
    }
    toast.success("Workspace updated.");
    setSaving(false);
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit}>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            {canEdit
              ? "Update your workspace name. The URL slug is fixed."
              : "Only owners and admins can change workspace settings."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">URL slug</Label>
            <Input id="org-slug" value={slug} disabled readOnly />
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
