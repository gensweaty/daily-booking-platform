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

      // First try the regular signup approach - it might work for some users
      console.log('Attempting normal signup first...');
      let signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: emailRedirectTo,
        },
      });

      let userId = null;
      let proceedWithAccountSetup = false;

      // Handle the signup result
      if (signUpResult.error) {
        console.warn('Initial signup attempt failed:', signUpResult.error.message);
        
        // If the error is email confirmation related, try workaround
        if (signUpResult.error.message.includes('confirmation') || 
            signUpResult.error.status === 500) {
          
          console.log('Trying admin signup approach as fallback...');
          
          // Try a different approach that bypasses email confirmation
          // This creates the user directly with auto-confirm
          const { data, error } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            user_metadata: { username },
            email_confirm: true
          });
          
          if (error) {
            console.error('Admin signup approach failed:', error);
            throw error;
          }
          
          if (data?.user) {
            userId = data.user.id;
            proceedWithAccountSetup = true;
            console.log('Successfully created user with admin approach:', userId);
            
            // Auto sign-in the user
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            
            if (signInError) {
              console.error('Auto sign-in failed:', signInError);
            } else {
              console.log('Auto sign-in successful!');
            }
          }
        } else {
          // Handle other signup errors
          throw signUpResult.error;
        }
      } else if (signUpResult.data.user) {
        // Regular signup worked
        userId = signUpResult.data.user.id;
        proceedWithAccountSetup = true;
        console.log('Successfully created user with normal approach:', userId);
      }

      if (!proceedWithAccountSetup || !userId) {
        throw new Error('Failed to create user account through any method');
      }

      // Wait longer to ensure the user and profile records are created in the database
      console.log('Waiting for profile creation...');
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      // Step 3: Create subscription with proper error handling
      try {
        console.log('Creating user subscription...');
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
          console.log('Updating redeem code with user details...');
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

      // Check if the user is already signed in
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (sessionData?.session) {
        console.log('User is already signed in, redirecting to dashboard');
        toast({
          title: "Success",
          description: "Your account has been created and you're now signed in!",
          duration: 5000,
        });
        
        clearForm();
        window.location.href = '/dashboard';
        return;
      }

      // Otherwise try to sign them in manually
      console.log('Attempting to sign in the user manually');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (signInError) {
        console.error('Manual sign-in error:', signInError);
        toast({
          title: "Account Created",
          description: "Your account has been created. Please sign in manually.",
          duration: 5000,
        });
      } else {
        console.log('Manual sign-in successful');
        toast({
          title: "Success",
          description: "Your account has been created and you're now signed in!",
          duration: 5000,
        });
        
        // Redirect to dashboard after successful manual sign-in
        window.location.href = '/dashboard';
      }
      
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
      } else if (error.message?.includes('confirmation') || error.message?.includes('Unable to create user')) {
        toast({
          title: "Account Creation Issue",
          description: "There's an issue with our email confirmation system. Please try again later or contact support.",
          variant: "destructive",
          duration: 8000,
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
