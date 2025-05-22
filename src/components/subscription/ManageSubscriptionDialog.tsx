
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/utils/stripeUtils";

export const ManageSubscriptionDialog = ({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void 
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubscribe = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      console.log(`Initiating checkout for ${selectedPlan} plan`);
      const data = await createCheckoutSession(selectedPlan);
      
      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        // Use full page redirect instead of opening in a new tab
        window.location.href = data.url;
      } else {
        console.error('No checkout URL returned');
        toast({
          title: "Error",
          description: "Failed to create checkout session - no URL returned",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      // Show detailed error to help debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Subscription Error",
        description: `Could not start subscription process: ${errorMessage.substring(0, 100)}`,
        variant: "destructive",
      });
      
      // For testing purposes, log the entire error object
      console.log('Complete error object:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
            Manage Your Subscription
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6 px-2 sm:px-4">
          <p className="text-center text-sm sm:text-base text-muted-foreground">
            Choose a plan to upgrade or renew your subscription.
          </p>
          
          <SubscriptionPlanSelect
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            isLoading={loading}
          />
          
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            {loading ? "Processing..." : "Subscribe Now"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
