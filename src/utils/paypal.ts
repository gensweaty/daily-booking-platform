
export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...');
  
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('paypal-script');
    if (existingScript) {
      console.log('PayPal script already exists, removing...');
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'paypal-script';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=subscription&vault=true`;
    script.async = true;

    script.onload = () => {
      console.log('PayPal script loaded successfully');
      resolve();
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
  
  if (!window.paypal) {
    throw new Error('PayPal SDK not loaded');
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
