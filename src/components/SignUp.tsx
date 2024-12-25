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
  const [attemptCount, setAttemptCount] = useState(0);

  const handleSignUp = async ({ email, username, password }: { 
    email: string; 
    username: string; 
    password: string 
  }) => {
    if (attemptCount >= 3) {
      toast({
        title: "Too Many Attempts",
        description: "Please wait a few minutes before trying again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log("Starting signup process...");

      // Check if username already exists
      const { data: existingUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (fetchError) throw fetchError;

      if (existingUsers?.length > 0) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        return;
      }

      console.log("Username is available, proceeding with signup...");

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
        
        if (signUpError.message.includes("email rate limit exceeded")) {
          setAttemptCount((prev) => prev + 1);
          toast({
            title: "Rate Limit Reached",
            description: "Too many requests. Please try again later.",
            variant: "destructive",
          });
          return;
        }
        
        throw signUpError;
      }

      if (!authData?.user) {
        throw new Error("Failed to create user account");
      }

      console.log("User signed up successfully, creating subscription...");

      // Get the plan_id for the selected plan type
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', selectedPlan)
        .single();

      if (planError) throw planError;

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial

      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert([{
          user_id: authData.user.id,
          plan_id: planData.id,
          plan_type: selectedPlan,
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
        }]);

      if (subscriptionError) throw subscriptionError;

      toast({
        title: "Success",
        description: "Check your email to confirm your account.",
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