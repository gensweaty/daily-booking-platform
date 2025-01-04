import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const buttonContainerId = planType === 'monthly' 
    ? 'paypal-container-ST9DUFXHJCGWJ'
    : 'paypal-container-YDK5G6VR2EA8L';

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