import { redirect } from "next/navigation";

import {
  stageSlugForStatus,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";

export const dynamic = "force-dynamic";

/**
 * The workspace root has no surface of its own: it forwards to the stage tab
 * for the request's *current* pipeline stage, so opening a request always
 * lands on the thing that matters right now.
 */
export default async function FeatureRequestIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const slug = stageSlugForStatus(request.status as FeatureRequestStatus);
  redirect(`/requests/${id}/${slug}`);
}
