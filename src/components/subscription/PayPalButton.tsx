import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const isInitializedRef = useRef(false);
  const scriptLoadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        if (isInitializedRef.current) {
          console.log('PayPal already initialized');
          return;
        }

        console.log('Initializing PayPal...');
        
        if (!scriptLoadPromiseRef.current) {
          scriptLoadPromiseRef.current = loadPayPalScript(
            import.meta.env.VITE_PAYPAL_CLIENT_ID || 'BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q'
          );
        }

        await scriptLoadPromiseRef.current;

        if (!mounted) {
          console.log('Component unmounted, aborting initialization');
          return;
        }

        await renderPayPalButton(
          containerId,
          buttonId,
          async (data) => {
            console.log('Processing payment:', data);
            
            try {
              const user = (await supabase.auth.getUser()).data.user;
              if (!user?.email) {
                throw new Error('User email not found');
              }

              console.log('Processing payment for user:', user.email);
              
              const { data: subscriptionData, error: functionError } = await supabase.functions.invoke(
                'handle-paypal-webhook',
                {
                  body: {
                    resource: {
                      id: data.orderID,
                      payer: { email_address: user.email }
                    },
                    plan_type: planType
                  }
                }
              );

              if (functionError) {
                throw new Error(functionError.message);
              }

              console.log('Subscription updated:', subscriptionData);

              toast({
                title: "Success",
                description: "Your subscription has been activated!",
                duration: 5000,
              });

              if (onSuccess) {
                onSuccess(data.orderID);
              }

              // Force reload to update subscription status
              window.location.reload();
            } catch (error: any) {
              console.error('Error activating subscription:', error);
              toast({
                title: "Error",
                description: "Failed to activate subscription. Please contact support.",
                variant: "destructive",
                duration: 8000,
              });
            }
          }
        );
        
        isInitializedRef.current = true;
        console.log('PayPal initialization complete');
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please refresh the page.",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
      isInitializedRef.current = false;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [buttonId, containerId, toast, onSuccess, planType]);

  return <div id={containerId} className="w-full min-h-[50px]" />;
};