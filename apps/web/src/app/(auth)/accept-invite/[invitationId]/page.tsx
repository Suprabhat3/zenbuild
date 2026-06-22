import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInvite } from "@/components/auth/accept-invite";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/server/auth";

export const metadata: Metadata = { title: "Accept invitation · ZenBuild" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const session = await getServerSession();

  if (!session) {
    const returnTo = encodeURIComponent(`/accept-invite/${invitationId}`);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
          <CardDescription>
            Sign in or create an account to accept this workspace invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            className="w-full"
            render={<Link href={`/sign-in?redirectTo=${returnTo}`} />}
          >
            Sign in
          </Button>
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/sign-up?redirectTo=${returnTo}`} />}
          >
            Create an account
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <AcceptInvite invitationId={invitationId} />;
}
