
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...', { clientId });

  return new Promise((resolve, reject) => {
    try {
      if (!clientId) {
        throw new Error('PayPal client ID is required');
      }

      // Clean up existing PayPal instance if it exists
      // @ts-ignore
      if (window.paypal) {
        // @ts-ignore
        delete window.paypal;
      }

      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script...');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
      script.crossOrigin = "anonymous";
      script.async = true;

      let timeoutId: NodeJS.Timeout;

      script.onload = () => {
        clearTimeout(timeoutId);
        console.log('PayPal script loaded successfully');
        // @ts-ignore
        if (window.paypal) {
          resolve();
        } else {
          reject(new Error('PayPal SDK not initialized after script load'));
        }
      };

      script.onerror = (error) => {
        clearTimeout(timeoutId);
        console.error('Error loading PayPal script:', error);
        reject(error);
      };

      // Set a timeout for script loading
      timeoutId = setTimeout(() => {
        reject(new Error('PayPal script load timeout'));
      }, 10000); // 10 second timeout

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

  // @ts-ignore
  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
  }

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container ${containerId} not found`);
  }

  try {
    // Clean up any existing PayPal buttons
    container.innerHTML = '<div id="paypal-container-SZHF9WLR5RQWU"></div>';
    
    // @ts-ignore
    const instance = await window.paypal.HostedButtons({
      hostedButtonId: 'SZHF9WLR5RQWU',
      onApprove: function(data: { orderID: string }) {
        console.log('PayPal payment approved:', data);
        if (data.orderID) {
          onSuccess(data.orderID);
        }
      }
    });

    await instance.render('#paypal-container-SZHF9WLR5RQWU');
    
    console.log('PayPal hosted button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
