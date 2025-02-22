
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscriptionPlanSelect } from "./subscription/SubscriptionPlanSelect";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const TrialExpiredDialog = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadAndRenderPayPalButton = async () => {
      try {
        console.log('Starting PayPal button initialization...');
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          throw new Error('No authenticated user found');
        }

        console.log('User authenticated, cleaning up existing PayPal elements...');

        // Clear any existing PayPal elements
        if (paypalButtonRef.current) {
          paypalButtonRef.current.innerHTML = '';
        }

        // Remove any existing PayPal scripts
        const existingScripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
        existingScripts.forEach(script => script.remove());

        // Create and load PayPal script
        const script = document.createElement('script');
        const buttonId = selectedPlan === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
        
        console.log('Loading PayPal SDK with button ID:', buttonId);

        // Load PayPal SDK with hosted-buttons component
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent('ASSEeQ2EOkXAmv_QgbwkIXiY_Tg1TPjqXJ71Ox2fy')}&components=hosted-buttons&currency=USD`;
        script.async = true;
        
        // Wait for script to load
        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log('PayPal SDK script loaded successfully');
            resolve();
          };
          script.onerror = () => {
            console.error('Failed to load PayPal SDK');
            reject(new Error('Failed to load PayPal SDK'));
          };
          document.body.appendChild(script);
        });

        // Check if PayPal object exists
        if (!window.paypal?.HostedButtons) {
          throw new Error('PayPal SDK not loaded');
        }

        // Render PayPal button
        if (paypalButtonRef.current) {
          paypalButtonRef.current.innerHTML = '';
          
          await window.paypal.HostedButtons({
            hostedButtonId: buttonId,
            onApprove: async (data: { orderID: string }) => {
              console.log('Payment approved:', data);
              toast({
                title: "Processing payment",
                description: "Please wait while we process your payment..."
              });
            }
          }).render('#paypal-button-container');

          setIsPayPalLoaded(true);
          console.log('PayPal button rendered successfully');
        }

      } catch (error) {
        console.error('PayPal setup error:', error);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please refresh and try again.",
          variant: "destructive",
        });
        setIsPayPalLoaded(false);
      }
    };

    loadAndRenderPayPalButton();

    // Cleanup
    return () => {
      const scripts = document.querySelectorAll('script[src*="paypal.com/sdk/js"]');
      scripts.forEach(script => script.remove());
      if (paypalButtonRef.current) {
        paypalButtonRef.current.innerHTML = '';
      }
    };
  }, [selectedPlan, toast]);

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-primary">
            Subscription Required
          </DialogTitle>
          <DialogDescription className="text-center">
            To continue using our services, please select a subscription plan below.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-foreground">
              Your access has expired
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <SubscriptionPlanSelect
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              isLoading={false}
            />
          </div>
          <div className="pt-4">
            {!isPayPalLoaded && (
              <div className="w-full h-[45px] bg-muted animate-pulse rounded-md" />
            )}
            <div 
              id="paypal-button-container"
              ref={paypalButtonRef}
              className="min-h-[45px] w-full"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
