
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }
  }, [location.pathname]);

  // Determine the correct logo to use based on theme
  const logoSrc = mounted && (resolvedTheme || theme) === 'dark' 
    ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
    : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png";

  // Listen for theme changes to update logo
  useEffect(() => {
    if (!mounted) return;

    const handleThemeChange = () => {
      console.log("[AuthUI] Theme changed detected");
    };

    document.addEventListener('themeChanged', handleThemeChange);
    document.addEventListener('themeInit', handleThemeChange);
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange);
      document.removeEventListener('themeInit', handleThemeChange);
    };
  }, [mounted]);

  return (
    <div className="min-h-screen bg-background p-4" lang={language}>
      <header className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/")}
              className="hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={logoSrc}
                alt="SmartBookly Logo" 
                className="h-8 md:h-10 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-1 text-center">
          <LanguageText>{t("auth.welcome")}</LanguageText>
        </h1>
        <p className="text-foreground/80 text-center text-sm mb-4">
          <LanguageText>{t("auth.description")}</LanguageText>
        </p>
      </header>

      <div className="w-full max-w-sm mx-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">
              <LanguageText withFont={true}>{t("auth.signInButton")}</LanguageText>
            </TabsTrigger>
            <TabsTrigger value="signup">
              <LanguageText withFont={true}>{t("auth.signUpButton")}</LanguageText>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
