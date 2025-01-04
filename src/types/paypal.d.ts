interface PayPalHostedButtonsComponent {
  render: (containerId: string) => Promise<any>;
}

interface PayPalHostedButtonsConfig {
  hostedButtonId: string;
}

interface PayPalNamespace {
  HostedButtons: (config: PayPalHostedButtonsConfig) => PayPalHostedButtonsComponent;
}

interface Window {
  paypal?: PayPalNamespace;
}