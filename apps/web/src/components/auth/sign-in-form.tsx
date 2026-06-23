"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { signInSchema } from "@/lib/validators/auth";

type FieldErrors = Partial<Record<"email" | "password", string>>;

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Unverified accounts can't sign in; BetterAuth has just emailed a fresh
      // OTP, so route the user to the verification step instead of erroring.
      const unverified =
        error.status === 403 ||
        error.code === "EMAIL_NOT_VERIFIED";
      if (unverified) {
        toast.message("Verify your email to continue", {
          description: "We've sent a 6-digit code to your inbox.",
        });
        const params = new URLSearchParams({
          email: parsed.data.email,
          redirectTo,
        });
        router.push(`/verify-email?${params.toString()}`);
        return;
      }
      setLoading(false);
      toast.error(error.message ?? "Invalid email or password.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label className="auth-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="auth-input"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          aria-invalid={Boolean(errors.email)}
          disabled={loading}
        />
        {errors.email && <p className="auth-error">{errors.email}</p>}
      </div>

      <div className="auth-field">
        <label className="auth-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="auth-input"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={Boolean(errors.password)}
          disabled={loading}
        />
        {errors.password && <p className="auth-error">{errors.password}</p>}
      </div>

      <button type="submit" className="auth-btn auth-btn-primary" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>

      <p className="auth-foot">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="auth-link">
          Sign up
        </Link>
      </p>
    </form>
  );
}
