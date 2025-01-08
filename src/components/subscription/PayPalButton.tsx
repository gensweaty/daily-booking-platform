import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const scriptLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadPayPalScript = async () => {
      try {
        // Clean up any existing PayPal script
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          existingScript.remove();
        }

        // Clean up the container
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }

        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&components=hosted-buttons&vault=true&intent=subscription`;
        script.async = true;

        script.onload = () => {
          if (!mountedRef.current) return;
          
          if (window.paypal && container) {
            try {
              window.paypal.HostedButtons({
                hostedButtonId: buttonId,
                onApprove: async (data: { orderID: string }) => {
                  console.log('Payment approved:', data);
                  try {
                    if (!user?.email) {
                      throw new Error('User email not found');
                    }

                    const { data: subscriptionData, error: functionError } = await supabase.functions.invoke(
                      'handle-paypal-webhook',
                      {
                        body: {
                          resource: {
                            id: data.orderID,
                            payer: { email_address: user.email }
                          },
                          plan_type: planType,
                          user_id: user.id,
                          return_url: `${window.location.origin}/dashboard?subscription=${planType}&user=${user.id}&order=${data.orderID}`
                        }
                      }
                    );

                    if (functionError) {
                      throw functionError;
                    }

                    console.log('Subscription updated:', subscriptionData);
                    
                    toast({
                      title: "Success",
                      description: "Your subscription has been activated!",
                    });

                    if (onSuccess) {
                      onSuccess(data.orderID);
                    }

                    window.location.reload();
                  } catch (error: any) {
                    console.error('Error processing payment:', error);
                    toast({
                      title: "Error",
                      description: "Failed to process payment. Please try again.",
                      variant: "destructive",
                    });
                  }
                }
              }).render(`#${containerId}`);
            } catch (renderError) {
              console.error('PayPal button render error:', renderError);
              if (mountedRef.current) {
                toast({
                  title: "Error",
                  description: "Failed to display payment button. Please refresh the page.",
                  variant: "destructive",
                });
              }
            }
          }
        };

        script.onerror = (error) => {
          console.error('PayPal script loading error:', error);
          if (mountedRef.current) {
            toast({
              title: "Error",
              description: "Failed to load payment system. Please refresh the page.",
              variant: "destructive",
            });
          }
        };

        document.body.appendChild(script);
        scriptLoadedRef.current = true;
      } catch (error) {
        console.error('Error initializing PayPal:', error);
        if (mountedRef.current) {
          toast({
            title: "Error",
            description: "Failed to initialize payment system. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    if (!scriptLoadedRef.current) {
      loadPayPalScript();
    }

    return () => {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
      mountedRef.current = false;
    };
  }, [buttonId, containerId, toast, onSuccess, planType, user]);

  return (
    <div 
      id={containerId} 
      className="w-full min-h-[50px] bg-white rounded-md shadow-sm p-2"
    />
  );
};