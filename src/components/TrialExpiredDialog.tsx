
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

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: `Successfully subscribed with ID: ${subscriptionId}`,
    });
    navigate("/dashboard");
  };

  useEffect(() => {
    const loadAndRenderPayPalButton = async () => {
      try {
        // Clear any existing PayPal elements
        if (paypalButtonRef.current) {
          paypalButtonRef.current.innerHTML = '';
        }

        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());

        // Create and load PayPal script
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
        script.crossOrigin = "anonymous";
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = (error) => {
            console.error('PayPal script loading error:', error);
            reject(error);
          };
          document.body.appendChild(script);
        });

        // Add error event listener to window
        window.addEventListener('error', (event) => {
          console.error('Global error caught:', event);
        });

        // Wait for PayPal to be ready
        await new Promise<void>((resolve, reject) => {
          const maxAttempts = 50; // 5 seconds maximum wait
          let attempts = 0;

          const checkPayPal = () => {
            if (window.paypal) {
              resolve();
            } else if (attempts >= maxAttempts) {
              reject(new Error('PayPal SDK failed to load after multiple attempts'));
            } else {
              attempts++;
              setTimeout(checkPayPal, 100);
            }
          };
          checkPayPal();
        });

        // Ensure PayPal object exists
        if (!window.paypal?.HostedButtons) {
          throw new Error('PayPal Hosted Buttons component not available');
        }

        // Render the button
        const buttonId = selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
        console.log('Rendering PayPal button with ID:', buttonId);
        
        await window.paypal.HostedButtons({
          hostedButtonId: buttonId,
          onError: (err: any) => {
            console.error('PayPal button error:', err);
            toast({
              title: "Error",
              description: "Failed to load payment button. Please try again.",
              variant: "destructive",
            });
          }
        }).render('#paypal-button-container');

        setIsPayPalLoaded(true);
        console.log('PayPal button rendered successfully');

      } catch (error) {
        console.error('PayPal setup error:', error);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please refresh and try again.",
          variant: "destructive",
        });
        setIsPayPalLoaded(false);
      }
    };

    loadAndRenderPayPalButton();

    // Cleanup
    return () => {
      const scripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      scripts.forEach(script => script.remove());
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
    };
  }, [selectedPlan, toast]);

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
