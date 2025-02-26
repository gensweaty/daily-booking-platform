
interface PayPalButtonsConfig {
  style?: {
    layout?: 'vertical' | 'horizontal';
    color?: 'gold' | 'blue' | 'silver' | 'black' | 'white';
    shape?: 'rect' | 'pill';
    label?: 'pay' | 'buynow' | 'paypal';
  };
  createOrder: (data: any, actions: any) => Promise<string>;
  onApprove: (data: any, actions: any) => Promise<void>;
}

interface PayPalButtons {
  render: (containerId: string) => Promise<void>;
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => PayPalButtons;
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}

export {};
