
interface PayPalHostedButtons {
  render: (containerId: string) => Promise<void>;
}

interface PayPalNamespace {
  HostedButtons: (config: { hostedButtonId: string }) => PayPalHostedButtons;
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}

export {};
