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
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q'}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.id = "paypal-script";

    script.onload = () => {
      console.log('PayPal script loaded successfully');
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load PayPal script:', error);
      scriptLoadPromise = null;
      reject(new Error('Failed to load PayPal script'));
    };

    const existingScript = document.getElementById('paypal-script');
    if (existingScript) {
      existingScript.remove();
    }

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();

        if (!mounted || !containerRef.current) return;

        containerRef.current.innerHTML = '';

        if (window.paypal) {
          console.log('Initializing PayPal button with ID:', buttonId);
          
          await window.paypal.HostedButtons({
            hostedButtonId: buttonId,
            onApprove: async (data, actions) => {
              console.log('Payment approved:', data);
              
              try {
                const user = (await supabase.auth.getUser()).data.user;
                if (!user?.email) {
                  throw new Error('User email not found');
                }

                console.log('Processing payment for user:', user.email);
                
                const response = await supabase.functions.invoke('handle-paypal-webhook', {
                  body: {
                    resource: {
                      id: data.orderID,
                      payer: {
                        email_address: user.email
                      }
                    },
                    plan_type: planType
                  }
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
          
          console.log('PayPal button rendered successfully');
        }
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
    };
  }, [buttonId, containerId, toast, onSuccess, planType]);

  return <div id={containerId} ref={containerRef} className="w-full" />;
};