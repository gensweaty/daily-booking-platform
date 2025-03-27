
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: t("auth.loginSuccess") || "Login successful!",
        description: t("auth.welcome") || "Welcome back",
      });
      
      // AuthContext will handle the redirect based on redirectAfterLogin
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

  // Ensure we clear any old recovery tokens when visiting the forgot password page
  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing Supabase session to avoid conflicts with the password reset flow
    supabase.auth.signOut().then(() => {
      console.log("Signed out before navigating to forgot password");
      // Navigate to forgot password page
      navigate("/forgot-password");
    });
  };

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div className="mb-4">
        <Label htmlFor="email" className="block text-sm font-medium mb-1">{t("auth.email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full"
        />
      </div>
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <Label htmlFor="password" className="block text-sm font-medium">{t("auth.password")}</Label>
          <button 
            type="button"
            className="text-xs text-primary hover:underline focus:outline-none"
            onClick={handleForgotPasswordClick}
          >
            {t("auth.forgotPassword")}
          </button>
        </div>
        <Input
          id="password"
          type="password"
          placeholder={t("auth.password")}
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
        {loading ? t("common.loading") : t("auth.signInButton")}
      </Button>
    </form>
  );
};
