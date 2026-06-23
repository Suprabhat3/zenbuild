import type { Metadata } from "next";

import { IntakeKeyCard } from "@/components/app/intake-key-card";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Intake settings · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function IntakeSettingsPage() {
  const [org, key] = await Promise.all([
    api.viewer.activeOrganization(),
    api.intakeKey.get(),
  ]);
  const canManage = org.role === "owner" || org.role === "admin";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const endpoint = `${baseUrl}/api/intake`;

  return (
    <IntakeKeyCard
      initialKey={
        key ? { token: key.token, rotatedAt: key.rotatedAt } : null
      }
      endpoint={endpoint}
      canManage={canManage}
    />
  );
}
