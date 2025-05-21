
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { StripeSubscribeButton } from "./StripeSubscribeButton";
import { verifyStripeSubscription, refreshSubscriptionStatus } from "@/utils/stripeUtils";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TrialExpiredDialogProps {
  onVerificationSuccess?: () => void;
}

export const TrialExpiredDialog = ({ onVerificationSuccess }: TrialExpiredDialogProps) => {
  const [open, setOpen] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for Stripe session ID in URL after redirect
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifySession(sessionId);
    }
  }, [searchParams]);
  
  // Periodically check subscription status if verification is in progress
  useEffect(() => {
    if (isVerifying && verificationAttempts > 0) {
      const checkInterval = setInterval(async () => {
        console.log("TrialExpiredDialog: Performing background subscription check");
        try {
          const isActive = await refreshSubscriptionStatus();
          if (isActive) {
            console.log("TrialExpiredDialog: Background check found active subscription");
            clearInterval(checkInterval);
            handleVerificationSuccess();
          }
        } catch (error) {
          console.error("Background subscription check error:", error);
        }
      }, 3000); // Check every 3 seconds
      
      // Safety timeout - stop checking after 60 seconds
      const safetyTimeout = setTimeout(() => {
        clearInterval(checkInterval);
        console.log("TrialExpiredDialog: Background check timed out after 60 seconds");
        setIsVerifying(false);
      }, 60000);
      
      return () => {
        clearInterval(checkInterval);
        clearTimeout(safetyTimeout);
      };
    }
  }, [isVerifying, verificationAttempts]);

  const verifySession = async (sessionId: string) => {
    setIsVerifying(true);
    setVerificationAttempts(prev => prev + 1);
    
    try {
      console.log("TrialExpiredDialog: Verifying Stripe session:", sessionId);
      const result = await verifyStripeSubscription(sessionId);
      
      if (result?.success) {
        console.log("TrialExpiredDialog: Verification successful");
        handleVerificationSuccess();
      } else {
        console.error("Subscription verification failed:", result);
        toast({
          title: "Verification in Progress",
          description: "Your payment is being processed. This may take a moment.",
        });
        
        // Start background checks for active subscription
        startBackgroundVerification();
      }
    } catch (error) {
      console.error("Error verifying subscription:", error);
      toast({
        title: "Verification in Progress",
        description: "We're confirming your payment. Please wait a moment.",
      });
      
      startBackgroundVerification();
    }
  };

  const startBackgroundVerification = () => {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      console.log(`Additional verification attempt ${attempts} of ${maxAttempts}`);
      
      const isActive = await refreshSubscriptionStatus();
      if (isActive) {
        clearInterval(interval);
        handleVerificationSuccess();
        return;
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setIsVerifying(false);
        toast({
          title: "Verification Issue",
          description: "Please contact support if your subscription doesn't activate soon.",
          variant: "destructive",
        });
      }
    }, 3000);
  };

  const handleVerificationSuccess = async () => {
    try {
      // Force refresh the auth session
      await supabase.auth.refreshSession();
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Force update the subscription record with active status
        const { error: updateError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: user.id,
            email: user.email,
            status: 'active',
            plan_type: selectedPlan,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
          
        if (updateError) {
          console.error("Error updating subscription record:", updateError);
        } else {
          console.log("Subscription record updated to active status");
        }
      }
      
      toast({
        title: "Success",
        description: "Your subscription has been activated!",
      });
      
      // Close the dialog
      setOpen(false);
      setIsVerifying(false);
      
      // Notify parent component
      if (onVerificationSuccess) {
        onVerificationSuccess();
      }
      
      // Replace URL to remove the session_id parameter
      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Error in verification success handler:", error);
    }
  };

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: `Payment processed successfully. Your subscription will be active shortly.`,
    });
    
    // Start verification process
    setIsVerifying(true);
    setVerificationAttempts(prev => prev + 1);
    
    // Set a timeout to check subscription status
    setTimeout(() => {
      refreshSubscriptionStatus()
        .then(isActive => {
          if (isActive) {
            handleVerificationSuccess();
          } else {
            // Start background verification since immediately after payment the subscription may not be active yet
            startBackgroundVerification();
          }
        })
        .catch(err => console.error("Error checking subscription status:", err));
    }, 2000);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing the dialog by user interaction
        // Only allow it to be closed programmatically after successful payment
        if (open && newOpen === false) {
          // Don't allow closing unless verification is complete
          if (!isVerifying) {
            return;
          }
        }
        setOpen(newOpen);
      }}
    >
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6" 
        hideCloseButton={true}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing when pressing Escape
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl sm:text-2xl font-bold">
            Subscription Required
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6 px-2 sm:px-4">
          {isVerifying ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground">
                Verifying your subscription...
              </p>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                This may take a moment. Please don't close this window.
              </p>
            </div>
          ) : (
            <>
              <p className="text-center text-sm sm:text-base text-muted-foreground">
                Your trial has expired. Please subscribe to continue using our services.
              </p>
              
              <div className="my-8">
                <Tabs defaultValue="monthly" onValueChange={(v) => setSelectedPlan(v as 'monthly' | 'yearly')}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly">Yearly (Save 17%)</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="monthly" className="mt-0">
                    <div className="px-4 py-6 border rounded-lg bg-card">
                      <h3 className="text-lg font-semibold text-center mb-2">Monthly Plan</h3>
                      <p className="text-center text-muted-foreground mb-4">
                        Full access to all features and premium support
                      </p>
                      <div className="text-center text-2xl font-bold mb-6">
                        $9.99<span className="text-base font-normal text-muted-foreground">/month</span>
                      </div>
                      
                      <StripeSubscribeButton 
                        onSuccess={handleSubscriptionSuccess}
                        planType="monthly"
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="yearly" className="mt-0">
                    <div className="px-4 py-6 border rounded-lg bg-card">
                      <h3 className="text-lg font-semibold text-center mb-2">Annual Plan</h3>
                      <p className="text-center text-muted-foreground mb-4">
                        Full access to all features and premium support
                      </p>
                      <div className="text-center text-2xl font-bold mb-6">
                        $99.99<span className="text-base font-normal text-muted-foreground">/year</span>
                      </div>
                      
                      <StripeSubscribeButton 
                        onSuccess={handleSubscriptionSuccess}
                        planType="yearly"
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
