"use client";

import { useState } from "react";

import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignUpForm } from "@/components/auth/sign-up-form";

type SignUpPanelProps = {
  redirectTo: string;
  githubEnabled: boolean;
  googleEnabled: boolean;
};

export function SignUpPanel({
  redirectTo,
  githubEnabled,
  googleEnabled,
}: SignUpPanelProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const socialEnabled = githubEnabled || googleEnabled;

  function handleTermsChange(checked: boolean) {
    setTermsAccepted(checked);
    if (checked) setConsentError(undefined);
  }

  function requireTerms(): boolean {
    if (termsAccepted) return true;
    setConsentError("Please accept the Terms and Conditions and Privacy Policy to continue.");
    return false;
  }

  return (
    <>
      {socialEnabled && (
        <div className="auth-social-block">
          <OAuthButtons
            redirectTo={redirectTo}
            githubEnabled={githubEnabled}
            googleEnabled={googleEnabled}
            onRequireTerms={requireTerms}
          />
          <div className="auth-divider">or</div>
        </div>
      )}

      <SignUpForm
        redirectTo={redirectTo}
        termsAccepted={termsAccepted}
        onTermsChange={handleTermsChange}
        consentError={consentError}
        onRequireTerms={requireTerms}
      />
    </>
  );
}
