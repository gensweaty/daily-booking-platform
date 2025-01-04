import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  useEffect(() => {
    // Remove any existing PayPal scripts
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;
    script.crossOrigin = "anonymous";
    scriptRef.current = script;

    const renderButton = () => {
      if (window.paypal) {
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
      }
    };

    script.onload = renderButton;

    document.body.appendChild(script);

    return () => {
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
      }
      // Clean up any PayPal-related global variables
      delete (window as any).paypal;
    };
  }, [buttonId, containerId, toast]);

  return <div id={containerId} className="w-full" />;
};