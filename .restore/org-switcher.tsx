"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { CreateWorkspaceDialog } from "@/components/app/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: string;
  memberCount: number;
}

export function OrgSwitcher({
  organizations,
  activeOrgId,
}: {
  organizations: OrgSummary[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const active =
    organizations.find((o) => o.id === activeOrgId) ?? organizations[0];

  async function switchTo(orgId: string) {
    if (orgId === active.id) return;
    setSwitching(true);
    const { error } = await authClient.organization.setActive({
      organizationId: orgId,
    });
    if (error) {
      setSwitching(false);
      toast.error(error.message ?? "Could not switch workspace.");
      return;
    }
    router.refresh();
    setSwitching(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              className="h-10 w-full justify-between px-2.5"
              disabled={switching}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded">
              <Building2 className="size-3.5" />
            </span>
            <span className="truncate text-sm font-medium">{active.name}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--anchor-width) min-w-56">
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Workspaces
          </DropdownMenuLabel>
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => switchTo(org.id)}
              className="gap-2"
            >
              <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded">
                <Building2 className="size-3.5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{org.name}</span>
                <span className="text-muted-foreground text-xs">
                  {org.memberCount} member{org.memberCount === 1 ? "" : "s"} ·{" "}
                  {org.role}
                </span>
              </span>
              <Check
                className={cn(
                  "ml-auto size-4",
                  org.id === active.id ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
