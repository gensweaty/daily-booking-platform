
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./SubscriptionPlanSelect";
import { RedeemCodeDialog } from "./RedeemCodeDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession } from "@/utils/optimizedStripeUtils";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export const ManageSubscriptionDialog = ({ 
  open, 
  onOpenChange,
  currentStatus,
  onSubscriptionChange
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  currentStatus?: {
    status: 'trial' | 'trial_expired' | 'active' | 'expired' | 'canceled';
    currentPeriodEnd?: string;
    trialEnd?: string;
    planType?: 'monthly' | 'yearly' | 'ultimate';
  };
  onSubscriptionChange?: () => void;
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();

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

  const handleRedeemSuccess = () => {
    toast({
      title: "Success",
      description: "Code redeemed successfully! You now have unlimited access.",
    });
    onOpenChange(false);
    if (onSubscriptionChange) {
      onSubscriptionChange();
    }
  };

  // Don't show subscription options for ultimate users
  if (currentStatus?.planType === 'ultimate') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-[475px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
              <LanguageText>Subscription Status</LanguageText>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-6 px-2 sm:px-4">
            <div className="text-center p-6 rounded-lg border-2 border-purple-200 bg-purple-50">
              <div className="text-purple-600 text-2xl font-bold mb-2">🎉</div>
              <h3 className="text-lg font-semibold text-purple-700 mb-2">
                <LanguageText>Ultimate Subscription</LanguageText>
              </h3>
              <p className="text-purple-600">
                <LanguageText>You have unlimited access to all features!</LanguageText>
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[90vw] max-w-[475px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
              <LanguageText>{t('subscription.manageSubscription')}</LanguageText>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-6 px-2 sm:px-4">
            <p className="text-center text-sm sm:text-base text-muted-foreground">
              <LanguageText>{t('subscription.chooseUpgradeRenew')}</LanguageText>
            </p>
            
            <SubscriptionPlanSelect
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              isLoading={loading}
              currentStatus={currentStatus}
              onRedeemClick={() => setRedeemDialogOpen(true)}
            />
            
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <LanguageText>{loading ? t('subscription.processing') : t('subscription.subscribeNow')}</LanguageText>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <RedeemCodeDialog
        open={redeemDialogOpen}
        onOpenChange={setRedeemDialogOpen}
        onSuccess={handleRedeemSuccess}
      />
    </>
  );
};
