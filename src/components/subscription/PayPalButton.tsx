import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { usePayPalScript } from './hooks/usePayPalScript';
import { updateSubscriptionStatus } from './utils/paypalUtils';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (orderId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { isScriptLoaded, isScriptError, loadScript } = usePayPalScript(containerId);
  
  const amount = planType === 'monthly' ? '9.95' : '89.95';
  const planDuration = planType === 'monthly' ? 'Monthly' : 'Yearly';

  useEffect(() => {
    let mounted = true;

    const initializePayPalButtons = async () => {
      if (!window.paypal || !mounted) return;

      try {
        // Safely clean up any existing buttons
        const container = document.getElementById(containerId);
        if (container) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        }

        await window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'pay'
          },
          createOrder: (data: any, actions: any) => {
            return actions.order.create({
              purchase_units: [{
                description: `${planDuration} Plan Payment`,
                amount: {
                  currency_code: 'USD',
                  value: amount
                }
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            if (!mounted) return;
            
            try {
              const order = await actions.order.capture();
              await updateSubscriptionStatus(planType, onSuccess, order.id);
              
              toast({
                title: "Payment Successful",
                description: "Thank you for your payment! Your account has been activated.",
              });
            } catch (error) {
              console.error('Error processing payment:', error);
              toast({
                title: "Error",
                description: "There was an error processing your payment. Please try again.",
                variant: "destructive",
              });
            }
          },
          onError: (err: any) => {
            if (!mounted) return;
            
            console.error('PayPal button error:', err);
            toast({
              title: "Error",
              description: "There was an error processing your payment. Please try again.",
              variant: "destructive",
            });
          }
        }).render(`#${containerId}`);
      } catch (error) {
        if (!mounted) return;
        
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
        if (window.paypal && mounted) {
          await initializePayPalButtons();
        }
      } catch (error) {
        console.error('Failed to load PayPal script:', error);
      }
    };

    initialize();

    return () => {
      mounted = false;
      // Clean up the container on unmount
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [containerId, planType, amount, planDuration, onSuccess, toast, loadScript]);

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