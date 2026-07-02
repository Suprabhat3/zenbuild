import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  FolderKanban,
  GitBranch,
  Inbox,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NEXT_ACTION,
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

/** Statuses that are blocked on a human decision, most urgent first. */
const ATTENTION_ORDER: FeatureRequestStatus[] = [
  "FIX_NEEDED",
  "IN_REVIEW",
  "APPROVED",
  "TASKS_READY",
  "PRD_DRAFTED",
];

/** Human labels for WorkflowRun.type — never show raw enum values. */
const RUN_TYPE_LABELS: Record<string, string> = {
  CLARIFY: "Discovery",
  PRD_GENERATE: "PRD generation",
  TASKS_GENERATE: "Task planning",
  REPO_ANALYZE: "Repository analysis",
  TASK_IMPLEMENT: "Coding agent",
  PR_REVIEW: "AI code review",
  RELEASE_READINESS: "Release readiness",
};

function runTypeLabel(type: string) {
  return (
    RUN_TYPE_LABELS[type] ??
    type.toLowerCase().replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export default async function DashboardPage() {
  let org: Awaited<ReturnType<typeof api.viewer.activeOrganization>>;
  let summary: Awaited<ReturnType<typeof api.dashboard.summary>>;
  let requests: Awaited<ReturnType<typeof api.featureRequest.list>>;
  try {
    [org, summary, requests] = await Promise.all([
      api.viewer.activeOrganization(),
      api.dashboard.summary(),
      api.featureRequest.list(),
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
      href: "/feature-requests",
    },
    {
      label: "Projects",
      value: summary.totals.projects,
      icon: FolderKanban,
      href: "/projects",
    },
    {
      label: "Repositories",
      value: summary.totals.repositories,
      icon: GitBranch,
      href: "/settings/integrations",
    },
    {
      label: "Review credits",
      value: credits,
      icon: Sparkles,
      href: "/billing",
    },
  ];

  const populatedStatuses = STATUS_ORDER.filter(
    (s) => (summary.countsByStatus[s] ?? 0) > 0,
  );

  // Requests blocked on a human decision, most urgent stage first.
  const needsAttention = ATTENTION_ORDER.flatMap((status) =>
    requests.filter((r) => r.status === status),
  );
  const attentionPreview = needsAttention.slice(0, 6);

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
        actions={
          <Button render={<Link href="/feature-requests?new=1" />}>
            <Plus className="size-4" />
            New request
          </Button>
        }
      />

      <div className="app-stat-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            href={stat.href}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCheck className="size-4 text-primary" />
            Needs your attention
          </CardTitle>
          <CardDescription>
            Requests waiting on a decision or a fix from your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attentionPreview.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing is waiting on you right now. New requests, PRD approvals,
              plan approvals, and ship decisions will show up here.
            </p>
          ) : (
            <>
              <div className="app-attn-list">
                {attentionPreview.map((r) => {
                  const status = r.status as FeatureRequestStatus;
                  const action = NEXT_ACTION[status];
                  return (
                    <Link
                      key={r.id}
                      href={action?.href(r.id) ?? `/feature-requests/${r.id}`}
                      className="app-attn-item"
                    >
                      <span className="min-w-0">
                        <span className="app-attn-title">{r.title}</span>
                        <span className="app-attn-sub block">
                          {STATUS_LABELS[status]}
                          {r.project ? ` · ${r.project.key}` : ""}
                        </span>
                      </span>
                      {action && (
                        <span className="app-attn-cta">
                          {action.label}
                          <ArrowRight className="size-3.5" />
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
              {needsAttention.length > attentionPreview.length && (
                <Link
                  href="/approvals"
                  className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
                >
                  See all {needsAttention.length} in Approvals →
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Feature requests by stage — click a stage to see its requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {populatedStatuses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No feature requests yet.{" "}
                <Link
                  href="/feature-requests?new=1"
                  className="font-medium text-primary hover:underline"
                >
                  Create your first
                </Link>{" "}
                to get started.
              </p>
            ) : (
              <div className="app-pipeline">
                {populatedStatuses.map((s) => (
                  <Link
                    key={s}
                    href={`/feature-requests?status=${s}`}
                    className="app-pipeline-chip"
                  >
                    {STATUS_LABELS[s]}
                    <strong>{summary.countsByStatus[s]}</strong>
                  </Link>
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
                      <span className="font-medium">
                        {runTypeLabel(run.type)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {run.progress}%
                      </span>
                    </div>
                    {run.featureRequest && (
                      <Link
                        href={`/feature-requests/${run.featureRequest.id}`}
                        className="text-muted-foreground hover:text-primary text-xs hover:underline"
                      >
                        {run.featureRequest.title}
                      </Link>
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
