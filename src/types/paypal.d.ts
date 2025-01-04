declare interface Window {
  paypal: {
    HostedButtons: (config: { hostedButtonId: string }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}