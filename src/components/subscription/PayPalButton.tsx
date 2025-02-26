
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';
import { useNavigate } from 'react-router-dom';

interface PayPalButtonProps {
  amount: string;
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalButton = ({ amount, planType, onSuccess }: PayPalButtonProps) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const scriptLoadAttempts = useRef(0);
  const [isError, setIsError] = useState(false);

  const handlePaymentSuccess = useCallback((orderId: string) => {
    console.log('Payment successful, order ID:', orderId);
    
    // Add subscription parameter to URL to trigger subscription activation
    navigate(`/dashboard?subscription=${planType}`);
    
    // Call the onSuccess callback if provided
    if (onSuccess) {
      onSuccess(orderId);
    }
  }, [navigate, planType, onSuccess]);

  useEffect(() => {
    let isMounted = true;
    let retryTimeout: NodeJS.Timeout;

    const initializePayPal = async () => {
      if (!isMounted) return;

      try {
        setIsError(false);
        console.log('Initializing PayPal button...');

        await loadPayPalScript('BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q');
        
        if (!isMounted) return;

        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        await renderPayPalButton(
          'paypal-outer-container', 
          { planType, amount },
          handlePaymentSuccess
        );

        if (isMounted) {
          setIsLoading(false);
          scriptLoadAttempts.current = 0;
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (isMounted) {
          if (scriptLoadAttempts.current < 3) {
            scriptLoadAttempts.current += 1;
            console.log(`Retrying PayPal initialization (attempt ${scriptLoadAttempts.current})`);
            retryTimeout = setTimeout(initializePayPal, 2000);
          } else {
            setIsLoading(false);
            setIsError(true);
            toast({
              title: "Error",
              description: "Failed to load payment system. Please refresh and try again.",
              variant: "destructive"
            });
          }
        }
      }
    };

    const cleanup = () => {
      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        existingScript.remove();
      }
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = '';
      }
    };

    cleanup();
    initializePayPal();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      cleanup();
    };
  }, [amount, planType, toast, handlePaymentSuccess]);

  if (isError) {
    return (
      <div className="w-full p-4 text-center">
        <p className="text-red-500">Failed to load payment system.</p>
        <button 
          onClick={() => {
            setIsLoading(true);
            setIsError(false);
            scriptLoadAttempts.current = 0;
          }}
          className="mt-2 text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef} 
        id="paypal-outer-container"
        className="min-h-[150px] flex justify-center items-center bg-transparent"
      >
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
