/**
 * Full-screen branded shell for the post-verification onboarding flow. The
 * warm editorial theme is global, so no scope wrapper is needed.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-svh">{children}</div>;
}
