declare interface Window {
  paypal: PayPalNamespace;
}

interface PayPalNamespace {
  HostedButtons: (config: { hostedButtonId: string }) => {
    render: (containerId: string) => Promise<any>;
  };
}