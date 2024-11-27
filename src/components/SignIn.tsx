import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";

export const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          await supabase.auth.resend({
            type: 'signup',
            email: email,
          });
          
          toast({
            title: "Email Not Confirmed",
            description: "Please confirm your email before signing in. A new confirmation email has been sent - check your inbox and spam folder.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        toast({
          title: "Email Not Confirmed",
          description: "Please confirm your email before signing in. Check your inbox and spam folder.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Signed in successfully",
      });
      
      // Wait a brief moment to ensure the session is set
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-left">Sign In</h2>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-left block">Email</Label>
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
            <Label htmlFor="password" className="text-left block">Password</Label>
            <Link 
              to="/reset-password"
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