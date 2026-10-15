
import { HeroSection } from "@/components/landing/HeroSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Suspense, memo } from "react";
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
  const { language } = useLanguage();
  const containerClasses = cn(
    "landing-page min-h-screen bg-background font-sans relative overflow-hidden",
    language === 'ka' ? 'lang-ka' : ''
  );
  
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
