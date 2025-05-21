
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
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&components=buttons&disable-funding=venmo&currency=USD`;
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
