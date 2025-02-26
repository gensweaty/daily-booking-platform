
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { PayPalButton } from "./subscription/PayPalButton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface TrialExpiredDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TrialExpiredDialog = ({ open = true, onOpenChange }: TrialExpiredDialogProps) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: "Your subscription has been activated successfully!",
    });
    
    if (onOpenChange) {
      onOpenChange(false);
    }
    
    // Refresh the page to update subscription status
    window.location.reload();
  };

  const amount = selectedPlan === 'monthly' ? '9.99' : '99.99';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]"
        hideCloseButton
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
            <PayPalButton
              amount={amount}
              planType={selectedPlan}
              onSuccess={handleSubscriptionSuccess}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
