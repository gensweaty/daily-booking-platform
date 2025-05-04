
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

      // NEW APPROACH: Use admin API to create user directly
      // This completely bypasses the email confirmation process
      console.log('Creating user with service role (admin API)...');
      
      try {
        // First, create the user using admin API
        const { data: adminData, error: adminError } = await supabase.functions.invoke('create-user-admin', {
          body: {
            email,
            password,
            username
          }
        });

        // Check for errors with admin user creation
        if (adminError) {
          console.error('Admin user creation error:', adminError);
          toast({
            title: "Signup Failed",
            description: adminError.message || "Failed to create user account",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        if (!adminData?.user || !adminData?.success) {
          console.error('User creation failed:', adminData);
          toast({
            title: "Signup Failed",
            description: adminData?.message || "Failed to create user account",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return;
        }

        console.log('User created successfully:', adminData.user);
        
        const userId = adminData.user.id;

        // Step 4: Create subscription
        console.log('Creating subscription...');
        const { data: subscription, error: subError } = await supabase
          .rpc('create_user_subscription', {
            p_user_id: userId,
            p_plan_type: redeemCode ? 'ultimate' : 'monthly',
            p_is_redeem_code: !!redeemCode
          });

        if (subError) {
          console.error('Subscription creation error:', subError);
          toast({
            title: "Warning",
            description: "User account created, but subscription setup failed. Please contact support.",
            variant: "destructive",
            duration: 5000,
          });
          // Continue anyway since the user was created
        } else {
          console.log('Subscription created:', subscription);
        }

        // Step 5: If we have a valid code, update it with user details
        if (codeId) {
          await supabase
            .from('redeem_codes')
            .update({
              used_by: userId,
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
          toast({
            title: "Success",
            description: "Account created! Please sign in manually.",
            duration: 5000,
          });
        } else {
          toast({
            title: "Success",
            description: "Account created successfully! You are now signed in.",
            duration: 5000,
          });
        }
        
        clearForm();
      } catch (adminError: any) {
        console.error('Admin API error:', adminError);
        toast({
          title: "Signup Error",
          description: adminError.message || "An unexpected error occurred during signup",
          variant: "destructive",
          duration: 5000,
        });
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
