import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  useEffect(() => {
    // Create a channel to listen for payment success events
    const channel = supabase
      .channel('payment_status')
      .on(
        'broadcast',
        { event: 'payment_success' },
        (payload) => {
          console.log('Payment success received:', payload);
          if (payload.payload.orderId) {
            handlePaymentSuccess(payload.payload.orderId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    // Open PayPal payment in new tab
    const paypalUrl = planType === 'monthly' 
      ? 'https://www.paypal.com/buttons/smart-payment-buttons?token=ST9DUFXHJCGWJ'
      : 'https://www.paypal.com/buttons/smart-payment-buttons?token=YDK5G6VR2EA8L';
    
    const button = document.createElement('button');
    button.className = 'w-full bg-[#FFC439] text-black px-4 py-2 rounded hover:bg-[#F2BA36] transition-colors';
    button.textContent = 'Pay with PayPal';
    button.onclick = () => {
      window.open(paypalUrl, '_blank');
    };

    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
      container.appendChild(button);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, planType]);

  return <div id={containerId} className="w-full h-[40px]" />;
};