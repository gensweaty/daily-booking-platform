import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Attempting to send reset email to:", email);

    try {
      // Send the reset password email directly without checking profiles
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Password reset request error:", error);
        throw error;
      }

      console.log("Reset password email sent successfully");
      toast({
        title: "Reset Link Sent",
        description: "If an account exists with this email, you will receive a password reset link.",
      });
      setEmail("");
    } catch (error: any) {
      console.error("Password reset request error:", error);
      // Don't reveal if email exists or not for security
      toast({
        title: "Reset Link Sent",
        description: "If an account exists with this email, you will receive a password reset link.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="w-full max-w-md mx-auto p-4 sm:p-6">
        <Link to="/login" className="flex items-center gap-2 text-sm mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>
        
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Reset Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </div>
    </div>
  );
};