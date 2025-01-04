interface PayPalNamespace {
  Buttons: (config: {
    style: {
      shape: string;
      color: string;
      layout: string;
      label: string;
    };
    createOrder: (data: any, actions: any) => Promise<string>;
    onApprove: (data: any, actions: any) => Promise<void>;
    onError: (err: any) => void;
  }) => {
    render: (containerId: string) => Promise<void>;
  };
}

interface Window {
  paypal?: PayPalNamespace;
}