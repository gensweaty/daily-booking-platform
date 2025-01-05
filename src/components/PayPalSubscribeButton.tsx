import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const buttonContainerId = `paypal-container-${planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L'}`;

  return (
    <div className="w-full">
      <PayPalButton
        planType={planType}
        onSuccess={onSuccess}
        containerId={buttonContainerId}
      />
    </div>
  );
};