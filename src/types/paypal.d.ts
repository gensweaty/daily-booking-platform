declare interface Window {
  paypal: {
    Buttons: (config: {
      style?: {
        layout?: string;
        color?: string;
        shape?: string;
        label?: string;
      };
      createSubscription?: (data: any, actions: any) => Promise<any>;
      onApprove?: (data: any) => void;
      onError?: (err: any) => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}