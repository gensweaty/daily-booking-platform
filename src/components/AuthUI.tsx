
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { useLocation, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { logSignupDebug } from "@/utils/signupLogger";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showEmailAlert, setShowEmailAlert] = useState(false);
  const [emailVerificationAttempted, setEmailVerificationAttempted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    // Check for email_confirmed flag in URL parameters
    const emailSent = searchParams.get('email_sent') === 'true';
    const emailError = searchParams.get('error') === 'confirmation_failed';
    
    if (emailSent) {
      setShowEmailAlert(true);
      // Log this event for debugging
      logSignupDebug('Email sent flag detected in URL', { source: 'AuthUI' });
      
      // Remove the parameter from the URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('email_sent');
      navigate({ search: newParams.toString() }, { replace: true });
    }
    
    if (emailError) {
      setEmailVerificationAttempted(true);
      // Log this event for debugging
      logSignupDebug('Email verification error detected in URL', { source: 'AuthUI' });
      
      // Remove the parameter from the URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('error');
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
        <Alert className="mb-6 max-w-md mx-auto bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Check your email</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <p className="mb-2">
              A confirmation email has been sent. Please check both your <strong>inbox and spam folder</strong> to verify your account.
            </p>
            <p className="mb-1 font-medium">Important troubleshooting steps:</p>
            <ul className="list-disc ml-5 text-xs mb-3">
              <li>Check your spam/junk folder carefully</li>
              <li>If using Yahoo, Yandex, or ProtonMail, try a Gmail or Outlook account instead</li>
              <li>Make sure your email address was entered correctly</li>
              <li>Wait a few minutes - email delivery can sometimes be delayed</li>
              <li>Return to sign-up to try again or use the "Resend Confirmation" option</li>
            </ul>
            
            <p className="text-xs mt-3">
              <strong>Note:</strong> We've identified a potential issue with our email delivery system. 
              If you do not receive an email after multiple attempts, please try signing up with a different email provider.
            </p>
          </AlertDescription>
        </Alert>
      )}
      
      {emailVerificationAttempted && (
        <Alert className="mb-6 max-w-md mx-auto bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-800 dark:text-red-300">Email Verification Failed</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-400">
            <p className="mb-2">
              We couldn't verify your email. This could be because:
            </p>
            <ul className="list-disc ml-5 text-xs">
              <li>The verification link has expired</li>
              <li>You've already verified this email</li>
              <li>There was a system issue with verification</li>
            </ul>
            <p className="mt-2">
              Please try signing in or sign up again if needed.
            </p>
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
