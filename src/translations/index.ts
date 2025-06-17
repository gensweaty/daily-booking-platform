
import { en } from './en';
import { translations as es } from './es';
import { translations as ka } from './ka';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en: en as TranslationType,
  es,
  ka,
};

export * from './types';
