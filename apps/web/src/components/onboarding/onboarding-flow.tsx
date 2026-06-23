"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, User } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  ACCOUNT_OPTIONS,
  PLANS_BY_ACCOUNT,
  type AccountType,
  type PlanTier,
} from "@/lib/plans";
import { api } from "@/trpc/react";

const ICONS: Record<AccountType, typeof User> = {
  INDIVIDUAL: User,
  ORGANIZATION: Building2,
};

/** Default plan for a freshly-picked account type (prefer the popular one). */
function defaultPlan(accountType: AccountType): PlanTier {
  const plans = PLANS_BY_ACCOUNT[accountType];
  return (plans.find((p) => p.popular) ?? plans[0]).tier;
}

export function OnboardingFlow({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [plan, setPlan] = useState<PlanTier>("FREE");

  const complete = api.onboarding.complete.useMutation({
    onSuccess: async (data) => {
      // Make the new workspace the active org for this session, then enter it.
      await authClient.organization.setActive({
        organizationId: data.organizationId,
      });
      toast.success("Your workspace is ready.");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message ?? "Could not finish setting up your workspace.");
    },
  });

  function chooseType(type: AccountType) {
    setAccountType(type);
    setPlan(defaultPlan(type));
    // Sensible default name: personal workspace for individuals, blank for orgs.
    setWorkspaceName(
      type === "INDIVIDUAL"
        ? `${defaultName.split(" ")[0] || "My"}'s Workspace`
        : "",
    );
    setStep(2);
  }

  function submit() {
    if (!accountType) return;
    const name = workspaceName.trim();
    if (name.length < 2) {
      toast.error("Give your workspace a name (at least 2 characters).");
      return;
    }
    complete.mutate({ accountType, workspaceName: name, plan });
  }

  const plans = accountType ? PLANS_BY_ACCOUNT[accountType] : [];
  const submitting = complete.isPending || complete.isSuccess;

  return (
    <div className="onb-wrap">
      <div className="onb-head">
        <span className="auth-wordmark">
          Zen<b>Build</b>
        </span>
        <div className="onb-steps" aria-label={`Step ${step} of 2`}>
          <span className={`onb-step-dot${step >= 1 ? " is-active" : ""}`} />
          <span className={`onb-step-dot${step >= 2 ? " is-active" : ""}`} />
          <span>Step {step} of 2</span>
        </div>
      </div>

      {step === 1 && (
        <>
          <span className="onb-eyebrow">Welcome to ZenBuild</span>
          <h1 className="onb-title">How will you use ZenBuild?</h1>
          <p className="onb-sub">
            You can change this later — it just sets up the right plans and
            features for you.
          </p>

          <div className="onb-choices">
            {ACCOUNT_OPTIONS.map((opt) => {
              const Icon = ICONS[opt.type];
              return (
                <button
                  key={opt.type}
                  type="button"
                  className={`onb-choice${accountType === opt.type ? " is-selected" : ""}`}
                  onClick={() => chooseType(opt.type)}
                >
                  <span className="onb-choice-icon">
                    <Icon size={22} />
                  </span>
                  <div className="onb-choice-title">{opt.title}</div>
                  <p className="onb-choice-desc">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && accountType && (
        <>
          <span className="onb-eyebrow">
            {accountType === "INDIVIDUAL" ? "Individual" : "Organization"}
          </span>
          <h1 className="onb-title">
            {accountType === "INDIVIDUAL"
              ? "Name your workspace"
              : "Set up your organization"}
          </h1>
          <p className="onb-sub">
            {accountType === "INDIVIDUAL"
              ? "Your personal space for projects, requests, and reviews."
              : "This is the shared workspace your team will join."}
          </p>

          <div className="onb-field">
            <div className="auth-field">
              <label className="auth-label" htmlFor="ws-name">
                {accountType === "INDIVIDUAL" ? "Workspace name" : "Organization name"}
              </label>
              <input
                id="ws-name"
                className="auth-input"
                placeholder={accountType === "INDIVIDUAL" ? "My Workspace" : "Acme Inc."}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                disabled={submitting}
                autoFocus
                maxLength={60}
              />
            </div>
          </div>

          <h2
            className="onb-eyebrow"
            style={{ marginTop: 36, display: "block", color: "var(--ink)", letterSpacing: 0 }}
          >
            Choose a plan
          </h2>
          <div className="onb-plans">
            {plans.map((p) => (
              <button
                key={p.tier}
                type="button"
                className={`onb-plan${plan === p.tier ? " is-selected" : ""}`}
                onClick={() => setPlan(p.tier)}
                aria-pressed={plan === p.tier}
              >
                {p.popular && <span className="onb-plan-tag">Popular</span>}
                <div className="onb-plan-name">{p.name}</div>
                <div className="onb-plan-price">
                  {p.price} <span>{p.per}</span>
                </div>
                <ul className="onb-plan-list">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <p className="auth-hint" style={{ marginTop: 12 }}>
            No payment required now — you can upgrade to a paid plan anytime from
            Billing.
          </p>

          <div className="onb-actions">
            <button
              type="button"
              className="onb-textbtn"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              ← Back
            </button>
            <button
              type="button"
              className="auth-btn auth-btn-primary"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? "Setting up…" : "Enter ZenBuild"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
