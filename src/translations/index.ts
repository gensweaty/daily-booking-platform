
import en from './en';
import es from './es';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en,
  es,
} as const;

export * from './types';
