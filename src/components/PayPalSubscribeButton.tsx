
import { PayPalButton } from './subscription/PayPalButton';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const amount = planType === 'monthly' ? '9.99' : '99.99';

  return (
    <div className="w-full">
      <PayPalButton
        planType={planType}
        amount={amount}
        onSuccess={onSuccess}
      />
    </div>
  );
};
