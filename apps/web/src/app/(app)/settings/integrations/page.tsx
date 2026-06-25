import type { Metadata } from "next";

import { GithubIntegrationCard } from "@/components/app/github-integration-card";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Integrations · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function IntegrationsSettingsPage() {
  const [org, status] = await Promise.all([
    api.viewer.activeOrganization(),
    api.github.status(),
  ]);
  const canManage = org.role === "owner" || org.role === "admin";

  return <GithubIntegrationCard initialStatus={status} canManage={canManage} />;
}
