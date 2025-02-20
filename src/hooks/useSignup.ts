
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

    let codeId: string | null = null;

    try {
      console.log('Starting signup process...');
      
      // Step 1: Check and lock redeem code if provided
      if (redeemCode) {
        console.log('Checking redeem code:', redeemCode);
        const trimmedCode = redeemCode.trim();
        
        const { data: codeCheck, error: codeError } = await supabase
          .rpc('check_and_lock_redeem_code', {
            p_code: trimmedCode
          });

        console.log('Code check result:', codeCheck);

        if (codeError) {
          console.error('Redeem code check error:', codeError);
          toast({
            title: "Error",
            description: "Error checking redeem code",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        // Important: Check if we got any results back
        if (!codeCheck || codeCheck.length === 0) {
          toast({
            title: "Invalid Redeem Code",
            description: "This code is invalid",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        // Check the validity of the code
        const codeResult = codeCheck[0];
        if (!codeResult.is_valid) {
          toast({
            title: "Invalid Redeem Code",
            description: codeResult.error_message || "This code is invalid or has already been used",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        codeId = codeResult.code_id;
        console.log('Redeem code is valid and locked, ID:', codeId);
      }

      // Step 2: Create user account
      console.log('Creating user account...');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
        },
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
            duration: 5000,
          });
          return;
        }
        throw signUpError;
      }

      if (!authData?.user) {
        throw new Error('Failed to create user account');
      }
      console.log('User account created successfully');

      // Step 3: Create subscription using secure function
      console.log('Creating subscription...', {
        userId: authData.user.id,
        planType: redeemCode ? 'ultimate' : 'monthly',
        isRedeemCode: !!redeemCode
      });

      const { data: subscription, error: subError } = await supabase
        .rpc('create_user_subscription', {
          p_user_id: authData.user.id,
          p_plan_type: redeemCode ? 'ultimate' : 'monthly',
          p_is_redeem_code: !!redeemCode
        });

      if (subError) {
        console.error('Subscription creation error:', subError);
        throw new Error('Failed to setup subscription: ' + subError.message);
      }
      
      console.log('Subscription created successfully:', subscription);

      // Step 4: Update redeem code with user details if we have a valid code
      if (codeId) {
        console.log('Updating redeem code status...');
        const { error: updateError } = await supabase
          .from('redeem_codes')
          .update({
            used_by: authData.user.id,
            used_at: new Date().toISOString()
          })
          .eq('id', codeId);

        if (updateError) {
          console.error('Failed to update redeem code status:', updateError);
        } else {
          console.log('Redeem code marked as used');
        }
      }

      // Success!
      toast({
        title: "Success",
        description: redeemCode 
          ? "Account created with Ultimate plan! Please check your email to confirm your account."
          : "Account created! Please check your email to confirm your account.",
        duration: 5000,
      });
      
      clearForm();

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
