
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { FeatureButtons } from "@/components/landing/FeatureButtons";

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background font-sans">
      <CursorFollower />
      <HeroSection />
      <FeatureButtons />
      <FeatureSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default Landing;
