import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { ModulesSection } from "@/components/marketing/modules-section";
import { PainSolutionSection } from "@/components/marketing/pain-solution-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ProductShowcaseSection } from "@/components/marketing/product-showcase-section";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden">
      <MarketingNav />
      <HeroSection />
      <PainSolutionSection />
      <ProductShowcaseSection />
      <ModulesSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
      <SiteFooter />
    </div>
  );
}
