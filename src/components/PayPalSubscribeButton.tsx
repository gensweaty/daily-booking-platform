
import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const buttonContainerId = `paypal-container-${planType === 'monthly' ? 'prod_SM0TDwHLzblX2v' : 'prod_SM0a8xDw7Hq2lu'}`;

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
