import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const loadPayPalScript = () => {
      // Remove any existing PayPal script
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Create new script element
      const script = document.createElement('script');
      script.src = "https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD";
      script.crossOrigin = "anonymous";
      script.async = true;
      
      // Add script to document
      document.body.appendChild(script);
      scriptRef.current = script;

      // Initialize PayPal button when script loads
      script.onload = () => {
        const hostedButtonId = planType === 'monthly' 
          ? 'ST9DUFXHJCGWJ'  // Monthly plan button ID
          : 'YDK5G6VR2EA8L'; // Yearly plan button ID

        try {
          window.paypal?.HostedButtons({
            hostedButtonId: hostedButtonId
          })
          .render(`#${containerId}`);
        } catch (error) {
          console.error('PayPal initialization error:', error);
          toast({
            title: "Error",
            description: "Failed to initialize payment system. Please refresh and try again.",
            variant: "destructive",
          });
        }
      };

      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        toast({
          title: "Error",
          description: "Failed to load payment system. Please refresh the page.",
          variant: "destructive",
        });
      };
    };

    loadPayPalScript();

    // Cleanup function
    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove();
      }
      // Clear the container
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
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