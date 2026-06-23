"use client";

import { useState } from "react";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignInForm } from "@/components/auth/sign-in-form";
import { TermsConsent } from "@/components/auth/terms-consent";

type SignInPanelProps = {
  redirectTo: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
};

export function SignInPanel({
  redirectTo,
  githubEnabled,
  googleEnabled,
}: SignInPanelProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const socialEnabled = githubEnabled || googleEnabled;

  function handleTermsChange(checked: boolean) {
    setTermsAccepted(checked);
    if (checked) setConsentError(undefined);
  }

  function requireTerms(): boolean {
    if (termsAccepted) return true;
    setConsentError("Please accept the Terms of Service and Privacy Policy to continue.");
    return false;
  }

  return (
    <>
      <TermsConsent
        id="sign-in-terms"
        checked={termsAccepted}
        onChange={handleTermsChange}
        error={consentError}
      />

      {socialEnabled && (
        <div className="auth-social-block">
          <OAuthButtons
            redirectTo={redirectTo}
            githubEnabled={githubEnabled}
            googleEnabled={googleEnabled}
            disabled={!termsAccepted}
          />
          <div className="auth-divider">or</div>
        </div>
      )}

      <SignInForm
        redirectTo={redirectTo}
        termsAccepted={termsAccepted}
        onRequireTerms={requireTerms}
      />
    </>
  );
}
