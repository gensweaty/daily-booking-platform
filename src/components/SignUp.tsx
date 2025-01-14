import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SignUpFields } from "./signup/SignUpFields";
import { SubscriptionPlanSelect } from "./signup/SubscriptionPlanSelect";
import { useSignup } from "@/hooks/useSignup";
import { useToast } from "@/hooks/use-toast";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  
  const { handleSignup, isLoading } = useSignup();
  const { toast } = useToast();

  const clearForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    await handleSignup(email, username, password, confirmPassword, selectedPlan, clearForm);
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign Up</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <SignUpFields
          email={email}
          setEmail={setEmail}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          isLoading={isLoading}
        />
        <SubscriptionPlanSelect
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          isLoading={isLoading}
        />
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "Signing up..." : "Sign Up"}
        </Button>
      </form>
    </div>
  );
};