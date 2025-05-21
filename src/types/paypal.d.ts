
interface PayPalButtonsComponentOptions {
  /**
   * The funding source to be shown in the button
   */
  fundingSource?: string;

  /**
   * Style object for the button
   */
  style?: {
    color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
    shape?: 'rect' | 'pill';
    label?: 'paypal' | 'checkout' | 'buynow' | 'pay' | 'installment' | 'subscribe';
    height?: number;
    tagline?: boolean;
  };

  /**
   * Creates and returns a new order
   */
  createOrder?: (data: any, actions: any) => Promise<string>;

  /**
   * Callback when the button is clicked
   */
  onClick?: (data: any, actions: any) => void | Promise<void>;

  /**
   * Callback when the payment is approved
   */
  onApprove?: (data: any, actions: any) => void | Promise<any>;

  /**
   * Callback when the payment is cancelled
   */
  onCancel?: (data: any) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (err: any) => void;

  /**
   * Callback when the button is rendered
   */
  onInit?: () => void;

  /**
   * Callback when the button is loaded
   */
  onShippingChange?: (data: any, actions: any) => void | Promise<void>;
}

interface PayPalButtonsComponent {
  render: (selector: string) => Promise<void>;
}

interface PayPalHostedButtonsOptions {
  /**
   * The ID of the PayPal hosted button to render
   */
  hostedButtonId: string;

  /**
   * Callback when the payment is approved
   */
  onApprove?: (data: any) => void | Promise<any>;
}

interface PayPalHostedButtons {
  render: (selector: string) => Promise<void>;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonsComponentOptions) => PayPalButtonsComponent;
  HostedButtons?: (options: PayPalHostedButtonsOptions) => PayPalHostedButtons;
  FUNDING: {
    PAYPAL: string;
    VENMO: string;
    CREDIT: string;
    CARD: string;
    [key: string]: string;
  };
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}
