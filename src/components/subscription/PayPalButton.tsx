import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

let isScriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

const loadPayPalScript = () => {
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  if (isScriptLoading) {
    return new Promise<void>((resolve) => {
      const checkScript = () => {
        if (window.paypal) {
          resolve();
        } else {
          setTimeout(checkScript, 100);
        }
      };
      checkScript();
    });
  }

  isScriptLoading = true;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      existingScript.remove();
      delete (window as any).paypal;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;

    script.onload = () => {
      isScriptLoading = false;
      resolve();
    };

    script.onerror = () => {
      isScriptLoading = false;
      scriptLoadPromise = null;
      reject(new Error('Failed to load PayPal script'));
    };

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

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
      
      if (planType === 'monthly') {
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
          plan_type: planType,
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
    let paymentWindow: Window | null = null;
    let checkInterval: number;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();

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
                paymentWindow = window.open(paymentUrl, '_blank');
                
                // Start checking for payment completion
                if (paymentWindow) {
                  checkInterval = setInterval(() => {
                    if (paymentWindow?.closed) {
                      clearInterval(checkInterval);
                      // Check subscription status
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

    initializePayPal();

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [buttonId, containerId, toast, onSuccess]);

  return <div id={containerId} className="w-full" />;
};