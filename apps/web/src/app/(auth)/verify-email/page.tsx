import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getServerSession } from "@/server/auth";
import { safeRedirectTarget } from "@/lib/validators/auth";

export const metadata: Metadata = { title: "Verify your email · ZenBuild" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; redirectTo?: string }>;
}) {
  const { email, redirectTo } = await searchParams;
  const target = safeRedirectTarget(redirectTo);

  // Already signed in (and therefore verified) → nothing to do here.
  if (await getServerSession()) redirect(target);

  // No email in the URL → can't verify; bounce back to sign-in.
  if (!email) redirect("/sign-in");

  return <VerifyEmailForm email={email} redirectTo={target} />;
}
