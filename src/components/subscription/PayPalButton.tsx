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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const initializePayPal = async () => {
      if (!mountedRef.current) return;

      try {
        if (isInitializedRef.current) {
          console.log('PayPal already initialized for:', containerId);
          return;
        }

        console.log('Starting PayPal initialization for:', containerId);
        
        if (!scriptLoadPromiseRef.current) {
          scriptLoadPromiseRef.current = loadPayPalScript(
            import.meta.env.VITE_PAYPAL_CLIENT_ID || ''
          );
        }

        await scriptLoadPromiseRef.current;
        
        if (!mountedRef.current) return;

        const container = document.getElementById(containerId);
        if (!container) {
          console.error('PayPal container not found:', containerId);
          return;
        }

        // Clear container before rendering
        container.innerHTML = '';

        await renderPayPalButton(
          containerId,
          buttonId,
          async (data) => {
            if (!mountedRef.current) return;
            
            console.log('Payment success:', data);
            
            try {
              const user = (await supabase.auth.getUser()).data.user;
              if (!user?.email) {
                throw new Error('User email not found');
              }

              const { error: functionError } = await supabase.functions.invoke(
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

              if (functionError) throw functionError;

              toast({
                title: "Success",
                description: "Your subscription has been activated!",
              });

              if (onSuccess) {
                onSuccess(data.orderID);
              }

              window.location.href = `/dashboard?subscription=${planType}`;
            } catch (error: any) {
              console.error('Subscription error:', error);
              toast({
                title: "Error",
                description: "Failed to activate subscription. Please try again.",
                variant: "destructive",
              });
            }
          }
        );
        
        isInitializedRef.current = true;
        console.log('PayPal initialization complete for:', containerId);
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mountedRef.current) {
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
      mountedRef.current = false;
    };
  }, [buttonId, containerId, toast, onSuccess, planType]);

  return <div id={containerId} className="w-full min-h-[50px]" />;
};