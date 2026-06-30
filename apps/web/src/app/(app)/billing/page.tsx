import type { Metadata } from "next";

import { BillingManager } from "@/components/app/billing-manager";
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
      <header className="space-y-2">
        <h1 className="app-page-title">Billing &amp; usage</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Manage your plan, track AI credit and repository usage, and review your
          credit activity. Paid plans are billed securely through Razorpay.
        </p>
      </header>

      <BillingManager initialSummary={summary} initialLedger={ledger} />
    </div>
  );
}
