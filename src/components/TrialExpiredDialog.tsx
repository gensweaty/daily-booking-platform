import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./signup/SubscriptionPlanSelect";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Here you would integrate with your payment processor
      // For now, we'll just show a toast
      toast({
        title: "Redirecting to payment",
        description: `Processing upgrade to ${selectedPlan} plan`,
      });
      
      // Simulate payment process
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error upgrading plan:", error);
      toast({
        title: "Error",
        description: "Failed to process upgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]">
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
            isLoading={isLoading}
          />
          <Button
            className="w-full"
            onClick={handleUpgrade}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Upgrade Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};