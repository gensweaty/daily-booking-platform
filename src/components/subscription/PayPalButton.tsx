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
    script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.id = "paypal-script";

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load PayPal script'));
    };

    // Remove any existing PayPal script
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
  const webhookUrl = `https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/handle-paypal-webhook?plan=${planType}`;
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        await loadPayPalScript();

        if (!mounted || !containerRef.current) return;

        // Clear the container before rendering
        containerRef.current.innerHTML = '';

        if (window.paypal) {
          await window.paypal.HostedButtons({
            hostedButtonId: buttonId,
            onApprove: async (data) => {
              console.log('Payment approved:', data);
              try {
                const response = await fetch(webhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer sbp_ab3461d452b584d8e80119216b4dc1a11190d702'
                  },
                  body: JSON.stringify({
                    resource: {
                      id: data.orderID,
                      payer: {
                        email_address: (await supabase.auth.getUser()).data.user?.email
                      }
                    }
                  })
                });

                if (!response.ok) {
                  throw new Error('Failed to process subscription');
                }

                if (onSuccess) {
                  onSuccess(data.orderID);
                }

                toast({
                  title: "Success",
                  description: "Your subscription has been activated!",
                  duration: 5000,
                });

                window.location.reload();
              } catch (error) {
                console.error('Error activating subscription:', error);
                toast({
                  title: "Error",
                  description: "Failed to activate subscription. Please contact support.",
                  variant: "destructive",
                });
              }
            }
          }).render(`#${containerId}`);
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
      // Clean up the container when unmounting
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [buttonId, containerId, toast, webhookUrl, onSuccess, planType]);

  return <div id={containerId} ref={containerRef} className="w-full" />;
};