export const loadPayPalScript = async (clientId: string): Promise<void> => {
  console.log('Starting PayPal script load...');
  
  if (!clientId) {
    console.error('PayPal client ID is required');
    throw new Error('PayPal client ID is required');
  }
  
  return new Promise((resolve, reject) => {
    try {
      const existingScript = document.getElementById('paypal-script');
      if (existingScript) {
        console.log('PayPal script already exists, removing...');
        existingScript.remove();
      }

      const script = document.createElement('script');
      script.id = 'paypal-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&vault=true&intent=subscription`;
      script.async = true;
      script.crossOrigin = "anonymous";

      script.addEventListener('load', () => {
        console.log('PayPal script loaded successfully');
        resolve();
      });

      script.addEventListener('error', (error) => {
        console.error('Error loading PayPal script:', error);
        reject(error);
      });

      document.body.appendChild(script);
    } catch (error) {
      console.error('Error in loadPayPalScript:', error);
      reject(error);
    }
  });
};