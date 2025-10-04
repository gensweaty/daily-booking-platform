
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { memo } from "react";

interface MobileMenuProps {
  isMobileMenuOpen: boolean;
  handleMenuClose: () => void;
}

export const MobileMenu = memo(({ isMobileMenuOpen, handleMenuClose }: MobileMenuProps) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  if (!isMobileMenuOpen) return null;

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
  }

  return (
    <div id="mobile-menu" className="fixed top-16 left-4 right-4 bg-background/95 backdrop-blur-md border rounded-lg shadow-2xl p-4 space-y-3 md:hidden animate-fade-in z-[100]" role="menu">
      <Link to="/login" onClick={handleMenuClose} role="menuitem">
        <Button variant="outline" className="w-full justify-start hover:bg-primary/10 transition-all bg-background border-border">
          {language === 'ka' ? "შესვლა" : t('nav.signin')}
        </Button>
      </Link>
      <Link to="/signup" onClick={handleMenuClose} role="menuitem">
        <Button variant="purple" className="w-full justify-start gpu-layer will-animate">
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
});

MobileMenu.displayName = 'MobileMenu';
