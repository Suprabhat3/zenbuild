import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NEXT_ACTION,
  PRIORITY_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Approvals · ZenBuild" };
export const dynamic = "force-dynamic";

type RequestRow = Awaited<ReturnType<typeof api.featureRequest.list>>[number];

/**
 * The decision inbox: one group per human gate in the pipeline, most
 * ship-critical first. Everything here is blocked until someone acts.
 */
const GATES: {
  statuses: FeatureRequestStatus[];
  title: string;
  description: string;
}[] = [
  {
    statuses: ["IN_REVIEW"],
    title: "Ship decisions",
    description:
      "AI review passed with no blocking issues — approve or reject the release.",
  },
  {
    statuses: ["APPROVED"],
    title: "Approved, not yet shipped",
    description: "Approved for release with pull requests still open to merge.",
  },
  {
    statuses: ["FIX_NEEDED"],
    title: "Blocked on fixes",
    description:
      "AI review found blocking issues — fixes must land before a re-review.",
  },
  {
    statuses: ["TASKS_READY"],
    title: "Plans awaiting approval",
    description:
      "Task plans are drafted — approve them to start development.",
  },
  {
    statuses: ["PRD_DRAFTED"],
    title: "PRDs awaiting approval",
    description: "PRD drafts are ready — review and approve to unlock planning.",
  },
];

function GateList({ rows }: { rows: RequestRow[] }) {
  return (
    <div className="app-attn-list">
      {rows.map((r) => {
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
                {PRIORITY_LABELS[r.priority] ?? r.priority} priority
                {r.project ? ` · ${r.project.name} (${r.project.key})` : ""}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <Badge variant={STATUS_BADGE_VARIANT[status]}>
                {STATUS_LABELS[status]}
              </Badge>
              {action && (
                <span className="app-attn-cta">
                  {action.label}
                  <ArrowRight className="size-3.5" />
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default async function ApprovalsPage() {
  const requests = await api.featureRequest.list();

  const gates = GATES.map((gate) => ({
    ...gate,
    rows: requests.filter((r) =>
      gate.statuses.includes(r.status as FeatureRequestStatus),
    ),
  })).filter((gate) => gate.rows.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Human gates"
        title="Approvals"
        description="Everything in the pipeline that is blocked on a human decision — PRD sign-off, plan sign-off, fixes, and the final ship call."
      />

      {gates.length === 0 ? (
        <div className="app-panel">
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing awaiting a decision"
            description="When a PRD, task plan, or release is ready for human sign-off — or a review finds blocking issues — it lands here."
            action={
              <Link
                href="/feature-requests"
                className="text-primary text-sm font-medium hover:underline"
              >
                Browse feature requests →
              </Link>
            }
          />
        </div>
      ) : (
        gates.map((gate) => (
          <Card key={gate.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {gate.title}
                <Badge variant="secondary">{gate.rows.length}</Badge>
              </CardTitle>
              <CardDescription>{gate.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <GateList rows={gate.rows} />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
