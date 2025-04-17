
export type Language = 'en' | 'es';

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

export interface TranslationType {
  nav: {
    signin: string;
    startJourney: string;
    contact: string;
  };
  hero: {
    title: string;
    subtitle: string;
    description: string;
  };
  features: {
    title: string;
    mainTitle: string;
    booking: string;
    tasks: string;
    crm: string;
    analytics: string;
    website: string;
    ownBookingWebsite: string;
    businessTitle: string;
  };
  booking: {
    title: string;
    description: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
  };
  analytics: {
    title: string;
    description: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
    feature5: string;
  };
  crm: {
    title: string;
    description: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
    feature5: string;
  };
  tasks: {
    title: string;
    description: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
    feature5: string;
  };
  website: {
    title: string;
    description: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
    feature5: string;
  };
  cta: {
    title: string;
    subtitle: string;
    button: string;
  };
  footer: {
    copyright: string;
    terms: string;
    privacy: string;
    description?: string;
    navigation?: string;
    legal?: string;
    termsAndPrivacy?: string;
    rights?: string;
  };
  business: {
    events: string;
    health: string;
    sports: string;
    beauty: string;
    personal: string;
    education: string;
    eventsDesc: string;
    healthDesc: string;
    sportsDesc: string;
    beautyDesc: string;
    personalDesc: string;
    educationDesc: string;
  };
  dashboard: {
    welcome: string;
    greeting: string;
    goodMorning: string;
    goodAfternoon: string;
    goodEvening: string;
    overview: string;
    calendar: string;
    bookingCalendar: string;
    tasks: string;
    reminders: string;
    notes: string;
    business: string;
    stats: string;
    statistics: string;
    crm: string;
    signOut: string;
    darkMode: string;
    lightMode: string;
    systemMode: string;
    more: string;
    addEvent: string;
    day: string;
    week: string;
    month: string;
    totalTasks: string;
    completed: string;
    inProgress: string;
    todo: string;
    totalEvents: string;
    partlyPaid: string;
    fullyPaid: string;
    totalIncome: string;
    fromAllEvents: string;
    exportSuccessful: string;
    exportSuccessMessage: string;
    changePassword: string;
    subtitle: string;
    profile: string;
    category: string;
    details: string;
    additionalInfo: string;
    taskStatistics: string;
    eventStatistics: string;
    financialSummary: string;
    summaryStatistics: string;
    eventsData: string;
  };
  auth: {
    welcome: string;
    description: string;
    signInButton: string;
    signUpButton: string;
    emailLabel: string;
    passwordLabel: string;
    passwordRequirements: string;
    confirmPasswordLabel: string;
    usernameLabel: string;
    passwordsDoNotMatch: string;
    passwordTooShort: string;
    signingUp: string;
    loading: string;
    forgotPassword: string;
  };
  common: {
    success: string;
    fileDeleted: string;
    description: string;
    noDescription: string;
  };
}

export type TranslationKey = keyof TranslationType;
