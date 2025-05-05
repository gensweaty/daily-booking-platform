
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";

export const Landing = () => {
  const { language } = useLanguage();
  
  return (
    <div className={`min-h-screen bg-background font-sans ${language === 'ka' ? 'lang-ka' : ''}`}>
      <CursorFollower />
      <HeroSection />
      <FeatureSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default Landing;
