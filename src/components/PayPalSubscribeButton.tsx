import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    paypal: any;
  }
}

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const { toast } = useToast();
  const buttonContainerId = planType === 'monthly' 
    ? 'paypal-button-container-P-3PD505110Y2402710M53L6AA'
    : 'paypal-button-container-P-8RY93575NH0589519M53L6YA';
  const planId = planType === 'monthly'
    ? 'P-3PD505110Y2402710M53L6AA'
    : 'P-8RY93575NH0589519M53L6YA';

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
    script.async = true;
    
    script.onload = () => {
      window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: function(data: any, actions: any) {
          return actions.subscription.create({
            plan_id: planId
          });
        },
        onApprove: async function(data: any) {
          try {
            const currentDate = new Date();
            const nextChargeDate = new Date(currentDate);
            
            if (planType === 'monthly') {
              nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
            } else {
              nextChargeDate.setFullYear(nextChargeDate.getFullYear() + 1);
            }

            const { error } = await supabase
              .from('subscriptions')
              .update({
                status: 'active',
                current_period_start: currentDate.toISOString(),
                current_period_end: nextChargeDate.toISOString(),
                plan_type: planType
              })
              .eq('status', 'expired');

            if (error) throw error;

            toast({
              title: "Subscription Activated",
              description: "Thank you for subscribing! Your account has been activated.",
            });

            if (onSuccess) {
              onSuccess(data.subscriptionID);
            }
          } catch (error) {
            console.error('Error updating subscription:', error);
            toast({
              title: "Error",
              description: "There was an error activating your subscription. Please contact support.",
              variant: "destructive",
            });
          }
        }
      }).render(`#${buttonContainerId}`);
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [buttonContainerId, planId, planType, onSuccess, toast]);

  return <div id={buttonContainerId} />;
};