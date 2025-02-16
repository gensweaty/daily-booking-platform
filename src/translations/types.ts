
export type Language = 'en' | 'es';

export type TranslationType = {
  [K in keyof typeof import('./en').enTranslations]: string;
} & {
  // Dashboard translations
  "dashboard.category": string;
  "dashboard.taskStatistics": string;
  "dashboard.total": string;
  "dashboard.details": string;
  "dashboard.additionalInfo": string;
  "dashboard.eventStatistics": string;
  "dashboard.financialSummary": string;
  "dashboard.summaryStatistics": string;
  "dashboard.eventsData": string;
  "dashboard.exportSuccessful": string;
  "dashboard.exportSuccessMessage": string;
  
  // Events translations
  "events.date": string;
  "events.time": string;
  
  // CRM translations
  "crm.error": string;
  "crm.noDataToExport": string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
