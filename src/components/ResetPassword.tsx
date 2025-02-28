
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const handleRecoveryToken = async () => {
      try {
        // Get the hash fragment from the URL
        const hashFragment = window.location.hash;
        if (!hashFragment) {
          console.log("No hash fragment found in URL");
          toast({
            title: "Error",
            description: "Invalid or expired recovery link. Please request a new one.",
            variant: "destructive",
          });
          navigate("/forgot-password");
          return;
        }

        // Parse the hash fragment
        const params = new URLSearchParams(hashFragment.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        console.log("URL params:", { type, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

        if (!accessToken || type !== 'recovery') {
          console.log("Invalid recovery parameters");
          toast({
            title: "Error",
            description: "Invalid or expired recovery link. Please request a new one.",
            variant: "destructive",
          });
          navigate("/forgot-password");
          return;
        }

        // Set the session with the recovery token
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw sessionError;
        }

        console.log("Recovery session set successfully");
      } catch (error) {
        console.error("Recovery token handling error:", error);
        toast({
          title: "Error",
          description: "An error occurred. Please try requesting a new password reset link.",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };

    handleRecoveryToken();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (password !== confirmPassword) {
        toast({
          title: "Error",
          description: t("auth.passwordsDoNotMatch") || "Passwords do not match",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        toast({
          title: "Error",
          description: t("auth.passwordTooShort") || "Password must be at least 6 characters long",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: t("auth.passwordUpdated") || "Password updated successfully. Please sign in with your new password.",
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: "Error",
        description: error.message || t("auth.passwordUpdateFailed") || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
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
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      <div className="w-full max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">{t("auth.setNewPassword") || "Set New Password"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.newPassword") || "New Password"}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("auth.enterNewPassword") || "Enter new password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("auth.confirmPassword") || "Confirm Password"}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("auth.confirmNewPassword") || "Confirm new password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? (t("auth.updating") || "Updating...") : (t("auth.updatePassword") || "Update Password")}
          </Button>
        </form>
      </div>
    </div>
  );
};
