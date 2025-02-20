
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
        // Clean and prepare the code
        const trimmedCode = redeemCode.trim();
        
        console.log('Checking redeem code:', {
          code: trimmedCode,
          timestamp: new Date().toISOString()
        });
        
        const { data: codeData, error: codeError } = await supabase
          .from('redeem_codes')
          .select('*')
          .eq('code', trimmedCode)
          .maybeSingle();

        if (codeError) {
          console.error('Database error while checking code:', codeError);
          toast({
            title: "Error",
            description: "Failed to check redeem code. Please try again.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        if (!codeData) {
          console.log('No matching code found');
          toast({
            title: "Invalid Redeem Code",
            description: "The redeem code does not exist.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        if (codeData.is_used) {
          console.log('Code already used:', {
            code: trimmedCode,
            usedBy: codeData.used_by,
            usedAt: codeData.used_at
          });
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
        console.log('Valid code found:', {
          code: trimmedCode,
          planType
        });
      }

      // Get subscription plan
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', planType)
        .single();

      if (planError) {
        console.error('Error fetching plan:', planError);
        throw new Error('Failed to fetch subscription plan');
      }

      console.log('Found plan:', plans);

      // Sign up user
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
            description: "Please wait a moment before trying again.",
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
        console.log('User created successfully:', data.user.id);

        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const subscriptionData = {
          user_id: data.user.id,
          plan_id: plans.id,
          plan_type: planType,
          status: redeemCode ? 'active' : 'trial',
          trial_end_date: redeemCode ? null : trialEndDate.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: redeemCode ? null : trialEndDate.toISOString()
        };

        console.log('Creating subscription:', subscriptionData);

        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .insert([subscriptionData]);

        if (subscriptionError) {
          console.error('Subscription creation error:', subscriptionError);
          toast({
            title: "Error",
            description: "Account created but subscription setup failed. Please contact support.",
            variant: "destructive",
            duration: 8000,
          });
          return;
        }

        console.log('Subscription created successfully');

        if (redeemCode) {
          console.log('Updating redeem code status');
          
          const { error: updateError } = await supabase
            .from('redeem_codes')
            .update({
              is_used: true,
              used_by: data.user.id,
              used_at: new Date().toISOString()
            })
            .eq('code', redeemCode.trim());

          if (updateError) {
            console.error('Error updating redeem code:', updateError);
            toast({
              title: "Error",
              description: "Failed to activate redeem code. Please contact support.",
              variant: "destructive",
              duration: 8000,
            });
            return;
          }

          console.log('Redeem code updated successfully');
        }

        toast({
          title: "Success",
          description: redeemCode 
            ? "Account created successfully with Ultimate plan! Please check your email to confirm your account."
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
