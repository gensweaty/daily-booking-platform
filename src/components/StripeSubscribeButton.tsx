
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface StripeSubscribeButtonProps {
  onSuccess?: (subscriptionId: string) => void;
}

export const StripeSubscribeButton = ({ onSuccess }: StripeSubscribeButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubscribe = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to subscribe.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      
      console.log("Initiating Stripe checkout with product ID: prod_SM0gHgA0G0cQN3");
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { productId: 'prod_SM0gHgA0G0cQN3' },
      });

      if (error) {
        console.error("Stripe checkout error:", error);
        throw error;
      }

      if (data?.url) {
        // Redirect to Stripe checkout
        console.log("Redirecting to Stripe checkout URL:", data.url);
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data);
        throw new Error('No checkout URL returned');
      }
    } catch (error: any) {
      console.error('Error creating Stripe checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to initiate checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSubscribe}
      disabled={isLoading}
      className="w-full bg-[#6772e5] hover:bg-[#5469d4] text-white"
    >
      {isLoading ? "Loading..." : "Subscribe with Stripe"}
    </Button>
  );
};
