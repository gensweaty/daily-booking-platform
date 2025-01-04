import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (orderId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const buttonInstance = useRef<PayPalHostedButtonsComponent | null>(null);

  const loadPayPalScript = () => {
    return new Promise<void>((resolve, reject) => {
      // First remove any existing PayPal script
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.src = "https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD";
      script.crossOrigin = "anonymous";
      script.async = true;
      
      script.addEventListener('load', () => {
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
    if (!window.paypal?.HostedButtons || !containerRef.current) return;

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

      // Use the appropriate hosted button ID based on plan type
      const hostedButtonId = planType === 'monthly' 
        ? 'YDK5G6VR2EA8L'  // Monthly plan button ID
        : 'YKXLC4MYQK4JY'; // Yearly plan button ID

      buttonInstance.current = await window.paypal.HostedButtons({
        hostedButtonId: hostedButtonId
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
    let checkPayPalInterval: number;

    const initialize = async () => {
      try {
        await loadPayPalScript();
        
        if (!isComponentMounted) return;

        // Wait for PayPal to be fully loaded
        checkPayPalInterval = window.setInterval(() => {
          if (window.paypal?.HostedButtons && isComponentMounted) {
            window.clearInterval(checkPayPalInterval);
            initializePayPalButton();
          }
        }, 100);

        // Cleanup interval after 10 seconds if PayPal doesn't load
        setTimeout(() => {
          window.clearInterval(checkPayPalInterval);
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
      if (checkPayPalInterval) {
        window.clearInterval(checkPayPalInterval);
      }
    };
  }, [containerId, planType, toast]);

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