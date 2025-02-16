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

  // Auth related translations
  "auth.welcome": string;
  "auth.description": string;
  "auth.signInButton": string;
  "auth.signUpButton": string;
  "auth.emailLabel": string;
  "auth.passwordLabel": string;
  "auth.usernameLabel": string;
  "auth.passwordsDoNotMatch": string;
  "auth.passwordTooShort": string;
  "auth.forgotPassword": string;
  "auth.loading": string;
  "auth.signingUp": string;
  "auth.resetLinkSent": string;
  "auth.resetLinkSentDescription": string;
  "auth.backToSignIn": string;
  "auth.resetPassword": string;
  "auth.enterEmail": string;
  "auth.sending": string;
  "auth.sendResetLink": string;
  "auth.passwordRequirements": string;
  "auth.confirmPasswordLabel": string;

  // Calendar & Events
  "events.editEvent": string;
  "events.addNewEvent": string;
  "events.updateEvent": string;
  "events.createEvent": string;
  "events.fullNameRequired": string;
  "events.fullName": string;
  "events.phoneNumber": string;
  "events.socialLinkEmail": string;
  "events.paymentStatus": string;
  "events.selectPaymentStatus": string;
  "events.paymentAmount": string;
  "events.eventNotes": string;
  "events.addEventNotes": string;
  "events.attachment": string;
  "events.maxSize": string;
  "events.supportedFormats": string;

  // Dashboard
  "dashboard.month": string;
  "dashboard.week": string;
  "dashboard.day": string;
  "dashboard.addEvent": string;
  "dashboard.bookingCalendar": string;
  "dashboard.statistics": string;
  "dashboard.tasks": string;
  "dashboard.crm": string;

  // CTA Section
  "cta.title": string;
  "cta.subtitle": string;
  "cta.button": string;

  // Business
  "business.events": string;
  "business.eventsDesc": string;
  "business.health": string;
  "business.healthDesc": string;
  "business.sports": string;
  "business.sportsDesc": string;
  "business.beauty": string;
  "business.beautyDesc": string;
  "business.personal": string;
  "business.personalDesc": string;
  "business.education": string;
  "business.educationDesc": string;

  // Features
  "features.businessTitle": string;

  // Contact Additional
  "contact.messageSent": string;
  "contact.messageSentDesc": string;
  "contact.getInTouch": string;
  "contact.contactInfo": string;
  "contact.phone": string;
  "contact.address": string;
  "contact.addressLine1": string;
  "contact.addressLine2": string;
  "contact.businessHours": string;
  "contact.workingHours": string;
  "contact.weekendHours": string;
  "contact.sendMessage": string;
  "contact.namePlaceholder": string;
  "contact.emailPlaceholder": string;
  "contact.messagePlaceholder": string;
  "contact.sending": string;

  // Legal
  "legal.termsAndPrivacy": string;
  "legal.lastUpdated": string;
  "legal.termsTitle": string;
  "legal.termsIntro": string;
  "legal.generalInfo": string;
  "legal.companyName": string;
  "legal.companyRegistered": string;
  "legal.contactEmail": string;
  "legal.eligibility": string;
  "legal.eligibilityText": string;
  "legal.accountTitle": string;
  "legal.accountInfo": string;
  "legal.accountSecurity": string;
  "legal.accountNotify": string;
  "legal.acceptableUseTitle": string;
  "legal.acceptableUse1": string;
  "legal.acceptableUse2": string;
  "legal.acceptableUse3": string;
  "legal.paymentsTitle": string;
  "legal.payments1": string;
  "legal.payments2": string;
  "legal.payments3": string;
  "legal.privacyTitle": string;
  "legal.privacyIntro": string;
  "legal.infoCollectTitle": string;
  "legal.infoCollectIntro": string;
  "legal.infoCollect1": string;
  "legal.infoCollect2": string;
  "legal.infoCollect3": string;
  "legal.dataUseTitle": string;
  "legal.dataUseIntro": string;
  "legal.dataUse1": string;
  "legal.dataUse2": string;
  "legal.dataUse3": string;
  "legal.dataUse4": string;
  "legal.dataRightsTitle": string;
  "legal.dataRightsIntro": string;
  "legal.dataRights1": string;
  "legal.dataRights2": string;
  "legal.dataRights3": string;
  "legal.dataRights4": string;
  "legal.contactUs": string;
  "legal.contactUsText": string;
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
