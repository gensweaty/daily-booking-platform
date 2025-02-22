
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import '../types/paypal.d.ts';

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const scriptLoadAttempts = useRef(0);

  const loadPayPalScript = async (): Promise<boolean> => {
    console.log("Starting loadPayPalScript...");
    console.log("PayPal Client ID:", import.meta.env.VITE_PAYPAL_CLIENT_ID);
    console.log("Current PayPal object:", window.paypal);
    
    return new Promise((resolve) => {
      try {
        // Remove any existing PayPal script
        const existingScript = document.getElementById('paypal-script');
        if (existingScript) {
          console.log("Removing existing PayPal script");
          existingScript.remove();
        }

        // Create and append new script
        const script = document.createElement('script');
        script.id = 'paypal-script';
        const scriptUrl = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
        script.src = scriptUrl;
        console.log("PayPal script URL:", scriptUrl);
        
        script.async = true;

        let hasResolved = false;

        const resolveOnce = (value: boolean) => {
          if (!hasResolved) {
            hasResolved = true;
            resolve(value);
          }
        };

        script.onload = () => {
          console.log("PayPal script onload event fired");
          console.log("PayPal object after load:", window.paypal);
          
          // Give a small delay to ensure PayPal SDK is fully initialized
          setTimeout(() => {
            if (window.paypal) {
              console.log("PayPal SDK loaded successfully");
              resolveOnce(true);
            } else {
              console.error("PayPal script loaded but window.paypal is undefined");
              resolveOnce(false);
            }
          }, 100);
        };

        script.onerror = (error) => {
          console.error("PayPal script load error:", error);
          resolveOnce(false);
        };

        // Set timeout to prevent hanging
        setTimeout(() => {
          if (!window.paypal) {
            console.error("PayPal script load timeout");
            resolveOnce(false);
          }
        }, 5000);

        // Append script to head
        document.head.appendChild(script);
        console.log("PayPal script appended to head");

      } catch (error) {
        console.error("Error in loadPayPalScript:", error);
        resolve(false);
      }
    });
  };

  const renderPayPalButtons = async (): Promise<boolean> => {
    console.log("Starting renderPayPalButtons...");
    console.log("PayPal object status:", !!window.paypal);
    console.log("Button container status:", !!paypalButtonRef.current);

    try {
      if (!window.paypal) {
        console.error("PayPal SDK not available");
        return false;
      }

      if (!paypalButtonRef.current) {
        console.error("Button container not found");
        return false;
      }

      // Clear existing content
      paypalButtonRef.current.innerHTML = '';

      console.log("Creating PayPal buttons configuration");
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        createOrder: async () => {
          console.log("Creating PayPal order");
          const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session found');
          }

          const response = await fetch(
            'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/create-paypal-order',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                plan_type: selectedPlan,
                amount: amount
              })
            }
          );

          if (!response.ok) {
            throw new Error('Failed to create PayPal order');
          }

          const order = await response.json();
          return order.id;
        },
        onApprove: async (data: { orderID: string }) => {
          try {
            console.log("Payment approved, processing...");
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error('No active session found');
            }

            const response = await fetch(
              'https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/verify-paypal-payment',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  order_id: data.orderID,
                  plan_type: selectedPlan
                })
              }
            );

            if (!response.ok) {
              throw new Error('Payment verification failed');
            }

            console.log("Payment verified successfully");
            toast({
              title: "Success",
              description: "Subscription activated successfully!",
            });
            
            navigate('/dashboard');
          } catch (error: any) {
            console.error('Payment verification error:', error);
            toast({
              title: "Error",
              description: "Payment verification failed. Please contact support.",
              variant: "destructive",
            });
          }
        },
        onError: (error: any) => {
          console.error('PayPal button error:', error);
          toast({
            title: "Error",
            description: "Payment failed. Please try again.",
            variant: "destructive",
          });
        }
      });

      console.log("Rendering PayPal buttons");
      await buttons.render(paypalButtonRef.current);
      console.log("PayPal buttons rendered successfully");
      return true;
    } catch (error) {
      console.error('Error in renderPayPalButtons:', error);
      return false;
    }
  };

  const initializePayPal = async () => {
    console.log("Starting PayPal initialization");
    try {
      setIsLoading(true);
      scriptLoadAttempts.current += 1;
      console.log(`Initialization attempt ${scriptLoadAttempts.current}`);

      const scriptLoaded = await loadPayPalScript();
      console.log("Script load result:", scriptLoaded);

      if (!scriptLoaded) {
        if (scriptLoadAttempts.current < 3) {
          console.log("Script load failed, retrying...");
          setTimeout(initializePayPal, 2000);
          return;
        }
        throw new Error('Failed to load PayPal script after multiple attempts');
      }

      const buttonsRendered = await renderPayPalButtons();
      console.log("Buttons render result:", buttonsRendered);
      setIsPayPalLoaded(buttonsRendered);
    } catch (error: any) {
      console.error('PayPal initialization error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load payment system. Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    console.log("TrialExpiredDialog mounted");

    const init = async () => {
      if (mounted) {
        await initializePayPal();
      }
    };

    init();

    return () => {
      console.log("TrialExpiredDialog unmounting");
      mounted = false;
      const script = document.getElementById('paypal-script');
      if (script) {
        script.remove();
      }
    };
  }, [selectedPlan]);

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-primary">
            Subscription Required
          </DialogTitle>
          <DialogDescription className="text-center">
            To continue using our services, please select a subscription plan below.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">
              Your access has expired
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <SubscriptionPlanSelect
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              isLoading={isLoading}
            />
          </div>
          <div className="pt-4">
            {!isPayPalLoaded && (
              <div className="w-full h-[45px] bg-muted animate-pulse rounded-md" />
            )}
            <div 
              id="paypal-button-container"
              ref={paypalButtonRef}
              className="min-h-[45px] w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
