
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

  const loadPayPalScript = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      console.log('Starting PayPal script load...');
      
      // Clean up any existing PayPal script
      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
      }

      // Create and load the PayPal script
      console.log('Creating new PayPal script');
      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
      script.async = true;

      let timeout: NodeJS.Timeout;

      const checkPayPal = () => {
        console.log('Checking if PayPal is loaded...');
        if (window.paypal) {
          console.log('PayPal SDK loaded successfully');
          clearTimeout(timeout);
          resolve(true);
        } else {
          console.log('PayPal not loaded yet, retrying...');
          timeout = setTimeout(checkPayPal, 100);
        }
      };

      script.onload = () => {
        console.log('Script onload triggered');
        checkPayPal();
      };

      script.onerror = () => {
        console.error('PayPal script failed to load');
        clearTimeout(timeout);
        resolve(false);
      };

      document.head.appendChild(script);

      // Set a maximum timeout of 10 seconds
      setTimeout(() => {
        clearTimeout(timeout);
        if (!window.paypal) {
          console.error('PayPal load timeout after 10 seconds');
          resolve(false);
        }
      }, 10000);
    });
  };

  const renderPayPalButtons = async () => {
    console.log('Attempting to render PayPal buttons...');
    
    if (!window.paypal) {
      console.error('PayPal SDK not found, cannot render buttons');
      return false;
    }

    if (!paypalButtonRef.current) {
      console.error('PayPal button container not found');
      return false;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      console.log('Clearing existing buttons...');
      paypalButtonRef.current.innerHTML = '';

      console.log('Creating PayPal buttons configuration...');
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        createOrder: async () => {
          console.log('Creating PayPal order...');
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
            const errorText = await response.text();
            console.error('Create order response:', errorText);
            throw new Error('Failed to create PayPal order');
          }

          const order = await response.json();
          console.log('Order created successfully:', order.id);
          return order.id;
        },
        onApprove: async (data: { orderID: string }) => {
          console.log('Payment approved, processing...', data.orderID);
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

            const result = await response.json();
            if (!response.ok) {
              throw new Error(result.error || `Verification failed with status ${response.status}`);
            }

            console.log('Payment verified successfully');
            toast({
              title: "Success",
              description: "Subscription activated successfully!",
            });
            
            navigate('/dashboard');
          } catch (error: any) {
            console.error('Payment verification error:', error);
            toast({
              title: "Error",
              description: `Payment verification failed: ${error.message}. Please contact support.`,
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

      console.log('Rendering PayPal buttons...');
      await buttons.render(paypalButtonRef.current);
      console.log('PayPal buttons rendered successfully');
      return true;
    } catch (error: any) {
      console.error('Error rendering PayPal buttons:', error);
      toast({
        title: "Error",
        description: "Failed to initialize payment system. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        setIsLoading(true);
        console.log('Starting PayPal initialization...');

        const scriptLoaded = await loadPayPalScript();
        if (!scriptLoaded || !mounted) {
          console.error('Failed to load PayPal script');
          return;
        }

        console.log('Script loaded, attempting to render buttons...');
        const buttonsRendered = await renderPayPalButtons();
        if (mounted) {
          setIsPayPalLoaded(buttonsRendered);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          setIsLoading(false);
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh and try again.",
            variant: "destructive",
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
      const script = document.getElementById('paypal-script');
      if (script) {
        script.remove();
      }
    };
  }, [selectedPlan, toast, navigate]);

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
