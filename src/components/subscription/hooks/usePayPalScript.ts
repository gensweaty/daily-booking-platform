import { useEffect, useState } from 'react';

// Remove global declaration since it's already defined in paypal.d.ts
export const usePayPalScript = () => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptError, setIsScriptError] = useState(false);

  useEffect(() => {
    const loadScript = async () => {
      try {
        if (!window.paypal) {
          const script = document.createElement('script');
          script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
          script.async = true;
          
          script.onload = () => {
            console.log('PayPal script loaded successfully');
            setIsScriptLoaded(true);
          };
          
          script.onerror = () => {
            console.error('Failed to load PayPal script');
            setIsScriptError(true);
          };
          
          document.body.appendChild(script);
        } else {
          setIsScriptLoaded(true);
        }
      } catch (error) {
        console.error('Error loading PayPal script:', error);
        setIsScriptError(true);
      }
    };

    loadScript();
  }, []);

  return {
    paypal: window.paypal,
    isScriptLoaded,
    isScriptError
  };
};