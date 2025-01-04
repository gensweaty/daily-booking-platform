import { usePayPalSubscription } from './hooks/usePayPalSubscription';

interface PayPalButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
  containerId: string;
}

export const PayPalButton = ({ planType, onSuccess, containerId }: PayPalButtonProps) => {
  const buttonId = planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L';

  usePayPalSubscription({
    buttonId,
    containerId,
    onSuccess,
  });

  return <div id={containerId} className="w-full h-[45px] min-h-[45px] bg-white" />;
};