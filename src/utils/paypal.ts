
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...');

  return new Promise((resolve, reject) => {
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = () => {
      console.log('PayPal script loaded successfully');
      resolve();
    };

    script.onerror = (error) => {
      console.error('Error loading PayPal script:', error);
      reject(error);
    };

    console.log('Appending PayPal script to document body...');
    document.body.appendChild(script);
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
    const hostedButtonId = options.planType === 'monthly' ? 'SZHF9WLR5RQWU' : 'YOUR_YEARLY_BUTTON_ID';
    
    await window.paypal.HostedButtons({
      hostedButtonId: hostedButtonId
    }).render('#' + containerId);
    
    console.log('PayPal hosted button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
