import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { updateSubscriptionStatus } from "@/components/subscription/utils/paypalUtils";
import { useAuth } from "@/contexts/AuthContext";

export const useSubscriptionHandler = (checkSubscriptionStatus: () => Promise<void>) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const handleSubscriptionRedirect = async () => {
      const subscriptionType = searchParams.get("subscription");
      
      if (subscriptionType && user && (subscriptionType === 'monthly' || subscriptionType === 'yearly')) {
        try {
          console.log('Processing subscription redirect for type:', subscriptionType);
          
          // Update subscription status
          await updateSubscriptionStatus(
            subscriptionType,
            (orderId) => {
              console.log('Subscription updated successfully with order ID:', orderId);
              toast({
                title: "Subscription Activated",
                description: `Your ${subscriptionType} subscription has been successfully activated.`,
                duration: 5000,
              });
            }
          );
          
          // Clear the subscription parameter from URL
          navigate('/dashboard', { replace: true });
          
          // Refresh subscription status
          await checkSubscriptionStatus();
          
        } catch (error) {
          console.error('Error processing subscription:', error);
          toast({
            title: "Subscription Error",
            description: "There was an error activating your subscription. Please contact support.",
            variant: "destructive",
          });
        }
      }
    };

    handleSubscriptionRedirect();
  }, [searchParams, user, navigate, toast, checkSubscriptionStatus]);
};