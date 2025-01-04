import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./signup/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { PayPalSubscribeButton } from "./PayPalSubscribeButton";
import { PaymentOptions } from "./subscription/PaymentOptions";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'paypal' | 'card'>('paypal');
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: "Your subscription has been activated successfully!",
    });
    setIsOpen(false);
  };

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
          <PaymentOptions
            selectedMethod={selectedPaymentMethod}
            onMethodChange={setSelectedPaymentMethod}
            planType={selectedPlan}
            onSuccess={handleSubscriptionSuccess}
          />
          {selectedPaymentMethod === 'paypal' && (
            <PayPalSubscribeButton 
              planType={selectedPlan}
              onSuccess={handleSubscriptionSuccess}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};