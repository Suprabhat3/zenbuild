import type { Metadata } from "next";

import {
  DiscoveryPanel,
  type ClarificationMessageView,
} from "@/components/app/discovery-panel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type FeatureRequestStatus } from "@/lib/feature-request";
import { requireFeatureRequest } from "@/server/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Discovery · ZenBuild" };
export const dynamic = "force-dynamic";

/**
 * Discovery stage: the original request, the clarification conversation with
 * the discovery agent, and the raw intake payload. Always accessible — it is
 * where every request starts.
 */
export default async function DiscoveryStagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await requireFeatureRequest(id);
  const prd = await api.prd.get({ featureRequestId: id });
  const status = request.status as FeatureRequestStatus;

  const messages: ClarificationMessageView[] = request.clarifications.map(
    (m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as ClarificationMessageView["metadata"]) ?? null,
      createdAt: m.createdAt,
    }),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {request.description}
          </p>
        </CardContent>
      </Card>

      <DiscoveryPanel
        featureRequestId={request.id}
        status={status}
        messages={messages}
        hasPrd={Boolean(prd)}
      />

      {request.rawPayload != null && (
        <Card>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                Original intake payload
              </summary>
              <p className="text-muted-foreground mt-1 mb-2 text-xs">
                Raw payload received via the intake webhook, kept for
                traceability.
              </p>
              <pre className="app-code">
                {JSON.stringify(request.rawPayload, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
