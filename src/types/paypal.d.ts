declare interface Window {
  paypal: {
    Buttons: (config: {
      style?: {
        layout?: 'vertical' | 'horizontal';
        color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
        shape?: 'rect' | 'pill';
        label?: 'paypal' | 'checkout' | 'buynow' | 'pay' | 'subscribe';
      };
      createSubscription?: (data: any, actions: any) => Promise<any>;
      onApprove?: (data: any) => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}