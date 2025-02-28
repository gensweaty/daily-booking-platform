
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
  const [tokenVerified, setTokenVerified] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const handleRecoveryToken = async () => {
      try {
        // Log the full URL for debugging
        console.log("Full URL:", window.location.href);
        
        // Try different approaches to getting the token
        
        // 1. Check hash fragment (#access_token=...)
        const hashFragment = window.location.hash;
        if (hashFragment) {
          console.log("Found hash fragment:", hashFragment);
          const params = new URLSearchParams(hashFragment.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const type = params.get('type');
          
          console.log("Hash params:", { type, hasToken: !!accessToken });
          
          if (accessToken && type === 'recovery') {
            try {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              
              if (error) throw error;
              console.log("Successfully set session from hash fragment");
              setTokenVerified(true);
              return;
            } catch (error) {
              console.error("Error setting session from hash:", error);
              // Continue to try other methods
            }
          }
        }
        
        // 2. Check query parameters (?token_hash=...)
        const searchParams = new URLSearchParams(window.location.search);
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        
        if (tokenHash && type === 'recovery') {
          console.log("Found token_hash in URL parameters");
          
          // For token_hash, we don't need to manually set the session
          // Supabase JS client should handle this automatically
          
          // Check if we have a session
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Error getting session after token_hash:", error);
            throw error;
          }
          
          if (data.session) {
            console.log("Session exists after token_hash processing");
            setTokenVerified(true);
            return;
          } else {
            console.log("No session found after token_hash processing");
            // Try to verify the token_hash directly
            try {
              // This is a special case - we'll try to verify the token directly
              const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'recovery',
              });
              
              if (error) throw error;
              console.log("Successfully verified OTP");
              setTokenVerified(true);
              return;
            } catch (e) {
              console.error("Error verifying OTP:", e);
              // Continue to try other methods
            }
          }
        }
        
        // 3. If the URL doesn't have explicit tokens but we're on the reset password page,
        // check if we already have a valid session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log("User already has a valid session");
          setTokenVerified(true);
          return;
        }
        
        // If we've tried all approaches and still don't have a valid token,
        // the recovery link is probably invalid or expired
        console.log("No valid recovery token found after trying all approaches");
        toast({
          title: "Invalid Recovery Link",
          description: "The password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
        });
        navigate("/forgot-password");
        
      } catch (error) {
        console.error("Recovery token handling error:", error);
        toast({
          title: "Error",
          description: "An error occurred while processing your password reset link. Please try requesting a new one.",
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
          description: t("auth.passwordsDoNotMatch"),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        toast({
          title: "Error",
          description: t("auth.passwordTooShort"),
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log("Attempting to update password");
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        throw updateError;
      }

      console.log("Password updated successfully");
      toast({
        title: "Success",
        description: "Password updated successfully. Please sign in with your new password.",
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
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
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Set New Password</h2>
        
        {!tokenVerified ? (
          <div className="text-center">
            <p className="mb-4">Verifying your reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("auth.confirmPasswordLabel")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
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
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
