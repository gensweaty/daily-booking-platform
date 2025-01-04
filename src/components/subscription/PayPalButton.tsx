import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  useEffect(() => {
    if (!user) return;

    // Listen for subscription updates
    const channel = supabase
      .channel('subscription-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Subscription updated:', payload);
          if (payload.new.status === 'active' && onSuccess) {
            onSuccess(payload.new.last_payment_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onSuccess]);

  const handlePaymentClick = () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to make a payment",
        variant: "destructive",
      });
      return;
    }

    // Open PayPal payment in new tab
    const paypalUrl = `https://www.paypal.com/buttons/smart-payment-buttons?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=buttons&currency=USD&hosted-button-id=${buttonId}&custom-id=${user.id}&description=${planType}`;
    window.open(paypalUrl, '_blank');
  };

  return (
    <button
      onClick={handlePaymentClick}
      className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
    >
      Pay with Credit Card
    </button>
  );
};