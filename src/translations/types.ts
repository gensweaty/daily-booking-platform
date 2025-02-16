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
  
  // Dashboard
  "dashboard.totalTasks": string;
  "dashboard.inProgress": string;
  "dashboard.totalEvents": string;
  "dashboard.totalIncome": string;
  "dashboard.completed": string;
  "dashboard.todo": string;
  "dashboard.partlyPaid": string;
  "dashboard.fullyPaid": string;
  "dashboard.fromAllEvents": string;
  "dashboard.totalBookingsGrowth": string;
  "dashboard.threeMonthIncome": string;
  "dashboard.category": string;
  "dashboard.total": string;
  "dashboard.details": string;
  "dashboard.additionalInfo": string;
  "dashboard.taskStatistics": string;
  "dashboard.eventStatistics": string;
  "dashboard.financialSummary": string;
  "dashboard.summaryStatistics": string;
  "dashboard.eventsData": string;
  "dashboard.statistics": string;
  "dashboard.exportSuccessful": string;
  "dashboard.exportSuccessMessage": string;
  
  // Events
  "events.date": string;
  "events.time": string;
  "events.paymentAmount": string;
  
  // CRM
  "crm.error": string;
  "crm.noDataToExport": string;
  "crm.fullName": string;
  "crm.phoneNumber": string;
  "crm.socialLinkEmail": string;
  "crm.paymentStatus": string;
  "crm.comment": string;
  
  // Navigation
  "nav.signin": string;
  "nav.signup": string;
  "nav.contact": string;
  "nav.startJourney": string;

  // Hero Section
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

  // Smart Booking Calendar
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

  // Task Management
  "tasks.title": string;
  "tasks.description": string;
  "tasks.feature1": string;
  "tasks.feature2": string;
  "tasks.feature3": string;
  "tasks.feature4": string;
  "tasks.feature5": string;

  // CTA Section
  "cta.title": string;
  "cta.subtitle": string;
  "cta.button": string;

  // Footer
  "footer.description": string;
  "footer.navigation": string;
  "footer.legal": string;
  "footer.rights": string;

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
  "dashboard.statistics": string;
  "dashboard.exportSuccessful": string;
  "dashboard.exportSuccessMessage": string;

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
};

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationType) => string;
}
