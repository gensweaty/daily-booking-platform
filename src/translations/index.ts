
import { enTranslations } from './en';
import { esTranslations } from './es';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en: enTranslations,
  es: esTranslations,
} as const;

export * from './types';
