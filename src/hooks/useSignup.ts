
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, validateUsername } from "@/utils/signupValidation";
import { logSignupDebug, logSignupError, logSignupStep } from "@/utils/signupLogger";
import { validateRedeemCode } from "@/utils/redeemCodeUtils";

interface SignupResult {
  success: boolean;
  error: string | null;
  user?: any;
}

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
  ): Promise<SignupResult> => {
    if (isLoading) return { success: false, error: "Already processing request" };
    setIsLoading(true);

    try {
      logSignupStep('Starting signup process');
      
      // Basic validation
      const passwordError = validatePassword(password);
      if (passwordError) {
        toast({
          title: "Password Error",
          description: passwordError,
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return { success: false, error: passwordError };
      }

      // Validate username before proceeding
      try {
        const usernameError = await validateUsername(username, supabase);
        if (usernameError) {
          toast({
            title: "Username Error",
            description: usernameError,
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return { success: false, error: usernameError };
        }
      } catch (error: any) {
        logSignupError('Username validation', error);
      }
      
      let codeId: string | null = null;
      let isRedeemCodeValid = false;

      // Step 1: Validate redeem code if provided
      if (redeemCode) {
        const codeValidation = await validateRedeemCode(supabase, redeemCode);
        
        if (!codeValidation.isValid) {
          if (codeValidation.errorMessage) {
            toast({
              title: "Invalid Redeem Code",
              description: codeValidation.errorMessage,
              variant: "destructive",
              duration: 5000,
            });
          }
          setIsLoading(false);
          return { success: false, error: codeValidation.errorMessage || "Invalid redeem code" };
        }
        
        codeId = codeValidation.codeId;
        isRedeemCodeValid = true;
      }

      // Get current site URL for redirects - CRUCIAL for email confirmations
      let origin = window.location.origin;
      
      // Handle special production cases
      if (window.location.host === 'smartbookly.com') {
        origin = 'https://smartbookly.com';
      }
      
      const emailRedirectTo = `${origin}/dashboard`;
      logSignupDebug('Email confirmation redirect URL:', emailRedirectTo);

      // Standard signup approach
      logSignupStep('Performing signup');
      const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: emailRedirectTo,
        },
      });

      logSignupDebug('Signup result:', signUpResult);

      if (signUpError) {
        logSignupError('Signup error', signUpError);
        
        // Special case for existing user
        if (signUpError.message?.includes('User already registered')) {
          const errorMsg = "An account with this email already exists. Please log in instead.";
          toast({
            title: "Account Already Exists",
            description: errorMsg,
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return { success: false, error: errorMsg };
        }
        
        // Handle email confirmation errors
        if (signUpError.message?.includes('confirmation email')) {
          setIsLoading(false);
          return { 
            success: false, 
            error: "Error sending confirmation email. Please try using a different email address or check with support."
          };
        }
        
        // Handle other signup errors
        const errorMsg = signUpError.message || "An error occurred during sign up";
        toast({
          title: "Signup Error",
          description: errorMsg,
          variant: "destructive", 
          duration: 5000,
        });
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      if (!signUpResult?.user) {
        const errorMsg = "Failed to create user account";
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }

      logSignupStep('Signup successful', {
        userId: signUpResult.user.id,
        hasSession: !!signUpResult.session
      });
      
      const userId = signUpResult.user.id;

      // If we have a valid code, update it with user details
      if (codeId && isRedeemCodeValid) {
        try {
          logSignupStep('Updating redeem code with user details');
          const { error: updateError } = await supabase
            .from('redeem_codes')
            .update({
              used_by: userId,
              used_at: new Date().toISOString()
            })
            .eq('id', codeId);
            
          if (updateError) {
            logSignupError('Error updating redeem code', {
              codeId, userId, timestamp: new Date().toISOString(), error: updateError
            });
          }
        } catch (codeUpdateError) {
          logSignupError('Exception updating redeem code', codeUpdateError);
        }
      }

      // First check permissions without RLS to debug profiles access
      try {
        logSignupDebug('Checking if profiles table is accessible...');
        const { data: debugProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);
          
        logSignupDebug('Profile debug fetch:', { debugProfile, error });
      } catch (err) {
        logSignupError('Error during profiles table check', err);
      }
      
      // Poll for profile creation
      logSignupStep('Waiting for profile creation');
      
      let profileFound = false;
      let profileAttempts = 0;
      const maxAttempts = 5;
      
      while (!profileFound && profileAttempts < maxAttempts) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
            
          logSignupDebug(`Profile polling attempt ${profileAttempts + 1}:`, { 
            profile, 
            error: profileError ? {
              message: profileError.message,
              details: profileError.details,
              code: profileError.code
            } : null 
          });
            
          if (profile) {
            logSignupStep('Profile found after attempt:', profileAttempts + 1);
            profileFound = true;
            break;
          } else {
            logSignupDebug(`Profile not found yet. Attempt ${profileAttempts + 1}/${maxAttempts}`);
          }
        } catch (err) {
          logSignupError('Error polling for profile', err);
        }
        
        // Wait before trying again
        await new Promise(resolve => setTimeout(resolve, 2000));
        profileAttempts++;
      }
      
      if (!profileFound) {
        logSignupDebug('Could not verify profile creation after max attempts');
      }
      
      // Create subscription with proper error handling
      try {
        const planType = redeemCode ? 'ultimate' : 'monthly';
        const isRedeemCodeFlag = !!redeemCode;
        
        logSignupStep('Creating user subscription', {
          userId,
          planType,
          isRedeemCodeFlag
        });
        
        const { data: subscription, error: subError } = await supabase
          .rpc('create_user_subscription', {
            p_user_id: userId,
            p_plan_type: planType,
            p_is_redeem_code: isRedeemCodeFlag
          });

        logSignupDebug('Subscription RPC returned:', {
          data: subscription,
          error: subError ? { 
            message: subError.message, 
            details: subError.details,
            hint: subError.hint, 
            code: subError.code
          } : null
        });

        if (subError) {
          logSignupError('Subscription creation error', {
            message: subError.message,
            details: subError.details,
            hint: subError.hint,
            code: subError.code
          });
          
          // Show more detailed error to the user
          toast({
            title: "Subscription Error",
            description: `${subError.message ?? "An error occurred"} — ${subError.details ?? ""}`,
            variant: "destructive",
            duration: 8000,
          });
          
          // Don't throw here - we still created the user account successfully
          toast({
            title: "Account Created",
            description: "Your account was created but there was an issue with subscription setup. Please contact support.",
            duration: 5000,
          });
        } else {
          logSignupStep('Subscription created successfully', subscription);
        }
      } catch (subError: any) {
        logSignupError('Subscription creation exception', subError);
        // Display error to user
        toast({
          title: "Subscription Error",
          description: subError.message || "An unexpected error occurred during subscription setup",
          variant: "destructive", 
          duration: 8000,
        });
        // Don't throw here - we still created the user account successfully
      }

      // Show different message based on email confirmation setting
      logSignupDebug('Final redirect decision based on session:', signUpResult.session);
      
      if (signUpResult.session) {
        // User was auto-confirmed (email confirmation disabled in Supabase)
        toast({
          title: "Account Created",
          description: "Your account has been created and you're now signed in!",
          duration: 5000,
        });
        
        clearForm();
        window.location.href = '/dashboard';
        return { success: true, error: null, user: signUpResult.user };
      } else {
        // Email confirmation required - show clear instructions
        toast({
          title: "Email Confirmation Required",
          description: "Please check your email inbox and spam folder to confirm your account. The email may take a few minutes to arrive.",
          duration: 10000,
        });
        clearForm();
        return { 
          success: true, 
          error: null, 
          user: signUpResult.user 
        };
      }

    } catch (error: any) {
      logSignupError('Signup general error', error);
      
      const errorMsg = error.message || "An error occurred during sign up";
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
        duration: 5000,
      });
      
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignup, isLoading };
};
