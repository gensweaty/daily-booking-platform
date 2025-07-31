
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import "@/components/landing/animations.css";

export const Landing = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  return (
    <div className={`min-h-screen bg-background font-sans relative overflow-hidden gpu-accelerated ${language === 'ka' ? 'lang-ka' : ''}`}>
      {/* Highly optimized background elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Single gradient background - no animation on mobile */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-accent/2",
          !isMobile && "animate-subtle-mesh-move"
        )} />
        
        {/* Minimal floating element - desktop only */}
        {!isMobile && (
          <div className="absolute top-1/4 right-1/6 w-8 h-8 bg-gradient-to-br from-primary/5 to-accent/5 rounded-full animate-gentle-float blur-sm" />
        )}
        
        {/* Subtle mesh accents - desktop only */}
        {!isMobile && (
          <>
            <div className="absolute top-0 right-0 w-1/6 h-1/6 bg-gradient-radial from-primary/2 to-transparent animate-subtle-mesh-move opacity-60" />
            <div className="absolute bottom-0 left-0 w-1/5 h-1/5 bg-gradient-radial from-accent/2 to-transparent animate-subtle-mesh-move opacity-60" style={{animationDelay: '10s'}} />
          </>
        )}
      </div>

      <div className="relative z-10">
        <CursorFollower />
        <div className="animate-fade-slide-in">
          <HeroSection />
        </div>
        <div className="animate-fade-slide-in stagger-child" style={{animationDelay: '0.2s'}}>
          <FeatureSection />
        </div>
        <div className="animate-fade-slide-in stagger-child" style={{animationDelay: '0.4s'}}>
          <PricingSection />
        </div>
        <div className="animate-fade-slide-in stagger-child" style={{animationDelay: '0.6s'}}>
          <FooterSection />
        </div>
      </div>
    </div>
  );
};

export default Landing;
