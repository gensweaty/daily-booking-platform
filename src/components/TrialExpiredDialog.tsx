
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

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;

    const loadPayPalScript = () => {
      return new Promise<void>((resolve, reject) => {
        // Remove any existing PayPal buttons
        if (paypalButtonRef.current) {
          paypalButtonRef.current.innerHTML = '';
        }

        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());

        // Create new script
        scriptElement = document.createElement('script');
        scriptElement.src = `https://www.paypal.com/sdk/js?client-id=${process.env.VITE_PAYPAL_CLIENT_ID}&currency=USD`;
        scriptElement.async = true;

        scriptElement.onload = () => {
          console.log('PayPal script loaded successfully');
          resolve();
        };

        scriptElement.onerror = (error) => {
          console.error('PayPal script loading error:', error);
          reject(error);
        };

        document.head.appendChild(scriptElement);
      });
    };

    const renderPayPalButton = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.id);
        
        if (!user) {
          throw new Error('No authenticated user found');
        }

        await loadPayPalScript();
        
        if (!window.paypal) {
          throw new Error('PayPal SDK not loaded');
        }

        const buttons = window.paypal.Buttons({
          createOrder: async () => {
            const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';
            
            const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${btoa(`${process.env.VITE_PAYPAL_CLIENT_ID}:${process.env.VITE_PAYPAL_SECRET_KEY}`)}`,
              },
              body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                  amount: {
                    currency_code: 'USD',
                    value: amount
                  }
                }]
              })
            });

            const order = await response.json();
            return order.id;
          },
          onApprove: async (data: { orderID: string }) => {
            console.log('PayPal payment approved. Order ID:', data.orderID);
            
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
          }
        });

        if (paypalButtonRef.current) {
          await buttons.render(paypalButtonRef.current);
          setIsPayPalLoaded(true);
        }

      } catch (error: any) {
        console.error('PayPal setup error:', error);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please refresh and try again.",
          variant: "destructive",
        });
        setIsPayPalLoaded(false);
      }
    };

    renderPayPalButton();

    // Cleanup function
    return () => {
      if (scriptElement) {
        scriptElement.remove();
      }
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
      setIsPayPalLoaded(false);
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
              isLoading={false}
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
