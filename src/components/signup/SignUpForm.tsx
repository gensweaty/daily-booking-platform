import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface SignUpFormProps {
  onSubmit: (data: { email: string; username: string; password: string; selectedPlan: string }) => Promise<void>;
  isLoading: boolean;
}

export const SignUpForm = ({ onSubmit, isLoading }: SignUpFormProps) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      console.log('Fetching subscription plans...');
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });
      
      if (error) {
        console.error('Error fetching plans:', error);
        toast({
          title: "Error loading plans",
          description: "Could not load subscription plans. Please try again.",
          variant: "destructive",
        });
        throw error;
      }

      console.log('Fetched plans:', data);
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedPlan) {
      setError("Please select a subscription plan");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    try {
      await onSubmit({ email, username, password, selectedPlan });
    } catch (err: any) {
      setError(err.message || "An error occurred during signup");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}
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
          placeholder="Password (min. 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
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
        <Label htmlFor="plan">Select Plan</Label>
        <Select 
          value={selectedPlan} 
          onValueChange={setSelectedPlan}
          disabled={isLoading || plansLoading}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Select a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans?.map((plan) => (
              <SelectItem key={plan.id} value={plan.type}>
                {plan.name} - ${plan.price}/{plan.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plansLoading && (
          <p className="text-sm text-muted-foreground mt-1">
            Loading plans...
          </p>
        )}
      </div>
      <Button 
        type="submit" 
        className="w-full"
        disabled={isLoading || !selectedPlan}
      >
        {isLoading ? "Signing up..." : "Start Free Trial"}
      </Button>
    </form>
  );
};