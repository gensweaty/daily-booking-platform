
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { lazy, Suspense, memo, useEffect, useState } from "react";
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

// Optimized loading placeholder component
const SectionSkeleton = memo(({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-background/30 rounded-lg", className)}>
    <div className="h-96 bg-gradient-to-r from-background via-muted/10 to-background" />
  </div>
));

// Always show cursor follower
const MemoizedCursorFollower = memo(() => <CursorFollower />);

// Reduced background elements component for better performance
const OptimizedBackground = memo(() => {
  const [showComplexAnimations, setShowComplexAnimations] = useState(false);
  
  useEffect(() => {
    // Only show complex animations on high-performance devices
    const timer = setTimeout(() => {
      const isHighPerformance = window.innerWidth >= 1024 && 
                               !('ontouchstart' in window) &&
                               navigator.hardwareConcurrency >= 4;
      setShowComplexAnimations(isHighPerformance);
    }, 1000); // Delay to prioritize initial render
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none gpu-layer opacity-70">
      {/* Simplified background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/1 via-background to-accent/1" />
      
      {/* Only show floating shapes on high-performance devices */}
      {showComplexAnimations && (
        <div className="hidden xl:block">
          <div className="floating-shape floating-shape-1 will-animate" />
          <div className="floating-shape floating-shape-2 will-animate" />
          <div className="floating-shape floating-shape-3 will-animate" />
        </div>
      )}
      
      {/* Minimal mesh overlay - only on desktop */}
      {showComplexAnimations && (
        <div className="hidden lg:block opacity-30">
          <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-radial from-primary/2 to-transparent will-animate" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-radial from-accent/2 to-transparent will-animate" />
        </div>
      )}
    </div>
  );
});

export const Landing = () => {
  const { language } = useLanguage();
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Optimize initial loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className={cn(
      "min-h-screen bg-background font-sans relative overflow-hidden gpu-layer",
      language === 'ka' ? 'lang-ka' : '',
      !isLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'
    )}>
      {/* Optimized background with performance considerations */}
      <OptimizedBackground />

      <div className="relative z-10">
        {/* Critical above-the-fold content loads immediately */}
        <MemoizedCursorFollower />
        <HeroSection />
        
        {/* Non-critical content loads lazily with optimized suspense */}
        <Suspense fallback={<SectionSkeleton className="my-20 mx-4 h-80" />}>
          <LazyFeatureSection />
        </Suspense>
        
        <Suspense fallback={<SectionSkeleton className="my-20 mx-4 h-96" />}>
          <LazyPricingSection />
        </Suspense>
        
        <Suspense fallback={<SectionSkeleton className="my-10 mx-4 h-32" />}>
          <LazyFooterSection />
        </Suspense>
      </div>
    </div>
  );
};

export default Landing;
