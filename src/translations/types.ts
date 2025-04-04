
export type Language = 'en' | 'es';

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof TranslationType) => string;
}

export interface TranslationType {
  // Auth translations
  "auth.signIn": string;
  "auth.signUp": string;
  "auth.signOut": string;
  "auth.email": string;
  "auth.password": string;
  "auth.forgotPassword": string;
  "auth.resetPassword": string;
  "auth.confirmPassword": string;
  "auth.username": string;
  "auth.required": string;
  "auth.emailRequired": string;
  "auth.passwordRequired": string;
  "auth.usernameRequired": string;
  "auth.emailInvalid": string;
  "auth.passwordInvalid": string;
  "auth.usernameInvalid": string;
  "auth.passwordMin": string;
  "auth.usernameMin": string;
  "auth.passwordMatch": string;
  "auth.resetPasswordSuccess": string;
  "auth.resetPasswordError": string;
  "auth.confirmPasswordError": string;
  "auth.signInSuccess": string;
  "auth.signUpSuccess": string;
  "auth.signOutSuccess": string;
  "auth.resetLinkSent": string;
  "auth.goBack": string;
  "auth.welcome": string;
  "auth.description": string;
  "auth.signInButton": string;
  "auth.signUpButton": string;
  "auth.passwordsDoNotMatch": string;
  "auth.passwordTooShort": string;
  "auth.signingUp": string;
  "auth.backToSignIn": string;
  "auth.emailLabel": string;
  "auth.enterEmail": string;
  "auth.sending": string;
  "auth.sendResetLink": string;
  "auth.usernameLabel": string;
  "auth.passwordLabel": string;
  "auth.passwordRequirements": string;
  "auth.confirmPasswordLabel": string;

  // Task translations
  "tasks.addTask": string;
  "tasks.editTask": string;
  "tasks.deleteTask": string;
  "tasks.title": string;
  "tasks.description": string;
  "tasks.status": string;
  "tasks.todo": string;
  "tasks.inProgress": string;
  "tasks.done": string;
  "tasks.createdAt": string;
  "tasks.updatedAt": string;
  "tasks.submit": string;
  "tasks.cancel": string;
  "tasks.areYouSure": string;
  "tasks.confirmDelete": string;
  "tasks.taskDeleted": string;
  "tasks.taskUpdated": string;
  "tasks.taskAdded": string;
  "tasks.feature1": string;
  "tasks.feature2": string;
  "tasks.feature3": string;
  "tasks.feature4": string;
  "tasks.feature5": string;

  // Notes translations
  "notes.addNote": string;
  "notes.editNote": string;
  "notes.deleteNote": string;
  "notes.title": string;
  "notes.content": string;
  "notes.createdAt": string;
  "notes.updatedAt": string;
  "notes.submit": string;
  "notes.cancel": string;
  "notes.areYouSure": string;
  "notes.confirmDelete": string;
  "notes.noteDeleted": string;
  "notes.noteUpdated": string;
  "notes.noteAdded": string;

  // Reminders translations
  "reminders.addReminder": string;
  "reminders.editReminder": string;
  "reminders.deleteReminder": string;
  "reminders.title": string;
  "reminders.description": string;
  "reminders.dueDate": string;
  "reminders.createdAt": string;
  "reminders.updatedAt": string;
  "reminders.submit": string;
  "reminders.cancel": string;
  "reminders.areYouSure": string;
  "reminders.confirmDelete": string;
  "reminders.reminderDeleted": string;
  "reminders.reminderUpdated": string;
  "reminders.reminderAdded": string;

  // Dashboard translations
  "dashboard.welcome": string;
  "dashboard.tasks": string;
  "dashboard.notes": string;
  "dashboard.reminders": string;
  "dashboard.statistics": string;
  "dashboard.crm": string;
  "dashboard.bookingCalendar": string;
  "dashboard.addEvent": string;
  "dashboard.month": string;
  "dashboard.week": string;
  "dashboard.day": string;
  "dashboard.totalTasks": string;
  "dashboard.completed": string;
  "dashboard.inProgress": string;
  "dashboard.todo": string;
  "dashboard.totalEvents": string;
  "dashboard.partlyPaid": string;
  "dashboard.fullyPaid": string;
  "dashboard.totalIncome": string;
  "dashboard.fromAllEvents": string;
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
  "dashboard.changePassword": string;
  "dashboard.profile": string;
  "dashboard.signOut": string;
  "dashboard.subtitle": string;

  // Settings translations
  "settings.title": string;
  "settings.language": string;
  "settings.theme": string;
  "settings.light": string;
  "settings.dark": string;
  "settings.system": string;
  "settings.save": string;
  "settings.cancel": string;

  // Contact translations
  "contact.title": string;
  "contact.description": string;
  "contact.name": string;
  "contact.email": string;
  "contact.message": string;
  "contact.send": string;
  "contact.success": string;
  "contact.error": string;
  "contact.messageSent": string;
  "contact.messageSentDesc": string;
  "contact.errorDesc": string;
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

