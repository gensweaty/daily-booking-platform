
import { Translations } from "./index";

export type Language = "en" | "es";

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  getLocalizedPath: (path: string) => string;
}

export type TranslationKey = keyof Translations;
