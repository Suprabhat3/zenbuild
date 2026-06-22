import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { GithubButton } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/sign-up-form";
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

export const metadata: Metadata = { title: "Sign up · ZenBuild" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const target = safeRedirectTarget(redirectTo);

  if (await getServerSession()) redirect(target);

  const githubEnabled = isGithubEnabled();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start shipping features calmly. A workspace is created for you
          automatically.
        </CardDescription>
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
        <SignUpForm redirectTo={target} />
      </CardContent>
    </Card>
  );
}
