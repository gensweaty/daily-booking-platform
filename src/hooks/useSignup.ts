
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
      const origin = window.location.host.includes('localhost') || 
                     window.location.host.includes('lovable.app') 
                     ? window.location.origin 
                     : 'https://smartbookly.com';
      
      const emailRedirectTo = `${origin}/dashboard`;
      
      console.log('Email confirmation redirect URL:', emailRedirectTo);

      // Sign up the user - without trying to auto-confirm
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: emailRedirectTo,
          // Remove the emailConfirm property as it's not supported
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
          console.warn('Email confirmation failed but proceeding with account creation:', signUpError.message);
          
          // If we can get the user data despite the email error, we proceed
          if (authData?.user) {
            // The account was created successfully despite the email error
            console.log('User account created successfully:', authData.user.id);
            
            // Continue with account setup despite email confirmation failure
          } else {
            // We couldn't get user data, which is unusual
            throw new Error('Unable to create user account due to confirmation system issues');
          }
        } else {
          throw signUpError;
        }
      }

      if (!authData?.user) {
        throw new Error('Failed to create user account');
      }

      const userId = authData.user.id;
      console.log('User created with ID:', userId);

      // Wait longer to ensure the user and profile records are created in the database
      // The auth webhook and trigger should create the profile
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 3: Create subscription with proper error handling
      try {
        const { data: subscription, error: subError } = await supabase
          .rpc('create_user_subscription', {
            p_user_id: userId,
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
              used_by: userId,
              used_at: new Date().toISOString()
            })
            .eq('id', codeId);
        } catch (codeUpdateError) {
          console.error('Error updating redeem code:', codeUpdateError);
          // Non-fatal, don't throw
        }
      }

      // Try to auto-sign in the user right after signup
      try {
        console.log('Attempting to auto-sign in the user');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) {
          console.error('Auto sign-in error:', signInError);
          // Don't throw, just show a different message
          toast({
            title: "Account Created",
            description: "Your account has been created. Please sign in manually.",
            duration: 5000,
          });
        } else {
          // Successfully signed in
          console.log('Auto sign-in successful');
          toast({
            title: "Success",
            description: "Your account has been created and you're now signed in!",
            duration: 5000,
          });
          
          // Redirect to dashboard after successful auto-signin
          window.location.href = '/dashboard';
          
          clearForm();
          return;
        }
      } catch (signInError) {
        console.error('Error during auto-sign in:', signInError);
        // Non-fatal, continue to show success message
      }

      // If auto-signin failed or wasn't attempted, show the normal success message
      toast({
        title: "Account Created",
        description: "Your account has been created successfully. You can now sign in.",
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
