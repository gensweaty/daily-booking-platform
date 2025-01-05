import { useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

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

export const usePayPalInitialization = (
  buttonId: string,
  containerId: string,
  onSuccess: (orderId: string) => void,
  isSubscribed: boolean,
  onError?: (error: any) => void,
  onLoad?: () => void
) => {
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      if (isSubscribed) return;

      try {
        await loadPayPalScript();

        if (!mounted) return;

        if (window.paypal) {
          try {
            await window.paypal.HostedButtons({
              hostedButtonId: buttonId,
              onApprove: (data) => {
                console.log('Payment approved:', data);
                onSuccess(data.orderID);
              },
            }).render(`#${containerId}`);
            
            if (onLoad) {
              onLoad();
            }
          } catch (error) {
            console.error('PayPal button render error:', error);
            if (onError) {
              onError(error);
            }
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
          if (onError) {
            onError(error);
          }
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
  }, [buttonId, containerId, toast, isSubscribed, onSuccess, onError, onLoad]);
};