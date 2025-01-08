import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { loadPayPalScript } from '@/utils/paypal';

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
        
        // Fetch PayPal client ID from Supabase
        const { data: { value: clientId }, error: secretError } = await supabase
          .functions.invoke('get-secret', {
            body: { secretName: 'PAYPAL_CLIENT_ID' }
          });

        if (secretError || !clientId) {
          throw new Error('Failed to fetch PayPal client ID');
        }
        
        if (!scriptLoadPromiseRef.current) {
          scriptLoadPromiseRef.current = loadPayPalScript(clientId);
        }

        await scriptLoadPromiseRef.current;

        if (!mounted) {
          console.log('Component unmounted, aborting initialization');
          return;
        }

        const container = document.getElementById(containerId);
        if (!container) {
          throw new Error(`Container ${containerId} not found`);
        }

        // Clear existing content
        container.innerHTML = '';

        // @ts-ignore - PayPal types are not complete
        window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'subscribe'
          },
          createSubscription: async (data: any, actions: any) => {
            return actions.subscription.create({
              'plan_id': buttonId
            });
          },
          onApprove: async (data: { subscriptionID: string, orderID: string }) => {
            console.log('Payment approved:', data);
            
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
                      id: data.subscriptionID,
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
                onSuccess(data.subscriptionID);
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
              throw error;
            }
          }
        }).render(`#${containerId}`);
        
        isInitializedRef.current = true;
        console.log('PayPal initialization complete');
      } catch (error: any) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: error.message || "Failed to initialize PayPal. Please refresh the page.",
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