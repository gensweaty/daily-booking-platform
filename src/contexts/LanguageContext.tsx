
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/translations';
import { Language, LanguageContextType } from '@/translations/types';
import { getCurrencySymbol } from '@/lib/currency'; // Import the centralized currency function

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('[DEBUG] LanguageProvider rendering');
  
  const [language, setLanguage] = useState<Language>(() => {
    console.log('[DEBUG] LanguageProvider initializing state');
    
    try {
      // Try to get language from URL first
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      if (urlLang && ['en', 'es', 'ka'].includes(urlLang)) {
        localStorage.setItem('language', urlLang as Language);
        console.log('[DEBUG] Language set from URL:', urlLang);
        return urlLang as Language;
      }
      
      // Then try localStorage
      const saved = localStorage.getItem('language');
      if (saved && ['en', 'es', 'ka'].includes(saved)) {
        console.log('[DEBUG] Language set from localStorage:', saved);
        return saved as Language;
      }
      
      // Default to 'en'
      console.log('[DEBUG] Language set to default: en');
      return 'en';
    } catch (error) {
      console.error('[DEBUG] Error initializing language:', error);
      return 'en';
    }
  });

  useEffect(() => {
    console.log('[DEBUG] LanguageProvider useEffect triggered, language:', language);
    
    try {
      localStorage.setItem('language', language);
      
      // Update URL without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.set('lang', language);
      window.history.replaceState({}, '', url);
      
      // Update the lang attribute on the HTML element
      document.documentElement.setAttribute('lang', language);
      
      // Add logging for debugging purposes
      console.log(`Language context updated to: ${language}`);
    } catch (error) {
      console.error('[DEBUG] Error in LanguageProvider useEffect:', error);
    }
  }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    if (!key) return '';
    
    try {
      const keys = key.split('.');
      let result: any = translations[language];
      
      // Navigate through the translation object using the keys
      for (const k of keys) {
        if (!result || typeof result !== 'object') {
          console.warn(`Translation key not found: ${key} (at ${k})`);
          return key.split('.').pop() || key; // Return last part of key as fallback
        }
        result = result[k];
      }
      
      // Return the translated string or fallback to the key
      if (typeof result === 'string') {
        // Handle parameter replacement with double curly braces
        if (params) {
          return Object.entries(params).reduce((str, [param, value]) => {
            return str.replace(new RegExp(`{{${param}}}`, 'g'), String(value));
          }, result);
        }
        return result;
      } else {
        console.warn(`Translation missing for key: ${key}`);
        return key.split('.').pop() || key; // Return last part of key as fallback
      }
    } catch (error) {
      console.error(`Error getting translation for key: ${key}`, error);
      return key.split('.').pop() || key; // Return last part of key as fallback
    }
  };

  const contextValue = React.useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language]);

  console.log('[DEBUG] LanguageProvider providing context:', contextValue);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  console.log('[DEBUG] useLanguage called, context:', context);
  if (context === undefined) {
    console.error('[DEBUG] useLanguage called outside of provider! Stack:', new Error().stack);
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Export getCurrencySymbol directly for convenience
export { getCurrencySymbol };
