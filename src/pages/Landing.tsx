
import { HeroSection } from "@/components/landing/HeroSection";
import { CursorFollower } from "@/components/landing/CursorFollower";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { lazy, Suspense, memo, useEffect, useState, useMemo } from "react";
import "@/components/landing/animations.css";

// More aggressive lazy loading with better chunking
const LazyFeatureSection = lazy(() => 
  import("@/components/landing/FeatureSection").then(module => ({ 
    default: module.FeatureSection 
  }))
);

const LazyPricingSection = lazy(() => 
  import("@/components/landing/PricingSection").then(module => ({ 
    default: module.PricingSection 
  }))
);

const LazyFooterSection = lazy(() => 
  import("@/components/landing/FooterSection").then(module => ({ 
    default: module.FooterSection 
  }))
);

// Optimized loading placeholder with reduced DOM complexity
const SectionSkeleton = memo(({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-muted/20 rounded-lg", className)}>
    <div className="h-96 bg-gradient-to-r from-muted/10 via-muted/5 to-muted/10" />
  </div>
));

SectionSkeleton.displayName = 'SectionSkeleton';

// Memoized cursor follower
const MemoizedCursorFollower = memo(CursorFollower);

// Highly optimized background with intersection observer
const OptimizedBackground = memo(() => {
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    // Use intersection observer to only render when needed
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldRender(true);
            observer.disconnect(); // Only render once
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe the root element
    observer.observe(document.documentElement);

    // Fallback timer for slower devices
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, 2000);
    
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // Memoize expensive gradient calculations
  const gradientStyles = useMemo(() => ({
    background: 'linear-gradient(135deg, hsl(var(--primary)/0.01) 0%, hsl(var(--background)) 50%, hsl(var(--accent)/0.01) 100%)'
  }), []);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 pointer-events-none gpu-layer opacity-60">
      <div className="absolute inset-0" style={gradientStyles} />
      
      {/* Only show complex animations on high-performance devices */}
      <div className="hidden xl:block">
        <div className="floating-shape floating-shape-1 will-animate" />
        <div className="floating-shape floating-shape-2 will-animate" />
        <div className="floating-shape floating-shape-3 will-animate" />
      </div>
      
      {/* Minimal mesh overlay */}
      <div className="hidden lg:block opacity-20">
        <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-radial from-primary/1 to-transparent will-animate" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-radial from-accent/1 to-transparent will-animate" />
      </div>
    </div>
  );
});

OptimizedBackground.displayName = 'OptimizedBackground';

export const Landing = memo(() => {
  const { language } = useLanguage();
  const [isLoaded, setIsLoaded] = useState(false);
  
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
  
  return (
    <div className={containerClasses}>
      <OptimizedBackground />

      <div className="relative z-10">
        <MemoizedCursorFollower />
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
