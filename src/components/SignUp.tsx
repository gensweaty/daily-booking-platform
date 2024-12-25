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

    try {
      // Check if username already exists using maybeSingle()
      const { data: existingUser, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (usernameError) throw usernameError;
      
      if (existingUser) {
        toast({
          title: "Username taken",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        return;
      }

      // First, sign up the user and wait for completion
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

      // Wait for the profile to be created via trigger
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch the selected plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('type', selectedPlan)
        .single();

      if (planError) throw planError;

      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: authData.user.id,
            plan_id: planData.id,
            plan_type: selectedPlan,
            status: 'trial',
            trial_end_date: trialEndDate.toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString(),
          },
        ]);

      if (subscriptionError) {
        console.error("Subscription error:", subscriptionError);
        throw subscriptionError;
      }

      toast({
        title: "Success",
        description: "Please check your email to verify your account",
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