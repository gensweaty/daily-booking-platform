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
      
      if (!user || !subscriptionType) return;

      try {
        console.log('Activating subscription:', subscriptionType, 'for user:', user.id);
        
        const { error } = await supabase.rpc('activate_subscription', {
          p_user_id: user.id,
          p_subscription_type: subscriptionType
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Your subscription has been activated!",
        });

        // Remove subscription parameter from URL
        navigate('/dashboard', { replace: true });
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