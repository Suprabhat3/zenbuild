import { LogoMark, GitHub } from "./icons";

const COLUMNS = [
  {
    title: "Product",
    links: ["Workflow", "Features", "Product tour", "Pricing", "Changelog"],
  },
  {
    title: "Platform",
    links: ["GitHub integration", "AI reviews", "Inngest workflows", "API"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact"],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <div className="logo">
              <LogoMark size={26} />
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
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-base">
          <span>© {2026} ZenBuild. Built for the ChaiCode hackathon.</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <GitHub size={16} /> Open source
          </span>
        </div>
      </div>
    </footer>
  );
}
