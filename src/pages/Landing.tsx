
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/components/theme-provider"; 
import { cn } from "@/lib/utils";
import { lazy, Suspense } from "react";
import "@/components/landing/animations.css";

// Lazy load non-critical components for better performance
const LazyFeatureSection = lazy(() => 
  import("@/components/landing/FeatureSection").then(module => ({ default: module.FeatureSection }))
);
const LazyPricingSection = lazy(() => 
  import("@/components/landing/PricingSection").then(module => ({ default: module.PricingSection }))
);
const LazyFooterSection = lazy(() => 
  import("@/components/landing/FooterSection").then(module => ({ default: module.FooterSection }))
);

// Loading placeholder component
const SectionSkeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-background/50 rounded-lg", className)}>
    <div className="h-96 bg-gradient-to-r from-background via-muted/20 to-background" />
  </div>
);

export const Landing = () => {
  const { language } = useLanguage();
  
  return (
    <div className={cn(
      "min-h-screen bg-background font-sans relative overflow-hidden gpu-layer",
      language === 'ka' ? 'lang-ka' : ''
    )}>
      {/* Optimized background elements with reduced complexity */}
      <div className="fixed inset-0 pointer-events-none gpu-layer">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/2 via-background to-accent/2 animate-gradient-shift" style={{backgroundSize: '400% 400%'}} />
        
        {/* Reduced Floating Geometric Shapes - only show on larger screens */}
        <div className="hidden lg:block">
          <div className="floating-shape floating-shape-1 will-animate" />
          <div className="floating-shape floating-shape-2 will-animate" />
          <div className="floating-shape floating-shape-3 will-animate" />
        </div>
        
        {/* Reduced Mesh Gradient Overlay - only on larger screens */}
        <div className="hidden md:block">
          <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-radial from-primary/3 to-transparent animate-mesh-move will-animate" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-radial from-accent/3 to-transparent animate-mesh-move will-animate" style={{animationDelay: '5s'}} />
        </div>
      </div>

      <div className="relative z-10">
        {/* Critical above-the-fold content loads immediately */}
        <CursorFollower />
        <HeroSection />
        
        {/* Non-critical content loads lazily with suspense */}
        <Suspense fallback={<SectionSkeleton className="my-20 mx-4" />}>
          <LazyFeatureSection />
        </Suspense>
        
        <Suspense fallback={<SectionSkeleton className="my-20 mx-4" />}>
          <LazyPricingSection />
        </Suspense>
        
        <Suspense fallback={<SectionSkeleton className="my-10 mx-4 h-48" />}>
          <LazyFooterSection />
        </Suspense>
      </div>
    </div>
  );
};

export default Landing;
