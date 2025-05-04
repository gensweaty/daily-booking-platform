
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { validateUsername, validatePassword } from "@/utils/signupValidation";

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
      
      // Validate username
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
      } catch (error) {
        console.error('Username validation error:', error);
        toast({
          title: "Error",
          description: "Error validating username",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return;
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

      // Step 2: Create user account WITHOUT relying on email confirmation
      console.log('Creating user account...');
      // We disable email confirmation by using the emailRedirectTo option with a dummy value
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: 'https://example.com', // This is just a dummy value - we won't use it
        },
      });

      // Handle specific signup errors
      if (signUpError) {
        console.error('Signup error:', signUpError);
        
        if (signUpError.status === 429) {
          toast({
            title: "Rate Limit Exceeded",
            description: "Please wait a moment before trying again.",
            variant: "destructive",
            duration: 5000,
          });
        } else if (signUpError.message === 'Email signups are disabled') {
          toast({
            title: "Email Signups Disabled",
            description: "Email signups are currently disabled in this project. Please contact support.",
            variant: "destructive",
            duration: 5000,
          });
        } else if (signUpError.message.includes('confirmation email')) {
          toast({
            title: "Email Confirmation Error",
            description: "There was an issue sending the confirmation email. Please try again later or contact support.",
            variant: "destructive",
            duration: 5000,
          });
        } else {
          toast({
            title: "Signup Error",
            description: signUpError.message || "An unexpected error occurred during signup",
            variant: "destructive",
            duration: 5000,
          });
        }
        
        setIsLoading(false);
        return;
      }

      if (!authData?.user) {
        throw new Error('Failed to create user account');
      }

      console.log('User account created:', authData.user);

      // Step 3: Confirm the user's email using our custom edge function
      console.log('Confirming email manually using edge function...');
      try {
        const confirmResponse = await supabase.functions.invoke('confirm-signup', {
          body: {
            user_id: authData.user.id,
            email: email
          }
        });

        // Enhanced debugging for confirmation response
        console.log('Full confirm response:', confirmResponse);
        
        if (confirmResponse.error || !confirmResponse.data?.success) {
          console.error("Edge function confirm error:", confirmResponse);
          
          // More specific error handling based on the response
          if (confirmResponse.error?.message?.includes('disabled')) {
            toast({
              title: "Email Confirmation Error",
              description: "Email confirmation is currently disabled. Contact support for assistance.",
              variant: "destructive",
              duration: 5000,
            });
          } else {
            toast({
              title: "Email Confirmation Error", 
              description: "Failed to confirm email automatically: " + 
                (confirmResponse.error?.message || confirmResponse.data?.error || "Unknown error"),
              variant: "destructive",
              duration: 5000,
            });
          }
          
          setIsLoading(false);
          return;
        }

        console.log('Email confirmation response:', confirmResponse.data);
      } catch (confirmError: any) {
        console.error('Edge function invocation error:', confirmError);
        toast({
          title: "System Error",
          description: "Failed to connect to confirmation service. Please try again later.",
          variant: "destructive",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      // Step 4: Create subscription
      console.log('Creating subscription...');
      const { data: subscription, error: subError } = await supabase
        .rpc('create_user_subscription', {
          p_user_id: authData.user.id,
          p_plan_type: redeemCode ? 'ultimate' : 'monthly',
          p_is_redeem_code: !!redeemCode
        });

      if (subError) {
        throw new Error('Failed to setup subscription: ' + subError.message);
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

      // Step 6: Auto-sign in the user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error('Auto sign-in error:', signInError);
        // Don't throw here, we'll just tell the user to sign in manually
      }

      toast({
        title: "Success",
        description: signInError 
          ? "Account created! Please sign in manually."
          : "Account created successfully! You are now signed in.",
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
