
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/theme-provider"; 

export const Landing = () => {
  const { language } = useLanguage();
  
  return (
    <div className={`min-h-screen bg-background font-sans ${language === 'ka' ? 'lang-ka' : ''}`}>
      <CursorFollower />
      <HeroSection />
      <FeatureSection />
      <PricingSection />
      <FooterSection />
    </div>
  );
};

export default Landing;
