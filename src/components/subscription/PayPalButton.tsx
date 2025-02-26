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

  const activateSubscription = async (orderId: string) => {
    if (!user) {
      console.error('No user found when trying to activate subscription');
      return false;
    }

    try {
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('type', planType)
        .single();

      if (planError || !planData?.id) {
        console.error('Error fetching plan:', planError);
        return false;
      }

      const currentDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (planType === 'yearly' ? 12 : 1));

      await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id);

      const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_id: planData.id,
          plan_type: planType,
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: endDate.toISOString(),
          last_payment_id: orderId
        })
        .select()
        .single();

      if (subscriptionError) {
        console.error('Error creating subscription:', subscriptionError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in activateSubscription:', error);
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
      
      if (onSuccess) {
        onSuccess(orderId);
      }
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
    let mounted = true;

    const initPayPal = async () => {
      if (!buttonContainerRef.current) return;
      
      try {
        await loadPayPalScript('BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q');
        
        if (!mounted) return;

        const container = buttonContainerRef.current;
        const containerId = 'paypal-button-container';
        container.id = containerId;
        
        await renderPayPalButton(
          containerId,
          { planType, amount },
          handlePaymentSuccess
        );

        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          setError('Failed to load payment system. Please try again.');
          toast({
            title: "Error",
            description: "Failed to load payment system. Please try again.",
            variant: "destructive"
          });
        }
      }
    };

    initPayPal();

    return () => {
      mounted = false;
    };
  }, [amount, planType, handlePaymentSuccess, toast]);

  if (error) {
    return (
      <div className="w-full p-4 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        ref={buttonContainerRef}
        className="min-h-[150px] w-full flex justify-center items-center bg-background"
      >
        {isLoading && <LoadingSpinner />}
      </div>
    </div>
  );
};
