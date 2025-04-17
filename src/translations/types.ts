
export type Language = 'en' | 'es';

export interface TranslationType {
  nav: {
    signin: string;
    startJourney: string;
    contact: string;
    pricing?: string;
    features?: string;
    home?: string;
  };
  hero: {
    title: string;
    subtitle: string;
    description: string;
  };
  features: {
    title: string;
    subtitle?: string;
    mainTitle?: string;
    booking?: string;
    crm?: string;
    analytics?: string;
    tasks?: string;
    website?: string;
    ownBookingWebsite?: string;
    businessTitle?: string;
    calendar?: {
      title?: string;
      description?: string;
    };
    crm?: {
      title?: string;
      description?: string;
    };
    tasks?: {
      title?: string;
      description?: string;
    };
    analytics?: {
      title?: string;
      description?: string;
    };
  };
  booking?: {
    title?: string;
    description?: string;
    feature1?: string;
    feature2?: string;
    feature3?: string;
    feature4?: string;
    feature5?: string;
    requestSubmitted?: string;
    yourEmailPlaceholder?: string;
    rateLimitExceeded?: string;
    rateLimitMessage?: string;
  };
  analytics?: {
    title?: string;
    description?: string;
    feature1?: string;
    feature2?: string;
    feature3?: string;
    feature4?: string;
    feature5?: string;
  };
  crm?: {
    title?: string;
    description?: string;
    feature1?: string;
    feature2?: string;
    feature3?: string;
    feature4?: string;
    feature5?: string;
    notPaid?: string;
    paidPartly?: string;
    paidFully?: string;
  };
  tasks?: {
    title?: string;
    description?: string;
    feature1?: string;
    feature2?: string;
    feature3?: string;
    feature4?: string;
    feature5?: string;
  };
  website?: {
    title?: string;
    description?: string;
    feature1?: string;
    feature2?: string;
    feature3?: string;
    feature4?: string;
    feature5?: string;
  };
  cta?: {
    title?: string;
    subtitle?: string;
    button?: string;
  };
  footer: {
    copyright: string;
    terms?: string;
    privacy?: string;
    description?: string;
    navigation?: string;
    legal?: string;
    termsAndPrivacy?: string;
    rights?: string;
  };
  business?: {
    events?: string;
    health?: string;
    sports?: string;
    beauty?: string;
    personal?: string;
    education?: string;
    eventsDesc?: string;
    healthDesc?: string;
    sportsDesc?: string;
    beautyDesc?: string;
    personalDesc?: string;
    educationDesc?: string;
  };
  dashboard?: {
    welcome?: string;
    greeting?: string;
    goodMorning?: string;
    goodAfternoon?: string;
    goodEvening?: string;
    overview?: string;
    calendar?: string;
    bookingCalendar?: string;
    tasks?: string;
    reminders?: string;
    notes?: string;
    business?: string;
    stats?: string;
    statistics?: string;
    crm?: string;
    signOut?: string;
    darkMode?: string;
    lightMode?: string;
    systemMode?: string;
    more?: string;
    addEvent?: string;
    day?: string;
    week?: string;
    month?: string;
    totalTasks?: string;
    completed?: string;
    inProgress?: string;
    todo?: string;
    totalEvents?: string;
    partlyPaid?: string;
    fullyPaid?: string;
    exportSuccessful?: string;
    exportSuccessMessage?: string;
    changePassword?: string;
    subtitle?: string;
    profile?: string;
    category?: string;
    details?: string;
    additionalInfo?: string;
    taskStatistics?: string;
    eventStatistics?: string;
    financialSummary?: string;
    summaryStatistics?: string;
    eventsData?: string;
  };
  common?: {
    loading?: string;
    success?: string;
    error?: string;
    cancel?: string;
    submitting?: string;
    edit?: string;
    delete?: string;
    save?: string;
    fullName?: string;
    fileDeleted?: string;
  };
  events?: {
    addEvent?: string;
    editEvent?: string;
    deleteEvent?: string;
    eventTitle?: string;
    eventNotes?: string;
    addEventNotes?: string;
    startDateTime?: string;
    endDateTime?: string;
    submitBookingRequest?: string;
    fullNameRequired?: string;
    phoneNumber?: string;
    paymentStatus?: string;
    selectPaymentStatus?: string;
    paymentAmount?: string;
  };
  calendar?: {
    today?: string;
    month?: string;
    week?: string;
    day?: string;
    agenda?: string;
    allDay?: string;
    attachment?: string;
  };
  contact?: {
    title?: string;
    subtitle?: string;
    description?: string;
    name?: string;
    email?: string;
    message?: string;
    send?: string;
  };
  pricing?: {
    title?: string;
    subtitle?: string;
    free?: {
      title?: string;
      description?: string;
      price?: string;
      features?: string[];
    };
    premium?: {
      title?: string;
      description?: string;
      price?: string;
      features?: string[];
    };
    enterprise?: {
      title?: string;
      description?: string;
      price?: string;
      features?: string[];
    };
  };
  auth?: {
    signupTitle?: string;
    signinTitle?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    name?: string;
    signUp?: string;
    signIn?: string;
    signOut?: string;
    forgotPassword?: string;
    resetPassword?: string;
    newPassword?: string;
    updatePassword?: string;
    passwordRequirements?: string;
    emailRequired?: string;
    passwordRequired?: string;
    nameRequired?: string;
    passwordMismatch?: string;
    invalidEmail?: string;
  };
}

export type TranslationKey = keyof TranslationType;
