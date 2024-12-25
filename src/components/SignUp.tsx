import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { SignUpForm } from "./signup/SignUpForm";

export const SignUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSignUp = async ({ 
    email, 
    username, 
    password, 
    selectedPlan 
  }: { 
    email: string; 
    username: string; 
    password: string;
    selectedPlan: string;
  }) => {
    if (isLoading) return;
    setIsLoading(true);
    console.log("Starting signup process...");

    try {
      // Check if username already exists
      const { data: existingUser, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (usernameError) {
        console.error('Username check error:', usernameError);
        throw usernameError;
      }
      
      if (existingUser) {
        toast({
          title: "Username taken",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user?.id) {
        throw new Error("User ID not available after signup");
      }

      // Add a longer delay to ensure profile creation and session establishment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch the selected plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('type', selectedPlan)
        .single();

      if (planError) {
        console.error("Plan fetch error:", planError);
        throw planError;
      }

      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Create subscription record with explicit WITH auth.uid()
      const { error: subscriptionError } = await supabase.rpc('create_subscription', {
        p_user_id: authData.user.id,
        p_plan_id: planData.id,
        p_plan_type: selectedPlan,
        p_trial_end_date: trialEndDate.toISOString(),
        p_current_period_start: new Date().toISOString(),
        p_current_period_end: trialEndDate.toISOString()
      });

      if (subscriptionError) {
        console.error("Subscription creation error:", subscriptionError);
        throw subscriptionError;
      }

      console.log("Signup process completed successfully");

      toast({
        title: "Account Created Successfully",
        description: "Please check your email (including spam folder) to verify your account. You'll be able to sign in after verification.",
      });

    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return <SignUpForm onSubmit={handleSignUp} isLoading={isLoading} />;
};