
interface PayPalButtonStyle {
  layout?: 'vertical' | 'horizontal';
  color?: 'gold' | 'blue' | 'silver' | 'black' | 'white';
  shape?: 'rect' | 'pill';
  label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
}

interface PayPalButtonsComponentOptions {
  style?: PayPalButtonStyle;
  createOrder?: () => Promise<string>;
  onApprove?: (data: { orderID?: string; subscriptionID?: string }) => Promise<void>;
  onError?: (error: any) => void;
  onCancel?: () => void;
  onClick?: () => Promise<void>;
  onInit?: () => Promise<void>;
}

interface PayPalButtonsComponent {
  render: (element: HTMLElement) => Promise<void>;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonsComponentOptions) => PayPalButtonsComponent;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export {};
