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
  const returnUrl = planType === 'monthly' 
    ? 'https://daily-booking-platform.lovable.app/dashboard?subscription=monthly'
    : 'https://daily-booking-platform.lovable.app/dashboard?subscription=yearly';

  useEffect(() => {
    let mounted = true;

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
              },
              onCancel: () => {
                console.log('Payment cancelled');
                toast({
                  title: "Payment Cancelled",
                  description: "You cancelled the payment process.",
                  variant: "destructive",
                });
              },
              onError: (err) => {
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
  }, [buttonId, containerId, toast]);

  const handlePaymentSuccess = async (orderId: string) => {
    try {
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
        .eq('status', 'expired');

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return;
      }

      if (onSuccess) {
        onSuccess(orderId);
      }

      toast({
        title: "Success",
        description: "Your subscription has been activated successfully!",
      });

      // Redirect to the return URL
      window.location.href = returnUrl;
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  return <div id={containerId} className="w-full" />;
};