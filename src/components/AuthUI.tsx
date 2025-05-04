
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showEmailAlert, setShowEmailAlert] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    // Check for email_confirmed flag in URL parameters
    const emailSent = searchParams.get('email_sent') === 'true';
    if (emailSent) {
      setShowEmailAlert(true);
      // Remove the parameter from the URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('email_sent');
      navigate({ search: newParams.toString() }, { replace: true });
    }

    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }
  }, [location.pathname, navigate, searchParams]);

  return (
    <div className="min-h-screen bg-background p-4">
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
                src={theme === 'dark' 
                  ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                  : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                }
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
          {t("auth.welcome")}
        </h1>
        <p className="text-foreground/80 text-center text-sm mb-4">
          {t("auth.description")}
        </p>
      </header>

      {showEmailAlert && (
        <Alert className="mb-6 max-w-sm mx-auto bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Check your email</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            A confirmation email has been sent. Please check both your inbox and spam folder to verify your account.
          </AlertDescription>
        </Alert>
      )}

      <div className="w-full max-w-sm mx-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="signin">{t("auth.signInButton")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signUpButton")}</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp setShowEmailAlert={setShowEmailAlert} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
