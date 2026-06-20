"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./icons";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <a href="#top" className="logo" aria-label="ZenBuild home">
          <LogoMark />
          ZenBuild
        </a>

        <div className="nav-links">
          <a href="#process">How it works</a>
          <a href="#features">Platform</a>
          <a href="#product">Review</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className="nav-cta">
          <a href="#" className="nav-signin">
            Sign in
          </a>
          <a href="#pricing" className="btn btn-primary btn-sm">
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}
