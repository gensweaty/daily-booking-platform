
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { LanguageProvider } from "@/contexts/LanguageContext";

export const Landing = () => {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background font-sans">
        <CursorFollower />
        <HeroSection />
        <FeatureSection />
        <CTASection />
        <FooterSection />
      </div>
    </LanguageProvider>
  );
};

export default Landing;
