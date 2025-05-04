
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
        return null;
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
          return null;
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
        return null;
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
          return null;
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
          return null;
        }

        codeId = validationResult.code_id;
      }

      // Create user using admin API (which will send confirmation email)
      console.log('Creating user with confirmation email requirement...');
      
      try {
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
          return null;
        }

        if (!adminData?.success) {
          console.error('User creation failed:', adminData);
          
          // Special handling for email already exists error
          if (adminData?.errorCode === "email_exists") {
            toast({
              title: "Email Already Registered",
              description: "This email address is already registered. Please try signing in or use a different email.",
              variant: "destructive",
              duration: 5000,
            });
            setIsLoading(false);
            return null;
          }
          
          toast({
            title: "Signup Failed",
            description: adminData?.message || "Failed to create user account",
            variant: "destructive",
            duration: 5000,
          });
          setIsLoading(false);
          return null;
        }

        console.log('User created successfully, confirmation email sent:', adminData);
        
        let toastMessage = "Account created! Please check your email to confirm your account.";
        
        // If Resend failed but we're using Supabase's email service as fallback
        if (adminData.resendError) {
          console.log("Note: Custom email sending failed, but Supabase's default service was used as fallback");
          toastMessage += " If you don't receive it, please check your spam folder.";
        }
        
        toast({
          title: "Success",
          description: toastMessage,
          duration: 8000,
        });
        
        clearForm();
        
        // Return the confirmation link if available (for development/testing)
        return {
          success: true,
          confirmationLink: adminData.confirmationLink
        };
      } catch (adminError: any) {
        console.error('Admin API error:', adminError);
        toast({
          title: "Signup Error",
          description: adminError.message || "An unexpected error occurred during signup",
          variant: "destructive",
          duration: 5000,
        });
        return null;
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign up",
        variant: "destructive",
        duration: 5000,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSignup, isLoading };
};
