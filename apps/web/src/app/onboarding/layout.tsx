/**
 * Full-screen branded shell for the post-verification onboarding flow. Applies
 * the `.authx` scope so it shares the warm editorial brand with the auth pages.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="authx">{children}</div>;
}
