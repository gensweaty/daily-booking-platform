
export type Language = 'en' | 'es';

export type TranslationType = {
  // Navigation
  "nav.signin": string;
  "nav.signup": string;
  "nav.contact": string;
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
  "features.businessTitle": string;
  
  // Dashboard
  "dashboard.welcome": string;
  "dashboard.subtitle": string;
  "dashboard.bookingCalendar": string;
  "dashboard.statistics": string;
  "dashboard.tasks": string;
  "dashboard.crm": string;
  "dashboard.month": string;
  "dashboard.week": string;
  "dashboard.day": string;
  "dashboard.addEvent": string;
  "dashboard.editEvent": string;
  "dashboard.totalTasks": string;
  "dashboard.inProgress": string;
  "dashboard.totalEvents": string;
  "dashboard.totalIncome": string;
  "dashboard.fromAllEvents": string;
  "dashboard.completed": string;
  "dashboard.todo": string;
  "dashboard.partlyPaid": string;
  "dashboard.fullyPaid": string;
  "dashboard.totalBookingsGrowth": string;
  "dashboard.threeMonthIncome": string;
  "dashboard.bookingDates": string;
  "dashboard.months": string;
  "dashboard.income": string;
  "dashboard.signOut": string;
  "dashboard.profile": string;
  "dashboard.changePassword": string;
  "dashboard.category": string;
  "dashboard.total": string;
  "dashboard.details": string;
  "dashboard.additionalInfo": string;
  "dashboard.taskStatistics": string;
  "dashboard.eventStatistics": string;
  "dashboard.financialSummary": string;
  "dashboard.summaryStatistics": string;
  "dashboard.eventsData": string;
  "dashboard.exportSuccessful": string;
  "dashboard.exportSuccessMessage": string;

  // Events
  "events.addNewEvent": string;
  "events.editEvent": string;
  "events.fullNameRequired": string;
  "events.fullName": string;
  "events.phoneNumber": string;
  "events.socialLinkEmail": string;
  "events.paymentStatus": string;
  "events.selectPaymentStatus": string;
  "events.eventNotes": string;
  "events.addEventNotes": string;
  "events.attachment": string;
  "events.chooseFile": string;
  "events.noFileChosen": string;
  "events.createEvent": string;
  "events.updateEvent": string;
  "events.paymentAmount": string;
  "events.maxSize": string;
  "events.supportedFormats": string;
  "events.date": string;
  "events.time": string;

  // CRM
  "crm.title": string;
  "crm.description": string;
  "crm.feature1": string;
  "crm.feature2": string;
  "crm.feature3": string;
  "crm.feature4": string;
  "crm.feature5": string;
  "crm.customers": string;
  "crm.addCustomer": string;
  "crm.fullName": string;
  "crm.phoneNumber": string;
  "crm.socialLinkEmail": string;
  "crm.paymentStatus": string;
  "crm.dates": string;
  "crm.comment": string;
  "crm.attachments": string;
  "crm.newCustomer": string;
  "crm.createEventForCustomer": string;
  "crm.selectPaymentStatus": string;
  "crm.addComment": string;
  "crm.create": string;
  "crm.cancel": string;
  "crm.open": string;
  "crm.search": string;
  "crm.error": string;
  "crm.noDataToExport": string;

  // Calendar
  "calendar.today": string;
  "calendar.clear": string;
  "calendar.month.january": string;
  "calendar.month.february": string;
  "calendar.month.march": string;
  "calendar.month.april": string;
  "calendar.month.may": string;
  "calendar.month.june": string;
  "calendar.month.july": string;
  "calendar.month.august": string;
  "calendar.month.september": string;
  "calendar.month.october": string;
  "calendar.month.november": string;
  "calendar.month.december": string;
  "calendar.weekday.sunday": string;
  "calendar.weekday.monday": string;
  "calendar.weekday.tuesday": string;
  "calendar.weekday.wednesday": string;
  "calendar.weekday.thursday": string;
  "calendar.weekday.friday": string;
  "calendar.weekday.saturday": string;
  "calendar.am": string;
  "calendar.pm": string;

  // Contact Page
  "contact.getInTouch": string;
  "contact.contactInfo": string;
  "contact.email": string;
  "contact.phone": string;
  "contact.address": string;
  "contact.addressLine1": string;
  "contact.addressLine2": string;
  "contact.businessHours": string;
  "contact.workingHours": string;
  "contact.weekendHours": string;
  "contact.sendMessage": string;
  "contact.name": string;
  "contact.namePlaceholder": string;
  "contact.emailPlaceholder": string;
  "contact.message": string;
  "contact.messagePlaceholder": string;
  "contact.send": string;
  "contact.sending": string;
  "contact.messageSent": string;
  "contact.messageSentDesc": string;
  "contact.error": string;
  "contact.errorDesc": string;

  // Auth
  "auth.welcome": string;
  "auth.description": string;
  "auth.emailLabel": string;
  "auth.passwordLabel": string;
  "auth.passwordRequirements": string;
  "auth.confirmPasswordLabel": string;
  "auth.usernameLabel": string;
  "auth.forgotPassword": string;
  "auth.signInButton": string;
  "auth.signUpButton": string;
  "auth.backToSignIn": string;
  "auth.resetPassword": string;
  "auth.sendResetLink": string;
  "auth.sending": string;
  "auth.enterEmail": string;
  "auth.resetLinkSent": string;
  "auth.resetLinkSentDescription": string;
  "auth.passwordsDoNotMatch": string;
  "auth.passwordTooShort": string;
  "auth.signingUp": string;
  "auth.loading": string;

  // Footer
  "footer.description": string;
  "footer.navigation": string;
  "footer.legal": string;
  "footer.rights": string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
