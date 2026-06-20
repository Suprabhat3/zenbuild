"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle } from "./icons";

const STEPS = [
  { label: "Request", state: "done" },
  { label: "PRD", state: "done" },
  { label: "Tasks", state: "done" },
  { label: "Code", state: "done" },
  { label: "AI Review", state: "active" },
  { label: "Approve", state: "todo" },
  { label: "Ship", state: "todo" },
] as const;

export function Hero() {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInView(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <header className={`hero ${inView ? "in-view" : ""}`} id="top">
      <div className="wrap">
        <span className="hero-ticket">
          <span className="tk-chip">REQ-4128</span>
          Password self-reset · now in AI Review
        </span>

        <h1 className="display">
          From feature request to{" "}
          <span className="underline-word">
            shipped
            <svg viewBox="0 0 200 12" preserveAspectRatio="none">
              <path d="M3 8C40 3 80 3 120 6s60 2 77 -1" />
            </svg>
          </span>{" "}
          — with a human in the <em>loop</em>.
        </h1>

        <p className="lede">
          ZenBuild gives every feature one calm, reviewable path: AI drafts the
          PRD, plans the tasks, and reviews the pull request against your
          requirements — but a person always approves the release.
        </p>

        <div className="hero-actions">
          <a href="#pricing" className="btn btn-accent">
            Start building free
            <ArrowRight size={18} />
          </a>
          <a href="#process" className="btn btn-ghost">
            See how it works
          </a>
        </div>
        <p className="hero-note">
          <CheckCircle size={16} style={{ color: "var(--sage)" }} />
          No credit card · Connect a GitHub repo in minutes
        </p>

        {/* horizontal pipeline rail */}
        <div className="rail" aria-hidden>
          <div className="rail-track" />
          <div className="rail-track-fill" />
          <div className="rail-steps">
            {STEPS.map((s, i) => (
              <div key={s.label} className={`rstep ${s.state}`}>
                <span className="rdot">
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                <span className="rlabel">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
