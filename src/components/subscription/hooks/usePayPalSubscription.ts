import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface UsePayPalSubscriptionProps {
  buttonId: string;
  containerId: string;
  onSuccess?: (subscriptionId: string) => void;
}

export const usePayPalSubscription = ({ buttonId, containerId, onSuccess }: UsePayPalSubscriptionProps) => {
  const { toast } = useToast();
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);

  const checkSubscriptionStatus = async () => {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('status', 'active')
      .single();

    if (subscription?.status === 'active') {
      if (onSuccess) {
        onSuccess('subscription_activated');
      }
    }
  };

  const handlePaymentSuccess = async (orderId: string) => {
    try {
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'expired')
        .single();

      if (fetchError) {
        console.error('Error fetching subscription:', fetchError);
        return;
      }

      const currentDate = new Date();
      const nextPeriodEnd = new Date(currentDate);
      
      if (buttonId === 'ST9DUFXHJCGWJ') { // monthly plan
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          plan_type: buttonId === 'ST9DUFXHJCGWJ' ? 'monthly' : 'yearly',
          last_payment_id: orderId
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return;
      }

      if (onSuccess) {
        onSuccess(orderId);
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let checkInterval: ReturnType<typeof setInterval>;

    const initializePayPal = async () => {
      try {
        if (!mounted) return;

        if (window.paypal) {
          try {
            await window.paypal.HostedButtons({
              hostedButtonId: buttonId,
              onApprove: (data) => {
                console.log('Payment approved:', data);
                handlePaymentSuccess(data.orderID);
                if (paymentWindow) {
                  paymentWindow.close();
                }
              },
              createOrder: () => {
                // Open payment in new tab
                const paymentUrl = `https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=${buttonId}`;
                const newWindow = window.open(paymentUrl, '_blank');
                setPaymentWindow(newWindow);
                
                // Start checking for payment completion
                if (newWindow) {
                  checkInterval = setInterval(() => {
                    if (newWindow.closed) {
                      clearInterval(checkInterval);
                      checkSubscriptionStatus();
                    }
                  }, 1000);
                }
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
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [buttonId, containerId, toast, onSuccess, paymentWindow]);
};