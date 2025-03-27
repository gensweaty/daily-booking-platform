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
    return translations[language][key] || key;
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
