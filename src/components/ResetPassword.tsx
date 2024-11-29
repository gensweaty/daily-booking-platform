import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";

export const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast({
        title: "Invalid Password",
        description: passwordError,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your password has been reset successfully. Please sign in with your new password.",
      });

      // Clear form
      setNewPassword("");
      setConfirmPassword("");
      
      // Redirect to sign in page after a short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
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
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Reset Password</h2>
      <form onSubmit={handlePasswordReset} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
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
          {isLoading ? "Resetting Password..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
};