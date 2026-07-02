"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ORG_ROLES,
  ORG_ROLE_LABELS,
  ORG_ROLE_VALUES,
  type OrgRole,
} from "@zenbuild/auth/client";

import { PageHeader } from "@/components/app/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { authClient } from "@/lib/auth-client";

export interface MemberRow {
  id: string;
  role: string;
  createdAt: string;
  isSelf: boolean;
  user: { id: string; name: string; email: string; image: string | null };
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: string;
}

function initials(name: string, email: string): string {
  const base = name.trim() || email;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

function roleLabel(role: string): string {
  return ORG_ROLE_LABELS[role as OrgRole] ?? role;
}

export function MembersManager({
  organizationId,
  canManage,
  members,
  invitations,
}: {
  organizationId: string;
  canManage: boolean;
  members: MemberRow[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>(ORG_ROLES.MEMBER);
  const [busy, setBusy] = useState(false);

  async function sendInvite(event: React.FormEvent) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter an email address.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.organization.inviteMember({
      email,
      role: inviteRole,
      organizationId,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message ?? "Could not send the invitation.");
      return;
    }
    toast.success(`Invitation sent to ${email}.`);
    setBusy(false);
    setInviteEmail("");
    setInviteRole(ORG_ROLES.MEMBER);
    setInviteOpen(false);
    router.refresh();
  }

  async function changeRole(memberId: string, role: OrgRole) {
    setBusy(true);
    const { error } = await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not update the role.");
    } else {
      toast.success("Role updated.");
      router.refresh();
    }
    setBusy(false);
  }

  async function removeMember(memberId: string) {
    setBusy(true);
    const { error } = await authClient.organization.removeMember({
      memberIdOrEmail: memberId,
      organizationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not remove the member.");
    } else {
      toast.success("Member removed.");
      router.refresh();
    }
    setBusy(false);
  }

  async function cancelInvite(invitationId: string) {
    setBusy(true);
    const { error } = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (error) {
      toast.error(error.message ?? "Could not cancel the invitation.");
    } else {
      toast.success("Invitation cancelled.");
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Members"
        description="People with access to this workspace, and pending invitations."
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)} className="gap-1.5">
              <UserPlus className="size-4" />
              Invite member
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            People with access to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const isOwner = m.role === ORG_ROLES.OWNER;
                // Owners can't be edited/removed from the UI (protects the last
                // owner); members manage everyone else.
                const editable = canManage && !m.isSelf && !isOwner;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {m.user.image && (
                            <AvatarImage src={m.user.image} alt={m.user.name} />
                          )}
                          <AvatarFallback className="text-xs">
                            {initials(m.user.name, m.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">
                              {m.user.name}
                            </span>
                            {m.isSelf && (
                              <Badge variant="secondary" className="text-[10px]">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-muted-foreground truncate text-xs">
                            {m.user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole(m.id, v as OrgRole)}
                          disabled={busy}
                        >
                          <SelectTrigger size="sm" className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ORG_ROLE_VALUES.filter(
                              (r) => r !== ORG_ROLES.OWNER,
                            ).map((r) => (
                              <SelectItem key={r} value={r}>
                                {roleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{roleLabel(m.role)}</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {editable && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Member actions"
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                className="gap-2"
                                onClick={() => removeMember(m.id)}
                                disabled={busy}
                              >
                                <Trash2 className="size-4" />
                                Remove from workspace
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(invitations.length > 0 || canManage) && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Invitations that haven&apos;t been accepted yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No pending invitations.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited by</TableHead>
                    {canManage && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{roleLabel(inv.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {inv.invitedBy}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Cancel invitation"
                            onClick={() => cancelInvite(inv.id)}
                            disabled={busy}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form onSubmit={sendInvite}>
            <DialogHeader>
              <DialogTitle>Invite a teammate</DialogTitle>
              <DialogDescription>
                They&apos;ll receive a link to join this workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={busy}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as OrgRole)}
                  disabled={busy}
                >
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_ROLE_VALUES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
