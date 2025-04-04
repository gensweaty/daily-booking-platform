
import { enTranslations } from './en';
import { esTranslations } from './es';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en: enTranslations as unknown as TranslationType,
  es: esTranslations as unknown as TranslationType,
} as const;

export * from './types';
