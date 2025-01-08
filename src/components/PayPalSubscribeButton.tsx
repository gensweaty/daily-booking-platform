import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const buttonContainerId = `paypal-button-${planType}-${Math.random().toString(36).substring(7)}`;

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