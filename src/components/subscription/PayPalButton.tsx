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
  const buttonInstance = useRef<any>(null);
  
  const amount = planType === 'monthly' ? '9.95' : '89.95';
  const planDuration = planType === 'monthly' ? 'Monthly' : 'Yearly';

  const loadPayPalScript = () => {
    return new Promise<void>((resolve, reject) => {
      // First remove any existing PayPal script
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription&components=buttons";
      script.async = true;
      
      script.addEventListener('load', () => {
        // Add a longer delay to ensure PayPal is fully initialized
        setTimeout(resolve, 1000);
      });

      script.addEventListener('error', () => {
        reject(new Error('Failed to load PayPal SDK'));
      });
      
      document.body.appendChild(script);
      scriptRef.current = script;
    });
  };

  const initializePayPalButton = async () => {
    if (!window.paypal?.Buttons || !containerRef.current) return;

    try {
      // Clear any existing buttons
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Clean up previous instance if it exists
      if (buttonInstance.current) {
        try {
          buttonInstance.current.close();
        } catch (error) {
          console.error('Error closing previous PayPal button:', error);
        }
      }

      buttonInstance.current = window.paypal.Buttons({
        style: {
          shape: 'rect',
          color: 'blue',
          layout: 'vertical',
          label: 'subscribe'
        },
        createSubscription: (data: any, actions: any) => {
          return actions.subscription.create({
            plan_id: planType === 'monthly' 
              ? 'P-3PD505110Y2402710M53L6AA'  // Monthly plan ID
              : 'P-8RY93575NH0589519M53L6YA',  // Yearly plan ID
            });
        },
        onApprove: async (data: any) => {
          try {
            await updateSubscriptionStatus(planType, onSuccess, data.subscriptionID);
            
            toast({
              title: "Success",
              description: "Thank you for your subscription! Your account has been activated.",
            });
          } catch (error) {
            console.error('Subscription processing error:', error);
            toast({
              title: "Error",
              description: "There was an error processing your subscription. Please try again.",
              variant: "destructive",
            });
          }
        },
        onError: (err: any) => {
          console.error('PayPal button error:', err);
          toast({
            title: "Error",
            description: "There was an error with PayPal. Please try again.",
            variant: "destructive",
          });
        }
      });

      await buttonInstance.current.render(`#${containerId}`);
    } catch (error) {
      console.error('PayPal initialization error:', error);
      toast({
        title: "Error",
        description: "Failed to initialize payment system. Please refresh and try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let isComponentMounted = true;

    const initialize = async () => {
      try {
        await loadPayPalScript();
        
        if (!isComponentMounted) return;

        // Wait for PayPal to be fully loaded
        const checkPayPal = setInterval(() => {
          if (window.paypal?.Buttons && isComponentMounted) {
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
      if (buttonInstance.current) {
        try {
          buttonInstance.current.close();
        } catch (error) {
          console.error('Error closing PayPal button:', error);
        }
      }
      // Clean up any intervals that might be running
      const intervals = setInterval(() => {}, 0);
      for (let i = 0; i < intervals; i++) {
        clearInterval(i);
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