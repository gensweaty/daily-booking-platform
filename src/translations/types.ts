
export type Language = 'en' | 'es';

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  getLocalizedPath: (path: string) => string;
}

// Define the shape of our translations to help with type checking
export interface TranslationDictionary {
  common: Record<string, string>;
  nav: Record<string, string>;
  hero: Record<string, string>;
  features: Record<string, string>;
  businessTypes: Record<string, string>;
  dashboard: Record<string, string>;
  auth: Record<string, string>;
  calendar: Record<string, string>;
  tasks: Record<string, string>;
  notes: Record<string, string>;
  businessSettings: Record<string, string>;
  events: Record<string, string>;
  errors: Record<string, string>;
  [key: string]: Record<string, string>;
}
