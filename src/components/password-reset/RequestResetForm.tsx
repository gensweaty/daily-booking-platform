import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

export const RequestResetForm = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownActive, setCooldownActive] = useState(false);
  const { toast } = useToast();

  const startCooldown = () => {
    setCooldownActive(true);
    setTimeout(() => {
      setCooldownActive(false);
    }, 15000); // 15 seconds cooldown
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cooldownActive) {
      toast({
        title: "Please wait",
        description: "For security purposes, please wait 15 seconds before requesting another reset link.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?type=recovery`,
      });

      if (error) {
        if (error.message.includes('rate_limit') || error.message.includes('over_email_send_rate_limit')) {
          startCooldown();
          toast({
            title: "Please wait",
            description: "For security purposes, please wait 15 seconds before requesting another reset link.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      startCooldown();
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link. Click the link to reset your password.",
      });
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
    <div className="text-center">
      <h2 className="text-2xl font-bold">Reset Password</h2>
      <p className="text-muted-foreground mt-2">Enter your email to receive a reset link</p>
      <form onSubmit={handleResetRequest} className="space-y-4 mt-4">
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
            disabled={isLoading || cooldownActive}
          />
        </div>
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading || cooldownActive}
        >
          {cooldownActive 
            ? "Please wait 15s..." 
            : isLoading 
              ? "Sending..." 
              : "Send Reset Link"
          }
        </Button>
      </form>
    </div>
  );
};