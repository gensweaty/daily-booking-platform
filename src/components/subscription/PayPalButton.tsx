import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

const SCRIPT_ID = 'paypal-script';
const BUTTON_CONTAINER_CLASS = 'paypal-button-container';

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);
  const scriptLoadPromiseRef = useRef<Promise<void> | null>(null);
  
  const loadPayPalScript = () => {
    if (scriptLoadPromiseRef.current) {
      console.log('Using existing PayPal script promise');
      return scriptLoadPromiseRef.current;
    }

    // Remove any existing PayPal script and container content
    const cleanup = () => {
      const existingScript = document.getElementById(SCRIPT_ID);
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
      }

      // Clear all existing PayPal button containers
      document.querySelectorAll(`.${BUTTON_CONTAINER_CLASS}`).forEach(container => {
        container.innerHTML = '';
      });

      scriptLoadPromiseRef.current = null;
      isInitializedRef.current = false;
    };

    cleanup();

    console.log('Loading PayPal script...');
    scriptLoadPromiseRef.current = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID || 'BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q'}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.id = SCRIPT_ID;

      script.onload = () => {
        console.log('PayPal script loaded successfully');
        resolve();
      };

      script.onerror = (error) => {
        console.error('Failed to load PayPal script:', error);
        cleanup();
        reject(new Error('Failed to load PayPal script'));
      };

      document.body.appendChild(script);
    });

    return scriptLoadPromiseRef.current;
  };

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        if (!containerRef.current || isInitializedRef.current) {
          return;
        }

        console.log('Starting PayPal initialization...');
        await loadPayPalScript();

        if (!mounted || !containerRef.current) {
          console.log('Component unmounted or container not found, aborting initialization');
          return;
        }

        // Clear the container and add the class
        containerRef.current.innerHTML = '';
        containerRef.current.className = `w-full ${BUTTON_CONTAINER_CLASS}`;

        if (!window.paypal) {
          throw new Error('PayPal SDK not loaded properly');
        }

        console.log('Initializing PayPal button with ID:', buttonId);
        
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
              
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  current_period_start: new Date().toISOString(),
                  current_period_end: new Date(
                    new Date().setMonth(
                      new Date().getMonth() + (planType === 'monthly' ? 1 : 12)
                    )
                  ).toISOString(),
                  last_payment_id: data.orderID
                })
                .eq('user_id', user.id)
                .eq('status', 'expired');

              if (updateError) {
                throw new Error(updateError.message);
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