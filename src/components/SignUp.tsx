import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { SignUpFields } from "./signup/SignUpFields";
import { SubscriptionPlanSelect } from "./signup/SubscriptionPlanSelect";
import { createSubscription } from "@/lib/subscription";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const { toast } = useToast();

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      // Validate passwords match
      if (password !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
          duration: 4000,
        });
        setIsLoading(false);
        return;
      }

      // Validate password requirements
      const passwordError = validatePassword(password);
      if (passwordError) {
        toast({
          title: "Invalid Password",
          description: passwordError,
          variant: "destructive",
          duration: 4000,
        });
        setIsLoading(false);
        return;
      }

      // Validate username length
      if (username.length < 3) {
        toast({
          title: "Error",
          description: "Username must be at least 3 characters long",
          variant: "destructive",
          duration: 4000,
        });
        setIsLoading(false);
        return;
      }

      // Check if username exists
      const { data: existingUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (fetchError) throw fetchError;

      if (existingUsers && existingUsers.length > 0) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
          duration: 4000,
        });
        setIsLoading(false);
        return;
      }

      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          }
        },
      });
      
      if (error) {
        if (error.message.includes("over_email_send_rate_limit")) {
          toast({
            title: "Rate Limit Exceeded",
            description: "For security purposes, please wait 60 seconds before trying again.",
            variant: "destructive",
            duration: 8000,
          });
          console.log("Rate limit error:", error);
          return;
        } else if (error.message.includes("User already registered")) {
          toast({
            title: "Error",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
            duration: 4000,
          });
        } else {
          throw error;
        }
        return;
      }

      if (data?.user) {
        try {
          // First, get the subscription plan details
          const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('type', selectedPlan)
            .maybeSingle();

          if (planError) {
            console.error('Plan fetch error:', planError);
            throw new Error('Failed to fetch subscription plan details');
          }

          if (!plan) {
            console.error('No plan found for type:', selectedPlan);
            throw new Error(`No subscription plan found for type: ${selectedPlan}`);
          }

          // Create subscription for the new user
          await createSubscription(data.user.id, selectedPlan);

          toast({
            title: "Success",
            description: "Please check your email (including spam folder) to confirm your account before signing in.",
            duration: 8000,
          });
          
          // Clear form
          setEmail("");
          setUsername("");
          setPassword("");
          setConfirmPassword("");
        } catch (subscriptionError: any) {
          console.error('Subscription creation error:', subscriptionError);
          toast({
            title: "Account Created",
            description: "Your account was created but there was an issue with the subscription setup. Please contact support or try signing in to resolve this.",
            variant: "destructive",
            duration: 8000,
          });
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign up",
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign Up</h2>
      <form onSubmit={handleSignUp} className="space-y-4">
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