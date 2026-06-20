import { Reveal } from "./Reveal";
import { ShieldCheck } from "./icons";

export function Product() {
  return (
    <section className="section" id="product" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal>
          <div className="section-head center">
            <span className="eyebrow center">Inside a review</span>
            <h2 className="display">The spec, marked up by your QA agent.</h2>
            <p className="lede">
              ZenBuild reads the pull request against the PRD and leaves notes in
              the margin — exactly where a requirement is met, missed, or at
              risk.
            </p>
          </div>
        </Reveal>

        <Reveal className="spec">
          {/* the document */}
          <div className="sheet">
            <span className="sheet-tab">PRD-4128 · password-self-reset.md</span>
            <h3>Password self-reset</h3>
            <p className="sheet-meta">
              v2 · generated &amp; human-edited · 7 files in PR #212
            </p>

            <div className="spec-block">
              <div className="label">Problem</div>
              <p>
                Users who forget their password must email support and wait
                hours — this drives ~18% of all tickets and blocks sign-in
                entirely.
              </p>
            </div>

            <div className="spec-block">
              <div className="label">Goals</div>
              <ul>
                <li>Request a reset link directly from the login page.</li>
                <li>Reduce password-related tickets by at least 60%.</li>
              </ul>
            </div>

            <div className="spec-block">
              <div className="label">Acceptance criteria</div>
              <ul>
                <li className="flagged">
                  Reset links are single-use and{" "}
                  <mark>expire after 30 minutes</mark>.
                </li>
                <li>Reset emails are rate-limited to 3 per hour per account.</li>
                <li>
                  Passwords are re-hashed with the current cost factor on reset.
                </li>
              </ul>
            </div>
          </div>

          {/* margin annotations */}
          <div className="notes">
            <div className="notes-head">
              <ShieldCheck size={15} /> AI review · PR #212
            </div>

            <div className="note blocking">
              <span className="note-sev">Blocking</span>
              <strong>Tokens never expire</strong>
              <p>
                Validation checks the token value but not its age — the 30-minute
                rule isn't enforced. Real account-takeover risk if a link leaks.
              </p>
              <div className="ref">auth/reset.ts:42</div>
            </div>

            <div className="note minor">
              <span className="note-sev">Non-blocking</span>
              <strong>Rate limit not wired up</strong>
              <p>
                The 3/hour limit is defined but not applied to the request route.
                Recommended before launch.
              </p>
              <div className="ref">api/forgot.ts:18</div>
            </div>

            <div className="note pass">
              <span className="note-sev">Passed</span>
              <strong>Re-hashing is correct</strong>
              <p>Uses the current cost factor — matches the criteria.</p>
              <div className="ref">auth/hash.ts</div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
