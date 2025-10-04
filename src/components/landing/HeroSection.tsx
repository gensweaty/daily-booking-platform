
import { useState, useEffect, memo } from "react";
import { useTheme } from "next-themes";
import { Navigation } from "./Navigation";
import { MobileMenu } from "./MobileMenu";
import { HeroContent } from "./HeroContent";

export const HeroSection = memo(() => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>("/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png");

  useEffect(() => {
    setMounted(true);
    updateLogoForTheme();
  }, []);

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const updateLogoForTheme = () => {
    const isDarkTheme = 
      document.documentElement.classList.contains('dark') || 
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (resolvedTheme || theme) === 'dark';
    
    const newLogoSrc = isDarkTheme 
      ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" 
      : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png";
    
    setCurrentLogo(newLogoSrc);
    console.log("[HeroSection] Logo updated based on theme:", isDarkTheme ? "dark" : "light");
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
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-gradient-shift" style={{backgroundSize: '400% 400%'}} />
      
      <div className="container mx-auto px-4 py-4 md:py-6 lg:py-8 relative">
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
      </div>
    </header>
  );
});

HeroSection.displayName = 'HeroSection';
