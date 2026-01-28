export type NotificationType = 
  | 'comment' 
  | 'chat' 
  | 'booking' 
  | 'task_reminder' 
  | 'event_reminder' 
  | 'custom_reminder';

export interface DashboardNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionData?: {
    taskId?: string;
    channelId?: string;
    eventId?: string;
    bookingId?: string;
    reminderId?: string;
  };
}

export interface DashboardNotificationEvent {
  type: NotificationType;
  title: string;
  message: string;
  actionData?: DashboardNotification['actionData'];
  /**
   * Notification routing (prevents admin/sub-user mixing and cross-user leaks)
   * - internal: authenticated dashboard user
   * - public: external/public-board sub-user
   */
  targetAudience?: 'internal' | 'public';
  /** Only for internal dashboard targeting (auth user id). */
  recipientUserId?: string;
  /** Only for public board targeting (sub-user UUID when available). */
  recipientSubUserId?: string;
  /** Public board targeting fallback (sub-user email). */
  recipientSubUserEmail?: string;
}
