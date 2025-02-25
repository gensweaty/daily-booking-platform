
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=subscription&vault=true`;
    script.async = true;

    script.onload = () => {
      if (window.paypal) {
        console.log('PayPal script loaded successfully');
        resolve();
      } else {
        console.error('PayPal script loaded but window.paypal is undefined');
        reject(new Error('PayPal SDK failed to initialize'));
      }
    };

    script.onerror = (error) => {
      console.error('Error loading PayPal script:', error);
      reject(error);
    };

    document.body.appendChild(script);
  });
};

export const renderPayPalButton = async (
  containerId: string,
  options: {
    createSubscription: () => Promise<string>;
    onApprove: (data: { subscriptionID?: string }) => Promise<void>;
  }
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId });

  // Wait for PayPal SDK with retry
  if (!window.paypal) {
    console.warn('PayPal SDK not loaded yet. Retrying in 500ms...');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!window.paypal) {
    throw new Error('PayPal SDK still not loaded');
  }

  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container ${containerId} not found`);
  }

  // Clear existing content
  container.innerHTML = '';

  try {
    const buttons = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'subscribe'
      },
      createSubscription: options.createSubscription,
      onApprove: options.onApprove
    });

    await buttons.render(container);
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
