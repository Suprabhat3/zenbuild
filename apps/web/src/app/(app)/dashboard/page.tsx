import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  FolderKanban,
  GitBranch,
  Inbox,
  Loader2,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Dashboard · ZenBuild" };
export const dynamic = "force-dynamic";

// Order in which to surface populated states on the dashboard.
const STATUS_ORDER: FeatureRequestStatus[] = [
  "DRAFT",
  "CLARIFYING",
  "PRD_DRAFTED",
  "PRD_APPROVED",
  "TASKS_READY",
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "FIX_NEEDED",
  "APPROVED",
  "SHIPPED",
  "REJECTED",
  "DECLINED_DUPLICATE",
];

export default async function DashboardPage() {
  let org: Awaited<ReturnType<typeof api.viewer.activeOrganization>>;
  let summary: Awaited<ReturnType<typeof api.dashboard.summary>>;
  try {
    [org, summary] = await Promise.all([
      api.viewer.activeOrganization(),
      api.dashboard.summary(),
    ]);
  } catch {
    return (
      <div className="app-panel">
        <EmptyState
          icon={AlertTriangle}
          title="We couldn't load your workspace"
          description="Something went wrong while fetching your dashboard. It's usually temporary."
          action={
            <Link
              href="/dashboard"
              className="text-primary text-sm font-medium hover:underline"
            >
              Try again
            </Link>
          }
        />
      </div>
    );
  }

  const credits = org.subscription
    ? org.subscription.reviewCreditsTotal - org.subscription.reviewCreditsUsed
    : 0;

  const stats = [
    {
      label: "Feature requests",
      value: summary.totals.featureRequests,
      icon: Inbox,
    },
    { label: "Projects", value: summary.totals.projects, icon: FolderKanban },
    { label: "Repositories", value: summary.totals.repositories, icon: GitBranch },
    { label: "Review credits", value: credits, icon: Sparkles },
  ];

  const populatedStatuses = STATUS_ORDER.filter(
    (s) => (summary.countsByStatus[s] ?? 0) > 0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={org.name}
        description={
          <>
            {org.subscription?.plan ?? "FREE"} plan · your role: {org.role}
          </>
        }
      />

      <div className="app-stat-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Feature requests by stage of the delivery loop.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {populatedStatuses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No feature requests yet.{" "}
                <Link href="/feature-requests" className="font-medium text-primary hover:underline">
                  Create your first
                </Link>{" "}
                to get started.
              </p>
            ) : (
              <div className="app-pipeline">
                {populatedStatuses.map((s) => (
                  <span key={s} className="app-pipeline-chip">
                    {STATUS_LABELS[s]}
                    <strong>{summary.countsByStatus[s]}</strong>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="size-4 text-primary" />
              In-flight workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.activeRuns.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No workflows running.
              </p>
            ) : (
              <ul className="space-y-3">
                {summary.activeRuns.map((run) => (
                  <li key={run.id} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{run.type}</span>
                      <span className="text-muted-foreground text-xs">
                        {run.progress}%
                      </span>
                    </div>
                    {run.featureRequest && (
                      <span className="text-muted-foreground text-xs">
                        {run.featureRequest.title}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul>
              {summary.recentActivity.map((log) => (
                <li key={log.id} className="app-activity-item">
                  <span>
                    <span className="font-medium">{log.actor}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {log.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
