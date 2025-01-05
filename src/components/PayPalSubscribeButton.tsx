import { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const paypalButtonRef = useRef<HTMLDivElement>(null);
  const paypalButtonId = 'paypal-button-container';

  useEffect(() => {
    // Get the hosted button ID based on the plan type
    const hostedButtonId = planType === 'monthly' 
      ? import.meta.env.VITE_PAYPAL_MONTHLY_BUTTON_ID 
      : import.meta.env.VITE_PAYPAL_YEARLY_BUTTON_ID;

    if (window.paypal) {
      window.paypal.HostedButtons({
        hostedButtonId: hostedButtonId,
        onApprove: (data: { orderID: string }) => {
          console.log('PayPal subscription successful:', data);
          onSuccess(data.orderID);
        },
      }).render(paypalButtonId);
    }
  }, [planType, onSuccess]);

  return (
    <div className="w-full">
      <div id={paypalButtonId} ref={paypalButtonRef} className="w-full" />
      <Button variant="outline" className="w-full mt-2">
        Subscribe with PayPal
      </Button>
    </div>
  );
};