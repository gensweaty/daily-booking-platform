import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { usePayPalSubscription } from './hooks/usePayPalSubscription';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly' | 'test';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { handlePaymentSuccess, isProcessing } = usePayPalSubscription(planType, onSuccess);

  useEffect(() => {
    let mounted = true;
    let paypalScriptAttempts = 0;
    const maxAttempts = 3;

    const initializePayPal = async () => {
      if (!user) {
        console.error('No authenticated user found');
        toast({
          title: "Error",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log('Initializing PayPal...');
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

        const loadPayPalScript = () => {
          return new Promise<void>((resolve, reject) => {
            if (window.paypal) {
              console.log('PayPal already loaded');
              resolve();
              return;
            }

            console.log('Loading PayPal script...');
            const script = document.createElement('script');
            script.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
            script.async = true;
            
            script.onload = () => {
              console.log('PayPal script loaded successfully');
              resolve();
            };

            script.onerror = () => {
              console.error('Failed to load PayPal script');
              paypalScriptAttempts++;
              if (paypalScriptAttempts < maxAttempts) {
                console.log(`Retrying PayPal script load (attempt ${paypalScriptAttempts + 1}/${maxAttempts})`);
                document.body.removeChild(script);
                loadPayPalScript();
              } else {
                reject(new Error('Failed to load PayPal after multiple attempts'));
              }
            };

            document.body.appendChild(script);
          });
        };

        try {
          await loadPayPalScript();
          await initializePayPalButton(plan.id);
        } catch (error) {
          console.error('PayPal initialization error:', error);
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please try again later.",
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

    const initializePayPalButton = async (planId: string) => {
      try {
        if (!window.paypal?.Buttons) {
          console.error('PayPal Buttons not available');
          return;
        }

        await window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'subscribe'
          },
          createSubscription: async () => {
            // Create subscription record with pending status
            const { data: subscription, error: subscriptionError } = await supabase
              .from('subscriptions')
              .insert({
                plan_type: planType,
                status: 'pending',
                plan_id: planId,
                user_id: user?.id
              })
              .select()
              .single();

            if (subscriptionError) {
              console.error('Error creating subscription:', subscriptionError);
              throw subscriptionError;
            }

            return subscription.id;
          },
          onApprove: async (data) => {
            console.log('Payment approved:', data);
            await handlePaymentSuccess(data.orderID, data.subscriptionID);
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
    };

    initializePayPal();

    return () => {
      mounted = false;
    };
  }, [containerId, toast, handlePaymentSuccess, isProcessing, planType, user]);

  return <div id={containerId} className="w-full" />;
};