import { PayPalButton } from './subscription/PayPalButton';
import { useEffect, useState } from 'react';

interface PayPalSubscribeButtonProps {
  planType: 'monthly' | 'yearly';
  onSuccess?: (subscriptionId: string) => void;
}

export const PayPalSubscribeButton = ({ planType, onSuccess }: PayPalSubscribeButtonProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const buttonContainerId = `paypal-container-${planType === 'monthly' ? 'ST9DUFXHJCGWJ' : 'YDK5G6VR2EA8L'}`;

  useEffect(() => {
    // Reset error state when plan type changes
    setError(null);
    setIsLoading(true);
  }, [planType]);

  const handleError = (err: any) => {
    console.error('PayPal button error:', err);
    setError('Failed to load PayPal button. Please try again.');
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  return (
    <div className="w-full">
      {isLoading && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">Loading payment options...</p>
        </div>
      )}
      {error && (
        <div className="text-center py-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      <PayPalButton
        planType={planType}
        onSuccess={onSuccess}
        containerId={buttonContainerId}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
};