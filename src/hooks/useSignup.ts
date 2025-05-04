
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
      console.log('Starting signup process...');
      
      let codeId: string | null = null;

      // Step 1: Validate redeem code if provided
      if (redeemCode) {
        const trimmedCode = redeemCode.trim();
        console.log('Checking redeem code:', trimmedCode);

        const { data: codeResult, error: codeError } = await supabase
          .rpc('check_and_lock_redeem_code', {
            p_code: trimmedCode
          });

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

        // The function always returns exactly one row
        const validationResult = codeResult[0];
        console.log('Code validation result:', validationResult);

        if (!validationResult.is_valid) {
          toast({
            title: "Invalid Redeem Code",
            description: validationResult.error_message,
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        codeId = validationResult.code_id;
      }

      // Get current site URL for redirects
      // For production, we need to ensure redirects go to the correct domain
      // Don't use window.location.origin as it will differ between development and production
      const origin = window.location.host.includes('localhost') || 
                     window.location.host.includes('lovable.app') 
                     ? window.location.origin 
                     : 'https://smartbookly.com';
      
      // Ensure the redirect URL explicitly includes the full path to avoid 404 errors
      const emailRedirectTo = `${origin}/dashboard`;
      
      console.log('Email confirmation redirect URL:', emailRedirectTo);

      // Step 2: Create user account with a modified approach to bypass email confirmation
      // if there are issues with the email confirmation system
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          // Use emailRedirectTo with fallback to the origin URL
          emailRedirectTo: emailRedirectTo,
        },
      });

      // Handle specific signup errors
      if (signUpError) {
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }
        
        if (signUpError.message.includes('confirmation email')) {
          // If the error is specifically about sending the confirmation email,
          // we can still proceed with the account creation since the user account
          // was likely created but the email failed to send
          console.warn('Email confirmation failed but account might have been created:', signUpError.message);
          
          // Show a different toast to inform the user
          toast({
            title: "Account Created",
            description: "Your account was created, but there was an issue sending the confirmation email. Please contact support if you don't receive it within a few minutes.",
            duration: 8000,
          });
          
          clearForm();
          setIsLoading(false);
          return;
        }
        
        throw signUpError;
      }

      if (!authData?.user) {
        throw new Error('Failed to create user account');
      }

      // Wait to ensure the user and profile records are created in the database
      // The auth webhook and trigger should create the profile
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Create subscription with proper error handling
      try {
        const { data: subscription, error: subError } = await supabase
          .rpc('create_user_subscription', {
            p_user_id: authData.user.id,
            p_plan_type: redeemCode ? 'ultimate' : 'monthly',
            p_is_redeem_code: !!redeemCode
          });

        if (subError) {
          console.error('Subscription creation error:', subError);
          // Don't throw here - we still created the user account successfully
          toast({
            title: "Account Created",
            description: "Your account was created but there was an issue with subscription setup. Please contact support.",
            duration: 5000,
          });
        } else {
          console.log('Subscription created successfully:', subscription);
        }
      } catch (subError: any) {
        console.error('Subscription creation exception:', subError);
        // Don't throw here - we still created the user account successfully
      }

      // Step 4: If we have a valid code, update it with user details
      if (codeId) {
        try {
          await supabase
            .from('redeem_codes')
            .update({
              used_by: authData.user.id,
              used_at: new Date().toISOString()
            })
            .eq('id', codeId);
        } catch (codeUpdateError) {
          console.error('Error updating redeem code:', codeUpdateError);
          // Non-fatal, don't throw
        }
      }

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
      
      // Check if the error is specifically related to the user already existing
      if (error.message?.includes('User already registered')) {
        toast({
          title: "Account Already Exists",
          description: "An account with this email already exists. Please log in instead.",
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "An error occurred during sign up",
          variant: "destructive",
          duration: 5000,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignup, isLoading };
};
