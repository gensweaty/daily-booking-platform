
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
    return new Promise((resolve) => {
      try {
        // Clean up any existing PayPal script
        const existingScript = document.getElementById('paypal-script');
        if (existingScript) {
          existingScript.remove();
        }

        // Reset PayPal global object
        if (window.paypal) {
          (window as any).paypal = undefined;
        }

        const script = document.createElement('script');
        script.id = 'paypal-script';
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
        script.async = true;

        script.addEventListener('load', () => {
          if (window.paypal) {
            console.log('PayPal script loaded successfully');
            resolve(true);
          } else {
            console.error('PayPal script loaded but window.paypal is not defined');
            resolve(false);
          }
        });

        script.addEventListener('error', (error) => {
          console.error('Error loading PayPal script:', error);
          resolve(false);
        });

        document.head.appendChild(script);

        // Set a timeout for script loading
        setTimeout(() => {
          if (!window.paypal) {
            console.error('PayPal script load timeout');
            resolve(false);
          }
        }, 5000);
      } catch (error) {
        console.error('Error in loadPayPalScript:', error);
        resolve(false);
      }
    });
  };

  const renderPayPalButtons = async (): Promise<boolean> => {
    try {
      if (!window.paypal) {
        console.error('PayPal SDK not loaded');
        return false;
      }

      if (!paypalButtonRef.current) {
        console.error('Button container not found');
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return false;
      }

      // Clear existing buttons
      paypalButtonRef.current.innerHTML = '';

      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        createOrder: async () => {
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
                  user_id: user.id,
                  plan_type: selectedPlan,
                  order_id: data.orderID
                })
              }
            );

            if (!response.ok) {
              throw new Error('Payment verification failed');
            }

            const result = await response.json();
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
          console.error('PayPal error:', error);
          toast({
            title: "Error",
            description: "Payment failed. Please try again.",
            variant: "destructive",
          });
        }
      });

      await buttons.render(paypalButtonRef.current);
      return true;
    } catch (error) {
      console.error('Error rendering PayPal buttons:', error);
      return false;
    }
  };

  const initializePayPal = async () => {
    try {
      setIsLoading(true);
      scriptLoadAttempts.current += 1;
      console.log(`Attempting to load PayPal script (attempt ${scriptLoadAttempts.current})`);

      const scriptLoaded = await loadPayPalScript();
      if (!scriptLoaded) {
        if (scriptLoadAttempts.current < 3) {
          console.log('Retrying PayPal script load...');
          setTimeout(initializePayPal, 1000); // Retry after 1 second
          return;
        }
        throw new Error('Failed to load PayPal script after multiple attempts');
      }

      const buttonsRendered = await renderPayPalButtons();
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

    if (mounted) {
      initializePayPal();
    }

    return () => {
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
