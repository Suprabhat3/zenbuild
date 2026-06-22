import type { Metadata } from "next";
import { Inbox, FolderKanban, Users, Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Dashboard · ZenBuild" };

// Reads the active workspace via an org-scoped procedure, which depends on the
// session's active org — keep this dynamic.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let org: Awaited<ReturnType<typeof api.viewer.activeOrganization>> | null = null;
  try {
    org = await api.viewer.activeOrganization();
  } catch {
    // Active-org pointer is being synced (see EnsureActiveOrg). Render a calm
    // interim state; the shell will refresh momentarily.
    return (
      <p className="text-muted-foreground text-sm">Loading your workspace…</p>
    );
  }

  const credits = org.subscription
    ? org.subscription.reviewCreditsTotal - org.subscription.reviewCreditsUsed
    : 0;

  const stats = [
    { label: "Projects", value: org.projectCount, icon: FolderKanban },
    { label: "Members", value: org.memberCount, icon: Users },
    { label: "Feature requests", value: 0, icon: Inbox },
    { label: "Review credits", value: credits, icon: Sparkles },
  ];

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

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            The core delivery loop unlocks over the next phases: create a project,
            capture a feature request, and let ZenBuild draft a PRD, plan tasks,
            review the code, and ship.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
