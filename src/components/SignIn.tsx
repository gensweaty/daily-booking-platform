import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const validateInputs = () => {
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return false;
    }
    
    if (!email.includes('@')) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        console.error('Sign in error:', error);
        
        // Handle different error scenarios
        if (error.status === 500) {
          toast({
            title: "Server Error",
            description: "We're experiencing technical difficulties. Please try again later.",
            variant: "destructive",
          });
        } else if (error.status === 400) {
          const errorMessage = error.message?.includes("Invalid login credentials")
            ? "Invalid email or password. Please check your credentials and try again."
            : error.message?.includes("Email not confirmed")
            ? "Please confirm your email address before signing in."
            : "An error occurred during sign in. Please try again.";
            
          toast({
            title: "Sign in failed",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "An unexpected error occurred. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      if (data.session) {
        toast({
          title: "Success",
          description: "Successfully signed in!",
        });
      }
      
    } catch (error: any) {
      console.error("Unexpected error during sign in:", error);
      toast({
        title: "Error",
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