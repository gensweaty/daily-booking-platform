
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
      console.log('PayPal script loaded. Checking window.paypal...');
      setTimeout(() => {
        console.log('window.paypal:', window.paypal);
        if (window.paypal) {
          console.log('PayPal script loaded successfully');
          resolve();
        } else {
          console.error('PayPal script loaded but window.paypal is undefined');
          reject(new Error('PayPal SDK failed to initialize'));
        }
      }, 1000); // Add a delay to ensure PayPal initializes
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
    createSubscription: () => Promise<string>;
    onApprove: (data: { subscriptionID?: string }) => Promise<void>;
  }
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId });

  // Wait for PayPal SDK with retries
  let retries = 5;
  while (!window.paypal && retries > 0) {
    console.warn(`Waiting for PayPal SDK... (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries--;
  }

  if (!window.paypal) {
    throw new Error('PayPal SDK failed to load after retries');
  }

  console.log('Looking for container:', containerId);
  const container = document.getElementById(containerId);
  console.log('Container found:', container);

  if (!container) {
    throw new Error(`Container ${containerId} not found`);
  }

  try {
    // Use the hosted button ID based on plan type
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
