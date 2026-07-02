import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

/**
 * Split-screen shell for unauthenticated auth screens: editorial brand panel on
 * the left (wide screens), the form on the right. Pages render their own title,
 * copy, and form into the panel.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-split">
      <AuthBrandPanel />
      <main className="auth-panel">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
