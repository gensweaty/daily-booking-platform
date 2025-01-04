declare interface Window {
  paypal: {
    HostedButtons: (config: {
      hostedButtonId: string;
      onApprove?: (data: { orderID: string }) => void;
      createOrder?: () => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}