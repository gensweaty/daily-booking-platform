import { useEffect, useRef, useState } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  useEffect(() => {
    // Only load script if it hasn't been loaded yet
    if (!isScriptLoaded) {
      // Remove any existing PayPal scripts first
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
        delete (window as any).paypal;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
      script.async = true;
      script.onload = () => {
        setIsScriptLoaded(true);
        setTimeout(() => {
          if (window.paypal) {
            try {
              window.paypal.HostedButtons({
                hostedButtonId: buttonId
              })
              .render(`#${containerId}`)
              .catch((error: any) => {
                console.error('PayPal button render error:', error);
                toast({
                  title: "Error",
                  description: "Failed to load PayPal button. Please try again.",
                  variant: "destructive",
                });
              });
            } catch (error) {
              console.error('PayPal initialization error:', error);
              toast({
                title: "Error",
                description: "Failed to initialize PayPal. Please refresh the page.",
                variant: "destructive",
              });
            }
          }
        }, 1000); // Give PayPal SDK time to fully initialize
      };

      document.body.appendChild(script);
    }

    return () => {
      // Cleanup on unmount
      const script = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (script) {
        script.remove();
        delete (window as any).paypal;
        setIsScriptLoaded(false);
      }
    };
  }, [buttonId, containerId, isScriptLoaded, toast]);

  return <div id={containerId} className="w-full" />;
};