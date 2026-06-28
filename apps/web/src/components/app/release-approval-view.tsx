"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import {
  AC_STATUS_BADGE,
  AC_STATUS_LABELS,
  DECISION_BADGE,
  DECISION_LABELS,
  VERDICT_BADGE,
  VERDICT_LABELS,
  type AcceptanceStatus,
  type ReleaseDecisionType,
  type ReleaseReadinessView,
  type ReleaseVerdict,
} from "@/lib/release";
import { SEVERITY_BADGE, SEVERITY_LABELS, type IssueSeverity } from "@/lib/review";
import { api, type RouterOutputs } from "@/trpc/react";

type Summary = RouterOutputs["release"]["summary"];

const ACTIVE = new Set(["QUEUED", "RUNNING"]);

const TEXTAREA_CLASS =
  "border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 flex w-full rounded-lg border px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50";

export function ReleaseApprovalView({
  featureRequestId,
  canApprove,
  initialData,
}: {
  featureRequestId: string;
  canApprove: boolean;
  initialData: Summary;
}) {
  const router = useRouter();

  const summaryQuery = api.release.summary.useQuery(
    { featureRequestId },
    { initialData },
  );
  const data = summaryQuery.data ?? initialData;

  const [polling, setPolling] = useState(false);
  const statusQuery = api.release.readinessStatus.useQuery(
    { featureRequestId },
    { enabled: polling, refetchInterval: polling ? 1500 : false },
  );
  const run = statusQuery.data?.run ?? null;
  const runActive = run ? ACTIVE.has(run.status) : false;

  useEffect(() => {
    if (polling && run && !runActive) {
      if (run.status === "FAILED") {
        toast.error(run.error ?? "Release assessment failed.");
      } else if (run.status === "COMPLETED") {
        toast.success("Release assessment ready.");
      }
      setPolling(false);
      void summaryQuery.refetch();
      router.refresh();
    }
  }, [polling, run, runActive, summaryQuery, router]);

  const assess = api.release.assessReadiness.useMutation({
    onSuccess: () => {
      setPolling(true);
      toast.message("Assessing release readiness…");
    },
    onError: (e) => toast.error(e.message),
  });

  const feature = data.feature;
  const status = feature.status as FeatureRequestStatus;
  const readiness = (data.readiness?.verdict ?? null) as ReleaseReadinessView | null;
  const busy = polling && runActive;
  const isTerminal = status === "SHIPPED";

  return (
    <div className="space-y-6">
      {/* Decision banner */}
      <DecisionBanner data={data} status={status} />

      {/* Gate + actions */}
      {!isTerminal && (
        <ApprovalGate
          data={data}
          canApprove={canApprove}
          featureRequestId={featureRequestId}
          onChanged={() => {
            void summaryQuery.refetch();
            router.refresh();
          }}
        />
      )}

      {/* AI readiness */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                AI release-readiness verdict
              </CardTitle>
              <CardDescription>
                Advisory assessment of PRD coverage, acceptance criteria, and
                outstanding risks. The human approver makes the final call.
              </CardDescription>
            </div>
            {(status === "IN_REVIEW" ||
              status === "FIX_NEEDED" ||
              status === "APPROVED") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busy || assess.isPending}
                onClick={() => assess.mutate({ featureRequestId })}
              >
                {busy || assess.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {readiness ? "Re-assess" : "Assess readiness"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {busy && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              {run?.step ?? "Assessing…"}
              {typeof run?.progress === "number" && run.progress > 0 && (
                <span>· {run.progress}%</span>
              )}
            </div>
          )}

          {!readiness && !busy && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              No assessment yet. Run the AI readiness check to summarize PRD
              coverage, acceptance-criteria status, and risks before deciding.
            </p>
          )}

          {readiness && <ReadinessReport readiness={readiness} assessedAt={data.readiness?.assessedAt ?? null} />}
        </CardContent>
      </Card>

      {/* Outstanding issues */}
      <OutstandingIssues data={data} />

      {/* Pull requests */}
      <PullRequestsCard data={data} />

      {/* PRD + tasks summary */}
      <ScopeCard data={data} />
    </div>
  );
}

function DecisionBanner({
  data,
  status,
}: {
  data: Summary;
  status: FeatureRequestStatus;
}) {
  if (status === "SHIPPED") {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold">Shipped</p>
            <p className="text-muted-foreground text-sm">
              This feature was approved and shipped
              {data.decision?.createdAt &&
                ` on ${new Date(data.decision.createdAt).toLocaleString()}`}
              .
            </p>
            {data.decision?.notes && (
              <p className="text-sm">{data.decision.notes}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data.decision) return null;

  const decision = data.decision.decision as ReleaseDecisionType;
  return (
    <Card className={decision === "REJECTED" ? "border-destructive/40 bg-destructive/5" : ""}>
      <CardContent className="flex items-start gap-3 py-4">
        {decision === "REJECTED" ? (
          <XCircle className="mt-0.5 size-5 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 text-primary" />
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={DECISION_BADGE[decision]}>
              {DECISION_LABELS[decision]}
            </Badge>
            {data.decision.createdAt && (
              <span className="text-muted-foreground text-xs">
                {new Date(data.decision.createdAt).toLocaleString()}
              </span>
            )}
          </div>
          {data.decision.notes && (
            <p className="text-sm leading-relaxed">
              <span className="font-medium">
                {decision === "REJECTED" ? "Reason: " : "Notes: "}
              </span>
              {data.decision.notes}
            </p>
          )}
          {decision === "APPROVED" && status === "APPROVED" && (
            <p className="text-muted-foreground text-sm">
              Approved and awaiting merge of the remaining pull request(s) to ship.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovalGate({
  data,
  canApprove,
  featureRequestId,
  onChanged,
}: {
  data: Summary;
  canApprove: boolean;
  featureRequestId: string;
  onChanged: () => void;
}) {
  const { gate } = data;
  const status = data.feature.status as FeatureRequestStatus;
  const isApprovable = status === "IN_REVIEW" || status === "APPROVED";

  if (!isApprovable) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
          <ShieldAlert className="size-4" />
          This feature is in {STATUS_LABELS[status]}. The human-approval gate opens
          once it reaches review with no blocking issues.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" />
          Human approval gate
        </CardTitle>
        <CardDescription>
          Only an explicit human approval can ship this feature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          <GateRow ok={gate.prdApproved} label="PRD approved" />
          <GateRow
            ok={gate.noBlockingIssues}
            label="No unresolved blocking review issues"
            failLabel={`${data.openBlockingCount} blocking issue${data.openBlockingCount === 1 ? "" : "s"} outstanding`}
          />
          {data.unreviewedOpenPrs > 0 && (
            <GateRow
              ok={false}
              label="All open PRs reviewed"
              failLabel={`${data.unreviewedOpenPrs} open PR(s) not yet reviewed`}
            />
          )}
        </ul>

        {!canApprove && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4" />
            Only workspace owners and admins can approve or reject a release.
          </p>
        )}

        {canApprove && (
          <div className="flex flex-wrap gap-2">
            <ApproveDialog
              data={data}
              featureRequestId={featureRequestId}
              disabled={!gate.canApprove}
              onChanged={onChanged}
            />
            <RejectDialog
              featureRequestId={featureRequestId}
              onChanged={onChanged}
            />
          </div>
        )}

        {canApprove && !gate.canApprove && status === "IN_REVIEW" && (
          <p className="text-muted-foreground text-xs">
            Resolve the blocking items above before this feature can be approved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GateRow({
  ok,
  label,
  failLabel,
}: {
  ok: boolean;
  label: string;
  failLabel?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-primary" />
      ) : (
        <XCircle className="size-4 text-destructive" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>
        {ok ? label : (failLabel ?? label)}
      </span>
    </li>
  );
}

function ApproveDialog({
  data,
  featureRequestId,
  disabled,
  onChanged,
}: {
  data: Summary;
  featureRequestId: string;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const canMerge = data.githubConfigured && data.mergeablePrCount > 0;
  const [merge, setMerge] = useState(canMerge);
  const [method, setMethod] = useState<"merge" | "squash" | "rebase">("squash");

  const approve = api.release.approve.useMutation({
    onSuccess: (res) => {
      const failed = res.merges.filter((m) => !m.merged);
      if (res.shipped) {
        toast.success("Feature approved and shipped.");
      } else {
        toast.success("Feature approved.");
      }
      if (failed.length > 0) {
        toast.warning(
          `${failed.length} pull request(s) could not be merged automatically — merge them on GitHub to ship.`,
        );
      }
      setOpen(false);
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        className="gap-1.5"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="size-4" />
        Approve &amp; ship
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve &amp; ship</DialogTitle>
          <DialogDescription>
            Record your approval for <strong>{data.feature.title}</strong> and
            ship it. This is the final human gate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="approve-notes" className="text-sm font-medium">
              Approval notes <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Anything the team should know about this release…"
              className={TEXTAREA_CLASS}
            />
          </div>

          {data.openPrCount > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={merge}
                  disabled={!canMerge}
                  onChange={(e) => setMerge(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input accent-primary disabled:opacity-50"
                />
                <span>
                  <span className="font-medium">
                    Merge {data.mergeablePrCount} open pull request
                    {data.mergeablePrCount === 1 ? "" : "s"} on GitHub
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {data.githubConfigured
                      ? "Merges via the GitHub App. If a merge fails (conflicts, branch protection), the feature is still approved and you can merge manually."
                      : "GitHub App is not configured — merge the PR(s) manually after approving."}
                  </span>
                </span>
              </label>

              {merge && canMerge && (
                <div className="flex items-center gap-2 pl-6.5 text-sm">
                  <span className="text-muted-foreground">Merge method:</span>
                  {(["squash", "merge", "rebase"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`rounded-md border px-2 py-0.5 text-xs capitalize transition-colors ${
                        method === m
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={approve.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="gap-1.5"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate({
                featureRequestId,
                notes: notes.trim() || undefined,
                mergePullRequests: merge && canMerge,
                mergeMethod: method,
              })
            }
          >
            {approve.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GitMerge className="size-4" />
            )}
            {merge && canMerge ? "Approve, merge & ship" : "Approve & ship"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  featureRequestId,
  onChanged,
}: {
  featureRequestId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const reject = api.release.reject.useMutation({
    onSuccess: () => {
      toast.success("Sent back to the fix loop.");
      setOpen(false);
      setReason("");
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <ThumbsDown className="size-4" />
        Reject
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject release</DialogTitle>
          <DialogDescription>
            This returns the feature to <strong>Fix needed</strong> so the issues
            can be addressed and re-reviewed. A reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Reason
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="What needs to change before this can ship?"
            className={TEXTAREA_CLASS}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={reject.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="gap-1.5"
            disabled={reject.isPending || reason.trim().length === 0}
            onClick={() =>
              reject.mutate({ featureRequestId, reason: reason.trim() })
            }
          >
            {reject.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ThumbsDown className="size-4" />
            )}
            Reject &amp; send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadinessReport({
  readiness,
  assessedAt,
}: {
  readiness: ReleaseReadinessView;
  assessedAt: Date | string | null;
}) {
  const verdict = readiness.verdict as ReleaseVerdict;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={VERDICT_BADGE[verdict]}>{VERDICT_LABELS[verdict]}</Badge>
        {assessedAt && (
          <span className="text-muted-foreground text-xs">
            Assessed {new Date(assessedAt).toLocaleString()}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed">{readiness.summary}</p>

      <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
        <p className="mb-1 font-medium">PRD coverage</p>
        <p className="text-muted-foreground leading-relaxed">
          {readiness.prdCoverage}
        </p>
      </div>

      {readiness.acceptanceCriteria.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Acceptance criteria</p>
          <ul className="space-y-1.5">
            {readiness.acceptanceCriteria.map((ac, i) => {
              const acStatus = ac.status as AcceptanceStatus;
              return (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-border/80 bg-background px-3 py-2 text-sm"
                >
                  <Badge
                    variant={AC_STATUS_BADGE[acStatus]}
                    className="mt-0.5 shrink-0 text-xs"
                  >
                    {AC_STATUS_LABELS[acStatus]}
                  </Badge>
                  <span>
                    <span className="font-medium">{ac.criterion}</span>
                    {ac.evidence && (
                      <span className="text-muted-foreground block text-xs leading-relaxed">
                        {ac.evidence}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {readiness.outstandingConcerns.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Outstanding concerns</p>
          <ul className="space-y-1.5">
            {readiness.outstandingConcerns.map((c, i) => {
              const sev = c.severity as IssueSeverity;
              return (
                <li
                  key={i}
                  className="rounded-md border border-border/80 bg-background px-3 py-2 text-sm"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant={SEVERITY_BADGE[sev]} className="text-xs">
                      {SEVERITY_LABELS[sev]}
                    </Badge>
                    <span className="font-medium">{c.title}</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {c.detail}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 font-medium">
          <Sparkles className="size-3.5 text-primary" />
          Recommendation
        </p>
        <p className="leading-relaxed">{readiness.recommendation}</p>
      </div>
    </div>
  );
}

function OutstandingIssues({ data }: { data: Summary }) {
  const issues = data.pullRequests
    .filter((p) => p.status === "OPEN" && p.latestReview)
    .flatMap((p) =>
      p.latestReview!.issues
        .filter((i) => i.status === "OPEN")
        .map((i) => ({ ...i, pr: p.number, repo: p.repositoryFullName })),
    );

  if (issues.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          No outstanding review issues across the linked pull requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          Outstanding issues ({issues.length})
        </CardTitle>
        <CardDescription>
          Unresolved issues from the latest review of each open pull request.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-md border border-border/80 bg-background px-3 py-2 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant={SEVERITY_BADGE[issue.severity as IssueSeverity]}
                  className="text-xs"
                >
                  {SEVERITY_LABELS[issue.severity as IssueSeverity]}
                </Badge>
                <span className="text-muted-foreground text-xs">
                  {issue.repo} #{issue.pr}
                </span>
                {issue.filePath && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {issue.filePath}
                    {issue.line ? `:${issue.line}` : ""}
                  </span>
                )}
              </div>
              <p className="font-medium">{issue.title}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                {issue.explanation}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PullRequestsCard({ data }: { data: Summary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitPullRequest className="size-4 text-primary" />
          Pull requests ({data.pullRequests.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.pullRequests.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No pull requests are linked to this feature.
          </p>
        )}
        {data.pullRequests.map((pr) => (
          <div
            key={pr.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
          >
            <div className="space-y-0.5">
              <a
                href={pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                {pr.repositoryFullName} #{pr.number}
                <ExternalLink className="size-3.5 opacity-60" />
              </a>
              <p className="text-muted-foreground text-xs">{pr.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {pr.latestReview?.verdict && (
                <Badge variant="outline" className="text-xs">
                  v{pr.latestReview.version} ·{" "}
                  {pr.latestReview.openBlockingCount} blocking
                </Badge>
              )}
              <Badge
                variant={pr.status === "MERGED" ? "default" : "outline"}
                className="text-xs"
              >
                {pr.status}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ScopeCard({ data }: { data: Summary }) {
  const doneTasks = data.tasks.filter((t) => t.status === "DONE").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scope</CardTitle>
        <CardDescription>
          PRD {data.prd ? `v${data.prd.version}` : "—"} ·{" "}
          {doneTasks}/{data.tasks.length} tasks done
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.tasks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tasks on the plan.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                {t.status === "DONE" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <span className="text-muted-foreground inline-block size-4 shrink-0 text-center text-xs">
                    ○
                  </span>
                )}
                <span className={t.status === "DONE" ? "" : "text-muted-foreground"}>
                  {t.title}
                </span>
                <Badge variant="outline" className="ml-auto text-xs">
                  {t.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
