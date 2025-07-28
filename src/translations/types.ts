export type Language = 'en' | 'es' | 'ka';

export interface TranslationType {
  nav: {
    dashboard: string;
    tasks: string;
    notes: string;
    reminders: string;
    calendar: string;
    statistics: string;
    customers: string;
    profile: string;
    settings: string;
    signOut: string;
    archivedTasks: string;
    business: string;
  };
  hero: {
    title: string;
    subtitle: string;
    getStarted: string;
    learnMore: string;
  };
  features: {
    title: string;
    tasks: {
      title: string;
      description: string;
    };
    notes: {
      title: string;
      description: string;
    };
    reminders: {
      title: string;
      description: string;
    };
    calendar: {
      title: string;
      description: string;
    };
  };
  booking: {
    title: string;
    selectDate: string;
    selectTime: string;
    fullName: string;
    email: string;
    phone: string;
    message: string;
    book: string;
    success: string;
    error: string;
    businessNotFound: string;
    invalidDate: string;
    invalidTime: string;
    nameRequired: string;
    emailRequired: string;
    phoneRequired: string;
    invalidEmail: string;
    pastDate: string;
    timeSlotTaken: string;
    businessHours: string;
    loading: string;
    availableSlots: string;
    noAvailableSlots: string;
    selectTimeSlot: string;
    bookingConfirmation: string;
    appointmentDetails: string;
    dateTime: string;
    contactInfo: string;
    additionalInfo: string;
    confirmBooking: string;
    cancel: string;
    backToSelection: string;
  };
  events: {
    addEvent: string;
    submitBookingRequest: string;
    fullNameRequired: string;
    fullName: string;
    phoneNumber: string;
    paymentStatus: string;
    selectPaymentStatus: string;
    paymentAmount: string;
    socialNetworkLink: string;
    eventNotes: string;
    eventName: string;
    startDate: string;
    endDate: string;
    editEvent: string;
    eventCreated: string;
    eventUpdated: string;
    eventDeleted: string;
    seriesDeleted: string;
    recurringEventCreated: string;
    deleteEventConfirmTitle: string;
    deleteEventConfirmMessage: string;
    deleteSeriesConfirmTitle: string;
    deleteSeriesConfirmMessage: string;
    deleteThis: string;
    deleteSeries: string;
    isRecurring: string;
    repeatPattern: string;
    repeatUntil: string;
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
    addAdditionalPerson: string;
    additionalPersons: string;
    createdAtLabel: string;
    lastUpdatedLabel: string;
  };
  tasks: {
    title: string;
    dueDate: string;
    priority: string;
    high: string;
    medium: string;
    low: string;
    completed: string;
    pending: string;
    addTask: string;
    editTask: string;
    taskCreated: string;
    taskUpdated: string;
    taskDeleted: string;
    deleteTaskConfirmTitle: string;
    deleteTaskConfirmMessage: string;
    deleteThis: string;
    deleteSeries: string;
    archivedTasks: string;
    archiveTask: string;
    unarchiveTask: string;
    taskArchived: string;
    taskUnarchived: string;
    deleteTask: string;
    cancel: string;
    confirm: string;
    description: string;
    createdAtLabel: string;
    lastUpdatedLabel: string;
  };
  notes: {
    title: string;
    addNote: string;
    editNote: string;
    noteCreated: string;
    noteUpdated: string;
    noteDeleted: string;
    deleteNoteConfirmTitle: string;
    deleteNoteConfirmMessage: string;
    deleteThis: string;
  };
  reminders: {
    title: string;
    addReminder: string;
    editReminder: string;
    reminderCreated: string;
    reminderUpdated: string;
    reminderDeleted: string;
    deleteReminderConfirmTitle: string;
    deleteReminderConfirmMessage: string;
    deleteThis: string;
    time: string;
    date: string;
  };
  calendar: {
    title: string;
  };
  statistics: {
    title: string;
  };
  customers: {
    title: string;
    addCustomer: string;
    editCustomer: string;
    customerCreated: string;
    customerUpdated: string;
    customerDeleted: string;
    deleteCustomerConfirmTitle: string;
    deleteCustomerConfirmMessage: string;
    deleteThis: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  profile: {
    title: string;
    editProfile: string;
    profileUpdated: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  settings: {
    title: string;
    editSettings: string;
    settingsUpdated: string;
    language: string;
    theme: string;
  };
  common: {
    loading: string;
    success: string;
    error: string;
    update: string;
    add: string;
    edit: string;
    delete: string;
    cancel: string;
    confirm: string;
    authRequired: string;
  };
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}
