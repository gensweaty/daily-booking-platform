import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./signup/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PayPalSubscribeButton } from "./PayPalSubscribeButton";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'test'>('monthly');
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status } = useSubscriptionStatus();

  // Close dialog if subscription becomes active
  useEffect(() => {
    if (status.isActive) {
      setIsOpen(false);
    }
  }, [status.isActive]);

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: `Successfully subscribed with ID: ${subscriptionId}`,
    });
    setIsOpen(false);
    navigate("/dashboard");
  };

  // Don't show dialog if subscription is active
  if (status.isActive) {
    return null;
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent className="w-[90vw] max-w-[475px] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
            Trial Period Expired
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6 px-2 sm:px-4">
          <p className="text-center text-sm sm:text-base text-muted-foreground">
            Your 14-day trial has expired. Please select a plan to continue using our services.
          </p>
          <SubscriptionPlanSelect
            selectedPlan={selectedPlan}
            setSelectedPlan={setSelectedPlan}
            isLoading={false}
          />
          <PayPalSubscribeButton 
            planType={selectedPlan}
            onSuccess={handleSubscriptionSuccess}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};