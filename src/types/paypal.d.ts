
interface PayPalButtonConfig {
  style: {
    layout: 'vertical' | 'horizontal';
    color: 'blue' | 'gold' | 'silver' | 'white' | 'black';
    shape: 'rect' | 'pill';
    label: 'paypal' | 'checkout' | 'buynow' | 'pay';
  };
  createOrder: (data: any, actions: any) => Promise<string>;
  onApprove: (data: any, actions: any) => Promise<void>;
}

interface PayPalButtons {
  render: (containerId: string) => Promise<void>;
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonConfig) => PayPalButtons;
  close: () => void;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export {};
