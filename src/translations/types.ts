
export type Language = 'en' | 'es';

export interface TranslationKey {
  [key: string]: string | TranslationKey;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

export interface Translations {
  common: {
    save: string;
    cancel: string;
    edit: string;
    delete: string;
    create: string;
    loading: string;
    error: string;
    success: string;
  };
  auth: {
    signIn: string;
    signUp: string;
    signOut: string;
    email: string;
    password: string;
    forgotPassword: string;
    resetPassword: string;
  };
  dashboard: {
    title: string;
    welcome: string;
    bookingCalendar: string;
    statistics: string;
    tasks: string;
    crm: string;
    month: string;
    week: string;
    day: string;
    addEvent: string;
    exportSuccessful: string;
    exportSuccessMessage: string;
    category: string;
    total: string;
    details: string;
    additionalInfo: string;
    taskStatistics: string;
    eventStatistics: string;
    financialSummary: string;
    totalIncome: string;
    fromAllEvents: string;
    summaryStatistics: string;
    eventsData: string;
    completed: string;
    inProgress: string;
    todo: string;
    partlyPaid: string;
    fullyPaid: string;
  };
  business: {
    myBusiness: string;
    addBusiness: string;
    businessDetails: string;
    businessName: string;
    businessDescription: string;
    contactInformation: string;
    contactPhone: string;
    contactAddress: string;
    contactEmail: string;
    contactWebsite: string;
    coverPhoto: string;
    noBusiness: string;
    addBusinessPrompt: string;
    unconfirmedEvents: string;
    approve: string;
    bookNow: string;
    error: string;
    errorLoadingBusiness: string;
    bookingRequest: string;
    pendingBooking: string;
    unconfirmedBooking: string;
    publicPage: string;
  };
  events: {
    title: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    addNewEvent: string;
    editEvent: string;
    clientName: string;
    contactNumber: string;
    socialMediaLink: string;
    eventNotes: string;
    date: string;
    time: string;
    fullName: string;
    phoneNumber: string;
  };
  crm: {
    title: string;
    addCustomer: string;
    fullName: string;
    phoneNumber: string;
    socialLinkEmail: string;
    paymentStatus: string;
    paymentAmount: string;
    dates: string;
    comment: string;
    attachments: string;
    actions: string;
    notPaid: string;
    paidPartly: string;
    paidFully: string;
    yes: string;
    no: string;
    error: string;
    noDataToExport: string;
  };
}
