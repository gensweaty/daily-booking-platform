import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { updateSubscriptionStatus } from './utils/paypalUtils';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (orderId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  
  const amount = planType === 'monthly' ? '9.95' : '89.95';
  const planDuration = planType === 'monthly' ? 'Monthly' : 'Yearly';

  const loadPayPalScript = () => {
    return new Promise<void>((resolve, reject) => {
      // Remove any existing PayPal script
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
        scriptRef.current = null;
      }

      const script = document.createElement('script');
      script.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      
      document.body.appendChild(script);
      scriptRef.current = script;
    });
  };

  const initializePayPalButton = async () => {
    if (!window.paypal || !containerRef.current) return;

    try {
      // Clear the container
      containerRef.current.innerHTML = '';

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

  useEffect(() => {
    let isComponentMounted = true;

    const initialize = async () => {
      try {
        await loadPayPalScript();
        
        // Wait for PayPal to be fully loaded
        const checkPayPal = setInterval(() => {
          if (window.paypal && isComponentMounted) {
            clearInterval(checkPayPal);
            initializePayPalButton();
          }
        }, 100);

        // Cleanup interval after 10 seconds if PayPal doesn't load
        setTimeout(() => {
          clearInterval(checkPayPal);
        }, 10000);
      } catch (error) {
        console.error('Failed to initialize PayPal:', error);
        if (isComponentMounted) {
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    initialize();

    return () => {
      isComponentMounted = false;
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [containerId, planType, amount, planDuration, toast]);

  return (
    <div 
      id={containerId}
      ref={containerRef}
      className="min-h-[150px] flex items-center justify-center"
    >
      <div className="text-center text-muted-foreground">
        Loading payment options...
      </div>
    </div>
  );
};