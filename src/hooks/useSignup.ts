
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validatePassword, validateUsername } from "@/utils/signupValidation";

export const useSignup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorType, setErrorType] = useState<string | null>(null);
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
    setErrorType(null);

    try {
      console.log('Starting signup process...');
      
      // Password validation
      const passwordError = validatePassword(password);
      if (passwordError) {
        toast({
          title: "Password Error",
          description: passwordError,
          variant: "destructive",
          duration: 5000,
        });
        setErrorType("password_validation");
        setIsLoading(false);
        return;
      }
      
      // Username validation
      try {
        const usernameError = await validateUsername(username, supabase);
        if (usernameError) {
          toast({
            title: "Username Error",
            description: usernameError,
            variant: "destructive",
            duration: 5000,
          });
          setErrorType("username_validation");
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Username validation error:", error);
      }
      
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
          setErrorType("redeem_code");
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
          setErrorType("redeem_code");
          setIsLoading(false);
          return;
        }

        codeId = validationResult.code_id;
      }

      // Get current site URL for redirects
      const baseUrl = window.location.origin;
      
      // For email redirections, always include error parameter to handle confirmation failures
      const emailRedirectTo = `${baseUrl}/signup?error=confirmation_failed`;
      
      console.log('Email confirmation redirect URL:', emailRedirectTo);

      // Step 2: Create user account with email confirmation redirect
      console.log('Calling supabase.auth.signUp with emailRedirectTo:', emailRedirectTo);
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: emailRedirectTo,
        },
      });
      
      console.log('Signup response:', { data: authData, error: signUpError });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
            duration: 5000,
          });
          setErrorType("rate_limit");
          setIsLoading(false);
          return;
        }
        
        if (signUpError.message.includes("email")) {
          toast({
            title: "Email Error",
            description: signUpError.message || "This email address cannot be used or is already taken.",
            variant: "destructive",
            duration: 5000,
          });
          setErrorType("email");
          setIsLoading(false);
          return;
        }
        
        throw signUpError;
      }

      if (!authData?.user) {
        throw new Error('Failed to create user account');
      }

      // Step 3: Create subscription
      const { data: subscription, error: subError } = await supabase
        .rpc('create_user_subscription', {
          p_user_id: authData.user.id,
          p_plan_type: redeemCode ? 'ultimate' : 'monthly',
          p_is_redeem_code: !!redeemCode
        });

      if (subError) {
        throw new Error('Failed to setup subscription: ' + subError.message);
      }

      // Step 4: If we have a valid code, update it with user details
      if (codeId) {
        await supabase
          .from('redeem_codes')
          .update({
            used_by: authData.user.id,
            used_at: new Date().toISOString()
          })
          .eq('id', codeId);
      }

      // Check if the user was created but email confirmation might have failed
      if (authData?.user && !authData.user.email_confirmed_at) {
        setErrorType("email_confirmation_pending");
        toast({
          title: "Account Created",
          description: "Please check your email (including spam folder) to confirm your account.",
          duration: 7000,
        });
      } else {
        toast({
          title: "Success",
          description: redeemCode 
            ? "Account created with Ultimate plan! Please check your email to confirm your account."
            : "Account created! Please check your email to confirm your account.",
          duration: 5000,
        });
      }
      
      clearForm();

    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Enhanced error detection for email confirmation issues
      if (error.message?.includes("confirmation") || 
          error.message?.includes("email") || 
          error.message?.includes("535") || 
          error.message?.includes("UNDEFINED_VALUE")) {
        setErrorType("email_confirmation_failed");
        toast({
          title: "Email Confirmation Issue",
          description: "There was an issue with the confirmation email system. Please try again or contact support.",
          variant: "destructive",
          duration: 7000,
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "An error occurred during sign up",
          variant: "destructive",
          duration: 5000,
        });
        setErrorType("unknown");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    setIsLoading(true);
    setErrorType(null);
    
    try {
      console.log('Attempting to resend confirmation email to:', email);
      
      // Get the current origin for redirects
      const origin = window.location.origin;
      const redirectTo = `${origin}/signup?error=confirmation_failed`;
      
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectTo,
        }
      });
      
      if (error) {
        console.error('Resend confirmation error:', error);
        toast({
          title: "Error",
          description: "Failed to resend confirmation email. Please try again later.",
          variant: "destructive",
          duration: 5000,
        });
        setErrorType("resend_failed");
        return;
      }
      
      console.log('Resend confirmation response:', data);
      
      toast({
        title: "Confirmation Email Sent",
        description: "Please check your inbox and spam folder.",
        duration: 5000,
      });
      
    } catch (error: any) {
      console.error('Resend error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred while resending the email",
        variant: "destructive",
        duration: 5000,
      });
      setErrorType("resend_exception");
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignup, resendConfirmationEmail, isLoading, errorType };
};
