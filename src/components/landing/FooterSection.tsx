import { Link } from "react-router-dom";
import { AnimatedRobotEye } from "@/components/shared/AnimatedRobotEye";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { Facebook, Twitter, Instagram, Linkedin, Github } from "lucide-react";
import { LanguageText } from "../shared/LanguageText";
import { useEffect, useState } from "react";

const FooterSection = () => {
  const { theme, resolvedTheme } = useTheme();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>("/logo-light.webp");

  useEffect(() => {
    setMounted(true);
    updateLogoForTheme();
  }, []);

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

  // Listen for theme changes
  useEffect(() => {
    if (!mounted) return;

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newTheme = customEvent.detail?.theme;
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

  return (
    <footer className="landing-surface border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-12">
          <div className="col-span-2 space-y-4 md:col-span-1">
            <Link to="/" className="inline-block">
              <div className="relative">
                <img 
                  src={currentLogo}
                  alt="SmartBookly Logo" 
                  className="h-10 w-auto max-w-[180px] object-contain" 
                />
                <AnimatedRobotEye size={12} top="44%" left="11%" />
              </div>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              <LanguageText>{t('footer.description')}</LanguageText>
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com/smartbookly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Visit our Facebook page">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://twitter.com/smartbookly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Follow us on Twitter">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/smartbookly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Follow us on Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://linkedin.com/company/smartbookly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Connect with us on LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://github.com/smartbookly" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Check our GitHub repository">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4"><LanguageText>{t('footer.navigation')}</LanguageText></h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="#ai-assistant" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('ai-assistant')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LanguageText>{t('aiAssistant.title')}</LanguageText>
                </a>
              </li>
              <li>
                <a 
                  href="#smart-booking" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('smart-booking')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LanguageText>{t('features.smartAppointment')}</LanguageText>
                </a>
              </li>
              <li>
                <a 
                  href="#crm-solution" 
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('crm-solution')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LanguageText>{language === 'ka' ? "CRM" : "CRM"}</LanguageText>
                </a>
              </li>
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  {language === 'ka' ? "შესვლა" : t('nav.signin')}
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                  {language === 'ka' ? "რეგისტრაცია" : t('auth.signUpButton')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4"><LanguageText>{t('footer.legal')}</LanguageText></h3>
            <ul className="space-y-2">
              <li>
                <Link to="/legal" className="text-muted-foreground hover:text-foreground transition-colors">
                  <LanguageText>{t('footer.termsAndPrivacy')}</LanguageText>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-10 pt-6 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          <p>
            <LanguageText>{t('footer.rights')}</LanguageText>
            <span className="block mt-1">AI SOFTWARE FACTORY LTD</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;