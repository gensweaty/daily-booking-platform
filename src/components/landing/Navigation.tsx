
import { Link } from "react-router-dom";
import { AnimatedRobotEye } from "@/components/shared/AnimatedRobotEye";
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

  const handlePricingClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      handleMenuClose();
    }
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
          className="flex items-center gap-2 rounded-md text-sm transition-colors duration-200"
        >
          <MemoizedAvatar className="h-6 w-6">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-background text-primary text-xs">
              {user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </MemoizedAvatar>
          <LanguageText>{language === 'ka' ? "მართვის პანელი" : "Dashboard"}</LanguageText>
        </Button>
        
        <Button
          onClick={handlePricingClick}
          variant="ghost" 
          className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          {t('nav.pricing')}
        </Button>
        
        <Button 
          onClick={handleSignOut}
          variant="outline" 
          className="flex items-center gap-2 text-sm transition-colors duration-200"
        >
          <LogOut className="h-4 w-4" />
          <LanguageText>{language === 'ka' ? "გამოსვლა" : t('nav.signOut')}</LanguageText>
        </Button>
        
        <Link to="/contact">
          <Button variant="ghost" className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground">
            {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <Button 
          onClick={handleDashboardClick}
          variant="ghost"
          size="sm"
          className="p-2 transition-all hover:scale-105"
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
          className="p-2 transition-all hover:scale-105"
          aria-label={language === 'ka' ? "გამოსვლა" : t('nav.signOut')}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu" className="transition-all hover:scale-105">
          {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );

  const renderUnauthenticatedNav = () => (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />
      <ThemeToggle />
      
      <div className="hidden md:flex items-center space-x-2 lg:space-x-3" role="navigation">
        <Button
          onClick={handlePricingClick}
          variant="ghost"
          className="rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('nav.pricing')}
        </Button>
        <Link to="/contact">
          <Button variant="ghost" className="rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors">
            {language === 'ka' ? "კონტაქტი" : t('nav.contact')}
          </Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" className="rounded-md text-sm transition-colors duration-200">
            {language === 'ka' ? "შესვლა" : t('nav.signin')}
          </Button>
        </Link>
        <Link to="/signup">
          <Button variant="default" className="rounded-md text-sm transition-colors duration-200">
            {language === 'ka' ? "რეგისტრაცია" : t('auth.signUpButton')}
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-expanded={isMobileMenuOpen} aria-controls="mobile-menu" aria-label="Toggle menu" className="transition-all hover:scale-105">
          {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );

  return (
    <nav className="relative mx-auto border-b border-border bg-background py-3 mb-6 z-50" aria-label="Main navigation">
      <div className="flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2" aria-label="SmartBookly Home">
          <div className="relative">
            <img 
              src={currentLogo}
              alt="SmartBookly Logo" 
              className="h-[32px] dark:h-[36px] md:h-[32px] dark:md:h-[36px] lg:h-[40px] dark:lg:h-[36px] w-auto max-w-[160px] lg:max-w-[180px] object-contain drop-shadow-lg" 
              width="160" 
              height="36"
              loading="eager" 
              fetchPriority="high" 
            />
            <AnimatedRobotEye size={11} top="44%" left={currentLogo.includes('compact') ? "24%" : "11%"} />
          </div>
        </Link>
        
        {user ? renderAuthenticatedNav() : renderUnauthenticatedNav()}
      </div>
    </nav>
  );
});

Navigation.displayName = 'Navigation';
