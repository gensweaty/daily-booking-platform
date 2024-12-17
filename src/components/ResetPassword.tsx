import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link } from "react-router-dom";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkRecoveryToken = async () => {
      try {
        if (!window.location.hash) {
          console.log("No hash found in URL");
          toast({
            title: "Error",
            description: "Invalid or expired recovery link. Please request a new one.",
            variant: "destructive",
          });
          navigate("/forgot-password");
          return;
        }

        const fragment = new URLSearchParams(window.location.hash.substring(1));
        const token = fragment.get('access_token');
        const type = fragment.get('type');

        console.log("URL params:", { token, type });

        if (!token || type !== 'recovery') {
          console.log("No recovery token found or wrong type");
          toast({
            title: "Error",
            description: "Invalid or expired recovery link. Please request a new one.",
            variant: "destructive",
          });
          navigate("/forgot-password");
          return;
        }

        setRecoveryToken(token);
      } catch (error) {
        console.error("Error in recovery flow:", error);
        toast({
          title: "Error",
          description: "An error occurred. Please try again.",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };

    checkRecoveryToken();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Attempting to reset password");

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      if (!recoveryToken) {
        throw new Error("No recovery token available");
      }

      // First set the session with the recovery token
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: recoveryToken,
        refresh_token: '',
      });

      if (sessionError) {
        throw sessionError;
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
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
      console.error("Password reset error:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while resetting your password",
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
          <Link to="/" className="text-2xl font-bold text-primary hover:text-primary/90">
            Taskify Minder
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full max-w-md mx-auto p-4 sm:p-6">
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Set New Password</h2>
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
            <Label htmlFor="confirmPassword">Confirm Password</Label>
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
      </div>
    </div>
  );
};