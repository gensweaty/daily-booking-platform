
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
  const [isLoading, setIsLoading] = useState(true);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const scriptLoadAttempts = useRef(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadPayPalScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (scriptLoadAttempts.current >= 3) {
        reject(new Error('Failed to load PayPal after multiple attempts'));
        return;
      }

      scriptLoadAttempts.current += 1;
      console.log(`Attempting to load PayPal script (attempt ${scriptLoadAttempts.current})`);

      // Clean up any existing PayPal elements
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }

      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.VITE_PAYPAL_CLIENT_ID}&currency=USD`;
      script.async = true;

      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeout);
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };

      const handleLoad = () => {
        console.log('PayPal script loaded successfully');
        cleanup();
        resolve();
      };

      const handleError = (error: any) => {
        console.error('PayPal script loading error:', error);
        cleanup();
        script.remove();
        setTimeout(() => {
          loadPayPalScript().then(resolve).catch(reject);
        }, 2000); // Retry after 2 seconds
      };

      timeout = setTimeout(() => {
        cleanup();
        script.remove();
        handleError(new Error('PayPal script load timeout'));
      }, 10000); // 10 second timeout

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      document.head.appendChild(script);
    });
  };

  useEffect(() => {
    let isMounted = true;

    const renderPayPalButton = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        console.log('Current user:', user?.id);
        
        if (!user) {
          throw new Error('No authenticated user found');
        }

        await loadPayPalScript();
        
        if (!isMounted) return;
        
        if (!window.paypal) {
          throw new Error('PayPal SDK not loaded');
        }

        const buttons = window.paypal.Buttons({
          createOrder: async () => {
            const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';
            
            try {
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
            } catch (error: any) {
              console.error('Error creating order:', error);
              toast({
                title: "Error",
                description: "Failed to create order. Please try again.",
                variant: "destructive",
              });
              throw error;
            }
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

        if (paypalButtonRef.current && isMounted) {
          await buttons.render(paypalButtonRef.current);
          setIsPayPalLoaded(true);
        }

      } catch (error: any) {
        console.error('PayPal setup error:', error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load payment system. Please refresh and try again.",
            variant: "destructive",
          });
          setIsPayPalLoaded(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    renderPayPalButton();

    return () => {
      isMounted = false;
      const script = document.getElementById('paypal-script');
      if (script) {
        script.remove();
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
