
import { translations as en } from './en';
import { translations as es } from './es';
import translations as ka from './ka';
import { Language, TranslationType } from './types';

export const translations: Record<Language, TranslationType> = {
  en,
  es,
  ka,
};

export * from './types';
