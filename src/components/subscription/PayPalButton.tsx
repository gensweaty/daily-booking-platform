
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
        try {
          // Remove any existing PayPal script
          const existingScript = document.getElementById(scriptId);
          if (existingScript) {
            document.body.removeChild(existingScript);
          }

          // Create new PayPal script
          paypalScript = document.createElement('script');
          paypalScript.id = scriptId;
          paypalScript.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=subscription`;
          
          paypalScript.onload = () => {
            console.log('PayPal script loaded successfully');
            resolve();
          };
          
          paypalScript.onerror = (error) => {
            console.error('PayPal script loading error:', error);
            reject(new Error('Failed to load PayPal script'));
          };
          
          document.body.appendChild(paypalScript);
        } catch (error) {
          console.error('Error in loadPayPalScript:', error);
          reject(error);
        }
      });
    };

    const initializePayPal = async () => {
      try {
        console.log('Initializing PayPal...');
        await loadPayPalScript();
        
        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        if (!window.paypal) {
          throw new Error('PayPal SDK not loaded');
        }

        // Clear any existing buttons
        buttonContainerRef.current.innerHTML = '';

        // Render PayPal button
        await window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'pay'
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
        }).render(buttonContainerRef.current);

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