  // Legal translations
  "legal.title": string;
  "legal.termsOfService": string;
  "legal.privacyPolicy": string;

  // Events translations
  "events.addNewEvent": string;
  "events.editEvent": string;
  "events.title": string;
  "events.userSurname": string;
  "events.userNumber": string;
  "events.socialNetworkLink": string;
  "events.eventNotes": string;
  "events.startDate": string;
  "events.endDate": string;
  "events.type": string;
  "events.paymentStatus": string;
  "events.paymentAmount": string;
  "events.createEvent": string;
  "events.updateEvent": string;
  "events.deleteEvent": string;
  "events.attachment": string;
  "events.maxSize": string;
  "events.supportedFormats": string;
  "events.uploadFile": string;
  "events.selectFile": string;
  "events.customerDetails": string;
  "events.paymentDetails": string;
  "events.eventDetails": string;
  "events.noEvents": string;
  "events.noEventsMessage": string;
  "events.fullName": string;
  "events.phoneNumber": string;
  "events.socialLinkEmail": string;
  "events.date": string;
  "events.time": string;
  "events.fullNameRequired": string;
  "events.dateAndTime": string;
  "events.startDateTime": string;
  "events.endDateTime": string;
  "events.selectPaymentStatus": string;
  "events.addEventNotes": string;

  // Business translations
  "business.title": string;
  "business.create": string;
  "business.edit": string;
  "business.name": string;
  "business.description": string;
  "business.contactPhone": string;
  "business.contactAddress": string;
  "business.contactEmail": string;
  "business.contactWebsite": string;
  "business.coverPhoto": string;
  "business.uploadPhoto": string;
  "business.changePhoto": string;
  "business.save": string;
  "business.update": string;
  "business.delete": string;
  "business.deleteConfirm": string;
  "business.deleteWarning": string;
  "business.publicPage": string;
  "business.copyLink": string;
  "business.visit": string;
  "business.bookNow": string;
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

  // Event request translations
  "eventRequests.title": string;
  "eventRequests.pending": string;
  "eventRequests.noPending": string;
  "eventRequests.approve": string;
  "eventRequests.reject": string;
  "eventRequests.approved": string;
  "eventRequests.rejected": string;

  // Notifications translations
  "notifications.businessCreated": string;
  "notifications.businessUpdated": string;
  "notifications.businessDeleted": string;
  "notifications.coverPhotoUploaded": string;
  "notifications.eventRequestApproved": string;
  "notifications.eventRequestRejected": string;
  "notifications.bookingRequestSent": string;
  "notifications.urlCopied": string;

  // Error translations
  "errors.businessNotFound": string;
  "errors.businessNotFoundDesc": string;
  "errors.returnHome": string;
  
  // CRM translations
  "crm.notPaid": string;
  "crm.paidPartly": string;
  "crm.paidFully": string;
  "crm.title": string;
  "crm.editCustomer": string;
  "crm.newCustomer": string;
  "crm.cancel": string;
  "crm.update": string;
  "crm.create": string;
  "crm.fullNameRequired": string;
  "crm.fullNamePlaceholder": string;
  "crm.phoneNumber": string;
  "crm.phoneNumberPlaceholder": string;
  "crm.socialLinkEmail": string;
  "crm.socialLinkEmailPlaceholder": string;
  "crm.createEventForCustomer": string;
  "crm.paymentStatus": string;
  "crm.selectPaymentStatus": string;
  "crm.paymentAmount": string;
  "crm.paymentAmountPlaceholder": string;
  "crm.comment": string;
  "crm.commentPlaceholder": string;
  "crm.attachments": string;
  "crm.fullName": string;
  "crm.dates": string;
  "crm.yes": string;
  "crm.no": string;
  "crm.addCustomer": string;
  "crm.actions": string;
  "crm.description": string;
  "crm.feature1": string;
  "crm.feature2": string;
  "crm.feature3": string;
  "crm.feature4": string;
  "crm.feature5": string;
  "crm.noDataToExport": string;
  "crm.error": string;
  
  // Landing/marketing translations
  "cta.title": string;
  "cta.subtitle": string;
  "cta.button": string;
  "features.businessTitle": string;
  "features.title": string;
  "features.booking": string;
  "features.tasks": string;
  "features.crm": string;
  "features.analytics": string;
  "features.mainTitle": string;
  "booking.title": string;
  "booking.description": string;
  "booking.feature1": string;
  "booking.feature2": string;
  "booking.feature3": string;
  "booking.feature4": string;
  "analytics.title": string;
  "analytics.description": string;
  "analytics.feature1": string;
  "analytics.feature2": string;
  "analytics.feature3": string;
  "analytics.feature4": string;
  "analytics.feature5": string;
  "footer.termsAndPrivacy": string;
  "footer.description": string;
  "footer.navigation": string;
  "footer.legal": string;
  "footer.rights": string;
  "nav.signin": string;
  "nav.signup": string;
  "nav.startJourney": string;
  "nav.contact": string;
  "hero.title": string;
  "hero.subtitle": string;
  "hero.description": string;
}
