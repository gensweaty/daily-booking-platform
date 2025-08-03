
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Menu, X, LogOut } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { memo } from "react";

const MemoizedAvatar = memo(Avatar);

interface NavigationProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  currentLogo: string;
}

export const Navigation = memo(({ isMobileMenuOpen, setIsMobileMenuOpen, currentLogo }: NavigationProps) => {
  const { t, language } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const renderAuthenticatedNav = () => (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />
      <ThemeToggle />
      
      <div className="hidden md:flex items-center gap-3">
        <Button 
          onClick={handleDashboardClick}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105 text-sm flex items-center gap-2 glass-morphism animate-pulse-glow"
        >
          <MemoizedAvatar className="h-6 w-6">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-white text-primary text-xs">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </MemoizedAvatar>
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

      <div className="flex items-center gap-2 md:hidden">
        <Button 
          onClick={handleDashboardClick}
          variant="ghost"
          size="sm"
          className="p-2 glass-morphism hover:bg-primary/20 transition-all hover:scale-105"
          aria-label="Go to Dashboard"
        >
          <MemoizedAvatar className="h-7 w-7">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </MemoizedAvatar>
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
          <Button variant="outline" className="hover:scale-105 transition-all text-sm md:text-base glass-morphism hover:bg-primary/10 ripple-container">
            {language === 'ka' ? "შესვლა" : t('nav.signin')}
          </Button>
        </Link>
        <Link to="/signup">
          <Button variant="purple" className="text-sm md:text-base ripple-container will-animate gpu-layer">
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

  return (
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
    </nav>
  );
});

Navigation.displayName = 'Navigation';
