
export type Language = 'en' | 'es';

export type TranslationType = {
  // Nav
  "nav.home": string;
  "nav.features": string;
  "nav.contact": string;
  "nav.login": string;
  "nav.signup": string;
  "nav.dashboard": string;
  "nav.signin": string;
  "nav.startJourney": string;

  // Hero
  "hero.title": string;
  "hero.subtitle": string;
  "hero.description": string;

  // Features
  "features.title": string;
  "features.mainTitle": string;
  "features.booking": string;
  "features.tasks": string;
  "features.crm": string;
  "features.analytics": string;

  // Booking
  "booking.title": string;
  "booking.description": string;
  "booking.feature1": string;
  "booking.feature2": string;
  "booking.feature3": string;
  "booking.feature4": string;

  // Analytics
  "analytics.title": string;
  "analytics.description": string;
  "analytics.feature1": string;
  "analytics.feature2": string;
  "analytics.feature3": string;
  "analytics.feature4": string;
  "analytics.feature5": string;

  // Tasks
  "tasks.title": string;
  "tasks.description": string;
  "tasks.feature1": string;
  "tasks.feature2": string;
  "tasks.feature3": string;
  "tasks.feature4": string;
  "tasks.feature5": string;

  // Dashboard
  "dashboard.welcome": string;
  "dashboard.subtitle": string;
  "dashboard.profile": string;
  "dashboard.signOut": string;
  "dashboard.changePassword": string;
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
  "dashboard.taskSummary": string;
  "dashboard.progressSummary": string;
  "dashboard.eventSummary": string;
  "dashboard.completed": string;
  "dashboard.todo": string;
  "dashboard.partlyPaid": string;
  "dashboard.fullyPaid": string;
  "dashboard.totalTasks": string;
  "dashboard.inProgress": string;
  "dashboard.totalEvents": string;
  "dashboard.totalIncome": string;
  "dashboard.fromAllEvents": string;

  // Contact
  "contact.title": string;
  "contact.description": string;
  "contact.name": string;
  "contact.email": string;
  "contact.message": string;
  "contact.send": string;
  "contact.success": string;
  "contact.error": string;
  "contact.errorDesc": string;

  // Footer
  "footer.copyright": string;
  "footer.terms": string;
  "footer.privacy": string;
  "footer.navigation": string;
  "footer.legal": string;
  "footer.rights": string;
  "footer.description": string;

  // Events
  "events.date": string;
  "events.time": string;

  // CRM
  "crm.error": string;
  "crm.noDataToExport": string;
  "crm.title": string;
  "crm.description": string;
  "crm.feature1": string;
  "crm.feature2": string;
  "crm.feature3": string;
  "crm.feature4": string;
  "crm.feature5": string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
