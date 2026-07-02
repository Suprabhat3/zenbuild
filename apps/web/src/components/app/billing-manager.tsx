"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  CreditCard,
  Loader2,
  Receipt,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  creditReasonLabel,
  formatInr,
  formatLimit,
  PLAN_NAMES,
  PLAN_TAGLINES,
  statusBadgeVariant,
  SUBSCRIPTION_STATUS_LABELS,
  type PlanTier,
  type SubscriptionStatus,
} from "@/lib/billing";
import { openRazorpayCheckout } from "@/lib/razorpay-checkout";
import { api, type RouterOutputs } from "@/trpc/react";

type Summary = RouterOutputs["billing"]["summary"];
type Ledger = RouterOutputs["billing"]["ledger"];
type PlanView = Summary["plans"][number];

const PLAN_ORDER: Record<PlanTier, number> = { FREE: 0, PRO: 1, TEAM: 2 };

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const danger = pct >= 90;
  return (
    <div
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div
        className={`h-full rounded-full transition-all ${
          danger ? "bg-destructive" : "bg-primary"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Labeled usage meter — bar when the limit is finite, plain count otherwise. */
function MeterRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {used} / {formatLimit(limit)}
        </span>
      </div>
      {limit !== null && <UsageBar used={used} total={limit} />}
    </div>
  );
}

function FeatureRow({ label, included }: { label: string; included: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Check
        className={`size-4 shrink-0 ${
          included ? "text-primary" : "text-muted-foreground/30"
        }`}
      />
      <span className={included ? "" : "text-muted-foreground line-through"}>
        {label}
      </span>
    </li>
  );
}

function planFeatureLines(plan: PlanView): { label: string; included: boolean }[] {
  return [
    { label: `${plan.monthlyCredits} AI credits / month`, included: true },
    {
      label: `${formatLimit(plan.repoLimit)} connected ${
        plan.repoLimit === 1 ? "repository" : "repositories"
      }`,
      included: true,
    },
    {
      label:
        plan.seatLimit === null
          ? "Unlimited members"
          : `Up to ${plan.seatLimit} ${plan.seatLimit === 1 ? "member" : "members"}`,
      included: true,
    },
    { label: "AI release-readiness checks", included: plan.features.releaseReadiness },
    { label: "Priority support", included: plan.features.prioritySupport },
  ];
}

export function BillingManager({
  initialSummary,
  initialLedger,
}: {
  initialSummary: Summary;
  initialLedger: Ledger;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const summaryQuery = api.billing.summary.useQuery(undefined, {
    initialData: initialSummary,
    refetchOnMount: false,
  });
  const ledgerQuery = api.billing.ledger.useQuery(
    { limit: 25 },
    { initialData: initialLedger, refetchOnMount: false },
  );

  const summary = summaryQuery.data ?? initialSummary;
  const ledger = ledgerQuery.data ?? initialLedger;

  const canManage = summary.role === "owner" || summary.role === "admin";
  const currentPlan = summary.subscription.plan as PlanTier;
  const status = summary.subscription.status as SubscriptionStatus;

  const [pendingTier, setPendingTier] = useState<PlanTier | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const verifyPayment = api.billing.verifyPayment.useMutation();
  const createSubscription = api.billing.createSubscription.useMutation();
  const cancel = api.billing.cancel.useMutation();

  async function refresh() {
    await Promise.all([utils.billing.summary.invalidate(), utils.viewer.activeOrganization.invalidate()]);
    router.refresh();
  }

  async function handleUpgrade(tier: PlanTier) {
    setPendingTier(tier);
    try {
      const checkout = await createSubscription.mutateAsync({ plan: tier });
      if (!checkout.keyId) {
        throw new Error("Razorpay key is not configured.");
      }
      const success = await openRazorpayCheckout({
        keyId: checkout.keyId,
        subscriptionId: checkout.subscriptionId,
        planLabel: PLAN_NAMES[tier],
        prefill: {
          name: checkout.customerName ?? undefined,
          email: checkout.customerEmail ?? undefined,
        },
      });
      await verifyPayment.mutateAsync({
        plan: tier,
        razorpayPaymentId: success.razorpay_payment_id,
        razorpaySubscriptionId: success.razorpay_subscription_id,
        signature: success.razorpay_signature,
      });
      toast.success(`You're now on the ${PLAN_NAMES[tier]} plan.`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed.";
      // A user-cancelled modal isn't an error worth shouting about.
      if (message === "Checkout cancelled.") {
        toast.message("Checkout cancelled.");
      } else {
        toast.error(message);
      }
    } finally {
      setPendingTier(null);
    }
  }

  async function handleCancel() {
    try {
      await cancel.mutateAsync({ immediate: false });
      toast.success("Subscription will cancel at the end of the billing period.");
      setCancelOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel subscription.");
    }
  }

  const credits = summary.usage.credits;
  const repos = summary.usage.repos;
  const seats = summary.usage.seats;
  const lowCredits = credits.remaining <= Math.max(2, Math.ceil(credits.total * 0.1));

  return (
    <div className="space-y-8">
      {/* Razorpay-unconfigured notice */}
      {!summary.configured && (
        <div className="text-muted-foreground rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm">
          Payments aren&apos;t configured on this deployment yet — the Free plan is
          fully usable. Set the{" "}
          <code className="font-mono text-xs">RAZORPAY_*</code> environment
          variables (and plan ids) to enable paid upgrades.
        </div>
      )}

      {/* Current plan + usage */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-(family-name:--font-display) text-xl font-normal tracking-tight">
                  <CreditCard className="size-4 text-primary" />
                  {PLAN_NAMES[currentPlan]} plan
                </CardTitle>
                <CardDescription className="mt-1">
                  {PLAN_TAGLINES[currentPlan]}
                </CardDescription>
              </div>
              <Badge variant={statusBadgeVariant(status)}>
                {SUBSCRIPTION_STATUS_LABELS[status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="font-(family-name:--font-display) text-3xl tracking-tight">
                {formatInr(summary.currentPlan.priceInInr)}
              </span>
              {summary.currentPlan.priceInInr > 0 && (
                <span className="text-muted-foreground">/ month</span>
              )}
            </div>
            {summary.subscription.currentPeriodEnd && (
              <p className="text-muted-foreground">
                {status === "CANCELLED" ? "Access until" : "Renews"}{" "}
                {new Date(summary.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </CardContent>
          {canManage && summary.subscription.hasRazorpaySubscription && status !== "CANCELLED" && (
            <CardFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
                disabled={cancel.isPending}
              >
                Cancel subscription
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">This month&apos;s usage</CardTitle>
            <CardDescription>
              Credits reset each billing period; repos and seats are live counts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">AI credits</span>
                <span className="text-muted-foreground">
                  {credits.used} / {credits.total} used
                </span>
              </div>
              <UsageBar used={credits.used} total={credits.total} />
              {lowCredits && (
                <p className="text-destructive flex items-center gap-1 text-xs">
                  <TriangleAlert className="size-3" />
                  {credits.remaining} credits left — consider upgrading.
                </p>
              )}
            </div>
            <MeterRow
              label="Connected repos"
              used={repos.used}
              limit={repos.limit}
            />
            <MeterRow label="Members" used={seats.used} limit={seats.limit} />
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison */}
      <section className="space-y-4">
        <div>
          <h2 className="font-(family-name:--font-display) text-xl tracking-tight">
            Plans
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Change plans anytime — upgrades take effect immediately.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...summary.plans]
            .sort((a, b) => PLAN_ORDER[a.tier] - PLAN_ORDER[b.tier])
            .map((plan) => {
              const isCurrent = plan.tier === currentPlan;
              const isUpgrade = PLAN_ORDER[plan.tier] > PLAN_ORDER[currentPlan];
              const busy = pendingTier === plan.tier;
              const canCheckout =
                canManage && plan.tier !== "FREE" && plan.available && summary.configured;

              return (
                <Card
                  key={plan.tier}
                  className={isCurrent ? "border-primary ring-1 ring-primary/30" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 font-(family-name:--font-display) text-xl font-normal tracking-tight">
                        {plan.tier !== "FREE" && (
                          <Sparkles className="size-4 text-primary" />
                        )}
                        {PLAN_NAMES[plan.tier]}
                      </CardTitle>
                      {isCurrent && <Badge>Current plan</Badge>}
                    </div>
                    <CardDescription>{PLAN_TAGLINES[plan.tier]}</CardDescription>
                    <div className="flex items-baseline gap-1.5 pt-1">
                      <span className="font-(family-name:--font-display) text-3xl tracking-tight">
                        {formatInr(plan.priceInInr)}
                      </span>
                      {plan.priceInInr > 0 && (
                        <span className="text-muted-foreground text-sm">/ mo</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {planFeatureLines(plan).map((f) => (
                        <FeatureRow key={f.label} label={f.label} included={f.included} />
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current plan
                      </Button>
                    ) : plan.tier === "FREE" ? (
                      <Button variant="outline" className="w-full" disabled>
                        Included
                      </Button>
                    ) : !plan.available ? (
                      <Button variant="outline" className="w-full" disabled>
                        Unavailable
                      </Button>
                    ) : (
                      <Button
                        className="w-full gap-1.5"
                        variant={isUpgrade ? "default" : "outline"}
                        disabled={!canCheckout || busy || pendingTier !== null}
                        onClick={() => handleUpgrade(plan.tier)}
                      >
                        {busy && <Loader2 className="size-4 animate-spin" />}
                        {isUpgrade ? `Upgrade to ${PLAN_NAMES[plan.tier]}` : "Switch"}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
        </div>
        {!canManage && (
          <p className="text-muted-foreground text-sm">
            Only workspace owners and admins can change the plan.
          </p>
        )}
      </section>

      {/* Credit activity */}
      <section className="space-y-4">
        <div>
          <h2 className="font-(family-name:--font-display) text-xl tracking-tight">
            Credit activity
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Every credit granted and spent in this workspace.
          </p>
        </div>
        {ledger.length === 0 ? (
          <Card>
            <EmptyState
              icon={Receipt}
              title="No credit activity yet"
              description="Credits granted by your plan and spent on AI runs will appear here."
            />
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {creditReasonLabel(entry.reason)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        entry.delta < 0 ? "text-muted-foreground" : "text-primary"
                      }`}
                    >
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.balance}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      {/* Cancel confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel subscription?</DialogTitle>
            <DialogDescription>
              Your {PLAN_NAMES[currentPlan]} plan stays active until the end of the
              current billing period, then your workspace drops to the Free plan.
              You can re-subscribe anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep plan
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancel.isPending}
            >
              {cancel.isPending && <Loader2 className="size-4 animate-spin" />}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
