import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { checkExistingSubscription } from '@/utils/subscriptionUtils';
import { usePayPalInitialization } from '@/hooks/usePayPalInitialization';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  onError?: (error: any) => void;
  onLoad?: () => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, onError, onLoad, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      const result = await checkExistingSubscription();
      if (result?.isSubscribed) {
        setIsSubscribed(true);
        if (onSuccess) {
          onSuccess('existing-subscription');
        }
      }
    };

    checkSubscription();
  }, [onSuccess]);

  const handlePaymentSuccess = async (orderId: string) => {
    try {
      const { data: subscription, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'expired')
        .single();

      if (fetchError) {
        console.error('Error fetching subscription:', fetchError);
        return;
      }

      const currentDate = new Date();
      const nextPeriodEnd = new Date(currentDate);
      
      if (planType === 'monthly') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: currentDate.toISOString(),
          current_period_end: nextPeriodEnd.toISOString(),
          plan_type: planType,
          last_payment_id: orderId
        })
        .eq('id', subscription.id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return;
      }

      if (onSuccess) {
        onSuccess(orderId);
      }

      toast({
        title: "Success",
        description: "Your subscription has been activated successfully!",
      });

      // Close any open PayPal windows
      const paypalWindows = window.opener || window.parent;
      if (paypalWindows !== window) {
        window.close();
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      if (onError) {
        onError(error);
      }
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  usePayPalInitialization(buttonId, containerId, handlePaymentSuccess, isSubscribed, onError, onLoad);

  if (isSubscribed) {
    return null;
  }

  return <div id={containerId} className="w-full" />;
};