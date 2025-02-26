
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...', { clientId });
  console.log('Current PayPal SDK status:', window.paypal);

  return new Promise((resolve, reject) => {
    try {
      if (!clientId) {
        throw new Error('PayPal client ID is required');
      }

      // Check if PayPal is already loaded and working
      if (window.paypal?.Buttons) {
        console.log('PayPal SDK already loaded and functional');
        return resolve();
      }

      // Clean up any existing PayPal scripts
      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script...');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&currency=USD`;
      script.async = true;
      script.crossOrigin = "anonymous";

      // Add timeout for script loading
      const timeoutId = setTimeout(() => {
        clearInterval(retryLoadInterval);
        reject(new Error('PayPal script load timeout'));
      }, 20000); // 20 second timeout

      // Setup retry interval to check for PayPal SDK
      const retryLoadInterval = setInterval(() => {
        console.log('Checking PayPal SDK status:', window.paypal);
        if (window.paypal?.Buttons) {
          console.log('PayPal SDK detected through retry check');
          clearInterval(retryLoadInterval);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 1000);

      script.onload = () => {
        console.log('PayPal script onload triggered');
        console.log('PayPal SDK status after load:', window.paypal);
        
        // Give the SDK a moment to initialize
        setTimeout(() => {
          if (window.paypal?.Buttons) {
            console.log('PayPal SDK initialized successfully');
            clearInterval(retryLoadInterval);
            clearTimeout(timeoutId);
            resolve();
          }
        }, 1000);
      };

      script.onerror = (error) => {
        clearInterval(retryLoadInterval);
        clearTimeout(timeoutId);
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
  onSuccess: (data: any) => void
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId, options });
  console.log('Current PayPal SDK status:', window.paypal);

  // Verify PayPal SDK is loaded
  if (!window.paypal?.Buttons) {
    console.error('PayPal SDK not loaded or not functional. Retrying in 3 seconds...');
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          await renderPayPalButton(containerId, options, onSuccess);
          resolve();
        } catch (error) {
          console.error('Retry failed:', error);
        }
      }, 3000);
    });
  }

  // Verify container exists
  const container = document.getElementById(containerId);
  console.log('Container check:', container);
  console.log('Current document body:', document.body.innerHTML);
  
  if (!container) {
    throw new Error(`Container #${containerId} not found. Current HTML: ${document.body.innerHTML}`);
  }

  try {
    console.log('Creating PayPal buttons...');
    const PayPalButtons = await window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'blue',
        shape: 'rect',
        label: 'paypal'
      },
      createOrder: async (_data: any, actions: any) => {
        console.log('Creating PayPal order for amount:', options.amount);
        try {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: options.amount,
                currency_code: 'USD'
              },
              description: `${options.planType} subscription`
            }]
          });
        } catch (error) {
          console.error('Error creating PayPal order:', error);
          throw error;
        }
      },
      onApprove: async (data: any, actions: any) => {
        console.log('PayPal order approved:', data);
        try {
          const orderDetails = await actions.order.capture();
          console.log('PayPal order captured:', orderDetails);
          onSuccess(data);
        } catch (error) {
          console.error('PayPal capture failed:', error);
          throw error;
        }
      }
    });

    // Verify buttons were created successfully
    console.log('PayPal buttons created:', PayPalButtons);
    if (!PayPalButtons) {
      throw new Error('Failed to create PayPal buttons');
    }

    console.log('Rendering PayPal buttons to container:', containerId);
    await PayPalButtons.render(`#${containerId}`);
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Failed to render PayPal button:', error);
    throw error;
  }
};
