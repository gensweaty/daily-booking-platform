
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // No need to navigate here, AuthContext will handle it
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    supabase.auth.signOut().then(() => {
      console.log("Signed out before navigating to forgot password");
      navigate("/forgot-password");
    });
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div className="mb-4">
        <Label htmlFor="email" className="block text-sm font-medium mb-1">
          {isGeorgian ? <LanguageText>{t("auth.emailLabel")}</LanguageText> : t("auth.emailLabel")}
        </Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full"
        />
      </div>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="password" className="block text-sm font-medium">
            {isGeorgian ? <LanguageText>{t("auth.passwordLabel")}</LanguageText> : t("auth.passwordLabel")}
          </Label>
          <button 
            type="button"
            className="text-xs text-primary hover:underline focus:outline-none"
            onClick={handleForgotPasswordClick}
          >
            {isGeorgian ? <LanguageText>{t("auth.forgotPassword")}</LanguageText> : t("auth.forgotPassword")}
          </button>
        </div>
        <Input
          id="password"
          type="password"
          placeholder={t("auth.passwordLabel")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          className="w-full"
        />
      </div>
      <Button 
        type="submit" 
        className="w-full bg-primary text-white font-medium"
        disabled={loading}
      >
        {isGeorgian ? (
          <LanguageText>{loading ? t("auth.loading") : t("auth.signInButton")}</LanguageText>
        ) : (
          loading ? t("auth.loading") : t("auth.signInButton")
        )}
      </Button>
    </form>
  );
};
