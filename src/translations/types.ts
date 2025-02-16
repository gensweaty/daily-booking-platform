
export type Language = 'en' | 'es';

export type TranslationType = {
  [K in keyof typeof import('./en').enTranslations]: string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
