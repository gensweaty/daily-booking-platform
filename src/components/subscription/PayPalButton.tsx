
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
        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        await loadPayPalScript('');  // We're using hardcoded client ID in loadPayPalScript
        await renderPayPalButton('paypal-button', {
          planType,
          amount
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
  }, [amount, planType, toast]);

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef} 
        id="paypal-button"
        className="min-h-[45px] flex justify-center items-center bg-transparent"
        style={{ minHeight: '200px' }}  // Ensure enough space for the PayPal button
      >
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
