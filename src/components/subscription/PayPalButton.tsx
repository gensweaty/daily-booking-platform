import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { PAYPAL_SDK_OPTIONS, PAYPAL_BUTTON_CONFIGS } from '@/config/paypal-config';
import { PayPalPlanType } from '@/types/paypal-types';
import { updateSubscription } from '@/utils/subscription-utils';

interface PayPalButtonProps {
  planType: PayPalPlanType;
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

let isScriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

const loadPayPalScript = () => {
  if (scriptLoadPromise) return scriptLoadPromise;
  if (isScriptLoading) {
    return new Promise<void>((resolve) => {
      const checkScript = () => {
        if (window.paypal) resolve();
        else setTimeout(checkScript, 100);
      };
      checkScript();
    });
  }

  isScriptLoading = true;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams(PAYPAL_SDK_OPTIONS);
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
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
  const buttonConfig = PAYPAL_BUTTON_CONFIGS[planType];

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();
        if (!mounted) return;

        if (window.paypal) {
          await window.paypal.HostedButtons({
            hostedButtonId: buttonConfig.hostedButtonId,
            onApprove: async (data) => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('No authenticated user found');
                
                await updateSubscription(user.id, planType, data.orderID);
                
                if (onSuccess) {
                  onSuccess(data.orderID);
                }

                toast({
                  title: "Success",
                  description: "Your subscription has been activated successfully!",
                });

                window.location.href = `/dashboard?subscription=${planType}`;
              } catch (error) {
                console.error('Payment processing error:', error);
                toast({
                  title: "Error",
                  description: "There was an error processing your payment. Please try again.",
                  variant: "destructive",
                });
              }
            },
            onCancel: () => {
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
    return () => { mounted = false; };
  }, [buttonConfig.hostedButtonId, containerId, onSuccess, planType, toast]);

  return <div id={containerId} className="w-full" />;
};