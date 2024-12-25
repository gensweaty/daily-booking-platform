import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { useSearchParams } from "react-router-dom";
import { SignUpForm } from "./signup/SignUpForm";

export const SignUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get('plan') || 'monthly';
  const [lastAttemptTime, setLastAttemptTime] = useState<number | null>(null);
  const COOLDOWN_PERIOD = 60000; // 1 minute cooldown

  const handleSignUp = async ({ email, username, password }: { 
    email: string; 
    username: string; 
    password: string 
  }) => {
    const now = Date.now();
    if (lastAttemptTime && (now - lastAttemptTime) < COOLDOWN_PERIOD) {
      const remainingTime = Math.ceil((COOLDOWN_PERIOD - (now - lastAttemptTime)) / 1000);
      toast({
        title: "Please Wait",
        description: `Please wait ${remainingTime} seconds before trying again.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setLastAttemptTime(now);
    
    try {
      console.log("Starting signup process with plan:", selectedPlan);

      // Check if username already exists
      const { data: existingUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (fetchError) {
        console.error("Error checking username:", fetchError);
        throw fetchError;
      }

      if (existingUsers?.length > 0) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        throw signUpError;
      }

      if (!authData?.user) {
        console.error("No user data returned from signup");
        throw new Error("Failed to create user account");
      }

      // Get the plan_id for the selected plan type
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('id, name')
        .eq('type', selectedPlan)
        .single();

      if (planError) {
        console.error("Error fetching plan:", planError);
        throw planError;
      }

      if (!planData) {
        console.error("No plan found for type:", selectedPlan);
        throw new Error("Selected plan not found");
      }

      console.log("Creating subscription with plan:", planData);

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial

      // Create subscription with trial period
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: authData.user.id,
          plan_id: planData.id,
          plan_type: selectedPlan,
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
        });

      if (subscriptionError) {
        console.error("Subscription creation error:", subscriptionError);
        throw subscriptionError;
      }

      console.log("Subscription created successfully");

      toast({
        title: "Sign Up Successful",
        description: "Please check your email to confirm your account. The confirmation email might be in your spam folder.",
      });
      
    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign up",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign Up</h2>
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">Start with a 14-day free trial</h3>
        <p className="text-sm text-muted-foreground">
          No credit card required. Full access to all features during the trial period.
        </p>
      </div>
      <SignUpForm onSubmit={handleSignUp} isLoading={isLoading} />
    </div>
  );
};