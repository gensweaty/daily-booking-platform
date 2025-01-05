import { PayPalButton } from './subscription/PayPalButton';
import { PayPalPlanType } from '@/types/paypal-types';

interface PayPalSubscribeButtonProps {
  planType: PayPalPlanType;
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const getContainerId = () => {
    switch (planType) {
      case 'monthly':
        return 'paypal-container-ST9DUFXHJCGWJ';
      case 'yearly':
        return 'paypal-container-YDK5G6VR2EA8L';
      case 'test':
        return 'paypal-container-SZHF9WLR5RQWU';
      default:
        return `paypal-container-${planType}`;
    }
  };

  return (
    <div className="w-full">
      <PayPalButton
        planType={planType}
        onSuccess={onSuccess}
        containerId={getContainerId()}
      />
    </div>
  );
};