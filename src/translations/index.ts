
import { en } from './en';
import { es } from './es';
import { ka } from './ka';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en,
  es,
  ka,
};

export * from './types';
