import { Reveal } from "./Reveal";
import { Check } from "./icons";
import { LandingCta } from "./LandingCta";

/**
 * Marketing copy for the plan catalog. The numbers here mirror the
 * server-authoritative catalog in `@zenbuild/billing` (`PLAN_DEFINITIONS`):
 *   FREE  — ₹0,     25 credits/mo, 1 repo,   3 seats
 *   PRO   — ₹999,  200 credits/mo, 5 repos,  solo (individual upgrade)
 *   TEAM  — ₹2,499, 500 credits/mo, 25 repos, unlimited seats (org upgrade)
 * Keep this in sync with packages/billing/src/plans.ts.
 */
const PLANS = [
  {
    name: "Free",
    sub: "For solo builders and trying ZenBuild end to end.",
    amount: "₹0",
    per: "/ forever",
    pop: false,
    cta: "Start free",
    ctaClass: "btn-ghost",
    features: [
      "1 workspace · up to 3 members",
      "1 connected GitHub repository",
      "25 AI credits / month",
      "PRD + task generation, AI code review",
      "Human approval gate & full audit trail",
    ],
  },
  {
    name: "Pro",
    sub: "For individuals shipping serious side projects.",
    amount: "₹999",
    per: "/ month",
    pop: true,
    cta: "Upgrade to Pro",
    ctaClass: "btn-accent",
    features: [
      "Personal workspace",
      "Up to 5 connected repositories",
      "200 AI credits / month",
      "AI release-readiness assessment",
      "Priority support",
    ],
  },
  {
    name: "Team",
    sub: "For teams shipping features every week.",
    amount: "₹2,499",
    per: "/ month",
    pop: false,
    cta: "Choose Team",
    ctaClass: "btn-ghost",
    features: [
      "Unlimited workspace members",
      "Up to 25 connected repositories",
      "500 AI credits / month",
      "Re-review loops & readiness checks",
      "Webhook automation via Inngest",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section className="section" id="pricing" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal>
          <div className="section-head center">
            <span className="eyebrow center">Pricing</span>
            <h2 className="display">Start free. Scale when you ship more.</h2>
            <p className="lede">
              Usage-based AI credits and repository limits — billed securely
              through Razorpay. Change plans anytime.
            </p>
          </div>
        </Reveal>

        <div className="plans plans-3">
          {PLANS.map((p, i) => (
            <Reveal
              key={p.name}
              delay={((i % 3) + 1) as 1 | 2 | 3}
              className={`plan ${p.pop ? "pop" : ""}`}
            >
              {p.pop && <span className="plan-tag">Most popular</span>}
              <h3>{p.name}</h3>
              <p className="plan-sub">{p.sub}</p>
              <div className="plan-figure">
                <span className="pf-amount">{p.amount}</span>
                <span className="pf-per">{p.per}</span>
              </div>
              <ul className="plan-list">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={18} />
                    {f}
                  </li>
                ))}
              </ul>
              <LandingCta
                className={`btn ${p.ctaClass}`}
                signedOutLabel={p.cta}
                signedInLabel="Go to billing"
                signedInHref="/billing"
                withArrow={false}
              />
            </Reveal>
          ))}
        </div>

        <p className="pricing-note">
          Individuals pick Free or Pro; teams pick Free or Team. Need SSO, audit
          exports or a higher repo limit? Enterprise plans are available — talk
          to us.
        </p>
      </div>
    </section>
  );
}
