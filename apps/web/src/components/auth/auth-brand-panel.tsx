import Link from "next/link";

const STEPS = [
  "Capture the request",
  "Draft the PRD",
  "Plan the tasks",
  "Code & AI review",
  "You approve & ship",
];

/**
 * Static editorial brand panel shown beside the auth forms on wide screens.
 * Mirrors the landing page's voice so signing in feels like part of the product.
 */
export function AuthBrandPanel() {
  return (
    <aside className="auth-brand">
      <Link href="/" className="auth-wordmark">
        Zen<b>Build</b>
      </Link>

      <div>
        <h1 className="auth-brand-headline">
          From feature request to <em>shipped</em> — calmly.
        </h1>
        <p className="auth-brand-sub">
          AI drafts the PRD, plans the tasks, and reviews every pull request
          against your requirements. A human always approves the release.
        </p>

        <div className="auth-rail">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`auth-rail-step${i === 3 ? " is-key" : ""}`}
            >
              <span className="auth-rail-dot">{i + 1}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <p className="auth-quote">
        “One calm, reviewable path for every feature — from the first request to
        the final ship.”
      </p>
    </aside>
  );
}
