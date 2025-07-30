
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/theme-provider"; 
import "@/components/landing/animations.css";

export const Landing = () => {
  const { language } = useLanguage();
  
  return (
    <div className={`min-h-screen bg-background font-sans relative overflow-hidden ${language === 'ka' ? 'lang-ka' : ''}`}>
      {/* Reduced intensity background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-background to-accent/3 animate-gradient-shift" style={{backgroundSize: '400% 400%'}} />
        
        {/* Reduced Floating Geometric Shapes */}
        <div className="floating-shape floating-shape-1" />
        <div className="floating-shape floating-shape-2" />
        <div className="floating-shape floating-shape-3" />
        
        {/* Reduced Mesh Gradient Overlay */}
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-gradient-radial from-primary/5 to-transparent animate-mesh-move" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-radial from-accent/5 to-transparent animate-mesh-move" style={{animationDelay: '5s'}} />
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
