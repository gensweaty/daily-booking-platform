
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "next-themes";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // On component mount, sign out to clear any existing session
  useEffect(() => {
    const clearSession = async () => {
      try {
        await supabase.auth.signOut();
        console.log("Signed out before navigating to forgot password");
      } catch (error) {
        console.error("Error signing out:", error);
      }
    };
    
    clearSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Attempting to send reset email to:", email);

    try {
      // Get the current origin (domain)
      const origin = window.location.origin;
      console.log("Current origin:", origin);
      
      // Request password reset with the correct redirect URL
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: origin,
      });

      console.log("Reset password response:", { data, error });

      if (error) {
        console.error("Password reset request error:", error);
        
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          toast({
            title: "Too many attempts",
            description: "Please wait a moment before trying again",
            variant: "destructive"
          });
        } else {
          // Still show success message for security
          handleSuccess();
        }
      } else {
        console.log("Reset password email sent successfully");
        handleSuccess();
      }
    } catch (error: any) {
      console.error("Password reset request error:", error);
      // Still show success message for security
      handleSuccess();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    toast({
      title: "Reset link sent",
      description: "If an account exists with this email, you'll receive a password reset link shortly",
    });
    setEmailSent(true);
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              {t("auth.backToSignIn")}
            </Link>
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
      </header>
      
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 bg-card border rounded-lg shadow-sm">
        <h2 className="text-2xl font-bold mb-6 text-center">{t("auth.resetPassword")}</h2>
        
        {emailSent ? (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground mb-4">
              {t("auth.checkEmailReset")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("auth.dontSeeEmail")}
            </p>
            <Button 
              variant="outline" 
              className="mt-2"
              onClick={() => setEmailSent(false)}
            >
              {t("auth.sendAnotherLink")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.enterEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? t("auth.sending") : t("auth.sendResetLink")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
