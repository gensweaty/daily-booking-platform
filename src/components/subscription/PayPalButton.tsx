
import { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';

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

    const initializePayPal = async () => {
      try {
        console.log('Initializing PayPal...');
        
        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        // Load PayPal SDK
        await loadPayPalScript(import.meta.env.VITE_PAYPAL_CLIENT_ID);

        // Render PayPal button
        await renderPayPalButton(buttonContainerRef.current.id || 'paypal-button', {
          createSubscription: async () => {
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
              console.error('Error in createSubscription:', error);
              throw error;
            }
          },
          onApprove: async (data) => {
            try {
              console.log('PayPal subscription approved:', data);
              const subscriptionId = data.subscriptionID;
              
              if (!subscriptionId) {
                throw new Error('No subscription ID received');
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
    };
  }, [amount, planType, onSuccess, toast]);

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef} 
        id="paypal-button"
        className="min-h-[45px]"
      >
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
