
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
  const clientId = 'AYmN8pJKiP646o4xp6KaMyEa3_TPIGL4KqYc_dPLD4JXulCW6-tJKn-4QAYPv98m1JPj57Yvf1mV8lP_';

  const loadPayPalScript = () => {
    return new Promise<boolean>((resolve) => {
      // Clean up any existing PayPal scripts
      const existingScripts = document.querySelectorAll('script[src*="paypal"]');
      existingScripts.forEach(script => script.remove());
      
      // Reset PayPal global object
      if (window.paypal) {
        delete (window as any).paypal;
      }

      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
      script.async = true;
      
      let resolved = false;
      
      const handleLoad = () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      const handleError = () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      // Add timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 5000);

      document.head.appendChild(script);
    });
  };

  const initializePayPal = async () => {
    setIsLoading(true);
    try {
      // Clean up any existing buttons
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }

      const scriptLoaded = await loadPayPalScript();
      if (!scriptLoaded || !window.paypal) {
        throw new Error('Failed to load PayPal SDK');
      }

      if (!paypalButtonRef.current) {
        throw new Error('Button container not found');
      }

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
            toast({
              title: "Error",
              description: "Payment verification failed. Please contact support.",
              variant: "destructive",
            });
          }
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: "Payment failed. Please try again.",
            variant: "destructive",
          });
        }
      });

      await buttons.render(paypalButtonRef.current);
      setIsPayPalLoaded(true);
    } catch (error: any) {
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
      const scripts = document.querySelectorAll('script[src*="paypal"]');
      scripts.forEach(script => script.remove());
      if (window.paypal) {
        delete (window as any).paypal;
      }
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
    };

    cleanup();
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
