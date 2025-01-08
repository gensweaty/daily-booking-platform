import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export const SubscriptionHandler = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const handleSubscription = async () => {
      const subscriptionType = searchParams.get('subscription');
      console.log('Starting subscription activation check:', { subscriptionType, userId: user?.id });
      
      if (!user || !subscriptionType) {
        console.log('Missing required data for subscription activation:', { user: !!user, subscriptionType });
        return;
      }

      try {
        // Call activate_subscription function
        const { error: activationError } = await supabase.rpc('activate_subscription', {
          p_user_id: user.id,
          p_subscription_type: subscriptionType
        });

        if (activationError) {
          console.error('Activation error:', activationError);
          throw activationError;
        }

        console.log('Subscription activated successfully');
        toast({
          title: "Success",
          description: "Your subscription has been activated!",
        });

        // Force reload to update subscription state
        window.location.reload();
      } catch (error: any) {
        console.error('Subscription activation error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to activate subscription",
          variant: "destructive",
        });
      }
    };

    handleSubscription();
  }, [user, searchParams, toast, navigate]);

  return null;
};