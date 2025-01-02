import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export const useSignup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSignup = async (
    email: string,
    username: string,
    password: string,
    confirmPassword: string,
    selectedPlan: 'monthly' | 'yearly',
    clearForm: () => void
  ) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // Fetch the subscription plan
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', selectedPlan)
        .single();

      if (planError) {
        console.error('Error fetching subscription plan:', planError);
        throw new Error('Failed to fetch subscription plan');
      }

      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) {
        // Handle rate limit error specifically
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying to sign up again.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }

        // Handle user already registered
        if (signUpError.message?.includes("User already registered")) {
          toast({
            title: "Account Exists",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }

        throw signUpError;
      }

      if (data?.user) {
        // Calculate trial end date (14 days from now)
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        // Create subscription
        const { error: subscriptionError } = await supabase.rpc('create_subscription', {
          p_user_id: data.user.id,
          p_plan_id: plans.id,
          p_plan_type: selectedPlan,
          p_trial_end_date: trialEndDate.toISOString(),
          p_current_period_start: new Date().toISOString(),
          p_current_period_end: new Date(trialEndDate.getTime() + (24 * 60 * 60 * 1000)).toISOString()
        });

        if (subscriptionError) {
          console.error('Subscription creation error:', subscriptionError);
          toast({
            title: "Account Created",
            description: "Your account was created but there was an issue with the subscription setup. Please contact support.",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          toast({
            title: "Success",
            description: "Please check your email to confirm your account before signing in.",
            duration: 5000,
          });
          clearForm();
        }
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign up",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignup, isLoading };
};