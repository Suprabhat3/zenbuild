import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  FolderKanban,
  GitBranch,
  Inbox,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  STATUS_BADGE_VARIANT,
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
      <p className="text-muted-foreground text-sm">Loading your workspace…</p>
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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground text-sm">
          {org.subscription?.plan ?? "FREE"} plan · your role: {org.role}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <Icon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
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
                <Link href="/feature-requests" className="underline">
                  Create your first
                </Link>{" "}
                to get started.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {populatedStatuses.map((s) => (
                  <Badge key={s} variant={STATUS_BADGE_VARIANT[s]}>
                    {STATUS_LABELS[s]}: {summary.countsByStatus[s]}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="size-4" />
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
            <Activity className="size-4" />
            Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activity yet.</p>
          ) : (
            <ul className="divide-y">
              {summary.recentActivity.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span>
                    <span className="font-medium">{log.actor}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
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
