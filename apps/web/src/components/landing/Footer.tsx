import Image from "next/image";
import { GitHub } from "./icons";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Workflow", href: "/#process" },
      { label: "Features", href: "/#features" },
      { label: "Product tour", href: "/#product" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Platform",
    links: [
      { label: "GitHub integration", href: "/#features" },
      { label: "AI reviews", href: "/#features" },
      { label: "Inngest workflows", href: "/#features" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="logo">
              <Image
                src="/logo.png"
                alt=""
                width={26}
                height={26}
                className="logo-img"
              />
              ZenBuild
            </div>
            <p className="footer-tag">
              The AI-assisted product delivery platform. From request to
              release, with a human in the loop.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-base">
          <span>© {2026} ZenBuild. Built for the ChaiCode hackathon.</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
            <a href="/terms">Terms</a>
            <a href="/privacy">Privacy</a>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <GitHub size={16} /> Open source
            </span>
          </span>
        </div>
      </div>
    </footer>
  );
}
