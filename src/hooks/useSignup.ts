
import { useState } from "react";
import { supabase, getRedirectUrl } from "@/lib/supabase";
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

      // Get stable redirect URL
      const redirectUrl = getRedirectUrl();
      console.log('Using redirect URL:', redirectUrl);
      
      // Step 2: Create user account without email confirmation
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          // We'll handle confirmation separately via our edge function
          emailRedirectTo: redirectUrl,
        },
      });
      
      console.log('Signup response:', { data: authData, hasUser: !!authData?.user, error: signUpError });

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

      // Step 3: Send custom confirmation email using our edge function
      try {
        console.log('Sending custom confirmation email to:', email, 'with redirect URL:', redirectUrl);
        
        // Fixed: ensure we're passing the correct data structure with JSON.stringify
        const confirmationResponse = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-confirmation-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            redirectUrl
          })
        });
        
        console.log('Confirmation email response status:', confirmationResponse.status);
        
        const responseText = await confirmationResponse.text();
        console.log('Confirmation email raw response:', responseText);
        
        let confirmationResult;
        try {
          confirmationResult = JSON.parse(responseText);
          console.log('Parsed confirmation result:', confirmationResult);
        } catch (parseError) {
          console.error('Error parsing confirmation response:', parseError);
          console.log('Raw response body was:', responseText);
        }
        
        if (!confirmationResponse.ok) {
          console.error('Error response from confirmation endpoint:', responseText);
          throw new Error(`Failed to send confirmation email: ${confirmationResponse.status} ${responseText}`);
        }
      } catch (error) {
        console.error('Error sending confirmation email:', error);
        toast({
          title: "Email System Issue",
          description: "We're having trouble sending the confirmation email. Please try again later or contact support.",
          variant: "destructive",
          duration: 7000,
        });
        setErrorType("email_system");
        setIsLoading(false);
        return;
      }

      // Step 4: Create subscription
      const { error: subError } = await supabase
        .rpc('create_user_subscription', {
          p_user_id: authData.user.id,
          p_plan_type: redeemCode ? 'ultimate' : 'monthly',
          p_is_redeem_code: !!redeemCode
        });

      if (subError) {
        console.error('Subscription creation error:', subError);
        // Continue with signup flow even if subscription has an issue
      }

      // Step 5: If we have a valid code, update it with user details
      if (codeId) {
        await supabase
          .from('redeem_codes')
          .update({
            used_by: authData.user.id,
            used_at: new Date().toISOString()
          })
          .eq('id', codeId);
      }

      // If account was created successfully, we show confirmation pending message
      setErrorType("email_confirmation_pending");
      toast({
        title: "Account Created",
        description: "Please check your email (including spam folder) to confirm your account. If you don't receive an email within 5 minutes, use the resend option.",
        duration: 7000,
      });
      
      clearForm();

    } catch (error: any) {
      console.error('Signup error:', error);
      
      const errorMessage = error.message?.toLowerCase() || '';
      
      if (
        errorMessage.includes("confirmation") || 
        errorMessage.includes("email") || 
        errorMessage.includes("535") || 
        errorMessage.includes("undefined_value") ||
        errorMessage.includes("send")
      ) {
        setErrorType("email_confirmation_failed");
        toast({
          title: "Email System Issue",
          description: "We're having trouble sending confirmation emails. Please try again or contact support.",
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
      
      // Get the redirect URL
      const redirectUrl = getRedirectUrl();
      console.log('Using redirect URL for resend:', redirectUrl);
      
      // Fixed: ensure we're passing the correct data structure with JSON.stringify
      const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/send-confirmation-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          redirectUrl
        })
      });
      
      console.log('Resend response status:', response.status);
      
      const responseText = await response.text();
      console.log('Raw response from resend endpoint:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed resend result:', result);
      } catch (parseError) {
        console.error('Error parsing resend response:', parseError);
      }
      
      if (!response.ok) {
        const errorText = responseText;
        console.error('Error response from resend endpoint:', errorText);
        throw new Error(`Failed to resend confirmation email: ${response.status} ${errorText}`);
      }
      
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
