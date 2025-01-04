import { useEffect, useState } from 'react';
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface UsePayPalSubscriptionProps {
  buttonId: string;
  containerId: string;
  onSuccess?: (subscriptionId: string) => void;
}

export const usePayPalSubscription = ({ buttonId, containerId, onSuccess }: UsePayPalSubscriptionProps) => {
  const { toast } = useToast();
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);

  const checkSubscriptionStatus = async () => {
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('status', 'active')
      .single();

    if (subscription?.status === 'active') {
      if (onSuccess) {
        onSuccess('subscription_activated');
      }
    }
  };

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
      
      if (buttonId === 'ST9DUFXHJCGWJ') {
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
          plan_type: buttonId === 'ST9DUFXHJCGWJ' ? 'monthly' : 'yearly',
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
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Error",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    let checkInterval: ReturnType<typeof setInterval>;

    const loadPayPalButton = async () => {
      try {
        if (!mounted) return;

        if (window.paypal) {
          await window.paypal.Buttons({
            style: {
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'subscribe'
            },
            createSubscription: (data: any, actions: any) => {
              return actions.subscription.create({
                'plan_id': buttonId
              });
            },
            onApprove: (data: any) => {
              console.log('Payment approved:', data);
              handlePaymentSuccess(data.subscriptionID);
            }
          }).render(`#${containerId}`);
        }
      } catch (error) {
        console.error('PayPal button render error:', error);
        toast({
          title: "Error",
          description: "Failed to load PayPal button. Please try again.",
          variant: "destructive",
        });
      }
    };

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=test&vault=true&intent=subscription`;
    script.async = true;
    script.onload = () => {
      loadPayPalButton();
    };
    document.body.appendChild(script);

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      document.body.removeChild(script);
    };
  }, [buttonId, containerId, toast, onSuccess, paymentWindow]);
};