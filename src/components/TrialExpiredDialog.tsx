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
import { supabase } from "@/lib/supabase";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { status, loading } = useSubscriptionStatus();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!loading) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: subscription, error } = await supabase
          .from('subscriptions')
          .select('status, current_period_end, plan_type')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking subscription:', error);
          return;
        }

        // Show dialog only if subscription is expired or doesn't exist
        const shouldShowDialog = !subscription || 
          subscription.status === 'expired' ||
          (subscription.current_period_end && new Date(subscription.current_period_end) < new Date());

        setIsOpen(shouldShowDialog);
      }
    };

    checkSubscriptionStatus();
  }, [loading]);

  // Close dialog if subscription becomes active
  useEffect(() => {
    if (status.isActive) {
      setIsOpen(false);
    }
  }, [status.isActive]);

  const handleSubscriptionSuccess = async (subscriptionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update subscription status
    const currentDate = new Date();
    const nextPeriodEnd = new Date(currentDate);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + (selectedPlan === 'monthly' ? 1 : 12));

    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        plan_type: selectedPlan,
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: nextPeriodEnd.toISOString(),
        last_payment_id: subscriptionId
      });

    if (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: "Error",
        description: "Failed to update subscription status.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Successfully subscribed to ${selectedPlan} plan`,
    });
    setIsOpen(false);
    navigate("/dashboard");
  };

  // Don't render if subscription is active or loading
  if (status.isActive || loading) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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