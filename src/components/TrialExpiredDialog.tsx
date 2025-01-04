import { useState } from "react";
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

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: `Successfully subscribed with ID: ${subscriptionId}`,
    });
    setIsOpen(false);
    navigate("/dashboard");
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            Trial Period Expired
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          <p className="text-center text-muted-foreground">
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