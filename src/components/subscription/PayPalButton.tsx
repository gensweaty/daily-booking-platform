
import { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';

interface PayPalButtonProps {
  amount: string;
  planType: 'monthly' | 'yearly';
  onSuccess: (subscriptionId: string) => void;
}

export const PayPalButton = ({ amount, planType, onSuccess }: PayPalButtonProps) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let paypalScript: HTMLScriptElement | null = null;
    const scriptId = 'paypal-script';

    const loadPayPalScript = async () => {
      return new Promise<void>((resolve, reject) => {
        // Remove any existing PayPal script
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
          document.body.removeChild(existingScript);
        }

        // Create new PayPal script
        paypalScript = document.createElement('script');
        paypalScript.id = scriptId;
        paypalScript.src = `https://www.paypal.com/sdk/js?client-id=AYmN8pJKiP646o4xp6KaMyEa3_TPIGL4KqYc_dPLD4JXulCW6-tJKn-4QAYPv98m1JPj57Yvf1mV8lP_&currency=USD&intent=subscription`;
        
        paypalScript.onload = () => resolve();
        paypalScript.onerror = () => reject(new Error('Failed to load PayPal script'));
        
        document.body.appendChild(paypalScript);
      });
    };

    const initializePayPal = async () => {
      try {
        console.log('Initializing PayPal...');
        await loadPayPalScript();
        
        if (!buttonContainerRef.current || !window.paypal) {
          throw new Error('PayPal container or SDK not available');
        }

        // Clear any existing buttons
        buttonContainerRef.current.innerHTML = '';

        // Render PayPal button
        const buttons = window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'subscribe'
          },
          createSubscription: async () => {
            const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/create-paypal-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                plan_type: planType,
                amount: amount
              })
            });

            if (!response.ok) {
              throw new Error('Failed to create subscription');
            }

            const data = await response.json();
            return data.subscriptionId;
          },
          onApprove: async (data) => {
            try {
              console.log('PayPal subscription approved:', data);
              const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/verify-paypal-subscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subscriptionId: data.subscriptionID,
                  plan_type: planType
                })
              });

              if (!response.ok) {
                throw new Error('Subscription verification failed');
              }

              const result = await response.json();
              if (isMounted) {
                onSuccess(data.subscriptionID);
              }
            } catch (error) {
              console.error('PayPal verification error:', error);
              toast({
                title: "Error",
                description: "Subscription verification failed. Please try again.",
                variant: "destructive"
              });
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            toast({
              title: "Error",
              description: "There was a problem processing your subscription. Please try again.",
              variant: "destructive"
            });
          }
        });

        const canRender = await buttons.isEligible();
        if (canRender) {
          await buttons.render(buttonContainerRef.current);
        } else {
          throw new Error('PayPal Buttons are not eligible to render');
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (isMounted) {
          setIsLoading(false);
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh and try again.",
            variant: "destructive"
          });
        }
      }
    };

    initializePayPal();

    return () => {
      isMounted = false;
      if (paypalScript && document.body.contains(paypalScript)) {
        document.body.removeChild(paypalScript);
      }
    };
  }, [amount, planType, onSuccess, toast]);

  return (
    <div className="w-full">
      <div ref={buttonContainerRef} className="min-h-[45px]">
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
