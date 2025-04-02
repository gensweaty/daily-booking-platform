
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/translations';
import { Language, LanguageContextType } from '@/translations/types';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    if (!key) return '';
    
    const keys = key.split('.');
    let result: any = translations[language];
    
    // Navigate through the translation object using the keys
    for (const k of keys) {
      if (!result || typeof result !== 'object') {
        console.warn(`Translation key not found: ${key}`);
        return key; // Return the key if we can't navigate further
      }
      result = result[k];
    }
    
    // Return the translated string or fallback to the key
    return typeof result === 'string' ? result : key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
