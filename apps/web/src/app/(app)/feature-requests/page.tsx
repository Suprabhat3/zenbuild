import type { Metadata } from "next";

import { FeatureRequestsManager } from "@/components/app/feature-requests-manager";
import {
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Feature Requests · ZenBuild" };
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(Object.keys(STATUS_LABELS));

function parseStatus(value: string | undefined): FeatureRequestStatus | undefined {
  return value && VALID_STATUSES.has(value)
    ? (value as FeatureRequestStatus)
    : undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = parseStatus(first(params.status));
  const projectIdParam = first(params.projectId);
  const openNew = first(params.new) === "1";

  const projects = await api.project.list();
  // Only filter by project ids that actually exist in the workspace, so a
  // stale or foreign id degrades to "all projects" instead of an empty page.
  const projectId = projects.some((p) => p.id === projectIdParam)
    ? projectIdParam
    : undefined;

  const requests = await api.featureRequest.list({ status, projectId });

  return (
    <FeatureRequestsManager
      requests={requests}
      projects={projects.map((p) => ({ id: p.id, name: p.name, key: p.key }))}
      activeStatus={status ?? null}
      activeProjectId={projectId ?? null}
      openCreate={openNew}
      createProjectId={projectId ?? null}
    />
  );
}
