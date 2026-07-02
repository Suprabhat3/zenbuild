import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  CheckCircle2,
  Circle,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ATTENTION_STATUSES,
  NEXT_ACTION,
  STAGE_FILTERS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Home · ZenBuild" };
export const dynamic = "force-dynamic";

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
    type
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^\w/, (c) => c.toUpperCase())
  );
}

const QUEUE_PREVIEW = 8;

export default async function HomePage() {
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
      label: "Requests",
      value: summary.totals.featureRequests,
      icon: Inbox,
      href: "/requests",
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

  // The absorbed Approvals inbox: everything blocked on a human decision,
  // most ship-critical first.
  const needsDecision = ATTENTION_STATUSES.flatMap((status) =>
    requests.filter((r) => r.status === status),
  );
  const queuePreview = needsDecision.slice(0, QUEUE_PREVIEW);

  // Pipeline overview: requests per stage bucket (closed shown only when
  // non-empty).
  const stageRows = STAGE_FILTERS.map((f) => ({
    ...f,
    count: f.statuses.reduce(
      (sum, s) => sum + (summary.countsByStatus[s] ?? 0),
      0,
    ),
  })).filter((row) => row.key !== "closed" || row.count > 0);

  // First run: teach the loop instead of showing empty modules.
  if (summary.totals.featureRequests === 0) {
    const steps = [
      {
        label: "Create a project",
        done: summary.totals.projects > 0,
        href: "/projects",
        hint: "Projects group requests and hold the repo connection.",
      },
      {
        label: "Connect a GitHub repository",
        done: summary.totals.repositories > 0,
        href: "/settings/integrations",
        hint: "The coding agent implements tasks and opens PRs there.",
      },
      {
        label: "Submit your first request",
        done: false,
        href: "/requests?new=1",
        hint: "Then follow it through discovery → PRD → plan → build → review → ship.",
      },
    ];
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Home"
          title={org.name}
          description={
            <>
              {org.subscription?.plan ?? "FREE"} plan · your role: {org.role}
            </>
          }
          actions={
            <Button render={<Link href="/requests?new=1" />}>
              <Plus className="size-4" />
              New request
            </Button>
          }
        />
        <Card>
          <CardHeader>
            <CardTitle>Welcome to ZenBuild</CardTitle>
            <CardDescription>
              AI does the work; you own the decisions. Three steps to your
              first shipped feature:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.map((step, i) => (
                <li key={step.label} className="flex items-start gap-3">
                  {step.done ? (
                    <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
                  ) : (
                    <Circle className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                  )}
                  <span>
                    <Link
                      href={step.href}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {i + 1}. {step.label}
                    </Link>
                    <span className="text-muted-foreground block text-sm">
                      {step.hint}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Home"
        title={org.name}
        description={
          <>
            {org.subscription?.plan ?? "FREE"} plan · your role: {org.role}
          </>
        }
        actions={
          <Button render={<Link href="/requests?new=1" />}>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCheck className="size-4 text-primary" />
                Needs your decision
              </CardTitle>
              <CardDescription>
                Requests blocked on a human — approvals, ship calls, and fixes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queuePreview.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nothing is waiting on you right now. PRD approvals, plan
                  approvals, fixes, and ship decisions land here.
                </p>
              ) : (
                <>
                  <div className="app-attn-list">
                    {queuePreview.map((r) => {
                      const status = r.status as FeatureRequestStatus;
                      const action = NEXT_ACTION[status];
                      return (
                        <Link
                          key={r.id}
                          href={action?.href(r.id) ?? `/requests/${r.id}`}
                          className="app-attn-item"
                        >
                          <span className="min-w-0">
                            <span className="app-attn-title">{r.title}</span>
                            <span className="app-attn-sub block">
                              <Badge
                                variant={STATUS_BADGE_VARIANT[status]}
                                className="mr-1.5 align-middle"
                              >
                                {STATUS_LABELS[status]}
                              </Badge>
                              {r.project ? r.project.key : ""}
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
                  {needsDecision.length > queuePreview.length && (
                    <Link
                      href="/requests?attention=1"
                      className="text-primary mt-3 inline-block text-sm font-medium hover:underline"
                    >
                      See all {needsDecision.length} →
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No activity yet.
                </p>
              ) : (
                <ul>
                  {summary.recentActivity.map((log) => (
                    <li key={log.id} className="app-activity-item">
                      <span>
                        <span className="font-medium">{log.actor}</span>{" "}
                        <span className="text-muted-foreground">
                          {log.action}
                        </span>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
              <CardDescription>
                Requests by stage — click through to the filtered list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul>
                {stageRows.map((row) => (
                  <li key={row.key}>
                    <Link
                      href={`/requests?stage=${row.key}`}
                      className="app-attn-item"
                    >
                      <span className="app-attn-title">{row.label}</span>
                      <span className="app-pipeline-chip">
                        <strong>{row.count}</strong>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="size-4 text-primary" />
                In flight
              </CardTitle>
              <CardDescription>AI workflows running right now.</CardDescription>
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
                          href={`/requests/${run.featureRequest.id}`}
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
      </div>
    </div>
  );
}
