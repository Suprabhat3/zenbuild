import Link from "next/link";

const LAST_UPDATED = "June 23, 2026";

type LegalLayoutProps = {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  alternate?: { href: string; label: string };
};

export function LegalLayout({ title, eyebrow, children, alternate }: LegalLayoutProps) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" className="legal-back">
            ← Back to home
          </Link>
          <Link href="/" className="legal-wordmark">
            Zen<b>Build</b>
          </Link>
          <p className="legal-eyebrow">{eyebrow}</p>
          <h1 className="legal-title">{title}</h1>
          <p className="legal-meta">Last updated: {LAST_UPDATED}</p>
        </div>
      </header>

      <main className="legal-body">
        <article className="legal-prose">{children}</article>

        <nav className="legal-nav" aria-label="Legal">
          {alternate && <Link href={alternate.href}>{alternate.label}</Link>}
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up">Create account</Link>
        </nav>
      </main>
    </div>
  );
}
