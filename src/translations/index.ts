
import { Language, Translations } from './types';
import { enTranslations } from './en';
import { esTranslations } from './es';

export const translations: Record<Language, Translations> = {
  en: enTranslations,
  es: esTranslations,
};

export const getTranslation = (language: Language, key: string) => {
  const keys = key.split('.');
  let result: any = translations[language];

  for (const k of keys) {
    if (result && result[k]) {
      result = result[k];
    } else {
      return key; // Return the key if translation not found
    }
  }

  return typeof result === 'string' ? result : key;
};
