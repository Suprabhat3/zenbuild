import type { Metadata } from "next";

import { BillingManager } from "@/components/app/billing-manager";
import { PageHeader } from "@/components/app/page-header";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Billing · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const [summary, ledger] = await Promise.all([
    api.billing.summary(),
    api.billing.ledger({ limit: 25 }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Billing & plan"
        description="Manage your plan, track AI credit and repository usage, and review your credit activity. Paid plans are billed securely through Razorpay."
      />

      <BillingManager initialSummary={summary} initialLedger={ledger} />
    </div>
  );
}
