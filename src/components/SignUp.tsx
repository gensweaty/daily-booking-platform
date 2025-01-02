import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addDays } from "date-fns";

export const SignUp = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const { toast } = useToast();

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const createSubscription = async (userId: string) => {
    try {
      // Get the subscription plan ID
      const { data: plans, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', selectedPlan)
        .single();

      if (planError) throw planError;

      const trialEndDate = addDays(new Date(), 14); // 14-day trial
      const currentPeriodStart = new Date();
      const currentPeriodEnd = addDays(currentPeriodStart, selectedPlan === 'monthly' ? 30 : 365);

      // Call the create_subscription function
      const { error } = await supabase.rpc('create_subscription', {
        p_user_id: userId,
        p_plan_id: plans.id,
        p_plan_type: selectedPlan,
        p_trial_end_date: trialEndDate.toISOString(),
        p_current_period_start: currentPeriodStart.toISOString(),
        p_current_period_end: currentPeriodEnd.toISOString()
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast({
        title: "Invalid Password",
        description: passwordError,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (username.length < 3) {
      toast({
        title: "Error",
        description: "Username must be at least 3 characters long",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Check if username already exists
      const { data: existingUsers, error: fetchError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username);

      if (fetchError) {
        throw fetchError;
      }

      if (existingUsers && existingUsers.length > 0) {
        toast({
          title: "Error",
          description: "This username is already taken. Please choose another one.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
          }
        },
      });
      
      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Error",
            description: "This email is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      if (data?.user) {
        // Create subscription for the new user
        await createSubscription(data.user.id);

        toast({
          title: "Success",
          description: "Please check your email (including spam folder) to confirm your account before signing in.",
        });
        
        // Clear form
        setEmail("");
        setUsername("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred during sign up",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6">
      <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Sign Up</h2>
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            className="w-full"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Password (min. 6 characters, include numbers)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Subscription Plan</Label>
          <RadioGroup
            value={selectedPlan}
            onValueChange={setSelectedPlan}
            className="grid grid-cols-1 gap-4 mt-2"
          >
            <div className="flex items-center space-x-2 border rounded-lg p-4">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly" className="flex-1">
                <div className="flex justify-between items-center">
                  <span>Monthly Plan</span>
                  <span className="font-semibold">$9.95/month</span>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-4">
              <RadioGroupItem value="yearly" id="yearly" />
              <Label htmlFor="yearly" className="flex-1">
                <div className="flex justify-between items-center">
                  <span>Yearly Plan</span>
                  <span className="font-semibold">$89.95/year</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Save over 24% compared to monthly</p>
              </Label>
            </div>
          </RadioGroup>
        </div>
        <Button 
          type="submit" 
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? "Signing up..." : "Sign Up"}
        </Button>
      </form>
    </div>
  );
};