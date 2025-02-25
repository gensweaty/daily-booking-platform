
import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';

interface PayPalButtonProps {
  amount: string;
  planType: 'monthly' | 'yearly';
  onSuccess: (subscriptionId: string) => void;
}

export const PayPalButton = ({ amount, planType, onSuccess }: PayPalButtonProps) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;
    let paypalScript: HTMLScriptElement | null = null;

    const initializePayPal = async () => {
      if (!window.paypal) {
        // Create and load PayPal script
        paypalScript = document.createElement('script');
        paypalScript.src = 'https://www.paypal.com/sdk/js?client-id=AYmN8pJKiP646o4xp6KaMyEa3_TPIGL4KqYc_dPLD4JXulCW6-tJKn-4QAYPv98m1JPj57Yvf1mV8lP_&currency=USD&intent=capture';
        
        await new Promise((resolve, reject) => {
          if (paypalScript) {
            paypalScript.onload = resolve;
            paypalScript.onerror = reject;
            document.body.appendChild(paypalScript);
          }
        });
      }

      if (!buttonContainerRef.current || !window.paypal) {
        return;
      }

      // Clear any existing buttons
      buttonContainerRef.current.innerHTML = '';

      // Render PayPal button
      window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'pay'
        },
        createOrder: async () => {
          const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/create-paypal-order', {
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
            throw new Error('Failed to create order');
          }

          const order = await response.json();
          return order.id;
        },
        onApprove: async (data) => {
          try {
            const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/verify-paypal-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                order_id: data.orderID,
                plan_type: planType
              })
            });

            if (!response.ok) {
              throw new Error('Payment verification failed');
            }

            const result = await response.json();

            if (isMounted) {
              onSuccess(result.subscriptionId || data.orderID);
            }
          } catch (error) {
            toast({
              title: "Error",
              description: "Payment verification failed. Please try again.",
              variant: "destructive"
            });
          }
        },
        onError: () => {
          toast({
            title: "Error",
            description: "There was a problem processing your payment. Please try again.",
            variant: "destructive"
          });
        }
      }).render(buttonContainerRef.current);
    };

    initializePayPal().catch(() => {
      if (isMounted) {
        toast({
          title: "Error",
          description: "Failed to load payment system. Please refresh and try again.",
          variant: "destructive"
        });
      }
    });

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
        <LoadingSpinner />
      </div>
    </div>
  );
};
