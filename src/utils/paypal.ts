export const loadPayPalScript = (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...');
  
  return new Promise((resolve, reject) => {
    try {
      // Clean up any existing script
      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('Removing existing PayPal script');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=hosted-buttons&disable-funding=venmo&currency=USD`;
      script.async = true;
      script.crossOrigin = "anonymous";

      script.onload = () => {
        console.log('PayPal script loaded successfully');
        resolve();
      };

      script.onerror = (error) => {
        console.error('Failed to load PayPal script:', error);
        reject(new Error('Failed to load PayPal script'));
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
  buttonId: string,
  onSuccess: (data: { orderID: string }) => Promise<void>
): Promise<void> => {
  console.log('Rendering PayPal button...', { containerId, buttonId });
  
  try {
    if (!window.paypal) {
      throw new Error('PayPal SDK not loaded');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Clear existing content
    container.innerHTML = '';

    await window.paypal.HostedButtons({
      hostedButtonId: buttonId,
      onApprove: async (data: { orderID: string }) => {
        console.log('Payment approved:', data);
        await onSuccess(data);
      }
    }).render(`#${containerId}`);

    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};