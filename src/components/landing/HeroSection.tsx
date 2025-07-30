import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Menu, X, Sparkles, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: t('auth.signOutSuccess'),
        description: t('auth.signOutSuccess'),
      });
      navigate('/');
    } catch (error) {
      toast({
        title: t('profile.signOutError'),
        description: t('profile.pleaseTryAgain'),
        variant: "destructive",
      });
    }
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
    handleMenuClose();
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

  const renderAuthenticatedNav = () => (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />
      <ThemeToggle />
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-3">
        <Button 
          onClick={handleDashboardClick}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105 text-sm flex items-center gap-2 glass-morphism animate-pulse-glow"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-white text-primary text-xs">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <LanguageText>{language === 'ka' ? "მართვის პანელი" : "Dashboard"}</LanguageText>
        </Button>
        
        <Button 
          onClick={handleSignOut}
          variant="outline" 
          className="hover:scale-105 transition-transform text-sm flex items-center gap-2 glass-morphism hover:bg-primary/10"
        >
          <LogOut className="h-4 w-4" />
          <LanguageText>{language === 'ka' ? "გამოსვლა" : t('nav.signOut')}</LanguageText>
        </Button>
        
        <Link to="/contact">
          <Button variant="outline" className="hover:scale-105 transition-transform text-sm glass-morphism hover:bg-accent/10">
            {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
          </Button>
        </Link>
      </div>

      {/* Mobile Navigation */}
      <div className="flex items-center gap-2 md:hidden">
        <Button 
          onClick={handleDashboardClick}
          variant="ghost"
          size="sm"
          className="p-2 glass-morphism hover:bg-primary/20 transition-all hover:scale-105"
          aria-label="Go to Dashboard"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
        
        <Button 
          onClick={handleSignOut}
          variant="outline" 
          size="sm"
          className="p-2 glass-morphism hover:bg-primary/10 transition-all hover:scale-105"
          aria-label={language === 'ka' ? "გამოსვლა" : t('nav.signOut')}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu" className="glass-morphism hover:bg-accent/10 transition-all hover:scale-105">
          {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );

  const renderUnauthenticatedNav = () => (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />
      <ThemeToggle />
      
      <div className="hidden md:flex items-center space-x-3 lg:space-x-4" role="navigation">
        <Link to="/login">
          <Button variant="outline" className="hover:scale-105 transition-all text-sm md:text-base glass-morphism hover:bg-primary/10 ripple-container" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            e.currentTarget.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
          }}>
            {language === 'ka' ? "შესვლა" : t('nav.signin')}
          </Button>
        </Link>
        <Link to="/signup">
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105 text-sm md:text-base animate-gradient-shift ripple-container" style={{backgroundSize: '200% 200%'}} onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.classList.add('ripple-effect');
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            e.currentTarget.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
          }}>
            {language === 'ka' ? "რეგისტრაცია" : "Sign Up"}
          </Button>
        </Link>
        <Link to="/contact">
          <Button variant="outline" className="hover:scale-105 transition-all text-sm md:text-base glass-morphism hover:bg-accent/10">
            {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu" className="glass-morphism hover:bg-accent/10 transition-all hover:scale-105">
          {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );

  const renderMobileMenu = () => {
    if (user) {
      return (
        <div id="mobile-menu" className="fixed top-16 left-4 right-4 bg-background/95 backdrop-blur-md border rounded-lg shadow-2xl p-4 space-y-3 md:hidden animate-fade-in z-[100]" role="menu">
          <Link to="/contact" onClick={handleMenuClose} role="menuitem">
            <Button variant="outline" className="w-full justify-start hover:bg-accent/10 transition-all bg-background border-border">
              {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
            </Button>
          </Link>
        </div>
      );
    } else {
      return (
        <div id="mobile-menu" className="fixed top-16 left-4 right-4 bg-background/95 backdrop-blur-md border rounded-lg shadow-2xl p-4 space-y-3 md:hidden animate-fade-in z-[100]" role="menu">
          <Link to="/login" onClick={handleMenuClose} role="menuitem">
            <Button variant="outline" className="w-full justify-start hover:bg-primary/10 transition-all bg-background border-border">
              {language === 'ka' ? "შესვლა" : t('nav.signin')}
            </Button>
          </Link>
          <Link to="/signup" onClick={handleMenuClose} role="menuitem">
            <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:opacity-90 animate-gradient-shift" style={{backgroundSize: '200% 200%'}}>
              {language === 'ka' ? "რეგისტრაცია" : "Sign Up"}
            </Button>
          </Link>
          <Link to="/contact" onClick={handleMenuClose} role="menuitem">
            <Button variant="outline" className="w-full justify-start hover:bg-accent/10 transition-all bg-background border-border">
              {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
            </Button>
          </Link>
        </div>
      );
    }
  };

  return <>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 animate-gradient-shift" style={{backgroundSize: '400% 400%'}} />
        
        <div className="container mx-auto px-4 py-4 md:py-6 lg:py-8 relative">
          <nav className="relative glass-morphism rounded-2xl px-4 py-3 mb-6 z-50" aria-label="Main navigation">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center gap-2 hover:scale-105 transition-transform" aria-label="SmartBookly Home">
                <img 
                  src={currentLogo}
                  alt="SmartBookly Logo" 
                  className="h-7 md:h-8 lg:h-10 w-auto drop-shadow-lg" 
                  width="160" 
                  height="40" 
                  loading="eager" 
                  fetchPriority="high" 
                />
              </Link>
              
              {user ? renderAuthenticatedNav() : renderUnauthenticatedNav()}
            </div>

            {isMobileMenuOpen && renderMobileMenu()}
          </nav>

          {/* Hero content with lower z-index on mobile when menu is open */}
          <main className={`grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center mt-6 md:mt-8 lg:mt-12 ${isMobileMenuOpen ? 'relative z-10' : 'relative z-20'}`}>
            <div className="space-y-3 md:space-y-4 animate-fade-in">
              <article className="space-y-2 md:space-y-4">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold enhanced-gradient-text drop-shadow-lg">
                  <LanguageText>{t('hero.title')}</LanguageText>
                </h1>
                <h2 className="text-xl md:text-2xl font-semibold text-foreground/90 drop-shadow-sm">
                  <LanguageText>{t('hero.subtitle')}</LanguageText>
                </h2>
                <h3 className="text-base md:text-lg text-muted-foreground leading-relaxed">
                  <LanguageText>{t('hero.description')}</LanguageText>
                </h3>
              </article>
              <div className="pt-2 md:pt-3 relative">
                {/* Floating particles around CTA */}
                <div className="absolute -inset-4 pointer-events-none">
                  <div className="absolute top-0 left-0 w-2 h-2 bg-primary/30 rounded-full animate-float" />
                  <div className="absolute top-2 right-0 w-1 h-1 bg-accent/40 rounded-full animate-float-slow" />
                  <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-primary/20 rounded-full animate-float" style={{animationDelay: '1s'}} />
                </div>
                <Link to="/signup">
                  <Button size={isMobile ? "default" : "lg"} className="group relative bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105 ripple-container animate-pulse-glow" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ripple = document.createElement('span');
                    ripple.classList.add('ripple-effect');
                    ripple.style.left = `${e.clientX - rect.left}px`;
                    ripple.style.top = `${e.clientY - rect.top}px`;
                    e.currentTarget.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 600);
                  }}>
                    <span className="flex items-center gap-2">
                      {language === 'ka' ? "გამოსცადეთ უფასოდ" : t('nav.startJourney')}
                      <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-pulse`} aria-hidden="true" />
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
            <div className="animate-fade-in transform-3d">
              <div className="hover-tilt transition-all duration-300">
                <ImageCarousel 
                  images={productImages} 
                  permanentArrows={true} 
                  imageHeight="h-[480px]"
                  objectFit="object-contain"
                />
              </div>
            </div>
          </main>
        </div>
      </header>
    </>;
};
