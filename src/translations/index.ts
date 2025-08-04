
import { en } from './en';
import { es } from './es';
import { ka } from './ka';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en: en as TranslationType,
  es: es as TranslationType,
  ka: ka as TranslationType,
};

export * from './types';
