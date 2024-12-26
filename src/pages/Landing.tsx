import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background font-sans">
      <HeroSection />
      <FeatureSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default Landing;