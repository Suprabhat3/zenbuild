/**
 * Marketing-facing plan catalog for the onboarding UI. The *authoritative* rules
 * (which plan each account type may pick, credits granted) live server-side in
 * `@zenbuild/api` (plans.ts) and are re-validated in the `onboarding.complete`
 * mutation — this file only drives presentation.
 */

export type AccountType = "INDIVIDUAL" | "ORGANIZATION";
export type PlanTier = "FREE" | "PRO" | "TEAM";

export interface AccountOption {
  type: AccountType;
  title: string;
  description: string;
}

export const ACCOUNT_OPTIONS: AccountOption[] = [
  {
    type: "INDIVIDUAL",
    title: "Individual",
    description:
      "A personal workspace for solo builders. Just you — ship features with AI from request to release.",
  },
  {
    type: "ORGANIZATION",
    title: "Organization",
    description:
      "A shared workspace for your team. Invite teammates, assign roles, and review releases together.",
  },
];

export interface PlanCard {
  tier: PlanTier;
  name: string;
  price: string;
  per: string;
  popular?: boolean;
  features: string[];
}

export const PLANS_BY_ACCOUNT: Record<AccountType, PlanCard[]> = {
  INDIVIDUAL: [
    {
      tier: "FREE",
      name: "Starter",
      price: "₹0",
      per: "/ forever",
      features: [
        "1 personal workspace",
        "1 connected GitHub repo",
        "25 AI review credits / month",
        "PRD + task generation",
      ],
    },
    {
      tier: "PRO",
      name: "Pro",
      price: "₹999",
      per: "/ month",
      popular: true,
      features: [
        "Up to 5 connected repos",
        "200 AI review credits / month",
        "Re-review loops & readiness checks",
        "Priority email support",
      ],
    },
  ],
  ORGANIZATION: [
    {
      tier: "FREE",
      name: "Team Trial",
      price: "₹0",
      per: "/ 14 days",
      features: [
        "Up to 3 members",
        "1 connected GitHub repo",
        "25 AI review credits / month",
        "Invite your team",
      ],
    },
    {
      tier: "TEAM",
      name: "Team",
      price: "₹2,499",
      per: "/ month",
      popular: true,
      features: [
        "Unlimited members",
        "Up to 25 connected repos",
        "500 AI review credits / month",
        "Webhook automation & priority support",
      ],
    },
  ],
};
