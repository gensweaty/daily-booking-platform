
export type Language = 'en' | 'es';

export type TranslationKeys = keyof typeof import('./en').enTranslations;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}
