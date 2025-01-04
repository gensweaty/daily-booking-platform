import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

// Global state to track script loading
let isScriptLoading = false;
let scriptLoadPromise: Promise<void> | null = null;

const loadPayPalScript = () => {
  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  if (isScriptLoading) {
    return new Promise<void>((resolve) => {
      const checkScript = () => {
        if (window.paypal) {
          resolve();
        } else {
          setTimeout(checkScript, 100);
        }
      };
      checkScript();
    });
  }

  isScriptLoading = true;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    // Clean up any existing PayPal scripts and globals
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      existingScript.remove();
      delete (window as any).paypal;
    }

    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;

    script.onload = () => {
      isScriptLoading = false;
      resolve();
    };

    script.onerror = () => {
      isScriptLoading = false;
      scriptLoadPromise = null;
      reject(new Error('Failed to load PayPal script'));
    };

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();

        if (!mounted) return;

        if (window.paypal) {
          try {
            await window.paypal.HostedButtons({
              hostedButtonId: buttonId
            }).render(`#${containerId}`);
          } catch (error) {
            console.error('PayPal button render error:', error);
            toast({
              title: "Error",
              description: "Failed to load PayPal button. Please try again.",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
    };
  }, [buttonId, containerId, toast]);

  return <div id={containerId} className="w-full" />;
};