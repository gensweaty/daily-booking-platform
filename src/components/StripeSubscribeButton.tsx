
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface StripeSubscribeButtonProps {
  onSuccess?: (subscriptionId: string) => void;
  planType?: 'monthly' | 'yearly';
}

export const StripeSubscribeButton = ({ onSuccess, planType = 'monthly' }: StripeSubscribeButtonProps) => {
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
      
      // Determine which product ID to use based on plan type
      const productId = planType === 'yearly' ? 'prod_yearly' : 'prod_SM0gHgA0G0cQN3';
      
      console.log(`Initiating Stripe checkout with product ID: ${productId}`);
      
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { 
          productId: productId,
          planType: planType
        },
      });

      if (error) {
        console.error("Stripe checkout error:", error);
        throw error;
      }

      if (!data?.url) {
        console.error("No checkout URL returned:", data);
        throw new Error('No checkout URL returned');
      }
      
      console.log("Redirecting to Stripe checkout URL:", data.url);
      window.location.href = data.url;
      
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
      {isLoading ? (
        <span className="flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </span>
      ) : (
        "Subscribe with Stripe"
      )}
    </Button>
  );
};
