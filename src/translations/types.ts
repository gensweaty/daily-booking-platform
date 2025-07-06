
export type Language = 'en' | 'es' | 'ka';

export interface TranslationType {
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    search: string;
    loading: string;
    attachments: string;
    selectFile: string;
    fileSelected: string;
    yes: string;
    no: string;
    accept: string;
    reject: string;
    approve: string;
    pending: string;
    completed: string;
    viewDetails: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    close: string;
  };

  recurring: {
    doesNotRepeat: string;
    daily: string;
    weekly: string;
    biweekly: string;
    monthly: string;
    yearly: string;
    weeklyOn: string;
    biweeklyOn: string;
    monthlyOnDay: string;
    annuallyOn: string;
    deleteRecurringEvent: string;
    isRecurringEvent: string;
    deleteThisEventOnly: string;
    deleteEntireSeries: string;
    repeatUntil: string;
    repeat: string;
  };

  months: {
    january: string;
    february: string;
    march: string;
    april: string;
    may: string;
    june: string;
    july: string;
    august: string;
    september: string;
    october: string;
    november: string;
    december: string;
  };

  auth: {
    signIn: string;
    signUp: string;
    signOut: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    resetPassword: string;
    createAccount: string;
    haveAccount: string;
    noAccount: string;
    welcomeBack: string;
    getStarted: string;
    resetInstructions: string;
    checkEmail: string;
  };

  navigation: {
    dashboard: string;
    tasks: string;
    notes: string;
    calendar: string;
    reminders: string;
    customers: string;
    statistics: string;
    business: string;
    settings: string;
  };

  dashboard: {
    welcome: string;
    quickActions: string;
    recentActivity: string;
    upcomingTasks: string;
    todayEvents: string;
  };

  tasks: {
    allTasks: string;
    addTask: string;
    newTask: string;
    taskTitle: string;
    taskDescription: string;
    dueDate: string;
    status: string;
    priority: string;
    todo: string;
    inProgress: string;
    done: string;
    high: string;
    medium: string;
    low: string;
    noTasks: string;
    taskCreated: string;
    taskUpdated: string;
    taskDeleted: string;
  };

  notes: {
    allNotes: string;
    addNote: string;
    newNote: string;
    noteTitle: string;
    noteContent: string;
    noNotes: string;
    noteCreated: string;
    noteUpdated: string;
    noteDeleted: string;
    searchNotes: string;
  };

  calendar: {
    month: string;
    week: string;
    day: string;
    today: string;
    previous: string;
    next: string;
    addEvent: string;
    editEvent: string;
    deleteEvent: string;
    noEvents: string;
  };

  events: {
    title: string;
    fullName: string;
    phoneNumber: string;
    socialLinkEmail: string;
    eventNotes: string;
    addEventNotes: string;
    dateAndTime: string;
    start: string;
    end: string;
    paymentStatus: string;
    selectPaymentStatus: string;
    paymentAmount: string;
    eventCreated: string;
    eventUpdated: string;
    eventDeleted: string;
  };

  reminders: {
    allReminders: string;
    addReminder: string;
    newReminder: string;
    reminderTitle: string;
    reminderDescription: string;
    remindAt: string;
    noReminders: string;
    reminderCreated: string;
    reminderDeleted: string;
  };

  customers: {
    allCustomers: string;
    addCustomer: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    noCustomers: string;
    customerCreated: string;
    customerUpdated: string;
    customerDeleted: string;
  };

  statistics: {
    overview: string;
    totalTasks: string;
    completedTasks: string;
    totalEvents: string;
    totalCustomers: string;
    thisMonth: string;
    lastMonth: string;
    growth: string;
  };

  business: {
    profile: string;
    businessName: string;
    description: string;
    contactInfo: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    profileUpdated: string;
  };

  settings: {
    general: string;
    notifications: string;
    account: string;
    privacy: string;
    language: string;
    theme: string;
    light: string;
    dark: string;
    system: string;
  };

  crm: {
    notPaid: string;
    paidPartly: string;
    paidFully: string;
  };
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}
