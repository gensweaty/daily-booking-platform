interface PayPalNamespace {
  Buttons: (config: {
    style: {
      layout: 'vertical' | 'horizontal';
      color: 'blue' | 'gold' | 'silver' | 'white' | 'black';
      shape: 'rect' | 'pill';
      label: 'subscribe';
    };
    createSubscription: () => Promise<string>;
    onApprove: (data: { orderID: string; subscriptionID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: any) => void;
  }) => {
    render: (containerId: string) => Promise<any>;
  };
}

declare global {
  interface Window {
    paypal: PayPalNamespace;
  }
}

export {};