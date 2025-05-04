
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertSeverity, setAlertSeverity] = useState<"warning" | "error" | "info">("warning");
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    console.log("AuthUI effect ran. Path:", location.pathname, "Search:", location.search);
    
    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }

    // Parse search params to detect different error types
    const searchParams = new URLSearchParams(location.search);
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    console.log("AuthUI - Parsed error param:", error, "success param:", success);
    
    // Handle success confirmations first
    if (success === 'email_confirmed') {
      setShowAlert(true);
      setAlertTitle("Email Confirmed");
      setAlertMessage("Your email has been confirmed successfully. You can now log in to your account.");
      setAlertSeverity("info");
      return;
    }
    
    // Handle various error scenarios
    if (error === 'confirmation_failed') {
      setShowAlert(true);
      setAlertTitle("Email Confirmation Failed");
      setAlertMessage("Email confirmation failed. If you don't receive a confirmation email, please check your spam folder or try signing up with a different email address.");
      setAlertSeverity("error");
    } else if (error === 'email_error') {
      setShowAlert(true);
      setAlertTitle("Email System Issue");
      setAlertMessage("There seems to be an issue with our email delivery system. Please try again later or contact support.");
      setAlertSeverity("error");
    } else if (error === 'invalid_code') {
      setShowAlert(true);
      setAlertTitle("Invalid Code");
      setAlertMessage("The confirmation link you used is invalid or has expired. Please try signing up again.");
      setAlertSeverity("error");
    } else {
      // Reset alert state if no errors
      setShowAlert(false);
      setAlertMessage("");
      setAlertTitle("");
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
        <Alert className={`max-w-sm mx-auto mb-6 ${
          alertSeverity === "error" 
            ? "border-red-500 bg-red-50 dark:bg-red-900/20" 
            : alertSeverity === "info"
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
        }`}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{alertTitle}</AlertTitle>
          <AlertDescription className="text-center">
            {alertMessage}
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
