import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { requireSession } from "@/server/auth";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Get started · ZenBuild" };

export default async function OnboardingPage() {
  const session = await requireSession("/onboarding");

  // Already has a workspace → onboarding is done; go straight to the app.
  const { onboarded } = await api.onboarding.status();
  if (onboarded) redirect("/dashboard");

  return <OnboardingFlow defaultName={session.user.name} />;
}
