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
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;

    const loadPayPalScript = async () => {
      try {
        console.log('Starting PayPal script load...', containerId);
        
        // Clean up any existing PayPal script and buttons
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          existingScript.remove();
          // @ts-ignore
          delete window.paypal;
        }

        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
        }

        // Create and load new script
        scriptElement = document.createElement('script');
        scriptElement.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
        scriptElement.async = true;

        const loadPromise = new Promise<void>((resolve, reject) => {
          if (scriptElement) {
            scriptElement.onload = () => {
              console.log('PayPal script loaded successfully for', containerId);
              resolve();
            };
            scriptElement.onerror = (error) => {
              console.error('PayPal script load error:', error);
              reject(new Error('Failed to load PayPal script'));
            };
          }
        });

        document.body.appendChild(scriptElement);
        await loadPromise;

        // Wait for PayPal to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));

        // @ts-ignore
        if (!window.paypal) {
          throw new Error('PayPal SDK not initialized properly');
        }

        console.log('Initializing PayPal button for', containerId);

        // @ts-ignore
        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: (data: any, actions: any) => {
            console.log('Creating subscription for plan:', planType);
            return actions.subscription.create({
              'plan_id': planType === 'monthly' ? 'P-5ML4271244454362WXNWU5NQ' : 'P-86V37366MN133974NXNWU5YI'
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
            console.error('PayPal button error:', err);
            toast({
              title: "Error",
              description: "There was a problem with the payment. Please try again.",
              variant: "destructive",
            });
          }
        }).render(`#${containerId}`);

        console.log('PayPal button rendered successfully for', containerId);
        scriptLoadedRef.current = true;

      } catch (error) {
        console.error('PayPal initialization error:', error);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please try again.",
          variant: "destructive",
        });
      }
    };

    if (user && !scriptLoadedRef.current) {
      loadPayPalScript();
    }

    return () => {
      // Cleanup on unmount
      if (scriptElement) {
        scriptElement.remove();
      }
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
      scriptLoadedRef.current = false;
    };
  }, [user, planType, onSuccess, containerId, toast]);

  return <div id={containerId} ref={buttonRef} />;
};