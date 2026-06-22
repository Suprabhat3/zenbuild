import { Reveal } from "./Reveal";
import { Check } from "./icons";

const PLANS = [
  {
    name: "Starter",
    sub: "For solo builders and trying things out.",
    amount: "₹0",
    per: "/ forever",
    pop: false,
    cta: "Start free",
    ctaClass: "btn-ghost",
    features: [
      "1 workspace · up to 3 members",
      "1 connected GitHub repository",
      "10 AI review credits / month",
      "PRD + task generation",
      "Community support",
    ],
  },
  {
    name: "Team",
    sub: "For teams shipping features every week.",
    amount: "₹2,499",
    per: "/ month",
    pop: true,
    cta: "Upgrade with Razorpay",
    ctaClass: "btn-accent",
    features: [
      "Unlimited workspaces & members",
      "Up to 25 connected repositories",
      "500 AI review credits / month",
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
              Usage-based AI review credits and repository limits — billed
              securely through Razorpay. Change plans anytime.
            </p>
          </div>
        </Reveal>

        <div className="plans">
          {PLANS.map((p, i) => (
            <Reveal
              key={p.name}
              delay={(i + 1) as 1 | 2}
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
              <a href="/sign-up" className={`btn ${p.ctaClass}`}>
                {p.cta}
              </a>
            </Reveal>
          ))}
        </div>

        <p className="pricing-note">
          Need SSO, audit logs or a higher repo limit? Enterprise plans are
          available — talk to us.
        </p>
      </div>
    </section>
  );
}
