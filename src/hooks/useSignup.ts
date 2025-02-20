
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
    redeemCode: string,
    clearForm: () => void
  ) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      let planType: 'monthly' | 'yearly' | 'ultimate' = 'monthly';
      
      if (redeemCode) {
        console.log('Attempting to validate redeem code:', redeemCode.trim());
        
        // First check if code exists without the is_used condition
        const { data: codeExists, error: codeCheckError } = await supabase
          .from('redeem_codes')
          .select('is_used')
          .eq('code', redeemCode.trim())
          .maybeSingle();

        console.log('Initial code check:', { codeExists, codeCheckError });

        if (codeCheckError) {
          console.error('Error checking redeem code:', codeCheckError);
          toast({
            title: "Error",
            description: "Failed to validate redeem code. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        if (!codeExists) {
          console.log('Code not found in database');
          toast({
            title: "Invalid Redeem Code",
            description: "The redeem code does not exist.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        if (codeExists.is_used) {
          console.log('Code exists but has been used');
          toast({
            title: "Invalid Redeem Code",
            description: "This redeem code has already been used.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        planType = 'ultimate';
        console.log('Valid unused code found, proceeding with ultimate plan');
      }

      // Fetch the subscription plan
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', planType)
        .single();

      if (planError) {
        console.error('Error fetching subscription plan:', planError);
        throw new Error('Failed to fetch subscription plan');
      }

      console.log('Found subscription plan:', plans);

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
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying to sign up again.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }

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
        if (redeemCode) {
          console.log('Activating redeem code for user:', data.user.id);
          
          const { data: validationResult, error: validationError } = await supabase
            .rpc('validate_and_use_redeem_code', {
              p_code: redeemCode.trim(),
              p_user_id: data.user.id
            });

          console.log('Redeem code validation result:', { validationResult, validationError });

          if (validationError) {
            console.error('Error validating redeem code:', validationError);
            toast({
              title: "Error",
              description: "Failed to activate redeem code. Please contact support.",
              variant: "destructive",
              duration: 8000,
            });
            return;
          }

          if (validationResult === false) {
            console.error('Redeem code validation returned false');
            toast({
              title: "Error",
              description: "Failed to activate redeem code. The code may have been used in the meantime.",
              variant: "destructive",
              duration: 8000,
            });
            return;
          }
        } else {
          // Calculate trial end date (14 days from now)
          const trialEndDate = new Date();
          trialEndDate.setDate(trialEndDate.getDate() + 14);

          // Create subscription
          const { error: subscriptionError } = await supabase.rpc('create_subscription', {
            p_user_id: data.user.id,
            p_plan_id: plans.id,
            p_plan_type: planType,
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
            return;
          }
        }

        toast({
          title: "Success",
          description: redeemCode 
            ? "Account created successfully with Ultimate plan! Please check your email to confirm your account before signing in."
            : "Please check your email to confirm your account before signing in.",
          duration: 5000,
        });
        clearForm();
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
