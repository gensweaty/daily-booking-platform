
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

        // Create new PayPal script with additional parameters
        paypalScript = document.createElement('script');
        paypalScript.id = scriptId;
        paypalScript.src = `https://www.paypal.com/sdk/js?client-id=AYmN8pJKiP646o4xp6KaMyEa3_TPIGL4KqYc_dPLD4JXulCW6-tJKn-4QAYPv98m1JPj57Yvf1mV8lP_&currency=USD&intent=subscription&vault=true&components=buttons`;
        
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
        window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING.PAYPAL,
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'pay'
          },
          async onClick() {
            // Validate or prepare anything before payment if needed
            console.log('Button clicked, preparing payment...');
          },
          async onInit() {
            console.log('PayPal button initialized');
          },
          createOrder: async () => {
            try {
              console.log('Creating subscription...', { planType, amount });
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
                const errorData = await response.json();
                console.error('Subscription creation failed:', errorData);
                throw new Error('Failed to create subscription');
              }

              const data = await response.json();
              console.log('Subscription created:', data);
              return data.subscriptionId;
            } catch (error) {
              console.error('Error in createOrder:', error);
              throw error;
            }
          },
          onApprove: async (data: { orderID?: string; subscriptionID?: string }) => {
            try {
              console.log('PayPal subscription approved:', data);
              const subscriptionId = data.subscriptionID || data.orderID;
              
              if (!subscriptionId) {
                throw new Error('No subscription or order ID received');
              }

              const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/verify-paypal-subscription', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subscriptionId: subscriptionId,
                  plan_type: planType
                })
              });

              if (!response.ok) {
                throw new Error('Subscription verification failed');
              }

              const result = await response.json();
              console.log('Subscription verified:', result);
              if (isMounted) {
                onSuccess(subscriptionId);
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
          },
          onCancel: () => {
            console.log('Payment cancelled');
            toast({
              title: "Cancelled",
              description: "Payment was cancelled. Please try again if you wish to subscribe.",
              variant: "default"
            });
          }
        }).render(buttonContainerRef.current)
          .catch((err: Error) => {
            console.error('PayPal render error:', err);
            if (isMounted) {
              toast({
                title: "Error",
                description: "Failed to load payment system. Please refresh and try again.",
                variant: "destructive"
              });
            }
          });

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
