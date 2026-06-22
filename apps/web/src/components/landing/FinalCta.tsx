import { Reveal } from "./Reveal";
import { ArrowRight, LogoMark } from "./icons";

export function FinalCta() {
  return (
    <section className="cta">
      <div className="wrap">
        <Reveal className="cta-panel">
          <LogoMark size={48} />
          <h2 className="display" style={{ marginTop: 18 }}>
            Bring calm to how you <em>ship</em>.
          </h2>
          <p className="lede">
            From the first feature request to a human-approved release —
            ZenBuild gives your team one clear, reviewable path to production.
          </p>
          <div className="hero-actions">
            <a href="/sign-up" className="btn btn-accent">
              Start building free
              <ArrowRight size={18} />
            </a>
            <a href="#product" className="btn btn-ghost">
              Explore the product
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
