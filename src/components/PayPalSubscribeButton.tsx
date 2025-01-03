import { useEffect, useState, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    paypal: any;
  }
}

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const { toast } = useToast();
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptError, setIsScriptError] = useState(false);
  const mountedRef = useRef(true);
  
  const buttonContainerId = planType === 'monthly' 
    ? 'paypal-button-container-P-3PD505110Y2402710M53L6AA'
    : 'paypal-button-container-P-8RY93575NH0589519M53L6YA';
  
  const planId = planType === 'monthly'
    ? 'P-3PD505110Y2402710M53L6AA'
    : 'P-8RY93575NH0589519M53L6YA';

  useEffect(() => {
    // Cleanup function to set mounted state
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;
    let initTimeout: NodeJS.Timeout;

    const loadPayPalScript = () => {
      // Remove any existing PayPal scripts
      const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Clear the container
      const container = document.getElementById(buttonContainerId);
      if (container) {
        container.innerHTML = '';
      }

      // Create new script element
      scriptElement = document.createElement('script');
      scriptElement.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
      scriptElement.async = true;
      
      scriptElement.onload = () => {
        if (!mountedRef.current) return;
        
        // Set a timeout to wait for PayPal object initialization
        initTimeout = setTimeout(() => {
          if (window.paypal) {
            setIsScriptLoaded(true);
            initializePayPalButtons();
          } else {
            setIsScriptError(true);
            toast({
              title: "Error",
              description: "Failed to initialize payment system. Please refresh the page.",
              variant: "destructive",
            });
          }
        }, 1000);
      };

      scriptElement.onerror = () => {
        if (!mountedRef.current) return;
        setIsScriptError(true);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please try again.",
          variant: "destructive",
        });
      };

      document.body.appendChild(scriptElement);
    };

    const initializePayPalButtons = () => {
      if (!window.paypal || !mountedRef.current) return;

      try {
        const container = document.getElementById(buttonContainerId);
        if (container) {
          container.innerHTML = '';
        }

        window.paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'blue',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: (data: any, actions: any) => {
            return actions.subscription.create({
              plan_id: planId
            });
          },
          onApprove: async (data: any) => {
            if (!mountedRef.current) return;

            try {
              const currentDate = new Date();
              const nextChargeDate = new Date(currentDate);
              
              if (planType === 'monthly') {
                nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
              } else {
                nextChargeDate.setFullYear(nextChargeDate.getFullYear() + 1);
              }

              const { error } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  current_period_start: currentDate.toISOString(),
                  current_period_end: nextChargeDate.toISOString(),
                  plan_type: planType
                })
                .eq('status', 'expired');

              if (error) throw error;

              toast({
                title: "Subscription Activated",
                description: "Thank you for subscribing! Your account has been activated.",
              });

              if (onSuccess) {
                onSuccess(data.subscriptionID);
              }
            } catch (error) {
              console.error('Error updating subscription:', error);
              toast({
                title: "Error",
                description: "There was an error activating your subscription. Please contact support.",
                variant: "destructive",
              });
            }
          },
          onError: (err: any) => {
            console.error('PayPal button error:', err);
            if (mountedRef.current) {
              toast({
                title: "Error",
                description: "There was an error processing your payment. Please try again.",
                variant: "destructive",
              });
            }
          }
        }).render(`#${buttonContainerId}`);
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mountedRef.current) {
          toast({
            title: "Error",
            description: "Failed to initialize payment system. Please refresh the page.",
            variant: "destructive",
          });
        }
      }
    };

    // Start loading the script
    loadPayPalScript();

    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (scriptElement && document.body.contains(scriptElement)) {
        scriptElement.remove();
      }
      clearTimeout(initTimeout);
      const container = document.getElementById(buttonContainerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [buttonContainerId, planId, planType, onSuccess, toast]);

  if (isScriptError) {
    return (
      <div className="text-center p-4 text-red-500">
        Failed to load payment system. Please refresh the page or try again later.
      </div>
    );
  }

  return <div id={buttonContainerId} className="min-h-[150px]" />;
};