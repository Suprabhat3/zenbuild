import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Process } from "@/components/landing/Process";
import { Features } from "@/components/landing/Features";
import { Product } from "@/components/landing/Product";
import { Pricing } from "@/components/landing/Pricing";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="landing">
      <Nav />
      <main>
        <Hero />
        <Process />
        <Features />
        <Product />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
