import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { usePayPalScript } from './hooks/usePayPalScript';
import { updateSubscriptionStatus } from './utils/paypalUtils';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { isScriptLoaded, isScriptError, loadScript } = usePayPalScript(containerId);
  
  const planId = planType === 'monthly' 
    ? 'P-3PD505110Y2402710M53L6AA'
    : 'P-8RY93575NH0589519M53L6YA';

  useEffect(() => {
    let initTimeout: NodeJS.Timeout;

    const initializePayPalButtons = async () => {
      if (!window.paypal) return;

      try {
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }

        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: (data: any, actions: any) => {
            return actions.subscription.create({
              plan_id: planId
            });
          },
          onApprove: async (data: any) => {
            try {
              await updateSubscriptionStatus(planType, onSuccess, data.subscriptionID);
              
              toast({
                title: "Subscription Activated",
                description: "Thank you for subscribing! Your account has been activated.",
              });
            } catch (error) {
              console.error('Error updating subscription:', error);
              toast({
                title: "Error",
                description: "There was an error activating your subscription. Please contact support.",
                variant: "destructive",
              });
            }
          },
          onError: (err: any) => {
            console.error('PayPal button error:', err);
            toast({
              title: "Error",
              description: "There was an error processing your payment. Please try again.",
              variant: "destructive",
            });
          }
        }).render(`#${containerId}`);
      } catch (error) {
        console.error('PayPal initialization error:', error);
        toast({
          title: "Error",
          description: "Failed to initialize payment system. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    const initialize = async () => {
      try {
        await loadScript();
        // Give PayPal time to initialize
        initTimeout = setTimeout(() => {
          if (window.paypal) {
            initializePayPalButtons();
          } else {
            toast({
              title: "Error",
              description: "Failed to initialize payment system. Please refresh the page.",
              variant: "destructive",
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to load PayPal script:', error);
      }
    };

    initialize();

    return () => {
      clearTimeout(initTimeout);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, planId, planType, onSuccess, toast, loadScript]);

  if (isScriptError) {
    return (
      <div className="text-center p-4 text-red-500">
        Failed to load payment system. Please refresh the page or try again later.
      </div>
    );
  }

  return (
    <div 
      id={containerId} 
      className="min-h-[150px] flex items-center justify-center"
    >
      {!isScriptLoaded && (
        <div className="text-center text-muted-foreground">
          Loading payment options...
        </div>
      )}
    </div>
  );
};