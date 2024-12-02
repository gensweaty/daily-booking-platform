import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First check if the user exists
      const { data: userExists } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', email)
        .single();

      // If user doesn't exist, show a specific message
      if (!userExists) {
        toast({
          title: "Account Not Found",
          description: "No account found with this email. Please check your email or sign up.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Attempt to sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Sign In Failed",
            description: "Invalid password. Please check your password and try again.",
            variant: "destructive",
          });
          return;
        }

        if (error.message.includes("Email not confirmed")) {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: email,
          });
          
          if (!resendError) {
            toast({
              title: "Email Not Confirmed",
              description: "We've sent a new confirmation email. Please check your inbox and spam folder.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: "Failed to resend confirmation email. Please try again later.",
              variant: "destructive",
            });
          }
          return;
        }

        throw error;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
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
          <Label htmlFor="password">Password</Label>
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
        <div className="flex justify-end">
          <Link 
            to="/forgot-password" 
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
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