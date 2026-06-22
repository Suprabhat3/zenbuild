"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

interface InvitationView {
  organizationName: string;
  role: string;
  email: string;
  status: string;
}

export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitationView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    authClient.organization
      .getInvitation({ query: { id: invitationId } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setLoadError(error?.message ?? "This invitation is no longer valid.");
          return;
        }
        setInvite({
          organizationName: data.organizationName,
          role: data.role,
          email: data.email,
          status: data.status,
        });
      })
      .catch(() => {
        if (active) setLoadError("This invitation is no longer valid.");
      });
    return () => {
      active = false;
    };
  }, [invitationId]);

  async function accept() {
    setWorking(true);
    const { data, error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    if (error || !data) {
      setWorking(false);
      toast.error(error?.message ?? "Could not accept the invitation.");
      return;
    }
    // Switch into the workspace we just joined, then enter the app.
    await authClient.organization.setActive({
      organizationId: data.invitation.organizationId,
    });
    toast.success("Invitation accepted.");
    router.push("/dashboard");
    router.refresh();
  }

  async function decline() {
    setWorking(true);
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    });
    if (error) {
      setWorking(false);
      toast.error(error.message ?? "Could not decline the invitation.");
      return;
    }
    toast.message("Invitation declined.");
    router.push("/dashboard");
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invitation unavailable</CardTitle>
          <CardDescription>{loadError}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!invite) {
    return (
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  const alreadyHandled = invite.status !== "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Join {invite.organizationName}</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join{" "}
          <span className="text-foreground font-medium">{invite.organizationName}</span>{" "}
          as <span className="text-foreground font-medium">{invite.role}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alreadyHandled ? (
          <p className="text-muted-foreground text-sm">
            This invitation has already been {invite.status}.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Accepting adds this workspace to your account and switches you into it.
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-3">
        {alreadyHandled ? (
          <Button className="w-full" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </Button>
        ) : (
          <>
            <Button className="flex-1" onClick={accept} disabled={working}>
              {working ? "Joining…" : "Accept invitation"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={decline}
              disabled={working}
            >
              Decline
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
