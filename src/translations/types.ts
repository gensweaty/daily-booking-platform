
export type Language = 'en' | 'es' | 'ka';

export interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Simplified TranslationType that matches what we actually have
export interface TranslationType {
  common: {
    success: string;
    successMessage: string;
    error: string;
    errorOccurred: string;
    warning: string;
    cancel: string;
    delete: string;
    saving: string;
    copiedToClipboard: string;
    deleteSuccess: string;
    loading?: string;
    update?: string;
    add?: string;
    save?: string;
    create?: string;
    authRequired?: string;
    select?: string;
    fileDeleted?: string;
    new?: string;
    close?: string;
    logout?: string;
    search?: string;
    clear?: string;
    viewAll?: string;
    today?: string;
    yesterday?: string;
    tomorrow?: string;
    thisWeek?: string;
    nextWeek?: string;
    thisMonth?: string;
    nextMonth?: string;
    all?: string;
    pending?: string;
    approved?: string;
    rejected?: string;
    partlyPaid?: string;
    fullyPaid?: string;
    notPaid?: string;
    confirm?: string;
    redo?: string;
    filters?: string;
    applyFilters?: string;
    resetFilters?: string;
    export?: string;
    import?: string;
    selectAll?: string;
    deselectAll?: string;
    and?: string;
    supportedFormats?: string;
    deleteConfirmMessage?: string;
    noDescription?: string;
    deleteConfirmTitle?: string;
    missingUserInfo?: string;
    refreshing?: string;
    copyError?: string;
    deleteError?: string;
    submitting?: string;
    rateLimitReached?: string;
    waitBeforeBooking?: string;
    rateLimitMessage?: string;
    waitTimeRemaining?: string;
    of?: string;
    attachments?: string;
    request?: string;
    requests?: string;
    backToHome?: string;
  };
  tasks: {
    addTask: string;
    editTask: string;
    taskTitle: string;
    taskDescription: string;
    taskAdded: string;
    taskUpdated: string;
    taskDeleted: string;
    taskArchived: string;
    archive: string;
    deleteTask: string;
    deleteTaskConfirmTitle: string;
    deleteTaskConfirmation: string;
    emailReminder: string;
    emailReminderDescription: string;
  };
  bookings: {
    requestSubmitted: string;
    requestSubmittedDescription: string;
    requestApproved: string;
    requestRejected: string;
    requestDeleted: string;
    newRequest: string;
    pendingRequestsCount: string;
  };
  events: {
    eventCreated: string;
    recurringEventCreated: string;
    eventUpdated: string;
    eventDeleted: string;
    eventSeriesDeleted: string;
    editEvent?: string;
    addEvent?: string;
  };
  notes: {
    noteAdded: string;
    noteAddedDescription: string;
    noteUpdated: string;
    noteDeleted: string;
  };
  reminders: {
    reminderCreated: string;
  };
  dashboard: {
    exportSuccessful: string;
    exportSuccessMessage: string;
  };
}
