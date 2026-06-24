import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DiscoveryPanel,
  type ClarificationMessageView,
} from "@/components/app/discovery-panel";
import { PrdView } from "@/components/app/prd-view";
import {
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Feature Request · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function FeatureRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request: Awaited<ReturnType<typeof api.featureRequest.byId>>;
  try {
    request = await api.featureRequest.byId({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const prd = await api.prd.get({ featureRequestId: id });
  const status = request.status as FeatureRequestStatus;

  const messages: ClarificationMessageView[] = request.clarifications.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    metadata: (m.metadata as ClarificationMessageView["metadata"]) ?? null,
    createdAt: m.createdAt,
  }));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-1.5" render={
        <Link href="/feature-requests" />
      }>
        <ArrowLeft className="size-4" />
        Feature requests
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {SOURCE_LABELS[request.source] ?? request.source} ·{" "}
            {PRIORITY_LABELS[request.priority] ?? request.priority} priority
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {request.title}
        </h1>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {request.requesterName && <span>From {request.requesterName}</span>}
          {request.requesterEmail && <span>{request.requesterEmail}</span>}
          {request.project && (
            <Link
              href={`/projects/${request.project.id}`}
              className="hover:underline"
            >
              Project: {request.project.name} ({request.project.key})
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{request.description}</p>
            </CardContent>
          </Card>

          <DiscoveryPanel
            featureRequestId={request.id}
            status={status}
            messages={messages}
            hasPrd={Boolean(prd)}
          />

          {prd && (
            <PrdView
              content={
                prd.content as unknown as React.ComponentProps<
                  typeof PrdView
                >["content"]
              }
              version={prd.version}
              approvedAt={prd.approvedAt}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="PRD" value={request.prd ? `v${request.prd.version}` : "—"} />
              <Separator />
              <Row label="Tasks" value={String(request._count.tasks)} />
              <Separator />
              <Row
                label="Pull requests"
                value={String(request._count.pullRequests)}
              />
              <Separator />
              <Row label="Reviews" value={String(request._count.reviews)} />
            </CardContent>
          </Card>

          {request.rawPayload != null && (
            <Card>
              <CardHeader>
                <CardTitle>Inbound payload</CardTitle>
                <CardDescription>
                  Original payload received via the intake webhook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted/40 max-h-72 overflow-auto rounded-md p-3 text-xs">
                  {JSON.stringify(request.rawPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
