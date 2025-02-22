
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
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
    const loadPayPalScript = async () => {
      try {
        // Remove any existing PayPal script
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          existingScript.remove();
        }

        // Create new script element
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
        script.async = true;
        script.crossOrigin = "anonymous";

        // Add script to document
        document.body.appendChild(script);

        // Wait for script to load and initialize
        script.onload = () => {
          // Make sure PayPal is available
          const initializeButton = () => {
            if (window.paypal) {
              try {
                window.paypal.HostedButtons({
                  hostedButtonId: selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'
                }).render(`#paypal-container-${selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'}`);
              } catch (error) {
                console.error('Error rendering PayPal button:', error);
              }
            } else {
              setTimeout(initializeButton, 100);
            }
          };
          
          initializeButton();
        };
      } catch (error) {
        console.error('Error loading PayPal script:', error);
      }
    };

    loadPayPalScript();

    // Cleanup function
    return () => {
      const script = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (script) {
        script.remove();
      }
      // Clear any PayPal button containers
      const container = document.querySelector(`#paypal-container-${selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'}`);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [selectedPlan]); // Re-run when plan changes

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
        </DialogHeader>
        <div className="mt-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">
              Your access has expired
            </p>
            <p className="text-sm text-muted-foreground">
              To continue using our services, please select a subscription plan below.
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
            <div 
              id={`paypal-container-${selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'}`} 
              className="min-h-[45px] w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
