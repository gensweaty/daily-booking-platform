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
        // First check if there's already an active subscription
        const { data: existingSubscription, error: fetchError } = await supabase
          .from('subscriptions')
          .select('status, current_period_end, plan_type')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('Existing subscription check:', { existingSubscription, error: fetchError });

        if (fetchError) {
          console.error('Error checking subscription:', fetchError);
          throw fetchError;
        }

        // If subscription exists and is active, no need to proceed
        if (existingSubscription?.status === 'active' && 
            existingSubscription.current_period_end && 
            new Date(existingSubscription.current_period_end) > new Date()) {
          console.log('Active subscription found:', existingSubscription);
          toast({
            title: "Subscription Active",
            description: "Your subscription is already active",
          });
          navigate('/dashboard');
          return;
        }

        console.log('Proceeding with subscription activation for:', user.email);
        
        // Activate the subscription using the database function
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