import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRIORITY_LABELS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Approvals · ZenBuild" };
export const dynamic = "force-dynamic";

type RequestRow = Awaited<
  ReturnType<typeof api.featureRequest.list>
>[number];

function ApprovalTable({ rows }: { rows: RequestRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Decision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link
                href={`/feature-requests/${r.id}`}
                className="font-medium hover:text-primary hover:underline"
              >
                {r.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_BADGE_VARIANT[r.status as FeatureRequestStatus]}>
                {STATUS_LABELS[r.status as FeatureRequestStatus]}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {PRIORITY_LABELS[r.priority] ?? r.priority}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {r.project ? (
                <Badge variant="outline" className="font-mono">
                  {r.project.key}
                </Badge>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/feature-requests/${r.id}/release`}
                className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
              >
                Review &amp; decide
                <ArrowRight className="size-3.5" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function ApprovalsPage() {
  const requests = await api.featureRequest.list();

  const awaitingDecision = requests.filter((r) => r.status === "IN_REVIEW");
  const approvedPendingShip = requests.filter((r) => r.status === "APPROVED");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Human gate"
        title="Approvals"
        description="Feature requests that have cleared AI review and are waiting on a human release decision."
      />

      {awaitingDecision.length === 0 && approvedPendingShip.length === 0 ? (
        <div className="app-panel">
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing awaiting approval"
            description={
              <>
                When a feature request clears AI review, it lands here for the
                final human decision before it can ship.
              </>
            }
          />
        </div>
      ) : (
        <>
          {awaitingDecision.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Awaiting decision</CardTitle>
                <CardDescription>
                  Reviewed and ready for approval or rejection.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApprovalTable rows={awaitingDecision} />
              </CardContent>
            </Card>
          )}

          {approvedPendingShip.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approved, not yet shipped</CardTitle>
                <CardDescription>
                  Approved for release with pull requests still open.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApprovalTable rows={approvedPendingShip} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
