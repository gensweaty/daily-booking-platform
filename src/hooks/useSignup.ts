
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
    redeemCode: string,
    clearForm: () => void
  ) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      console.log('Starting signup process...');
      
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
        return;
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
          return;
        }
      } catch (error: any) {
        console.error('Username validation error:', error);
      }
      
      let codeId: string | null = null;
      let isRedeemCodeValid = false;

      // Step 1: Validate redeem code if provided
      if (redeemCode) {
        const trimmedCode = redeemCode.trim();
        console.log('Checking redeem code:', trimmedCode);

        const { data: codeResult, error: codeError } = await supabase
          .rpc('check_and_lock_redeem_code', {
            p_code: trimmedCode
          });

        console.log('Raw redeem code RPC response:', codeResult);

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

        // Updated validation for object response structure
        if (!codeResult || typeof codeResult !== 'object') {
          console.error('Invalid redeem code response:', codeResult);
          toast({
            title: "Redeem Code Error",
            description: "Unexpected response from server when validating redeem code.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        // Handle the object response directly
        const validationResult = codeResult;
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
        isRedeemCodeValid = true;
      }

      // Get current site URL for redirects
      const origin = window.location.host.includes('localhost') || 
                     window.location.host.includes('lovable.app') 
                     ? window.location.origin 
                     : 'https://smartbookly.com';
      
      const emailRedirectTo = `${origin}/dashboard`;
      
      console.log('Email confirmation redirect URL:', emailRedirectTo);

      // Standard signup approach
      console.log('Performing signup...');
      const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: emailRedirectTo,
        },
      });

      console.log('Signup result:', signUpResult);

      if (signUpError) {
        console.error('Signup error:', signUpError);
        
        // Special case for existing user
        if (signUpError.message?.includes('User already registered')) {
          toast({
            title: "Account Already Exists",
            description: "An account with this email already exists. Please log in instead.",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }
        
        // Handle other signup errors
        toast({
          title: "Signup Error",
          description: signUpError.message || "An error occurred during sign up",
          variant: "destructive", 
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      if (!signUpResult?.user) {
        toast({
          title: "Error",
          description: "Failed to create user account",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      console.log('Signup successful:', signUpResult);
      const userId = signUpResult.user.id;

      // If we have a valid code, update it with user details
      if (codeId && isRedeemCodeValid) {
        try {
          console.log('Updating redeem code with user details...');
          const { error: updateError } = await supabase
            .from('redeem_codes')
            .update({
              used_by: userId,
              used_at: new Date().toISOString()
            })
            .eq('id', codeId);
            
          if (updateError) {
            console.error('Error updating redeem code:', updateError, {
              codeId,
              userId,
              timestamp: new Date().toISOString()
            });
            // Non-fatal, continue with user creation but log the issue
          }
        } catch (codeUpdateError) {
          console.error('Exception updating redeem code:', codeUpdateError);
          // Non-fatal, continue with user creation
        }
      }

      // Poll for profile creation instead of using a fixed timeout
      console.log('Waiting for profile creation...');
      
      let profileFound = false;
      let profileAttempts = 0;
      const maxAttempts = 5;
      
      // First check permissions without RLS to debug
      try {
        console.log('Checking if profiles table is accessible...');
        const { data: debugProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);
          
        console.log('Profile debug fetch:', debugProfile, error);
      } catch (err) {
        console.error('Error during profiles table check:', err);
      }
      
      while (!profileFound && profileAttempts < maxAttempts) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
            
          console.log(`Profile polling attempt ${profileAttempts + 1}:`, { 
            profile, 
            error: profileError ? {
              message: profileError.message,
              details: profileError.details,
              code: profileError.code
            } : null 
          });
            
          if (profile) {
            console.log('Profile found after attempt:', profileAttempts + 1);
            profileFound = true;
            break;
          } else {
            console.log(`Profile not found yet. Attempt ${profileAttempts + 1}/${maxAttempts}`);
            if (profileError) {
              console.error('Error checking profile:', profileError);
            }
          }
        } catch (err) {
          console.error('Error polling for profile:', err);
        }
        
        // Wait before trying again
        await new Promise(resolve => setTimeout(resolve, 2000));
        profileAttempts++;
      }
      
      if (!profileFound) {
        console.warn('Could not verify profile creation after max attempts');
      }
      
      // Create subscription with proper error handling
      try {
        const planType = redeemCode ? 'ultimate' : 'monthly';
        const isRedeemCodeFlag = !!redeemCode;
        
        console.log('Creating user subscription with params:', {
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

        console.log('Subscription RPC returned:', {
          data: subscription,
          error: subError ? { 
            message: subError.message, 
            details: subError.details,
            hint: subError.hint, 
            code: subError.code
          } : null
        });

        if (subError) {
          console.error('Subscription creation error:', {
            message: subError.message,
            details: subError.details,
            hint: subError.hint,
            code: subError.code
          });
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

      // Show different message based on email confirmation setting
      console.log('Final redirect decision based on session:', signUpResult.session);
      
      if (signUpResult.session) {
        // User was auto-confirmed (email confirmation disabled in Supabase)
        toast({
          title: "Account Created",
          description: "Your account has been created and you're now signed in!",
          duration: 5000,
        });
        
        clearForm();
        window.location.href = '/dashboard';
      } else {
        // Email confirmation required
        toast({
          title: "Account Created",
          description: "Please check your email to confirm your account.",
          duration: 8000,
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
