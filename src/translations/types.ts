
import { enTranslations } from './en';

export type Language = 'en' | 'es';
export type TranslationKeys = keyof typeof enTranslations;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}
