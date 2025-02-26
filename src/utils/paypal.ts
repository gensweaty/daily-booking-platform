
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...', { clientId });

  return new Promise((resolve, reject) => {
    try {
      if (!clientId) {
        throw new Error('PayPal client ID is required');
      }

      if (window.paypal) {
        console.log('PayPal SDK already loaded');
        return resolve();
      }

      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script...');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.crossOrigin = "anonymous";
      script.async = true;

      script.onload = () => {
        console.log('PayPal script loaded successfully');
        if (window.paypal) {
          resolve();
        } else {
          reject(new Error('PayPal SDK not initialized after script load'));
        }
      };

      script.onerror = (error) => {
        console.error('Error loading PayPal script:', error);
        reject(error);
      };

      console.log('Appending PayPal script to document body...');
      document.body.appendChild(script);
    } catch (error) {
      console.error('Error in loadPayPalScript:', error);
      reject(error);
    }
  });
};

export const renderPayPalButton = async (
  containerId: string,
  options: {
    planType: 'monthly' | 'yearly';
    amount: string;
  },
  onSuccess: (orderId: string) => void
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId, options });

  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
  }

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container ${containerId} not found`);
  }

  try {
    container.innerHTML = '';
    
    const buttons = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'pay'
      },
      createOrder: (_data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{
            amount: {
              value: options.amount,
              currency_code: 'USD'
            },
            description: `${options.planType} subscription`
          }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        console.log('Payment approved:', data);
        const order = await actions.order.capture();
        console.log('Payment captured:', order);
        onSuccess(order.id);
      }
    });
    
    await buttons.render(`#${containerId}`);
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
