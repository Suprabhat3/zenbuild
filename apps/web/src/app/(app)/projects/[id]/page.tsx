import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Inbox, GitBranch } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Project · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let project: Awaited<ReturnType<typeof api.project.byId>>;
  try {
    project = await api.project.byId({ id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const requests = await api.featureRequest.list({ projectId: id });

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="gap-1.5" render={
          <Link href="/projects" />
        }>
          <ArrowLeft className="size-4" />
          Projects
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <Badge variant="outline" className="font-mono">
          {project.key}
        </Badge>
      </div>
      {project.description && (
        <p className="text-muted-foreground max-w-2xl text-sm">
          {project.description}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Feature requests
            </CardTitle>
            <Inbox className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {project.featureRequestCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Repositories
            </CardTitle>
            <GitBranch className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {project.repositoryCount}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No feature requests in this project yet.
            </p>
          ) : (
            <ul className="divide-y">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/feature-requests/${r.id}`}
                    className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3"
                  >
                    <span className="truncate text-sm font-medium">
                      {r.title}
                    </span>
                    <Badge
                      variant={
                        STATUS_BADGE_VARIANT[r.status as FeatureRequestStatus]
                      }
                    >
                      {STATUS_LABELS[r.status as FeatureRequestStatus]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
