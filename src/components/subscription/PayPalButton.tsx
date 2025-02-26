
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface PayPalButtonProps {
  amount: string;
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalButton = ({ amount, planType, onSuccess }: PayPalButtonProps) => {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handlePaymentSuccess = useCallback(async (data: any) => {
    console.log('PayPal payment approved:', data);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No auth session found');
      }

      const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/verify-paypal-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subscriptionId: data.orderID,
          plan_type: planType
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Subscription verification failed:', errorText);
        throw new Error('Subscription verification failed');
      }

      const result = await response.json();
      console.log('Subscription verified:', result);

      toast({
        title: "Success",
        description: "Your subscription has been activated successfully!",
      });
      
      if (onSuccess) {
        onSuccess(data.orderID);
      }

      window.location.reload();
    } catch (error) {
      console.error('PayPal verification error:', error);
      toast({
        title: "Error",
        description: "Failed to verify subscription. Please try again or contact support.",
        variant: "destructive"
      });
    }
  }, [planType, onSuccess, toast]);

  const initPayPal = useCallback(async () => {
    if (!buttonContainerRef.current) {
      console.error('Button container ref not found');
      return;
    }
    
    try {
      setError(null);
      setIsLoading(true);

      // Create the container before loading PayPal
      buttonContainerRef.current.innerHTML = '<div id="paypal-button-container"></div>';

      // Load PayPal script
      await loadPayPalScript('BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q');
      
      // Render PayPal button
      await renderPayPalButton(
        'paypal-button-container',
        { planType, amount },
        handlePaymentSuccess
      );

      setIsLoading(false);
    } catch (error) {
      console.error('PayPal initialization error:', error);
      setIsLoading(false);
      setError('Failed to load payment system. Please try refreshing the page.');
      toast({
        title: "Error",
        description: "Failed to load payment system. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  }, [amount, planType, handlePaymentSuccess, toast]);

  useEffect(() => {
    let mounted = true;

    // Clean up function that will run when component unmounts
    const cleanup = () => {
      mounted = false;
      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = '';
      }
      // Clean up PayPal script
      const paypalScript = document.getElementById('paypal-script');
      if (paypalScript) {
        paypalScript.remove();
      }
    };

    // Only initialize if component is mounted
    if (mounted) {
      // Clean up any existing PayPal instances first
      cleanup();
      // Initialize PayPal after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (mounted) {
          initPayPal();
        }
      }, 100);
    }

    return cleanup;
  }, [initPayPal]);

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef}
        className="min-h-[150px] w-full flex justify-center items-center bg-background"
      >
        {isLoading && <LoadingSpinner />}
      </div>
      {error && (
        <div className="mt-2 text-center text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};
