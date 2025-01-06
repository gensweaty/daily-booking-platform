import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

let scriptLoadPromise: Promise<void> | null = null;

const loadPayPalScript = () => {
  if (scriptLoadPromise) {
    console.log('Using existing PayPal script promise');
    return scriptLoadPromise;
  }

  // Remove any existing PayPal script first
  const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
  if (existingScript) {
    console.log('Removing existing PayPal script');
    existingScript.remove();
    scriptLoadPromise = null;
  }

  console.log('Loading PayPal script...');
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q'}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.id = "paypal-script";

    script.onload = () => {
      console.log('PayPal script loaded successfully');
      console.log('PayPal object available:', !!window.paypal);
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load PayPal script:', error);
      scriptLoadPromise = null;
      reject(new Error('Failed to load PayPal script'));
    };

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  
  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        if (isInitializedRef.current) {
          console.log('PayPal button already initialized');
          return;
        }

        console.log('Starting PayPal initialization...');
        await loadPayPalScript();

        if (!mounted || !containerRef.current) {
          console.log('Component unmounted or container not found, aborting initialization');
          return;
        }

        containerRef.current.innerHTML = '';

        if (!window.paypal) {
          throw new Error('PayPal SDK not loaded properly');
        }

        console.log('Initializing PayPal button with ID:', buttonId);
        console.log('Container ID:', containerId);
        
        await window.paypal.HostedButtons({
          hostedButtonId: buttonId,
          onApprove: async (data: { orderID: string }) => {
            console.log('Payment approved:', data);
            
            try {
              const user = (await supabase.auth.getUser()).data.user;
              if (!user?.email) {
                throw new Error('User email not found');
              }

              console.log('Processing payment for user:', user.email);
              
              const webhookPayload = {
                resource: {
                  id: data.orderID,
                  payer: {
                    email_address: user.email
                  }
                },
                plan_type: planType
              };
              
              console.log('Sending webhook payload:', webhookPayload);
              
              const response = await supabase.functions.invoke('handle-paypal-webhook', {
                body: webhookPayload
              });

              console.log('Webhook response:', response);

              if (response.error) {
                throw new Error(response.error.message || 'Failed to process subscription');
              }

              if (onSuccess) {
                onSuccess(data.orderID);
              }

              toast({
                title: "Success",
                description: "Your subscription has been activated!",
                duration: 5000,
              });

              // Force reload to update subscription status
              window.location.reload();
            } catch (error: any) {
              console.error('Error activating subscription:', error);
              toast({
                title: "Error",
                description: "Failed to activate subscription. Please contact support.",
                variant: "destructive",
                duration: 8000,
              });
            }
          }
        }).render(`#${containerId}`);
        
        isInitializedRef.current = true;
        console.log('PayPal button rendered successfully');
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please refresh the page.",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      isInitializedRef.current = false;
    };
  }, [buttonId, containerId, toast, onSuccess, planType]);

  return <div id={containerId} ref={containerRef} className="w-full" />;
};