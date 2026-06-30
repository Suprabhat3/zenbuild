"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const authed = Boolean(session?.user);

  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="wrap nav-inner">
        <a href="#top" className="logo" aria-label="ZenBuild home">
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            priority
            className="logo-img"
          />
          ZenBuild
        </a>

        <div className="nav-links">
          <a href="#process">How it works</a>
          <a href="#features">Platform</a>
          <a href="#product">Review</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className="nav-cta">
          {authed ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="nav-signin"
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                Sign in
              </Link>
              <Link href="/sign-up" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
