
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
import { checkSubscriptionStatus, createCheckoutSession, verifySession } from "@/utils/stripeUtils";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [open, setOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    // Check if test user
    const isTestUser = user.email === 'pmb60533@toaik.com';
    if (isTestUser) {
      console.log('Test user detected, showing trial expired dialog');
      // For the test user, force the dialog to appear
      setOpen(true);
      setSubscriptionStatus('trial_expired');
    } else {
      checkUserSubscription();
    }
    
    // Check URL for session_id parameter
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session_id');
    
    if (sessionId) {
      verifyStripeSession(sessionId);
      // Clean URL after processing
      url.searchParams.delete('session_id');
      window.history.replaceState({}, document.title, url.toString());
    }
    
    // Set up a periodic check for subscription status
    const intervalId = setInterval(checkUserSubscription, 5000); // Check every 5 seconds (reduced from 30s)
    
    return () => clearInterval(intervalId);
  }, [user]);

  const checkUserSubscription = async () => {
    if (!user) return;
    
    try {
      console.log('Checking subscription status...');
      const data = await checkSubscriptionStatus();
      console.log('Subscription status result:', data);
      
      if (data.status === 'active') {
        console.log('Subscription is active, closing dialog');
        setOpen(false);
      } else {
        setSubscriptionStatus(data.status);
        setOpen(data.status === 'trial_expired');
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

  const verifyStripeSession = async (sessionId: string) => {
    setIsVerifying(true);
    
    try {
      console.log('Verifying session:', sessionId);
      const data = await verifySession(sessionId);
      
      if (data.success) {
        handleVerificationSuccess();
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      toast({
        title: "Verification Issue",
        description: "There was a problem verifying your payment",
        variant: "destructive",
      });
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

  // Prevent closing when trial expired
  const handleOpenChange = (newOpen: boolean) => {
    if (subscriptionStatus === 'trial_expired' && !newOpen) {
      return; // Prevent closing
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6" 
        hideCloseButton={subscriptionStatus === 'trial_expired'}
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
