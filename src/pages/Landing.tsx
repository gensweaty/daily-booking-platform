
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import "@/components/landing/animations.css";

export const Landing = () => {
  const { language } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  return (
    <div className={`min-h-screen bg-background font-sans relative overflow-hidden ${language === 'ka' ? 'lang-ka' : ''}`}>
      {/* Optimized background elements - reduced for mobile */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Simplified background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-background to-accent/2 animate-static-gradient" />
        
        {/* Single floating shape - hidden on mobile */}
        {!isMobile && (
          <div className="floating-shape floating-shape-1" />
        )}
        
        {/* Reduced mesh gradient overlay - desktop only */}
        {!isMobile && (
          <>
            <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-radial from-primary/3 to-transparent animate-simple-mesh-move" />
            <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-radial from-accent/3 to-transparent animate-simple-mesh-move" style={{animationDelay: '15s'}} />
          </>
        )}
      </div>

      <div className="relative z-10">
        <CursorFollower />
        <HeroSection />
        <FeatureSection />
        <PricingSection />
        <FooterSection />
      </div>
    </div>
  );
};

export default Landing;
