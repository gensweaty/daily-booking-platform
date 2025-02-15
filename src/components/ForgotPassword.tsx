
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Attempting to send reset email to:", email);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Password reset request error:", error);
        throw error;
      }

      console.log("Reset password email sent successfully");
      toast({
        title: t("auth.resetLinkSent"),
        description: t("auth.resetLinkSentDescription"),
      });
      setEmail("");
    } catch (error: any) {
      console.error("Password reset request error:", error);
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
      <div className="w-full max-w-md mx-auto p-4 sm:p-6">
        <Link to="/login" className="flex items-center gap-2 text-sm mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          {t("auth.backToSignIn")}
        </Link>
        
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
