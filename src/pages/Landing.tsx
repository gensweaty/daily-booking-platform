
import { HeroSection } from "@/components/landing/HeroSection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { lazy, Suspense, memo, useEffect, useState, useMemo } from "react";
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

// Ultra lightweight skeleton
const SectionSkeleton = memo(({ className }: { className?: string }) => (
  <div className={cn("bg-background/30 rounded-lg", className)}>
    <div className="h-96 bg-gradient-to-r from-background via-muted/5 to-background" />
  </div>
));

// Lightweight cursor follower with better device detection
const OptimizedCursorFollower = memo(() => {
  const [showCursor, setShowCursor] = useState(false);
  
  useEffect(() => {
    const isDesktopWithMouse = () => {
      return window.innerWidth >= 1024 && 
             !('ontouchstart' in window) && 
             matchMedia('(pointer: fine)').matches;
    };
    
    if (isDesktopWithMouse()) {
      setShowCursor(true);
    }
  }, []);
  
  return showCursor ? <CursorFollower /> : null;
});

// Minimal background with conditional rendering
const MinimalBackground = memo(() => {
  const [showAnimations, setShowAnimations] = useState(false);
  
  const deviceCapability = useMemo(() => {
    // Type-safe navigator property access
    const connection = (navigator as any).connection;
    const deviceMemory = (navigator as any).deviceMemory;
    
    return {
      isDesktop: window.innerWidth >= 1024,
      hasGoodConnection: !connection || connection.effectiveType === '4g',
      hasEnoughMemory: !deviceMemory || deviceMemory >= 4
    };
  }, []);
  
  useEffect(() => {
    // Only show complex backgrounds on capable devices after initial load
    const timer = setTimeout(() => {
      if (deviceCapability.isDesktop && deviceCapability.hasGoodConnection && deviceCapability.hasEnoughMemory) {
        setShowAnimations(true);
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [deviceCapability]);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Simple gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/1 via-background to-accent/1" />
      
      {/* Minimal floating elements - only on high-end devices */}
      {showAnimations && (
        <>
          <div className="floating-shape floating-shape-1" />
          <div className="floating-shape floating-shape-2" />
        </>
      )}
    </div>
  );
});

export const Landing = () => {
  const { language } = useLanguage();
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Fast initialization
  useEffect(() => {
    setIsInitialized(true);
  }, []);
  
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className={cn(
      "min-h-screen bg-background font-sans relative overflow-hidden",
      language === 'ka' ? 'lang-ka' : ''
    )}>
      {/* Minimal background */}
      <MinimalBackground />

      <div className="relative z-10">
        {/* Above-the-fold content loads immediately */}
        <OptimizedCursorFollower />
        <HeroSection />
        
        {/* Below-the-fold content with intersection observer lazy loading */}
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
