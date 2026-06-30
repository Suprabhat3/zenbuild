"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ArrowRight } from "./icons";

/**
 * Auth-aware primary call-to-action for the marketing page. When a visitor is
 * already signed in, every "Start building free" button quietly becomes a
 * "Go to dashboard" link so returning users aren't bounced back through signup.
 * Mirrors the behaviour the nav already implements.
 */
export function LandingCta({
  className = "btn btn-accent",
  signedOutLabel = "Start building free",
  signedInLabel = "Go to dashboard",
  signedInHref = "/dashboard",
  withArrow = true,
}: {
  className?: string;
  signedOutLabel?: string;
  signedInLabel?: string;
  signedInHref?: string;
  withArrow?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const authed = Boolean(session?.user);

  return (
    <Link
      href={authed ? signedInHref : "/sign-up"}
      className={className}
      style={{ opacity: isPending ? 0.7 : 1 }}
    >
      {authed ? signedInLabel : signedOutLabel}
      {withArrow && <ArrowRight size={18} />}
    </Link>
  );
}
