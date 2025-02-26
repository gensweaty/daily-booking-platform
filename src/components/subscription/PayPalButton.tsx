
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '../ui/loading-spinner';
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();

  const activateSubscription = async (orderId: string) => {
    if (!user) return;

    try {
      // Get the subscription plan ID
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', planType)
        .single();

      if (!planData?.id) {
        throw new Error('Subscription plan not found');
      }

      const currentDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (planType === 'yearly' ? 12 : 1));

      // Update or create subscription
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          plan_id: planData.id,
          plan_type: planType,
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: endDate.toISOString(),
          last_payment_id: orderId
        });

      if (subscriptionError) throw subscriptionError;

      return true;
    } catch (error) {
      console.error('Error activating subscription:', error);
      return false;
    }
  };

  const handlePaymentSuccess = useCallback(async (orderId: string) => {
    console.log('Payment successful, order ID:', orderId);
    
    const success = await activateSubscription(orderId);
    
    if (success) {
      toast({
        title: "Success",
        description: "Your subscription has been activated successfully!",
      });
      
      // Call the onSuccess callback if provided
      if (onSuccess) {
        onSuccess(orderId);
      }

      // Refresh the page to update the UI
      window.location.reload();
    } else {
      toast({
        title: "Error",
        description: "Failed to activate subscription. Please contact support.",
        variant: "destructive"
      });
    }
  }, [planType, onSuccess, toast, user]);

  useEffect(() => {
    let isMounted = true;

    const initializePayPal = async () => {
      try {
        if (!buttonContainerRef.current) {
          throw new Error('PayPal container not found');
        }

        await loadPayPalScript('BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q');
        
        if (!isMounted) return;

        await renderPayPalButton(
          'paypal-outer-container', 
          { planType, amount },
          handlePaymentSuccess
        );

        setIsLoading(false);
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

  if (!buttonContainerRef.current && isLoading) {
    return <LoadingSpinner />;
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
