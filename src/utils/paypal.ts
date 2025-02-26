
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
        label: 'paypal'
      },
      createOrder: async function(data: any, actions: any) {
        console.log('Creating PayPal order...');
        return await actions.order.create({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'USD',
              value: options.amount
            },
            description: `${options.planType} subscription`
          }]
        });
      },
      onApprove: async function(data: any, actions: any) {
        try {
          console.log('Payment approved, capturing order...', data);
          const orderDetails = await actions.order.capture();
          console.log('Order captured successfully:', orderDetails);
          onSuccess(orderDetails.id);
        } catch (error) {
          console.error('Error capturing order:', error);
          throw error;
        }
      },
      onError: function(err: any) {
        console.error('PayPal button error:', err);
        throw err;
      }
    });

    console.log('PayPal button configuration created, rendering...');
    await buttons.render(`#${containerId}`);
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
