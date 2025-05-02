
export type Language = 'en' | 'es' | 'ka';

export interface TranslationCommon {
  success: string;
  error: string;
  warning: string;
  delete: string;
  cancel: string;
  confirm: string;
  continue: string;
  back: string;
  save: string;
  edit: string;
  loading: string;
  upload: string;
  download: string;
  required: string;
  optional: string;
  deleteConfirmMessage: string;
  email: string;
  password: string;
  retypePassword: string;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
  notes: string;
  description: string;
  title: string;
  status: string;
  date: string;
  startDate: string;
  endDate: string;
  time: string;
  startTime: string;
  endTime: string;
  duration: string;
  price: string;
  amount: string;
  currency: string;
  payment: string;
  paymentMethod: string;
  paymentStatus: string;
  total: string;
  created: string;
  updated: string;
  deleted: string;
}

export interface TranslationAuth {
  signIn: string;
  signOut: string;
  signUp: string;
  forgotPassword: string;
  resetPassword: string;
  newPassword: string;
  resetPasswordSuccess: string;
  emailVerification: string;
  emailVerificationSuccess: string;
  emailVerificationError: string;
  invalidCredentials: string;
  passwordsDontMatch: string;
  passwordResetEmailSent: string;
  errorCreatingAccount: string;
  errorLoggingIn: string;
}

export interface TranslationEvents {
  myEvents: string;
  addEvent: string;
  editEvent: string;
  deleteEvent: string;
  eventDetails: string;
  addNewEvent: string;
  createEvent: string;
  updateEvent: string;
  eventName: string;
  eventDescription: string;
  eventDate: string;
  eventTime: string;
  allEvents: string;
  upcoming: string;
  past: string;
  today: string;
  tomorrow: string;
  yesterday: string;
  day: string;
  week: string;
  month: string;
  year: string;
  allDay: string;
  noEvents: string;
  eventCreated: string;
  eventUpdated: string;
  eventDeleted: string;
}

export interface TranslationDashboard {
  welcome: string;
  overview: string;
  analytics: string;
  settings: string;
  profile: string;
  account: string;
  help: string;
  logout: string;
  notifications: string;
  messages: string;
  tasks: string;
  recentActivity: string;
  statistics: string;
}

export interface TranslationBookingEmails {
  requestSubject: string;
  requestHeading: string;
  requestIntro: string;
  requestDetails: string;
  startDate: string;
  endDate: string;
  phone: string;
  notes: string;
  email: string;
  viewDashboard: string;
  goDashboard: string;
  automatedMessage: string;
  disclaimer: string;
  approvedSubject: string;
  approvedHeading: string;
  approvedMessage: string;
  bookingDate: string;
  lookingForward: string;
  automatedApproval: string;
}

export interface TranslationEmails {
  booking: TranslationBookingEmails;
}

export interface TranslationType {
  common: TranslationCommon;
  auth: TranslationAuth;
  events: TranslationEvents;
  dashboard: TranslationDashboard;
  emails: TranslationEmails;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  t: (key: string, params?: Record<string, string | number>) => string;
}
