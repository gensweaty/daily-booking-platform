import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PayPalSubscribeButton } from "./PayPalSubscribeButton";
import { useState } from "react";
import { Button } from "./ui/button";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Subscription Required</DialogTitle>
          <DialogDescription>
            Please choose a subscription plan to continue using all features.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex justify-center gap-4">
            <Button
              variant={selectedPlan === 'monthly' ? "default" : "outline"}
              onClick={() => setSelectedPlan('monthly')}
            >
              Monthly ($9.99)
            </Button>
            <Button
              variant={selectedPlan === 'yearly' ? "default" : "outline"}
              onClick={() => setSelectedPlan('yearly')}
            >
              Yearly ($99.99)
            </Button>
          </div>
          <PayPalSubscribeButton planType={selectedPlan} />
        </div>
      </DialogContent>
    </Dialog>
  );
};