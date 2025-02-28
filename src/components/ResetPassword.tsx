
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
import { ArrowLeft } from "lucide-react";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [verificationInProgress, setVerificationInProgress] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();

  // Debug function to log URL parameters
  const logUrlParams = () => {
    console.log("Full URL:", window.location.href);
    console.log("Hash:", window.location.hash);
    console.log("Search params:", window.location.search);
  };

  // Extract recovery token parameters from URL
  const extractTokenParams = () => {
    logUrlParams();
    
    // Check hash parameters (new auth flow)
    const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Remove # before parsing
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    
    // Check query parameters (old auth flow)
    const queryParams = new URLSearchParams(window.location.search);
    const tokenHash = queryParams.get('token_hash');
    const typeFromQuery = queryParams.get('type');
    
    console.log("Extracted params:", { 
      accessToken: !!accessToken, 
      refreshToken: !!refreshToken, 
      tokenHash: !!tokenHash, 
      type: type || typeFromQuery 
    });
    
    return { 
      accessToken, 
      refreshToken, 
      tokenHash, 
      type: type || typeFromQuery 
    };
  };

  useEffect(() => {
    // Always sign out first to ensure a clean state for password reset
    const signOutAndVerify = async () => {
      try {
        setVerificationInProgress(true);
        console.log("Signing out before verifying recovery token...");
        
        // Sign out to clear any existing session
        await supabase.auth.signOut();
        
        console.log("Verifying recovery token...");
        const { accessToken, refreshToken, tokenHash, type } = extractTokenParams();
        
        // If we don't have any recovery parameters, just show the error
        if (!accessToken && !tokenHash) {
          console.error("No recovery parameters found in URL");
          setVerificationInProgress(false);
          return;
        }
        
        // Try to verify using different methods based on what we have
        let verified = false;
        
        // 1. Try access_token method (hash fragment)
        if (accessToken && type === 'recovery') {
          console.log("Using access_token method");
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });
            
            if (error) {
              console.error("Error setting session with access token:", error);
            } else {
              console.log("Successfully verified token using access_token");
              verified = true;
            }
          } catch (error) {
            console.error("Error in access_token verification:", error);
          }
        }
        
        // 2. Try token_hash method (query parameter)
        if (!verified && tokenHash && (type === 'recovery' || typeFromQuery === 'recovery')) {
          console.log("Using token_hash method");
          try {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            });
            
            if (error) {
              console.error("Error verifying OTP with token_hash:", error);
            } else {
              console.log("Successfully verified token using token_hash");
              verified = true;
            }
          } catch (error) {
            console.error("Error in token_hash verification:", error);
          }
        }
        
        // 3. Final check - see if we have a session after our attempts
        if (!verified) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            console.log("Session exists after verification attempts");
            verified = true;
          }
        }
        
        setTokenVerified(verified);
        
        if (!verified) {
          console.error("All verification methods failed");
          toast({
            title: "Password Reset Link Invalid",
            description: "Your password reset link has expired or is invalid. Please request a new one.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Token verification error:", error);
        toast({
          title: "Error Processing Reset Link",
          description: "There was a problem with your password reset link. Please try again.",
          variant: "destructive",
        });
      } finally {
        setVerificationInProgress(false);
      }
    };

    signOutAndVerify();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (password !== confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Please make sure your passwords match.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Your password must be at least 6 characters long.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      console.log("Updating password...");
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        throw updateError;
      }

      console.log("Password updated successfully");
      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully. You can now log in with your new password.",
      });

      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: "Error Updating Password",
        description: error.message || "There was a problem updating your password. Please try again.",
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
          <div className="flex items-center gap-4">
            <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
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
        <h2 className="text-2xl font-bold mb-6 text-center">Reset Your Password</h2>
        
        {verificationInProgress ? (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Verifying your reset link...</p>
          </div>
        ) : tokenVerified ? (
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
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
        ) : (
          <div className="text-center py-4">
            <p className="text-destructive mb-4">Your password reset link is invalid or has expired.</p>
            <Button asChild variant="outline">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
