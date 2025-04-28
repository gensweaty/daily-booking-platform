
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { Facebook, Twitter, Instagram, Linkedin, Github } from "lucide-react";
import { LanguageText } from "../shared/LanguageText";

export const FooterSection = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img 
                src={theme === 'dark' ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"} 
                alt="SmartBookly Logo" 
                className="h-10" 
              />
            </Link>
            <p className="text-muted-foreground">
              <LanguageText>{t('footer.description')}</LanguageText>
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Visit our Facebook page">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Follow us on Twitter">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Follow us on Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Connect with us on LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground" aria-label="Check our GitHub repository">
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4"><LanguageText>{t('footer.navigation')}</LanguageText></h3>
            <ul className="space-y-2">
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                  <LanguageText>{t('nav.signin')}</LanguageText>
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                  <LanguageText>{t('auth.signUpButton')}</LanguageText>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  <LanguageText>{t('nav.contact')}</LanguageText>
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
        
        <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
          <p><LanguageText>{t('footer.rights')}</LanguageText></p>
        </div>
      </div>
    </footer>
  );
};
