
import { enTranslations } from './en';
import { esTranslations } from './es';
import { Language, TranslationKeys } from './types';

export const translations: Record<Language, typeof enTranslations> = {
  en: enTranslations,
  es: esTranslations,
};

export * from './types';
