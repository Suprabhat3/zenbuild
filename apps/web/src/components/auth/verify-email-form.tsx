"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { OtpInput } from "@/components/auth/otp-input";
import { authClient } from "@/lib/auth-client";

const RESEND_COOLDOWN_SECONDS = 30;

export function VerifyEmailForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = useCallback(
    async (otp: string) => {
      setVerifying(true);
      const { error } = await authClient.emailOtp.verifyEmail({ email, otp });
      if (error) {
        setVerifying(false);
        setCode("");
        toast.error(
          error.code === "OTP_EXPIRED"
            ? "That code has expired. Request a new one."
            : error.code === "TOO_MANY_ATTEMPTS"
              ? "Too many attempts. Request a new code."
              : "That code isn't right. Try again.",
        );
        return;
      }
      // autoSignInAfterVerification issues the session; the app shell will route
      // a freshly-verified user to onboarding if they have no workspace yet.
      toast.success("Email verified.");
      router.push(redirectTo);
      router.refresh();
    },
    [email, redirectTo, router],
  );

  async function resend() {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (error) {
      toast.error(error.message ?? "Could not resend the code.");
      return;
    }
    toast.success("A new code is on its way.");
  }

  return (
    <>
      <Link href="/sign-in" className="auth-back">
        ← Back to sign in
      </Link>

      <span className="auth-mobile-mark">
        Zen<b>Build</b>
      </span>
      <h2 className="auth-title">Check your inbox</h2>
      <p className="auth-subtitle">
        Enter the 6-digit code we sent to verify your email.
      </p>
      <p style={{ marginTop: 10 }}>
        <span className="auth-pill">{email}</span>
      </p>

      <div className="auth-form">
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={verify}
          disabled={verifying}
        />

        <button
          type="button"
          className="auth-btn auth-btn-primary"
          disabled={verifying || code.length !== 6}
          onClick={() => verify(code)}
        >
          {verifying ? "Verifying…" : "Verify email"}
        </button>

        <p className="auth-foot">
          Didn&apos;t get it?{" "}
          {cooldown > 0 ? (
            <span className="auth-hint">Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="auth-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    </>
  );
}
