import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";

export const usePayPalScript = (containerId: string) => {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isScriptError, setIsScriptError] = useState(false);
  const mountedRef = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadScript = () => {
    // Clean up any existing PayPal script
    const existingScript = document.querySelector('script[src*="paypal.com/sdk/js"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Clean up the container
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    const scriptElement = document.createElement('script');
    scriptElement.src = "https://www.paypal.com/sdk/js?client-id=ATm58Iv3bVdLcUIVllc-on6VZRaRJeedpxso0KgGVu_kSELKrKOqaE63a8CNu-jIQ4ulE2j9WUkLASlY&vault=true&intent=subscription";
    scriptElement.async = true;
    scriptElement.crossOrigin = "anonymous";
    
    return new Promise<void>((resolve, reject) => {
      scriptElement.onload = () => {
        if (!mountedRef.current) return;
        setIsScriptLoaded(true);
        resolve();
      };

      scriptElement.onerror = (error) => {
        if (!mountedRef.current) return;
        setIsScriptError(true);
        toast({
          title: "Error",
          description: "Failed to load payment system. Please try again.",
          variant: "destructive",
        });
        reject(error);
      };

      document.body.appendChild(scriptElement);
    });
  };

  return {
    isScriptLoaded,
    isScriptError,
    loadScript,
  };
};