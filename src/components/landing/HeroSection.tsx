
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Menu, X, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const productImages = [{
  src: "/lovable-uploads/89b6a836-d818-4753-a3f8-9d0d83dc7406.png", // Pet Grooming Salon
  alt: "Pet Grooming Salon",
  loading: "lazy",
  customStyle: "object-cover", 
  customPadding: "p-4" // Adding padding specifically for this image
}, {
  src: "/lovable-uploads/a00576d5-fb16-4a4b-a313-0e1cbb61b00c.png",
  alt: "Calendar Preview",
  loading: "lazy"
}, {
  src: "/lovable-uploads/7a8c5cac-2431-44db-8e9b-ca6e5ba6d633.png",
  alt: "Analytics Preview",
  loading: "lazy"
}, {
  src: "/lovable-uploads/292b8b91-64ee-4bf3-b4e6-1e68f77a6563.png",
  alt: "Tasks Preview",
  loading: "lazy"
}, {
  src: "/lovable-uploads/f35ff4e8-3ae5-4bc2-95f6-c3bef5d53689.png",
  alt: "CRM Preview",
  loading: "lazy"
}];

export const HeroSection = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>("/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png");
  const isMobile = useMediaQuery("(max-width: 640px)");

  useEffect(() => {
    setMounted(true);
    // Set initial logo
    updateLogoForTheme();
  }, []);

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // Function to update logo based on current theme
  const updateLogoForTheme = () => {
    // Get current theme from various sources in order of reliability
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

  // Listen for theme changes to update logo
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

  // Update logo when theme or resolvedTheme changes
  useEffect(() => {
    if (mounted) {
      updateLogoForTheme();
    }
  }, [theme, resolvedTheme, mounted]);

  return <>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-background to-accent-light opacity-10" />
        
        <div className="container mx-auto px-4 py-4 md:py-6 lg:py-8 relative">
          <nav className="relative" aria-label="Main navigation">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center gap-2" aria-label="SmartBookly Home">
                <img 
                  src={currentLogo}
                  alt="SmartBookly Logo" 
                  className="h-7 md:h-8 lg:h-10 w-auto" 
                  width="160" 
                  height="40" 
                  loading="eager" 
                  fetchPriority="high" 
                />
              </Link>
              
              <div className="flex items-center gap-3 md:hidden">
                <LanguageSwitcher />
                <ThemeToggle />
                <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu">
                  {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
                </Button>
              </div>

              <div className="hidden md:flex items-center space-x-3 lg:space-x-4" role="navigation">
                <LanguageSwitcher />
                <ThemeToggle />
                <Link to="/login">
                  <Button variant="outline" className="hover:scale-105 transition-transform text-sm md:text-base">
                    {language === 'ka' ? "შესვლა" : t('nav.signin')}
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105 text-sm md:text-base">
                    {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline" className="hover:scale-105 transition-transform text-sm md:text-base">
                    {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
                  </Button>
                </Link>
              </div>
            </div>

            {isMobileMenuOpen && <div id="mobile-menu" className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg mt-2 p-4 space-y-3 md:hidden animate-fade-in z-50" role="menu">
                <Link to="/login" onClick={handleMenuClose} role="menuitem">
                  <Button variant="outline" className="w-full justify-start">
                    {language === 'ka' ? "შესვლა" : t('nav.signin')}
                  </Button>
                </Link>
                <Link to="/signup" onClick={handleMenuClose} role="menuitem">
                  <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:opacity-90">
                    {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                  </Button>
                </Link>
                <Link to="/contact" onClick={handleMenuClose} role="menuitem">
                  <Button variant="outline" className="w-full justify-start">
                    {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
                  </Button>
                </Link>
              </div>}
          </nav>

          <main className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center mt-6 md:mt-8 lg:mt-12">
            <div className="space-y-3 md:space-y-4 animate-fade-in">
              <article className="space-y-2 md:space-y-4">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary">
                  <LanguageText>{t('hero.title')}</LanguageText>
                </h1>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground/90">
                  <LanguageText>{t('hero.subtitle')}</LanguageText>
                </h2>
                <h3 className="text-base md:text-lg text-muted-foreground leading-relaxed">
                  <LanguageText>{t('hero.description')}</LanguageText>
                </h3>
              </article>
              <div className="pt-2 md:pt-3">
                <Link to="/signup">
                  <Button size={isMobile ? "default" : "lg"} className="group relative bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105">
                    <span className="flex items-center gap-2">
                      {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                      <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-pulse`} aria-hidden="true" />
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
            <div className="animate-fade-in">
              <ImageCarousel 
                images={productImages} 
                permanentArrows={true} 
                imageHeight="h-[480px]"
                objectFit="object-contain"
              />
            </div>
          </main>
        </div>
      </header>
    </>;
};

