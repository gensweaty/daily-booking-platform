import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { SignUpForm } from "./signup/SignUpForm";

export const SignUp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSignUp = async ({ 
    email, 
    username, 
    password, 
    selectedPlan 
  }: { 
    email: string; 
    username: string; 
    password: string;
    selectedPlan: string;
  }) => {
    if (isLoading) return;
    setIsLoading(true);
    console.log("Starting signup process...");

    try {
      // Check if username already exists
      const { data: existingUser, error: usernameError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (usernameError) {
        console.error('Username check error:', usernameError);
        throw usernameError;
      }
      
      if (existingUser) {
        toast({
          title: "Username taken",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        return;
      }

      // Sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            username,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (!authData.user?.id) {
        throw new Error("User ID not available after signup");
      }

      // Add a longer delay to ensure profile creation and session establishment
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the current session with retries
      let session = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!session && retryCount < maxRetries) {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error(`Session error (attempt ${retryCount + 1}):`, sessionError);
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw new Error("Failed to get session after multiple attempts");
        }

        if (currentSession) {
          session = currentSession;
          break;
        }

        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!session) {
        throw new Error("Failed to get session after signup");
      }

      console.log("Session established, creating subscription...");

      // Fetch the selected plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('type', selectedPlan)
        .single();

      if (planError) {
        console.error("Plan fetch error:", planError);
        throw planError;
      }

      // Calculate trial end date (14 days from now)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      // Create subscription record
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert([{
          user_id: session.user.id,
          plan_id: planData.id,
          plan_type: selectedPlan,
          status: 'trial',
          trial_end_date: trialEndDate.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: trialEndDate.toISOString(),
        }])
        .select()
        .single();

      if (subscriptionError) {
        console.error("Subscription creation error:", subscriptionError);
        throw subscriptionError;
      }

      console.log("Signup process completed successfully");

      toast({
        title: "Success",
        description: "Please check your email to verify your account",
      });

    } catch (error: any) {
      console.error("Signup error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return <SignUpForm onSubmit={handleSignUp} isLoading={isLoading} />;
};