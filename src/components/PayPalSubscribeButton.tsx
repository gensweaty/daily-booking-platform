import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  // Generate a truly unique ID for each button instance
  const buttonContainerId = `paypal-button-container-${planType}-${Date.now()}`;

  return (
    <div className="w-full min-h-[50px]">
      <PayPalButton
        planType={planType}
        onSuccess={onSuccess}
        containerId={buttonContainerId}
      />
    </div>
  );
};