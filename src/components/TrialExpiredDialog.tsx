
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
import { verifyStripeSubscription } from "@/utils/stripeUtils";
import { useSearchParams } from "react-router-dom";

export const TrialExpiredDialog = () => {
  const [open, setOpen] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for Stripe session ID in URL after redirect
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Verify the subscription
      const verifySubscription = async () => {
        setIsVerifying(true);
        try {
          console.log("Verifying Stripe session:", sessionId);
          const result = await verifyStripeSubscription(sessionId);
          
          if (result?.success) {
            toast({
              title: "Success",
              description: "Your subscription has been activated!",
            });
            // Close the dialog on successful verification
            setOpen(false);
            // Replace URL to remove the session_id parameter
            navigate("/dashboard", { replace: true });
          } else {
            console.error("Subscription verification failed:", result);
            toast({
              title: "Error",
              description: "Failed to verify subscription. Please contact support.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error verifying subscription:", error);
          toast({
            title: "Error",
            description: "Failed to verify subscription. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsVerifying(false);
        }
      };
      
      verifySubscription();
    }
  }, [searchParams, toast, navigate]);

  const handleSubscriptionSuccess = (subscriptionId: string) => {
    toast({
      title: "Success",
      description: `Successfully subscribed with ID: ${subscriptionId}`,
    });
    setOpen(false);
    navigate("/dashboard");
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(newOpen) => {
        // Prevent closing the dialog by user interaction
        // Only allow it to be closed programmatically after successful payment
        if (open && newOpen === false) {
          // Don't allow closing
          return;
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
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <p className="mt-4 text-center text-sm sm:text-base text-muted-foreground">
                Verifying your subscription...
              </p>
            </div>
          ) : (
            <>
              <p className="text-center text-sm sm:text-base text-muted-foreground">
                Your trial has expired. Please subscribe to continue using our services.
              </p>
              <div className="my-8">
                <div className="px-4 py-6 border rounded-lg bg-card">
                  <h3 className="text-lg font-semibold text-center mb-2">Premium Plan</h3>
                  <p className="text-center text-muted-foreground mb-4">
                    Full access to all features and premium support
                  </p>
                  <div className="text-center text-2xl font-bold mb-6">
                    $9.99<span className="text-base font-normal text-muted-foreground">/month</span>
                  </div>
                  <StripeSubscribeButton onSuccess={handleSubscriptionSuccess} />
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
