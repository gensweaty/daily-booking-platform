
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { checkSubscriptionStatus, createCheckoutSession, verifySession, manualSyncSubscription } from "@/utils/stripeUtils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [open, setOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');
    
    if (sessionId) {
      console.log('Found session_id in URL, verifying payment:', sessionId);
      verifyStripeSession(sessionId);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, document.title, url.toString());
    } else {
      checkUserSubscription();
    }
    
    const checkInterval = sessionId ? 2000 : 5000;
    const intervalId = setInterval(checkUserSubscription, checkInterval);
    
    return () => clearInterval(intervalId);
  }, [user]);

  const checkUserSubscription = async () => {
    if (!user) return;
    
    try {
      console.log('Checking subscription status...');
      const data = await checkSubscriptionStatus();
      console.log('Subscription status result:', data);
      
      const status = data.status;
      setSubscriptionStatus(status);
      
      if (status === 'active') {
        console.log('Subscription is active, closing dialog');
        setOpen(false);
      } else if (status === 'trial_expired') {
        console.log('Trial expired, showing dialog');
        setOpen(true);
      } else {
        console.log('Status is not active or trial_expired:', status);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      console.log(`Initiating checkout for ${selectedPlan} plan`);
      const data = await createCheckoutSession(selectedPlan);
      
      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Subscription Error",
        description: `Could not start subscription process: ${errorMessage.substring(0, 100)}`,
        variant: "destructive",
      });
      
      console.log('Complete error object:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyStripeSession = async (sessionId: string) => {
    setIsVerifying(true);
    
    try {
      console.log('Verifying session:', sessionId);
      const response = await verifySession(sessionId);
      
      console.log('Session verification response:', response);
      
      if (response && (response.success || response.status === 'active')) {
        handleVerificationSuccess();
        await checkUserSubscription();
      } else {
        console.error('Session verification failed:', response);
        toast({
          title: "Verification Issue",
          description: (response && response.error) || "There was a problem verifying your payment",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      toast({
        title: "Verification Issue",
        description: "There was a problem verifying your payment",
        variant: "destructive",
      });
      await checkUserSubscription();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerificationSuccess = () => {
    setOpen(false);
    setSubscriptionStatus('active');
    toast({
      title: "Subscription Activated",
      description: "Thank you for subscribing to our service!",
    });
  };

  // NEW: Manual sync functionality for trial expired dialog
  const handleManualSync = async () => {
    if (!user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const result = await manualSyncSubscription();
      
      if (result.success && result.status === 'active') {
        setSubscriptionStatus('active');
        setOpen(false);
        
        toast({
          title: "Payment Found!",
          description: "Your subscription has been activated successfully",
        });
      } else {
        toast({
          title: "No Active Subscription",
          description: "No paid subscription found. Please subscribe to continue.",
        });
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      toast({
        title: "Sync Error",
        description: "Failed to check payment status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    const isTestUser = user?.email === 'anania.devsurashvili885@law.tsu.edu.ge';
    
    if (isTestUser && subscriptionStatus === 'trial_expired' && !newOpen) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6" 
        hideCloseButton={user?.email === 'anania.devsurashvili885@law.tsu.edu.ge' && subscriptionStatus === 'trial_expired'}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
            Your Trial Has Expired
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6 px-2 sm:px-4">
          <p className="text-center text-sm sm:text-base text-muted-foreground">
            Your 14-day free trial has ended. Please select a plan to continue using our services.
          </p>
          
          {/* Manual sync button for users who already paid */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Already paid? Check your payment status:
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="mb-4"
            >
              {isSyncing ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Checking Payment...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Check Payment Status
                </span>
              )}
            </Button>
          </div>
          
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
