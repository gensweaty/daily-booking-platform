declare interface Window {
  paypal: {
    HostedButtons: (config: {
      hostedButtonId: string;
      onApprove?: (data: { orderID: string }) => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}