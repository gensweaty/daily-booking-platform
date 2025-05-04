
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    console.log("AuthUI effect ran. Path:", location.pathname, "Search:", location.search);
    console.log("AuthUI - Current path:", location.pathname);
    console.log("AuthUI - Current search params:", location.search);
    
    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }

    // More reliable way to parse search params and detect errors
    const searchParams = new URLSearchParams(location.search);
    const error = searchParams.get('error');
    console.log("AuthUI - Parsed error param:", error);
    
    if (error === 'confirmation_failed') {
      setShowAlert(true);
      setAlertMessage("Email confirmation failed. If you don't receive a confirmation email, please check your spam folder or try signing up with a different email address.");
    } else if (error === 'email_error') {
      setShowAlert(true);
      setAlertMessage("There seems to be an issue with our email delivery system. Please try again later or contact support.");
    } else {
      // Reset alert state if no errors
      setShowAlert(false);
      setAlertMessage("");
    }
  }, [location]); // Using location as dependency to ensure it runs on any location change

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

      {showAlert && (
        <Alert className="max-w-sm mx-auto mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-center">
            {alertMessage || "If you don't receive a confirmation email, please check your spam folder or try signing up with a different email address."}
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
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
