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

  const status = request.status as FeatureRequestStatus;

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

          <Card>
            <CardHeader>
              <CardTitle>Product discovery</CardTitle>
              <CardDescription>
                The AI agent will clarify missing context and draft a PRD here.
                This unlocks in the next phase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {request.clarifications.length > 0 ? (
                <ul className="space-y-3">
                  {request.clarifications.map((m) => (
                    <li key={m.id} className="text-sm">
                      <span className="text-muted-foreground font-medium">
                        {m.role === "AGENT" ? "Agent" : "You"}:
                      </span>{" "}
                      {m.content}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No clarification yet.
                </p>
              )}
            </CardContent>
          </Card>
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
