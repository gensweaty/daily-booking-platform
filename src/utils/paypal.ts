
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...', { clientId });

  return new Promise((resolve, reject) => {
    try {
      if (!clientId) {
        throw new Error('PayPal client ID is required');
      }

      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script...');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
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
    
    await window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
      },
      createOrder: async (_data: any, actions: any) => {
        console.log('Creating order for amount:', options.amount);
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
        console.log('Order approved:', data);
        try {
          const orderDetails = await actions.order.capture();
          console.log('Order captured:', orderDetails);
          onSuccess(orderDetails.id);
        } catch (error) {
          console.error('Capture failed:', error);
          throw error;
        }
      }
    }).render(`#${containerId}`);
    
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Failed to render PayPal button:', error);
    throw error;
  }
};
