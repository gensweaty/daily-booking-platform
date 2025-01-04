import { useState } from 'react';
import { PaymentOptions } from './subscription/PaymentOptions';
import { PayPalButton } from './subscription/PayPalButton';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card'>('paypal');
  const { toast } = useToast();
  const buttonContainerId = planType === 'monthly' 
    ? 'paypal-container-YDK5G6VR2EA8L'  // Monthly hosted button container
    : 'paypal-container-YKXLC4MYQK4JY';  // Yearly hosted button container

  const handleCardPayment = () => {
    toast({
      title: "Coming Soon",
      description: "Credit/Debit card payments will be available soon!",
    });
  };

  return (
    <div className="space-y-6">
      <PaymentOptions
        selectedMethod={paymentMethod}
        onMethodChange={setPaymentMethod}
      />
      
      {paymentMethod === 'paypal' ? (
        <PayPalButton
          planType={planType}
          onSuccess={onSuccess}
          containerId={buttonContainerId}
        />
      ) : (
        <Button 
          className="w-full"
          onClick={handleCardPayment}
        >
          Pay with Card
        </Button>
      )}
    </div>
  );
};