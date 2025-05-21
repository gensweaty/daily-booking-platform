
import { useEffect, useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { loadPayPalScript } from "@/utils/paypal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const loadScript = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get client ID from environment variable
        const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
        
        if (!clientId) {
          throw new Error("PayPal client ID is not configured");
        }
        
        await loadPayPalScript(clientId);
        
        // Safely check if PayPal SDK is loaded
        if (typeof window === 'undefined' || !window.paypal) {
          throw new Error("PayPal SDK failed to load");
        }
        
        const renderButton = async () => {
          try {
            const container = document.getElementById(containerId);
            if (!container) {
              throw new Error(`Container ${containerId} not found`);
            }
            
            // Clear existing content
            container.innerHTML = '';
            
            // Safely check if PayPal SDK is available
            if (typeof window === 'undefined' || !window.paypal) {
              throw new Error("PayPal SDK not available");
            }
            
            // Determine button ID based on plan type
            const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
            
            await window.paypal.Buttons({
              fundingSource: window.paypal.FUNDING.PAYPAL,
              style: {
                color: 'gold',
                shape: 'rect',
                label: 'subscribe',
                height: 40
              },
              createOrder: function(data, actions) {
                return actions.order.create({
                  purchase_units: [{
                    amount: {
                      value: planType === 'monthly' ? '9.99' : '99.99',
                      breakdown: {
                        item_total: { value: planType === 'monthly' ? '9.99' : '99.99', currency_code: 'USD' }
                      }
                    },
                    description: `SmartBookly ${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
                    items: [{
                      name: `${planType === 'monthly' ? 'Monthly' : 'Yearly'} Subscription`,
                      quantity: '1',
                      unit_amount: { value: planType === 'monthly' ? '9.99' : '99.99', currency_code: 'USD' },
                      category: 'DIGITAL_GOODS'
                    }]
                  }]
                });
              },
              onApprove: async function(data, actions) {
                try {
                  toast({
                    title: "Processing Payment",
                    description: "Please wait while we verify your payment...",
                  });
                  
                  const orderID = data.orderID;
                  console.log("Payment approved, order ID:", orderID);
                  
                  // Verify the payment with our backend
                  const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-paypal-payment', {
                    body: { orderID },
                  });
                  
                  if (verifyError || !verifyData?.success) {
                    console.error("Payment verification failed:", verifyError || verifyData);
                    throw new Error(verifyError?.message || "Failed to verify payment");
                  }
                  
                  console.log("Payment verified:", verifyData);
                  
                  toast({
                    title: "Payment Successful",
                    description: `Your ${planType} subscription is now active!`,
                  });
                  
                  // Call the success callback
                  if (onSuccess) {
                    onSuccess(orderID);
                  }
                  
                  return true;
                } catch (error: any) {
                  console.error("Error processing PayPal payment:", error);
                  toast({
                    title: "Payment Error",
                    description: error.message || "Failed to process payment",
                    variant: "destructive",
                  });
                  return false;
                }
              },
              onError: function(err) {
                console.error("PayPal error:", err);
                setError("PayPal encountered an error. Please try again.");
                toast({
                  title: "PayPal Error",
                  description: "There was an issue with PayPal. Please try again.",
                  variant: "destructive",
                });
              }
            }).render(`#${containerId}`);
            
          } catch (renderError: any) {
            console.error("Error rendering PayPal button:", renderError);
            setError(renderError.message || "Failed to render PayPal button");
          } finally {
            setIsLoading(false);
          }
        };
        
        renderButton();
        
      } catch (loadError: any) {
        console.error("PayPal script loading error:", loadError);
        setError(loadError.message || "Failed to load PayPal");
        setIsLoading(false);
        
        toast({
          title: "PayPal Error",
          description: "Failed to load PayPal. Please try again later.",
          variant: "destructive",
        });
      }
    };
    
    loadScript();
    
  }, [containerId, planType, toast, onSuccess]);

  return (
    <div className="w-full">
      <div 
        id={containerId} 
        className="paypal-button-container min-h-[40px] flex items-center justify-center"
      >
        {isLoading && (
          <div className="animate-pulse flex items-center justify-center h-10 bg-gray-200 rounded w-full">
            <span className="text-sm text-gray-500">Loading PayPal...</span>
          </div>
        )}
        
        {error && !isLoading && (
          <div className="text-sm text-red-500 text-center p-2 border border-red-300 rounded bg-red-50">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
