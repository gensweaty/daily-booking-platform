interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => PayPalButtonsComponent;
}

interface PayPalButtonsConfig {
  style: {
    shape: string;
    color: string;
    layout: string;
    label: string;
  };
  createOrder: (data: any, actions: any) => Promise<string>;
  onApprove: (data: any, actions: any) => Promise<void>;
  onError: (err: any) => void;
}

interface PayPalButtonsComponent {
  render: (containerId: string) => Promise<void>;
}

interface Window {
  paypal?: PayPalNamespace;
}