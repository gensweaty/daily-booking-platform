import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/lib/supabase';
import { usePayPalScript } from './hooks/usePayPalScript';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { paypal, isScriptLoaded, isScriptError } = usePayPalScript();

  useEffect(() => {
    if (isScriptLoaded && paypal && !isScriptError) {
      try {
        paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'subscribe'
          },
          createSubscription: async (data: any, actions: any) => {
            const planId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
            return actions.subscription.create({
              'plan_id': planId
            });
          },
          onApprove: async (data: any) => {
            console.log('PayPal subscription approved:', data);
            
            try {
              // Update subscription status
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  plan_type: planType,
                  current_period_start: new Date().toISOString(),
                  current_period_end: new Date(
                    new Date().setMonth(
                      new Date().getMonth() + (planType === 'monthly' ? 1 : 12)
                    )
                  ).toISOString(),
                  last_payment_id: data.subscriptionID,
                  trial_end_date: null
                })
                .eq('status', 'expired');

              if (updateError) {
                throw updateError;
              }

              toast({
                title: "Success!",
                description: `Your ${planType} subscription has been activated.`,
                duration: 5000,
              });

              if (onSuccess) {
                onSuccess(data.subscriptionID);
              }

              // Force reload to update UI
              window.location.reload();
            } catch (error) {
              console.error('Error updating subscription:', error);
              toast({
                title: "Error",
                description: "Failed to activate subscription. Please contact support.",
                variant: "destructive",
                duration: 5000,
              });
            }
          },
          onError: (err: any) => {
            console.error('PayPal error:', err);
            toast({
              title: "Error",
              description: "There was an error processing your payment. Please try again.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }).render(`#${containerId}`);

      } catch (error) {
        console.error('Error rendering PayPal button:', error);
        toast({
          title: "Error",
          description: "Failed to load payment options. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  }, [isScriptLoaded, paypal, isScriptError, planType, onSuccess, containerId, toast]);

  return <div id={containerId} />;
};