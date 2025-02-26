
interface PayPalHostedButtonsConfig {
  hostedButtonId: string;
  onApprove?: (data: { orderID: string }) => void;
}

interface PayPalHostedButtons {
  render: (containerId: string) => Promise<void>;
}

interface PayPalNamespace {
  HostedButtons: (config: PayPalHostedButtonsConfig) => PayPalHostedButtons;
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}

export {};
