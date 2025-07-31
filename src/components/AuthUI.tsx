
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, resolvedTheme } = useTheme();
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [currentLogo, setCurrentLogo] = useState<string>("/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png");

  useEffect(() => {
    setMounted(true);
    
    // Set the initial logo based on theme
    updateLogoForTheme();
  }, []);

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
    console.log("[AuthUI] Logo updated based on theme:", isDarkTheme ? "dark" : "light");
  };

  useEffect(() => {
    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }
  }, [location.pathname]);

  // Listen for theme changes
  useEffect(() => {
    if (!mounted) return;

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newTheme = customEvent.detail?.theme;
      console.log("[AuthUI] Theme changed detected:", newTheme);
      updateLogoForTheme();
    };

    // Listen for both initialization and changes
    document.addEventListener('themeChanged', handleThemeChange);
    document.addEventListener('themeInit', handleThemeChange);
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange);
      document.removeEventListener('themeInit', handleThemeChange);
    };
  }, [mounted, theme, resolvedTheme]);

  // Update logo when theme or resolvedTheme changes
  useEffect(() => {
    if (mounted) {
      updateLogoForTheme();
    }
  }, [theme, resolvedTheme, mounted]);

  return (
    <div className="min-h-screen bg-background p-4" lang={language}>
      <header className="mb-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-accent transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={currentLogo}
                alt="SmartBookly Logo" 
                className="h-8 md:h-10 w-auto transition-transform duration-200 hover:scale-105"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        {/* Enhanced Welcome Section */}
        <div className="text-center space-y-4 relative">
          {/* Animated Background Gradient */}
          <div className="absolute inset-0 -z-10 opacity-30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-gradient-to-r from-primary/20 via-accent/15 to-secondary/20 blur-3xl rounded-full animate-pulse"></div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-80 h-24 bg-gradient-to-r from-secondary/15 via-primary/20 to-accent/15 blur-2xl rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          {/* Main Welcome Text */}
          <div className="relative">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-2 animate-fade-in">
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent animate-pulse">
                <LanguageText>{t("auth.welcome")}</LanguageText>
              </span>
            </h1>
            
            {/* Subtle accent line */}
            <div className="mx-auto w-24 h-1 bg-gradient-to-r from-primary to-accent rounded-full opacity-60 animate-scale-in" style={{ animationDelay: '0.3s' }}></div>
          </div>

          {/* Enhanced Description */}
          <div className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-md mx-auto leading-relaxed">
              <LanguageText>{t("auth.description")}</LanguageText>
            </p>
          </div>

          {/* Floating Elements for Visual Interest */}
          <div className="absolute -top-8 left-8 w-3 h-3 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3s' }}></div>
          <div className="absolute -top-4 right-12 w-2 h-2 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '3s' }}></div>
          <div className="absolute top-16 left-16 w-1.5 h-1.5 bg-secondary/35 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3s' }}></div>
          <div className="absolute top-12 right-8 w-2.5 h-2.5 bg-primary/25 rounded-full animate-bounce" style={{ animationDelay: '0.8s', animationDuration: '3s' }}></div>
        </div>
      </header>

      <div className="w-full max-w-sm mx-auto animate-fade-in" style={{ animationDelay: '0.7s' }}>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 backdrop-blur-sm border border-border/50">
            <TabsTrigger 
              value="signin" 
              className={`transition-all duration-200 ${language === 'ka' ? 'ka-text georgian-tab' : ''} data-[state=active]:bg-background data-[state=active]:shadow-md`}
            >
              {language === 'ka' ? <GeorgianAuthText>შესვლა</GeorgianAuthText> : t("auth.signInButton")}
            </TabsTrigger>
            <TabsTrigger 
              value="signup" 
              className={`transition-all duration-200 ${language === 'ka' ? 'ka-text georgian-tab' : ''} data-[state=active]:bg-background data-[state=active]:shadow-md`}
            >
              {language === 'ka' ? <GeorgianAuthText>რეგისტრაცია</GeorgianAuthText> : t("auth.signUpButton")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="animate-fade-in">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup" className="animate-fade-in">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
