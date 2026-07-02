import type { Metadata } from "next";

import { FeatureRequestsManager } from "@/components/app/requests-manager";
import {
  ATTENTION_STATUSES,
  STAGE_FILTERS,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Requests · ZenBuild" };
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(Object.keys(STATUS_LABELS));

function parseStatus(
  value: string | undefined,
): FeatureRequestStatus | undefined {
  return value && VALID_STATUSES.has(value)
    ? (value as FeatureRequestStatus)
    : undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // `?status=` (exact, legacy deep links) still works; the filter UI speaks
  // pipeline stages (`?stage=`) plus the `?attention=1` decision-queue toggle.
  const status = parseStatus(first(params.status));
  const stageParam = first(params.stage);
  const stage = STAGE_FILTERS.find((f) => f.key === stageParam) ?? null;
  const attention = first(params.attention) === "1";
  const projectIdParam = first(params.projectId);
  const openNew = first(params.new) === "1";

  const projects = await api.project.list();
  // Only filter by project ids that actually exist in the workspace, so a
  // stale or foreign id degrades to "all projects" instead of an empty page.
  const projectId = projects.some((p) => p.id === projectIdParam)
    ? projectIdParam
    : undefined;

  const fetched = await api.featureRequest.list({ status, projectId });

  // Stage/attention are org-local groupings over the status enum, filtered
  // here rather than in the API (no backend changes in the redesign).
  const requests = fetched.filter((r) => {
    const s = r.status as FeatureRequestStatus;
    if (stage && !stage.statuses.includes(s)) return false;
    if (attention && !ATTENTION_STATUSES.includes(s)) return false;
    return true;
  });

  return (
    <FeatureRequestsManager
      requests={requests}
      projects={projects.map((p) => ({ id: p.id, name: p.name, key: p.key }))}
      activeStage={stage?.key ?? null}
      attention={attention}
      activeProjectId={projectId ?? null}
      openCreate={openNew}
      createProjectId={projectId ?? null}
    />
  );
}
