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
  const loadingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadPayPalScript = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      try {
        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());
        scriptLoadedRef.current = false;

        // Clear the container
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-gray-500">Loading payment options...</p></div>';
        }

        // Create and load new script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&components=hosted-buttons&vault=true&intent=subscription`;
        script.async = true;

        const renderButton = () => {
          const container = document.getElementById(containerId);
          if (!window.paypal || !container || !mountedRef.current) return;

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
            
            scriptLoadedRef.current = true;
          } catch (renderError) {
            console.error('PayPal button render error:', renderError);
            if (mountedRef.current) {
              container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-red-500">Failed to load payment button. Please refresh the page.</p></div>';
            }
          }
        };

        script.onload = () => {
          if (!mountedRef.current) return;
          renderButton();
        };

        script.onerror = () => {
          console.error('PayPal script loading error');
          if (mountedRef.current) {
            const container = document.getElementById(containerId);
            if (container) {
              container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-red-500">Failed to load payment system. Please refresh the page.</p></div>';
            }
          }
        };

        document.body.appendChild(script);
      } catch (error) {
        console.error('Error initializing PayPal:', error);
        const container = document.getElementById(containerId);
        if (container && mountedRef.current) {
          container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-red-500">Failed to initialize payment system. Please refresh the page.</p></div>';
        }
      } finally {
        loadingRef.current = false;
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
    };
  }, [buttonId, containerId, toast, onSuccess, planType, user]);

  return (
    <div 
      id={containerId} 
      className="w-full bg-white rounded-md shadow-sm p-4"
      style={{ minHeight: '150px' }}
    />
  );
};