
import { useState, useEffect, memo } from "react";
import { useTheme } from "next-themes";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { HeroContent } from "./HeroContent";

export const HeroSection = memo(() => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>("/logo-light.webp");

  useEffect(() => {
    setMounted(true);
    updateLogoForTheme();
  }, []);

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const updateLogoForTheme = () => {
    const isDarkTheme = 
      document.documentElement.classList.contains('dark') || 
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (resolvedTheme || theme) === 'dark';
    
    const mobile = window.innerWidth < 768;
    const newLogoSrc = isDarkTheme 
      ? (mobile ? "/logo-dark-compact.webp" : "/logo-dark.webp")
      : (mobile ? "/logo-light-compact.webp" : "/logo-light.webp");
    
    setCurrentLogo(newLogoSrc);
  };

  useEffect(() => {
    if (!mounted) return;

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newTheme = customEvent.detail?.theme;
      console.log("[HeroSection] Theme changed detected:", newTheme);
      updateLogoForTheme();
    };

    document.addEventListener('themeChanged', handleThemeChange);
    document.addEventListener('themeInit', handleThemeChange);
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange);
      document.removeEventListener('themeInit', handleThemeChange);
    };
  }, [mounted]);

  useEffect(() => {
    if (mounted) {
      updateLogoForTheme();
    }
  }, [theme, resolvedTheme, mounted]);

  return (
      <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      
      <nav className="container mx-auto px-4 py-4 md:py-6 lg:py-8 relative">
        <Navigation 
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          currentLogo={currentLogo}
        />

        <MobileMenu 
          isMobileMenuOpen={isMobileMenuOpen}
          handleMenuClose={handleMenuClose}
        />

        <HeroContent isMobileMenuOpen={isMobileMenuOpen} />
      </nav>
    </header>
  );
});

HeroSection.displayName = 'HeroSection';
