import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Inbox, GitBranch, Plus } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProjectDetailActions } from "@/components/app/project-detail-actions";
import { RepoConnectCard } from "@/components/app/repo-connect-card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
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

  const [requests, repos, org] = await Promise.all([
    api.featureRequest.list({ projectId: id }),
    api.github.repositories({ projectId: id }),
    api.viewer.activeOrganization(),
  ]);
  const canManageRepos = org.role === "owner" || org.role === "admin";

  return (
    <div className="space-y-8">
      <Link href="/projects" className="app-back-link">
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      <PageHeader
        eyebrow="Project"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {project.name}
            <Badge variant="outline" className="font-mono text-base">
              {project.key}
            </Badge>
          </span>
        }
        description={project.description ?? undefined}
        actions={
          <ProjectDetailActions
            project={{
              id: project.id,
              name: project.name,
              description: project.description,
            }}
          />
        }
      />

      <div className="app-stat-grid sm:grid-cols-2 lg:grid-cols-2">
        <StatCard
          label="Requests"
          value={project.featureRequestCount}
          icon={Inbox}
          href={`/requests?projectId=${id}`}
        />
        <StatCard
          label="Repositories"
          value={project.repositoryCount}
          icon={GitBranch}
        />
      </div>

      <RepoConnectCard
        projectId={id}
        initialRepos={repos}
        canManage={canManageRepos}
      />

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No feature requests yet"
              description="Capture the first request for this project to kick off the delivery loop."
              action={
                <Button
                  className="gap-1.5"
                  render={
                    <Link href={`/requests?new=1&projectId=${id}`} />
                  }
                >
                  <Plus className="size-4" />
                  New request
                </Button>
              }
            />
          ) : (
            <>
              <ul>
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="hover:bg-muted/40 -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors"
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
              <Link
                href={`/requests?projectId=${id}`}
                className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
              >
                Open in Requests →
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
