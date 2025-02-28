
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

  // Debug utility to log all URL parameters for troubleshooting
  const logUrlParams = () => {
    const fullUrl = window.location.href;
    const path = window.location.pathname;
    const searchParamsString = window.location.search;
    const hashString = window.location.hash;
    const parsedSearchParams = Object.fromEntries(searchParams.entries());
    
    console.log("===== PASSWORD RESET DEBUG INFO =====");
    console.log("Full URL:", fullUrl);
    console.log("Path:", path);
    console.log("Search params string:", searchParamsString);
    console.log("Hash string:", hashString);
    console.log("Parsed search params:", parsedSearchParams);
    console.log("Code parameter:", searchParams.get('code'));
    console.log("Type parameter:", searchParams.get('type'));
    console.log("=====================================");
    
    return {
      fullUrl,
      path,
      searchParamsString,
      hashString,
      parsedSearchParams
    };
  };

  // Function to extract code from URL (trying all possible locations)
  const extractResetCode = () => {
    // First try from search params
    const codeFromSearch = searchParams.get('code');
    if (codeFromSearch) {
      return codeFromSearch;
    }
    
    // Try to extract from hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const codeFromHash = hashParams.get('code');
    if (codeFromHash) {
      return codeFromHash;
    }
    
    // If we have an access_token in the URL, we might be in a different auth flow
    if (hashParams.has('access_token')) {
      console.log("Found access_token in URL, may be using different auth flow");
    }
    
    // Try to extract directly from URL path for cases where routing is failing
    const pathMatch = window.location.pathname.match(/\/reset-password\/(.+)$/);
    if (pathMatch && pathMatch[1]) {
      console.log("Found potential code in URL path:", pathMatch[1]);
      return pathMatch[1];
    }
    
    return null;
  };

  useEffect(() => {
    // Handle password reset when component mounts
    const handlePasswordReset = async () => {
      try {
        setVerificationInProgress(true);
        setVerificationError(null);
        
        // Log URL parameters for debugging
        logUrlParams();
        
        // First, we need to handle the reset properly
        // Check for the presence of a code parameter
        const code = extractResetCode();
        
        if (!code) {
          console.error("No code found in URL parameters");
          setVerificationError("No password reset code was found in the URL. Please request a new reset link.");
          setVerificationInProgress(false);
          return;
        }
        
        // Supabase recommends using exchangeCodeForSession for password reset flows
        console.log("Attempting to exchange code for session...");
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
          console.error("Error exchanging code for session:", error);
          setVerificationError(`Error: ${error.message}`);
          setVerificationInProgress(false);
          return;
        }
        
        if (data?.session) {
          console.log("Session obtained successfully");
          setTokenVerified(true);
        } else {
          console.error("No session returned after code exchange");
          setVerificationError("Failed to verify the reset link. Please request a new one.");
        }
      } catch (error: any) {
        console.error("Password reset verification error:", error);
        setVerificationError(`Unexpected error: ${error.message || "Unknown error"}`);
      } finally {
        setVerificationInProgress(false);
      }
    };
    
    handlePasswordReset();
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
