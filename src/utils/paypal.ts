
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
      script.src = `https://www.paypal.com/sdk/js?client-id=BAAlwpFrqvuXEZGXZH7jc6dlt2dJ109CJK2FBo79HD8OaKcGL5Qr8FQilvteW7BkjgYo9Jah5aXcRICk3Q&components=hosted-buttons&disable-funding=venmo&currency=USD`;
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
  }
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
    // Using specific container ID format required by PayPal
    const paypalContainerId = `paypal-container-SZHF9WLR5RQWU`;
    container.id = paypalContainerId;

    await window.paypal.HostedButtons({
      hostedButtonId: 'SZHF9WLR5RQWU'
    }).render(`#${paypalContainerId}`);
    
    console.log('PayPal hosted button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
