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
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
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
  buttonId: string,
  onSuccess: (data: any) => Promise<void>
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId, buttonId });
  
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
    await window.paypal.HostedButtons({
      hostedButtonId: buttonId,
      onApprove: async (data: any) => {
        console.log('Payment approved:', data);
        await onSuccess(data);
      },
      onError: (err: any) => {
        console.error('PayPal button error:', err);
        throw err;
      }
    }).render(`#${containerId}`);
    
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};