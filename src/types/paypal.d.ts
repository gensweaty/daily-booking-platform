declare interface Window {
  paypal: {
    HostedButtons: (config: {
      hostedButtonId: string;
      onApprove?: (data: { orderID: string }) => void;
      onCancel?: () => void;
      onError?: (err: any) => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}