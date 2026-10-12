
import { HeroSection } from "@/components/landing/HeroSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { lazy, Suspense, memo, useEffect, useState, useMemo } from "react";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import "@/components/landing/animations.css";

// Lazy sections with automatic recovery from stale chunks after a deploy
const LazyFeatureSection = lazyWithRetry(() =>
  import("@/components/landing/FeatureSection").then(module => ({
    default: module.FeatureSection || module.default,
  }))
);

const LazyPricingSection = lazyWithRetry(() =>
  import("@/components/landing/PricingSection").then(module => ({
    default: module.PricingSection || module.default,
  }))
);

const LazyFooterSection = lazyWithRetry(() =>
  import("@/components/landing/FooterSection").then(module => ({
    default: module.default,
  }))
);

// Optimized loading placeholder with reduced DOM complexity
const SectionSkeleton = memo(({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-muted/20 rounded-lg", className)}>
    <div className="h-96 bg-gradient-to-r from-muted/10 via-muted/5 to-muted/10" />
  </div>
));

SectionSkeleton.displayName = 'SectionSkeleton';

export const Landing = memo(() => {
  console.log('[DEBUG] Landing component rendering');
  
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Add safety check for context availability
  let language, contextReady;
  try {
    const context = useLanguage();
    language = context.language;
    contextReady = true;
    console.log('[DEBUG] Landing - LanguageContext available:', context);
  } catch (error) {
    console.error('[DEBUG] Landing - LanguageContext not available:', error);
    contextReady = false;
    language = 'en'; // fallback
  }
  
  // Don't render if context is not ready
  if (!contextReady) {
    console.log('[DEBUG] Landing - Context not ready, returning null');
    return null;
  }
  
  // Optimize initial loading with requestIdleCallback if available
  useEffect(() => {
    const loadHandler = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => setIsLoaded(true));
      } else {
        setTimeout(() => setIsLoaded(true), 50);
      }
    };
    
    loadHandler();
  }, []);

  // Memoize expensive class calculations
  const containerClasses = useMemo(() => cn(
    "min-h-screen bg-background font-sans relative overflow-hidden gpu-layer",
    language === 'ka' ? 'lang-ka' : '',
    !isLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'
  ), [language, isLoaded]);
  
  console.log('[DEBUG] Landing - Rendering with classes:', containerClasses);
  
  return (
    <div className={containerClasses}>


      <div className="relative z-10">

        <HeroSection />
        
        {/* Optimized suspense boundaries with better error boundaries */}
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
});

Landing.displayName = 'Landing';

export default Landing;
