
import { useState, useEffect, useCallback } from "react";
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
  const [searchParams, setSearchParams] = useSearchParams();

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
      
      console.log("TrialExpiredDialog: Verification result:", result);
      
      if (result?.success) {
        console.log("TrialExpiredDialog: Verification successful with data:", result);
        // Clean up URL
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev.toString());
          newParams.delete('session_id');
          return newParams;
        }, { replace: true });
        
        handleVerificationSuccess();
        return;
      } else {
        console.warn("Subscription verification returned non-success:", result);
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
    // Use exponential backoff for retries
    const maxAttempts = 10;
    let attempt = 0;
    
    const checkWithBackoff = async () => {
      if (attempt >= maxAttempts) {
        setIsVerifying(false);
        toast({
          title: "Verification Issue",
          description: "Please contact support if your subscription doesn't activate soon.",
          variant: "destructive",
        });
        return;
      }
      
      attempt++;
      console.log(`Background verification attempt ${attempt} of ${maxAttempts}`);
      
      try {
        const isActive = await refreshSubscriptionStatus();
        if (isActive) {
          handleVerificationSuccess();
          return;
        }
        
        // Exponential backoff
        const delay = Math.min(2000 * Math.pow(1.5, attempt), 15000); // Cap at 15 seconds
        console.log(`Will retry in ${delay}ms`);
        setTimeout(checkWithBackoff, delay);
      } catch (error) {
        console.error("Error in background verification:", error);
        // Continue with backoff even after errors
        const delay = Math.min(2000 * Math.pow(1.5, attempt), 15000);
        setTimeout(checkWithBackoff, delay);
      }
    };
    
    checkWithBackoff();
  };

  const handleVerificationSuccess = async () => {
    try {
      // Force refresh the auth session
      await supabase.auth.refreshSession();
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check if subscription is active
        const isActive = await refreshSubscriptionStatus();
        
        if (!isActive) {
          console.log("TrialExpiredDialog: Trying one more direct check before success");
          // Try one last direct check
          const { data: subscriptionCheck } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();
            
          if (!subscriptionCheck && user.email) {
            console.log("TrialExpiredDialog: No subscription found, trying by email");
            
            // Try by email as last resort
            const { data: emailSubscription } = await supabase
              .from('subscriptions')
              .select('*')
              .eq('email', user.email)
              .eq('status', 'active')
              .maybeSingle();
              
            if (emailSubscription) {
              console.log("TrialExpiredDialog: Found subscription by email, updating user_id");
              
              // Update the subscription with the current user_id
              const { error: updateError } = await supabase
                .from('subscriptions')
                .update({ user_id: user.id })
                .eq('id', emailSubscription.id);
                
              if (updateError) {
                console.error("Error updating subscription user_id:", updateError);
              }
            }
          }
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
      
      // Replace URL to remove the session_id parameter and navigate to dashboard
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
        // Only allow closing if not verifying
        if (isVerifying) {
          return;
        }
        setOpen(newOpen);
      }}
    >
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6" 
        hideCloseButton={isVerifying}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside during verification
          if (isVerifying) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing when pressing Escape during verification
          if (isVerifying) {
            e.preventDefault();
          }
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
