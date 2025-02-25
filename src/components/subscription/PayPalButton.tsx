
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
          planType,
          amount,
          createSubscription: async () => {
            // This won't be called with hosted buttons, but kept for type compatibility
            return '';
          },
          onApprove: async (data) => {
            // This won't be called with hosted buttons, but kept for type compatibility
            if (isMounted) {
              onSuccess('subscription_created');
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
