import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GithubButton } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isGithubEnabled } from "@/server/auth-providers";
import { getServerSession } from "@/server/auth";
import { safeRedirectTarget } from "@/lib/validators/auth";

export const metadata: Metadata = { title: "Sign in · ZenBuild" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const target = safeRedirectTarget(redirectTo);

  // Already authenticated → skip the form.
  if (await getServerSession()) redirect(target);

  const githubEnabled = isGithubEnabled();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your ZenBuild workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {githubEnabled && (
          <>
            <GithubButton redirectTo={target} />
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        )}
        <SignInForm redirectTo={target} />
      </CardContent>
    </Card>
  );
}
