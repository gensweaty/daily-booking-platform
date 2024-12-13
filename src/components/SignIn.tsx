import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    setIsLoading(true);
    console.log("Starting sign in process...");
    
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      // First, ensure we're starting with a clean slate
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.log("Sign out before sign in failed:", signOutError);
        // Continue with sign in attempt even if sign out fails
      }
      
      console.log("Attempting sign in...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        console.error("Sign in error:", error);
        
        let errorMessage = "An unexpected error occurred. Please try again.";
        let errorTitle = "Sign In Failed";

        if (error.message.includes("Invalid login credentials")) {
          errorTitle = "Invalid Credentials";
          errorMessage = "The email or password you entered is incorrect.";
        } else if (error.message.includes("Email not confirmed")) {
          errorTitle = "Email Not Verified";
          errorMessage = "Please check your email and verify your account.";
        } else if (error.status === 500 || error.message.includes("Database error")) {
          errorTitle = "Service Unavailable";
          errorMessage = "We're experiencing technical difficulties. Please try again in a moment.";
          
          // Additional error logging for debugging
          console.error("Database error details:", {
            status: error.status,
            message: error.message,
            error: error
          });
        }

        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (data?.user) {
        console.log("Sign in successful");
        toast({
          title: "Welcome Back!",
          description: "You've successfully signed in.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      toast({
        title: "System Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign In</h2>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Password</Label>
            <Link 
              to="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
};