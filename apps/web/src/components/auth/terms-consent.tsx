"use client";

import Link from "next/link";

type TermsConsentProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  error?: string;
};

export function TermsConsent({ checked, onChange, id, error }: TermsConsentProps) {
  return (
    <div className="auth-consent">
      <label className="auth-consent-label" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="auth-consent-input"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
        />
        <span className="auth-consent-copy">
          I have read and agree to the{" "}
          <Link href="/terms" className="auth-link" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="auth-link" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
