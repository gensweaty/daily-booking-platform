
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '@/translations';
import { Language, LanguageContextType, TranslationDictionary } from '@/translations/types';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // Try to get from localStorage, default to 'en'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language');
      return saved && Object.keys(translations).includes(saved) ? (saved as Language) : 'en';
    }
    return 'en';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', language);
    }
  }, [language]);

  const t = (key: string): string => {
    if (!key) return '';
    
    try {
      // Split the key by dots to navigate the translations object
      const parts = key.split('.');
      
      // If no dots or only one part, return the key itself as fallback
      if (parts.length <= 1) {
        console.warn(`Invalid translation key format (missing section): ${key}`);
        return key;
      }
      
      // Get the section and the specific key
      const section = parts[0];
      const translationKey = parts[1];
      
      // Access the translation dictionary for the current language
      const translationDict = translations[language] as TranslationDictionary;
      
      // Check if the section exists in the dictionary
      if (!translationDict || !translationDict[section]) {
        console.warn(`Missing translation section: ${section} for language: ${language}`);
        return key;
      }
      
      // Get the translation from the section
      const sectionData = translationDict[section];
      if (!sectionData) {
        console.warn(`Section is undefined: ${section} for language: ${language}`);
        return key;
      }
      
      const translation = sectionData[translationKey];
      
      // If no translation found, return the key as fallback and log warning
      if (!translation) {
        console.warn(`Missing translation: ${key} for language: ${language}, section: ${section}, key: ${translationKey}`);
        return key;
      }
      
      return translation;
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
      return `/${language}/${path}`;
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
