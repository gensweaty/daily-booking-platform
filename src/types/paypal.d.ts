
interface PayPalButtonStyle {
  layout?: 'vertical' | 'horizontal';
  color?: 'gold' | 'blue' | 'silver' | 'black' | 'white';
  shape?: 'rect' | 'pill';
  label?: 'paypal' | 'checkout' | 'buynow' | 'pay' | 'subscribe';
}

interface PayPalSubscriptionResponse {
  orderID?: string;
  subscriptionID?: string;
}

interface PayPalButtonsComponentOptions {
  style?: PayPalButtonStyle;
  createSubscription?: (data: any, actions: any) => Promise<string>;
  onApprove?: (data: PayPalSubscriptionResponse) => Promise<void>;
  onError?: (error: any) => void;
  onCancel?: () => void;
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
