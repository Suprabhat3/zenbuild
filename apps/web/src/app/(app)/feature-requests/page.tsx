import type { Metadata } from "next";

import { FeatureRequestsManager } from "@/components/app/feature-requests-manager";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Feature Requests · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function FeatureRequestsPage() {
  const [requests, projects] = await Promise.all([
    api.featureRequest.list(),
    api.project.list(),
  ]);

  return (
    <FeatureRequestsManager
      requests={requests}
      projects={projects.map((p) => ({ id: p.id, name: p.name, key: p.key }))}
    />
  );
}
