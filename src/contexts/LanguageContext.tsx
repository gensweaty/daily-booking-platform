
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/translations';
import { Language, LanguageContextType, TranslationDictionary } from '@/translations/types';

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
    
    // Split the key by dots to navigate the translations object
    const parts = key.split('.');
    if (parts.length === 1) return key; // If no dots, return the key itself
    
    try {
      // Get the section and the specific key
      const section = parts[0];
      const translationKey = parts[1];
      
      // Access the translation
      const translationDict = translations[language] as unknown as TranslationDictionary;
      if (!translationDict[section]) return key;
      
      return translationDict[section][translationKey] || key;
    } catch (error) {
      console.error(`Translation error for key: ${key}`, error);
      return key;
    }
  };

  const getLocalizedPath = (path: string): string => {
    if (language !== 'en') {
      if (path.startsWith('/')) {
        return `/${language}${path}`;
      }
      return `${language}/${path}`;
    }
    return path;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, getLocalizedPath }}>
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
