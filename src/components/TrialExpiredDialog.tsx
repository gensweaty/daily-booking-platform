
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

declare global {
  interface Window {
    paypal: any;
  }
}

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
    // Remove any existing PayPal script
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Create new script element
    const script = document.createElement('script');
    script.src = "https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD";
    script.crossOrigin = "anonymous";
    script.async = true;

    // Add the initialization script
    const initScript = document.createElement('script');
    initScript.textContent = `
      document.addEventListener("DOMContentLoaded", (event) => {
        if (window.paypal) {
          paypal.HostedButtons({
            hostedButtonId: "SZHF9WLR5RQWU"
          }).render("#paypal-container-SZHF9WLR5RQWU")
        }
      })
    `;

    // Add scripts to document
    document.body.appendChild(script);
    document.body.appendChild(initScript);

    // Cleanup function
    return () => {
      const scripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      scripts.forEach(script => script.remove());
      initScript.remove();
      const container = document.getElementById('paypal-container-SZHF9WLR5RQWU');
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []); // Run only once on mount

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
            <div id="paypal-container-SZHF9WLR5RQWU" className="min-h-[45px] w-full" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
