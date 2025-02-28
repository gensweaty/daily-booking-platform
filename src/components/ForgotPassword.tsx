
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "next-themes";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const { theme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Attempting to send reset email to:", email);

    try {
      // Create a new anonymous session to prevent "Session expired" errors
      // This ensures we're not relying on any existing session that might be invalid
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log("Current session before reset:", sessionData);
      
      if (sessionError) {
        console.error("Session check error:", sessionError);
      }

      // Use resetPasswordForEmail without relying on existing session
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Password reset request error:", error);
        
        if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
          toast({
            title: "Too many attempts",
            description: "Please wait a moment before trying again",
            variant: "destructive"
          });
        } else {
          // Still show success message to prevent email enumeration
          toast({
            title: t("auth.resetLinkSent"),
            description: t("auth.resetLinkSentDescription"),
          });
        }
      } else {
        console.log("Reset password email sent successfully");
        toast({
          title: t("auth.resetLinkSent"),
          description: t("auth.resetLinkSentDescription"),
        });
        setEmail("");
      }
    } catch (error: any) {
      console.error("Password reset request error:", error);
      // Still show success message to prevent email enumeration
      toast({
        title: t("auth.resetLinkSent"),
        description: t("auth.resetLinkSentDescription"),
      });
    } finally {
      setIsLoading(false);
    }
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
      
      <div className="w-full max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">{t("auth.resetPassword")}</h2>
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
      </div>
    </div>
  );
};
