
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
import { PayPalSubscribeButton } from "./PayPalSubscribeButton";
import { StripeSubscribeButton } from "./StripeSubscribeButton";
import { PaymentOptions } from "./subscription/PaymentOptions";
import { verifyStripeSubscription } from "@/utils/stripeUtils";
import { useSearchParams } from "react-router-dom";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card' | 'stripe'>('paypal');
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
          const result = await verifyStripeSubscription(sessionId);
          
          if (result?.success) {
            toast({
              title: "Success",
              description: "Your subscription has been activated!",
            });
            navigate("/dashboard", { replace: true });
          } else {
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
    navigate("/dashboard");
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[90vw] max-w-[475px] p-4 sm:p-6" 
        hideCloseButton={true}
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
                Your subscription has expired. Please select a plan to continue using our services.
              </p>
              <SubscriptionPlanSelect
                selectedPlan={selectedPlan}
                setSelectedPlan={setSelectedPlan}
                isLoading={false}
              />
              <PaymentOptions
                selectedMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
              />
              {paymentMethod === 'paypal' ? (
                <PayPalSubscribeButton 
                  planType={selectedPlan}
                  onSuccess={handleSubscriptionSuccess}
                />
              ) : (
                <StripeSubscribeButton 
                  planType={selectedPlan}
                  onSuccess={handleSubscriptionSuccess}
                />
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
