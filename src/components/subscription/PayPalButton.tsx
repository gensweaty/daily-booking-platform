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
        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());

        // Clear the container and show loading state
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-gray-500">Loading payment options...</p></div>';
        }

        // Create and load new script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&components=hosted-buttons&vault=true&intent=subscription`;
        script.async = true;

        const loadPromise = new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load PayPal script'));
        });

        document.body.appendChild(script);
        await loadPromise;

        if (!mountedRef.current) return;

        // Render the button after script loads
        const renderButton = () => {
          if (!window.paypal || !mountedRef.current) return;

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
            const container = document.getElementById(containerId);
            if (container && mountedRef.current) {
              container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-red-500">Failed to load payment button. Please try refreshing the page.</p></div>';
            }
          }
        };

        renderButton();
        scriptLoadedRef.current = true;
      } catch (error) {
        console.error('Error loading PayPal:', error);
        const container = document.getElementById(containerId);
        if (container && mountedRef.current) {
          container.innerHTML = '<div class="flex items-center justify-center h-[150px]"><p class="text-red-500">Failed to load payment system. Please try refreshing the page.</p></div>';
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