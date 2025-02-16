
export type Language = 'en' | 'es';

type CalendarMonths = {
  january: string;
  february: string;
  march: string;
  april: string;
  may: string;
  june: string;
  july: string;
  august: string;
  september: string;
  october: string;
  november: string;
  december: string;
};

type CalendarWeekdays = {
  sunday: string;
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
};

export type TranslationType = {
  [K in keyof typeof import('./en').enTranslations]: 
    K extends 'calendar.months' ? CalendarMonths :
    K extends 'calendar.weekdays' ? CalendarWeekdays :
    string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
