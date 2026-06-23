"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "@/lib/validators/auth";

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function SignUpForm({
  redirectTo,
  termsAccepted,
  onRequireTerms,
}: {
  redirectTo: string;
  termsAccepted: boolean;
  onRequireTerms: () => boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!onRequireTerms()) return;
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors as FieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    // Email verification is required and auto sign-in is off, so signUp creates
    // the account and triggers an OTP email — it does NOT start a session.
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      setLoading(false);
      toast.error(error.message ?? "Could not create your account.");
      return;
    }

    // Off to the verification step with the email + intended destination.
    const params = new URLSearchParams({
      email: parsed.data.email,
      redirectTo,
    });
    router.push(`/verify-email?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit} className="auth-form" noValidate>
      <div className="auth-field">
        <label className="auth-label" htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          className="auth-input"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          aria-invalid={Boolean(errors.name)}
          disabled={loading}
        />
        {errors.name && <p className="auth-error">{errors.name}</p>}
      </div>

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={Boolean(errors.password)}
          disabled={loading}
        />
        {errors.password && <p className="auth-error">{errors.password}</p>}
      </div>

      <button
        type="submit"
        className="auth-btn auth-btn-primary"
        disabled={loading || !termsAccepted}
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="auth-foot">
        Already have an account?{" "}
        <Link href="/sign-in" className="auth-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
