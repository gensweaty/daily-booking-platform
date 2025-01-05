import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { usePayPalSubscription } from './hooks/usePayPalSubscription';
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly' | 'test';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { handlePaymentSuccess, isProcessing } = usePayPalSubscription(planType, onSuccess);

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        // First, get the subscription plan ID
        const { data: plan, error: planError } = await supabase
          .from('subscription_plans')
          .select('id')
          .eq('type', planType)
          .single();

        if (planError) {
          console.error('Error fetching plan:', planError);
          toast({
            title: "Error",
            description: "Could not fetch subscription plan. Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (!plan?.id) {
          console.error('No plan found for type:', planType);
          toast({
            title: "Error",
            description: "Invalid subscription plan. Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (!mounted || isProcessing) return;

        try {
          await window.paypal.HostedButtons({
            hostedButtonId: getButtonId(planType),
            onApprove: async (data: any) => {
              console.log('Payment approved:', data);
              
              // Create subscription record with plan_id
              const { data: subscription, error: subscriptionError } = await supabase
                .from('subscriptions')
                .insert({
                  plan_type: planType,
                  status: 'pending',
                  plan_id: plan.id,
                  user_id: (await supabase.auth.getUser()).data.user?.id
                })
                .select()
                .single();

              if (subscriptionError) {
                console.error('Error creating subscription:', subscriptionError);
                toast({
                  title: "Error",
                  description: "Could not create subscription. Please try again.",
                  variant: "destructive",
                });
                return;
              }

              await handlePaymentSuccess(data.orderID, subscription?.id);
            },
            onCancel: () => {
              console.log('Payment cancelled');
              toast({
                title: "Payment Cancelled",
                description: "You cancelled the payment process.",
                variant: "destructive",
              });
            },
            onError: (err: any) => {
              console.error('PayPal error:', err);
              toast({
                title: "Error",
                description: "There was an error processing your payment.",
                variant: "destructive",
              });
            }
          }).render(`#${containerId}`);
        } catch (error) {
          console.error('PayPal button render error:', error);
          toast({
            title: "Error",
            description: "Failed to load PayPal button. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
    };
  }, [containerId, toast, handlePaymentSuccess, isProcessing, planType]);

  const getButtonId = (type: string) => {
    switch (type) {
      case 'monthly':
        return 'ST9DUFXHJCGWJ';
      case 'yearly':
        return 'YDK5G6VR2EA8L';
      case 'test':
        return 'TEST_BUTTON_ID';
      default:
        return '';
    }
  };

  return <div id={containerId} className="w-full" />;
};