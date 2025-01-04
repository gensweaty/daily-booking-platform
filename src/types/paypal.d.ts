declare interface Window {
  paypal: {
    Buttons: (config: {
      style?: {
        layout?: 'vertical' | 'horizontal';
        color?: 'gold' | 'blue' | 'silver' | 'white' | 'black';
        shape?: 'rect' | 'pill';
        label?: 'paypal' | 'checkout' | 'buynow' | 'pay';
      };
      createOrder: (data: any, actions: any) => Promise<string>;
      onApprove: (data: any, actions: any) => void;
      onError?: (err: any) => void;
    }) => {
      render: (containerId: string) => Promise<any>;
    };
  };
}