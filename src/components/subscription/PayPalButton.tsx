import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { usePayPalSubscription } from './hooks/usePayPalSubscription';
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly' | 'test';
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
    script.crossOrigin = "anonymous";

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
  const { handlePaymentSuccess, isProcessing } = usePayPalSubscription(planType, onSuccess);

  // Get button ID based on plan type
  const getButtonId = (type: string) => {
    switch (type) {
      case 'monthly':
        return 'ST9DUFXHJCGWJ';
      case 'yearly':
        return 'YDK5G6VR2EA8L';
      case 'test':
        return 'TEST_BUTTON_ID'; // Replace with actual test button ID
      default:
        return '';
    }
  };

  const buttonId = getButtonId(planType);

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();

        if (!mounted) return;

        if (window.paypal && !isProcessing) {
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

          // Then create the subscription record
          const { data: subscription, error: subscriptionError } = await supabase
            .from('subscriptions')
            .insert({
              plan_type: planType,
              status: 'pending',
              plan_id: plan.id, // Add the plan_id here
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

          try {
            await window.paypal.HostedButtons({
              hostedButtonId: buttonId,
              onApprove: async (data: any) => {
                console.log('Payment approved:', data);
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
  }, [buttonId, containerId, toast, handlePaymentSuccess, isProcessing, planType]);

  return <div id={containerId} className="w-full" />;
};