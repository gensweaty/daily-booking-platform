
import { translations as en } from './en';
import { translations as es } from './es';
import { translations as ka } from './ka';
import { Language, Translations } from './types';

export const translations: Record<Language, Translations> = {
  en,
  es,
  ka,
};

export * from './types';
