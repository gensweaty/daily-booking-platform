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
      console.log('Checking subscription parameters:', { subscriptionType, user: user?.email });
      
      if (!user || !subscriptionType) {
        console.log('Missing required data:', { user: !!user, subscriptionType });
        return;
      }

      // First check if user already has an active subscription
      const { data: existingSubscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error checking existing subscription:', fetchError);
        toast({
          title: "Error",
          description: "Failed to check subscription status",
          variant: "destructive",
        });
        return;
      }

      // If subscription is already active, no need to activate again
      if (existingSubscription?.status === 'active' && 
          existingSubscription.current_period_end && 
          new Date(existingSubscription.current_period_end) > new Date()) {
        console.log('Subscription already active:', existingSubscription);
        toast({
          title: "Info",
          description: "Your subscription is already active",
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        console.log('Starting subscription activation for:', user.email);
        console.log('Subscription type:', subscriptionType);
        
        // Call the database function to activate the subscription
        const { error: activationError } = await supabase.rpc('activate_subscription', {
          p_user_id: user.id,
          p_subscription_type: subscriptionType
        });

        if (activationError) {
          console.error('Subscription activation error:', activationError);
          throw activationError;
        }

        console.log('Subscription activated successfully');
        
        toast({
          title: "Success",
          description: "Your subscription has been activated!",
        });

        // Remove subscription parameter and refresh the page
        navigate('/dashboard', { replace: true });
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

    // Run immediately when component mounts or when URL parameters/user change
    handleSubscription();
  }, [user, searchParams, toast, navigate]);

  return null;
};