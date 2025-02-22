
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { PayPalSubscribeButton } from "./PayPalSubscribeButton";

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

  return (
    <Dialog open={true} onOpenChange={() => {}} modal={true}>
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />
        <DialogContent 
          className="fixed left-[50%] top-[50%] z-50 w-[90vw] max-w-[500px] translate-x-[-50%] translate-y-[-50%] bg-background p-6 shadow-lg rounded-lg"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          hideCloseButton={true}
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
              <PayPalSubscribeButton 
                planType={selectedPlan}
                onSuccess={handleSubscriptionSuccess}
              />
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
