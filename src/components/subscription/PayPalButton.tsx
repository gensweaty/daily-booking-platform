
import { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';
import { useNavigate } from 'react-router-dom';

interface PayPalButtonProps {
  amount: string;
  planType: 'monthly' | 'yearly';
  onSuccess: (subscriptionId: string) => void;
}

export const PayPalButton = ({ amount, planType, onSuccess }: PayPalButtonProps) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handlePaymentSuccess = async (orderId: string) => {
    console.log('Payment successful, order ID:', orderId);
    
    // Add subscription parameter to URL to trigger subscription activation
    navigate(`/dashboard?subscription=${planType}`);
    
    // Call the onSuccess callback
    onSuccess(orderId);
  };

  useEffect(() => {
    let isMounted = true;

    const initializePayPal = async () => {
      try {
        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        await loadPayPalScript('BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q');
        await renderPayPalButton('paypal-outer-container', {
          planType,
          amount
        }, handlePaymentSuccess);

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
  }, [amount, planType, toast, handlePaymentSuccess]);

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef} 
        id="paypal-outer-container"
        className="min-h-[200px] flex justify-center items-center bg-transparent"
      >
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
