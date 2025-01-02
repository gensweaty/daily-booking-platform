import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, validateUsername } from "@/utils/signupValidation";

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
      // Validate passwords match
      if (password !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
          duration: 4000,
        });
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
        return;
      }

      // Validate username
      const usernameError = await validateUsername(username, supabase);
      if (usernameError) {
        toast({
          title: "Error",
          description: usernameError,
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Fetch subscription plan ID
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', selectedPlan)
        .single();

      if (planError) {
        console.error('Error fetching subscription plan:', planError);
        toast({
          title: "Error",
          description: "Failed to fetch subscription plan",
          variant: "destructive",
          duration: 4000,
        });
        return;
      }

      // Create user account
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          }
        },
      });

      if (signUpError) {
        // Handle rate limit error specifically
        if (signUpError.status === 429) {
          let errorMessage = "Please wait 60 seconds before trying to sign up again.";
          
          // Try to parse the error body for more specific message
          try {
            const errorBody = JSON.parse(signUpError.message);
            if (errorBody?.message === "email rate limit exceeded") {
              errorMessage = "Too many signup attempts. Please wait 60 seconds before trying again.";
            }
          } catch (e) {
            console.error("Error parsing rate limit message:", e);
          }

          toast({
            title: "Rate Limit Exceeded",
            description: errorMessage,
            variant: "destructive",
            duration: 8000,
          });
          return;
        }
        
        // Handle user already registered error
        if (signUpError.message?.includes("User already registered")) {
          toast({
            title: "Error",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
            duration: 4000,
          });
          return;
        }

        throw signUpError;
      }

      if (data?.user) {
        try {
          // Calculate trial end date (14 days from now)
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 14);

          // Create subscription using the database function
          const { error: subscriptionError } = await supabase.rpc('create_subscription', {
            p_user_id: data.user.id,
            p_plan_id: plan.id,
            p_plan_type: selectedPlan,
            p_trial_end_date: trialEndDate.toISOString(),
            p_current_period_start: new Date().toISOString(),
            p_current_period_end: new Date(trialEndDate.getTime() + (24 * 60 * 60 * 1000)).toISOString()
          });

          if (subscriptionError) {
            console.error('Subscription creation error:', subscriptionError);
            throw subscriptionError;
          }

          toast({
            title: "Success",
            description: "Please check your email (including spam folder) to confirm your account before signing in.",
            duration: 8000,
          });

          clearForm();
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

  return { handleSignup, isLoading };
};