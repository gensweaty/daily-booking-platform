
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadPayPalScript = async () => {
      try {
        console.log('Starting PayPal script load...');
        setIsLoading(true);
        
        // Clean up any existing PayPal buttons
        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
        }

        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());

        // Create and load new PayPal script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
        script.crossOrigin = "anonymous";
        script.async = true;

        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });

        console.log('PayPal script loaded, waiting for initialization...');

        // Wait for PayPal to be available
        await new Promise<void>((resolve) => {
          const checkPayPal = () => {
            // @ts-ignore
            if (window.paypal?.HostedButtons) {
              resolve();
            } else {
              setTimeout(checkPayPal, 100);
            }
          };
          checkPayPal();
        });

        if (!mounted) return;

        console.log('PayPal initialized, rendering button...');

        // @ts-ignore
        await window.paypal.HostedButtons({
          hostedButtonId: planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'
        }).render(`#${containerId}`);

        console.log('PayPal button rendered successfully');
        setIsLoading(false);

      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh the page and try again.",
            variant: "destructive",
          });
        }
      }
    };

    if (user) {
      loadPayPalScript();
    }

    return () => {
      mounted = false;
      const scripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      scripts.forEach(script => script.remove());
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
    };
  }, [user, planType, containerId, toast]);

  return (
    <>
      <div id={containerId} ref={buttonRef} className="min-h-[45px] w-full" />
      {isLoading && (
        <div className="w-full h-[45px] bg-muted animate-pulse rounded-md" />
      )}
    </>
  );
};
