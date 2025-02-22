
interface PayPalButtonsComponentOptions {
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError?: (error: any) => void;
}

interface PayPalButtonsComponent {
  render: (element: HTMLElement) => Promise<void>;
}

interface PayPalNamespace {
  Buttons: (options: PayPalButtonsComponentOptions) => PayPalButtonsComponent;
}

declare interface Window {
  paypal?: PayPalNamespace;
}

export {};
