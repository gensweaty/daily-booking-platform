
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
  const [scriptError, setScriptError] = useState<string | null>(null);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const scriptLoadAttempts = useRef(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadPayPalScript = () => {
    return new Promise<boolean>((resolve) => {
      try {
        if (scriptLoadAttempts.current >= 3) {
          console.error('Max script load attempts reached');
          resolve(false);
          return;
        }

        scriptLoadAttempts.current += 1;
        console.log('Attempting to load PayPal script, attempt:', scriptLoadAttempts.current);

        // Remove only our specific script
        const existingScript = document.getElementById('paypal-sdk');
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.id = 'paypal-sdk';
        script.src = 'https://www.paypal.com/sdk/js?client-id=AYmN8pJKiP646o4xp6KaMyEa3_TPIGL4KqYc_dPLD4JXulCW6-tJKn-4QAYPv98m1JPj57Yvf1mV8lP_&currency=USD';
        script.async = true;

        let timeoutId: number;

        const cleanup = () => {
          if (timeoutId) {
            window.clearTimeout(timeoutId);
          }
        };

        script.onload = () => {
          console.log('PayPal script loaded successfully');
          cleanup();
          resolve(true);
        };

        script.onerror = (error) => {
          console.error('PayPal script failed to load:', error);
          cleanup();
          resolve(false);
        };

        timeoutId = window.setTimeout(() => {
          console.error('PayPal script load timed out');
          resolve(false);
        }, 10000);

        document.head.appendChild(script);
      } catch (error) {
        console.error('Error in loadPayPalScript:', error);
        resolve(false);
      }
    });
  };

  const initializePayPal = async () => {
    setIsLoading(true);
    setScriptError(null);

    try {
      console.log('Starting PayPal initialization');

      if (!paypalButtonRef.current) {
        throw new Error('Button container not found');
      }

      // Clean container
      paypalButtonRef.current.innerHTML = '';

      // Load script
      const scriptLoaded = await loadPayPalScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load PayPal SDK');
      }

      // Verify PayPal object exists
      if (!window.paypal?.Buttons) {
        throw new Error('PayPal SDK not initialized properly');
      }

      console.log('Creating PayPal buttons');
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'gold',
          shape: 'rect',
          label: 'paypal'
        },
        createOrder: async () => {
          console.log('Creating PayPal order');
          const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';
          
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session found');
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('No authenticated user found');
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
                amount: amount,
                user_id: user.id
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
            console.log('Processing PayPal approval');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error('No active session found');
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              throw new Error('No authenticated user found');
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
                  plan_type: selectedPlan,
                  user_id: user.id
                })
              }
            );

            if (!response.ok) {
              throw new Error('Payment verification failed');
            }

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

      console.log('Rendering PayPal buttons');
      await buttons.render(paypalButtonRef.current);
      console.log('PayPal buttons rendered successfully');
      setIsPayPalLoaded(true);
    } catch (error: any) {
      console.error('PayPal initialization error:', error);
      setScriptError(error.message);
      toast({
        title: "Error",
        description: error.message || "Failed to load payment system",
        variant: "destructive",
      });
      setIsPayPalLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const cleanup = () => {
      // Only remove our specific script
      const script = document.getElementById('paypal-sdk');
      if (script) {
        script.remove();
      }
      if (window.paypal) {
        delete (window as any).paypal;
      }
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
    };

    cleanup();
    scriptLoadAttempts.current = 0;
    initializePayPal();

    return cleanup;
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
            {!isPayPalLoaded && !scriptError && (
              <div className="w-full h-[45px] bg-muted animate-pulse rounded-md" />
            )}
            {scriptError && (
              <div className="text-center text-destructive">
                {scriptError}
              </div>
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
