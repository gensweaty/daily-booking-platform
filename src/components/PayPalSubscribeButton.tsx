import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const buttonContainerId = `paypal-container-${planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YDK5G6VR2EA8L'}`;

  return (
    <div className="w-full min-h-[50px] bg-white rounded-md shadow-sm">
      <PayPalButton
        planType={planType}
        onSuccess={onSuccess}
        containerId={buttonContainerId}
      />
    </div>
  );
};