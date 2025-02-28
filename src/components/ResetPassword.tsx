
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useNavigate, Link, useSearchParams, useLocation } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [verificationInProgress, setVerificationInProgress] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Debug utility to log URL information
  const logUrlInfo = () => {
    console.log("URL Debug Info:");
    console.log("- Full URL:", window.location.href);
    console.log("- Hash:", window.location.hash);
    console.log("- Path:", window.location.pathname);
    console.log("- Search:", window.location.search);
  };

  useEffect(() => {
    // Log URL information for debugging
    logUrlInfo();
    
    // Verify the password reset session
    const verifySession = async () => {
      try {
        setVerificationInProgress(true);
        setVerificationError(null);
        
        // Check if we have a session from the URL (Supabase should have processed tokens already)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session) {
          console.log("Session found via URL tokens:", session);
          setTokenVerified(true);
          setVerificationInProgress(false);
          return;
        }
        
        if (sessionError) {
          console.error("Error getting session:", sessionError);
        }
        
        // If we have a hash with access_token, try to manually handle it
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log("Found tokens in URL hash, setting session manually");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error("Error setting session from hash params:", error);
            throw error;
          }
          
          if (data.session) {
            console.log("Session set successfully from hash params");
            setTokenVerified(true);
            setVerificationInProgress(false);
            return;
          }
        }
        
        // If we have a recovery token in the URL query
        const token = searchParams.get('token');
        if (token) {
          console.log("Found recovery token in URL query");
          try {
            // Try to verify with token
            const { error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'recovery'
            });
            
            if (error) {
              console.error("Token verification error:", error);
              throw error;
            }
            
            console.log("Token verified successfully");
            setTokenVerified(true);
            setVerificationInProgress(false);
            return;
          } catch (err) {
            console.error("Error verifying token:", err);
            throw err;
          }
        }
        
        // If we get here, we couldn't verify the session
        throw new Error("Could not verify password reset session from URL");
      } catch (error: any) {
        console.error("Password reset verification failed:", error);
        setVerificationError(error.message || "Invalid or expired password reset link");
        setVerificationInProgress(false);
      }
    };
    
    verifySession();
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Please make sure your passwords match.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Validate password length
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
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error("Password update error:", error);
        throw error;
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
          <div className="text-center py-4 space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <p className="text-destructive font-medium">Password reset link is invalid or has expired</p>
            {verificationError && (
              <p className="text-sm text-muted-foreground border p-2 rounded bg-muted mt-2">
                Error details: {verificationError}
              </p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link to="/forgot-password">Request a new reset link</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
