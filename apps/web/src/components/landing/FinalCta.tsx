import Image from "next/image";
import { Reveal } from "./Reveal";
import { LandingCta } from "./LandingCta";

export function FinalCta() {
  return (
    <section className="cta">
      <div className="wrap">
        <Reveal className="cta-panel">
          <Image src="/logo.png" alt="ZenBuild" width={48} height={48} />
          <h2 className="display" style={{ marginTop: 18 }}>
            Bring calm to how you <em>ship</em>.
          </h2>
          <p className="lede">
            From the first feature request to a human-approved release —
            ZenBuild gives your team one clear, reviewable path to production.
          </p>
          <div className="hero-actions">
            <LandingCta />
            <a href="#product" className="btn btn-ghost">
              Explore the product
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
