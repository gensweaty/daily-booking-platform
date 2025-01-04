interface PayPalNamespace {
  Buttons: (config: {
    style: {
      shape: string;
      color: string;
      layout: string;
      label: string;
    };
    createSubscription: (data: any, actions: any) => Promise<string>;
    onApprove: (data: any) => void;
    onError: (err: any) => void;
  }) => {
    render: (containerId: string) => void;
  };
}

interface Window {
  paypal?: PayPalNamespace;
}