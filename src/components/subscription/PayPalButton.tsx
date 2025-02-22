
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const scriptLoadAttempts = useRef(0);
  const maxAttempts = 3;

  useEffect(() => {
    const loadPayPalScript = async () => {
      try {
        console.log('Starting PayPal script load...');
        
        // Clean up any existing PayPal buttons
        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
        }

        // Clean up any existing PayPal script
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          existingScript.remove();
        }

        // @ts-ignore
        if (!window.paypal) {
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
          script.async = true;
          
          await new Promise((resolve, reject) => {
            script.onload = () => {
              console.log('PayPal script loaded successfully');
              resolve(true);
            };
            script.onerror = (error) => {
              console.error('PayPal script load error:', error);
              reject(error);
            };
            document.body.appendChild(script);
          });
        }

        // Wait a short moment to ensure PayPal is fully initialized
        await new Promise(resolve => setTimeout(resolve, 1000));

        // @ts-ignore
        if (!window.paypal?.Buttons) {
          throw new Error('PayPal Buttons not available');
        }

        console.log('Initializing PayPal button');

        // @ts-ignore
        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: (data: any, actions: any) => {
            return actions.subscription.create({
              'plan_id': planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'
            });
          },
          onApprove: async (data: any) => {
            console.log('Subscription approved:', data);
            
            try {
              const { error: verificationError } = await supabase.functions.invoke(
                'verify-paypal-payment',
                {
                  body: { 
                    userId: user?.id,
                    subscription: data.subscriptionID
                  }
                }
              );

              if (verificationError) {
                throw verificationError;
              }

              toast({
                title: "Success",
                description: "Your subscription has been activated!",
              });

              if (onSuccess) {
                onSuccess(data.subscriptionID);
              }

              // Reload the page to update subscription state
              window.location.reload();

            } catch (error) {
              console.error('Subscription verification error:', error);
              toast({
                title: "Error",
                description: "Failed to verify subscription. Please contact support.",
                variant: "destructive",
              });
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            toast({
              title: "Error",
              description: "There was a problem with the payment. Please try again.",
              variant: "destructive",
            });
          }
        }).render(`#${containerId}`);

        console.log('PayPal button rendered successfully');

      } catch (error) {
        console.error('PayPal initialization error:', error);
        scriptLoadAttempts.current += 1;
        
        if (scriptLoadAttempts.current < maxAttempts) {
          console.log(`Retrying PayPal script load (attempt ${scriptLoadAttempts.current + 1}/${maxAttempts})...`);
          setTimeout(loadPayPalScript, 2000); // Retry after 2 seconds
        } else {
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh the page and try again.",
            variant: "destructive",
          });
        }
      }
    };

    if (user) {
      loadPayPalScript();
    }

    return () => {
      // Clean up PayPal button container
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
    };
  }, [user, planType, onSuccess, containerId, toast]);

  return <div id={containerId} ref={buttonRef} />;
};
