import { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";

export const usePayPalScript = () => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptError, setIsScriptError] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadScript = async () => {
      try {
        // Clean up any existing PayPal script
        const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
        if (existingScript) {
          existingScript.remove();
        }

        const scriptElement = document.createElement('script');
        scriptElement.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
        scriptElement.async = true;
        scriptElement.crossOrigin = "anonymous";
        
        scriptElement.onload = () => {
          setIsScriptLoaded(true);
        };

        scriptElement.onerror = (error) => {
          setIsScriptError(true);
          toast({
            title: "Error",
            description: "Failed to load payment system. Please try again.",
            variant: "destructive",
          });
          console.error('PayPal script loading error:', error);
        };

        document.body.appendChild(scriptElement);
      } catch (error) {
        console.error('Error in loadScript:', error);
        setIsScriptError(true);
      }
    };

    loadScript();

    return () => {
      const script = document.querySelector('script[src*="paypal.com/sdk/js"]');
      if (script) {
        script.remove();
      }
    };
  }, [toast]);

  return {
    isScriptLoaded,
    isScriptError,
    paypal: isScriptLoaded ? window.paypal : null,
  };
};