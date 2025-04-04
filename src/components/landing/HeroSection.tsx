import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Menu, X, Sparkles } from "lucide-react";
import { useState, lazy, Suspense } from "react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";

// Lazy load less critical components
const ClientLogos = lazy(() => import("./ClientLogos").then(mod => ({
  default: mod.ClientLogos
})));
const FeatureButtons = lazy(() => import("./FeatureButtons").then(mod => ({
  default: mod.FeatureButtons
})));
const productImages = [{
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
  const { theme } = useTheme();
  const { t } = useLanguage();

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return <>
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-background to-accent-light opacity-10" />
        
        <div className="container mx-auto px-4 py-6 md:py-8 relative">
          <nav className="relative" aria-label="Main navigation">
            <div className="flex justify-between items-center">
              <Link to="/" className="flex items-center gap-2" aria-label="SmartBookly Home">
                <img src={theme === 'dark' ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"} alt="SmartBookly Logo" className="h-8 md:h-10 w-auto" width="160" height="40" loading="eager" fetchPriority="high" />
              </Link>
              
              <div className="flex items-center gap-4 md:hidden">
                <LanguageSwitcher />
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu">
                  {isMobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
                </Button>
              </div>

              <div className="hidden md:flex items-center space-x-4" role="navigation">
                <LanguageSwitcher />
                <ThemeToggle />
                <Link to="/login">
                  <Button variant="outline" className="hover:scale-105 transition-transform">
                    {t('nav.signin')}
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105">
                    {t('nav.startJourney')}
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline" className="hover:scale-105 transition-transform">
                    {t('nav.contact')}
                  </Button>
                </Link>
              </div>
            </div>

            {isMobileMenuOpen && <div id="mobile-menu" className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg mt-2 p-4 space-y-3 md:hidden animate-fade-in z-50" role="menu">
                <Link to="/login" onClick={handleMenuClose} role="menuitem">
                  <Button variant="outline" className="w-full justify-start">
                    {t('nav.signin')}
                  </Button>
                </Link>
                <Link to="/signup" onClick={handleMenuClose} role="menuitem">
                  <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:opacity-90">
                    {t('nav.startJourney')}
                  </Button>
                </Link>
                <Link to="/contact" onClick={handleMenuClose} role="menuitem">
                  <Button variant="outline" className="w-full justify-start">
                    {t('nav.contact')}
                  </Button>
                </Link>
              </div>}
          </nav>

          <main className="grid md:grid-cols-2 gap-8 md:gap-12 items-center mt-8 md:mt-12">
            <div className="space-y-4 animate-fade-in">
              <article className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-primary lg:text-5xl">
                  {t('hero.title')}
                </h1>
                <h2 className="text-2xl font-semibold text-foreground/90 md:text-2xl">
                  {t('hero.subtitle')}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed md:text-lg">
                  {t('hero.description')}
                </p>
              </article>
              <div className="pt-3">
                <Link to="/signup">
                  <Button size="lg" className="group relative bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105">
                    <span className="flex items-center gap-2">
                      {t('nav.startJourney')}
                      <Sparkles className="w-5 h-5 animate-pulse" aria-hidden="true" />
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
            <div className="animate-fade-in">
              <ImageCarousel images={productImages} permanentArrows={true} />
            </div>
          </main>
        </div>
      </header>

      <Suspense fallback={<div className="h-20" />}>
        <FeatureButtons />
      </Suspense>
      <Suspense fallback={<div className="h-20" />}>
        <ClientLogos />
      </Suspense>
    </>;
};
