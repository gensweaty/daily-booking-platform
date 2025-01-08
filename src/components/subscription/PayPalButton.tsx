import { useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { loadPayPalScript, renderPayPalButton } from '@/utils/paypal';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const { toast } = useToast();
  const buttonId = planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L';
  const isInitializedRef = useRef(false);
  const scriptLoadPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializePayPal = async () => {
      try {
        if (isInitializedRef.current) {
          console.log('PayPal already initialized');
          return;
        }

        console.log('Initializing PayPal...');
        
        if (!scriptLoadPromiseRef.current) {
          scriptLoadPromiseRef.current = loadPayPalScript(
            import.meta.env.VITE_PAYPAL_CLIENT_ID || ''
          );
        }

        await scriptLoadPromiseRef.current;

        if (!mounted) {
          console.log('Component unmounted, aborting initialization');
          return;
        }

        const returnUrl = `${window.location.origin}/dashboard?subscription=${planType}`;

        await renderPayPalButton(
          containerId,
          buttonId,
          async (data) => {
            console.log('Processing payment:', data);
            window.location.href = `${returnUrl}&orderId=${data.orderID}`;
          }
        );
        
        isInitializedRef.current = true;
        console.log('PayPal initialization complete');
      } catch (error) {
        console.error('PayPal initialization error:', error);
        if (mounted) {
          toast({
            title: "Error",
            description: "Failed to initialize PayPal. Please refresh the page.",
            variant: "destructive",
            duration: 5000,
          });
        }
      }
    };

    initializePayPal();

    return () => {
      mounted = false;
      isInitializedRef.current = false;
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [buttonId, containerId, toast, onSuccess, planType]);

  return <div id={containerId} className="w-full min-h-[50px]" />;
};