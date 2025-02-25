
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
      createSubscription: async () => {
        try {
          console.log('Creating subscription...', { options });
          const response = await fetch('https://mrueqpffzauvdxmuwhfa.supabase.co/functions/v1/create-paypal-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              plan_type: options.planType,
              amount: options.amount
            })
          });
          console.log('Response status:', response.status);
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Subscription creation failed:', errorData);
            throw new Error('Failed to create subscription');
          }

          const data = await response.json();
          console.log('Subscription API response:', data);
          return data.subscriptionId;
        } catch (error) {
          console.error('Error in createSubscription:', error);
          throw error;
        }
      },
      onApprove: options.onApprove
    });

    await buttons.render(container);
    console.log('PayPal button rendered successfully');
  } catch (error) {
    console.error('Error rendering PayPal button:', error);
    throw error;
  }
};
